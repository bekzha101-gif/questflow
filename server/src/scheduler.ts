// Расписания сервера по Asia/Bishkek. Один тик каждые 30 секунд решает, что пора сделать;
// «уже сделано сегодня» хранится в bot_settings.last_sent (переживает перезапуск).
// Пятница — день восстановления: ни одного сообщения (бэкап идёт).
import cron from 'node-cron';
import { APP_TZ, addDays, bishkekHM, dayOfWeek, isRecoveryDay, monthKey, todayStr } from '../../shared/time';
import type { BotSettings, Task } from '../../shared/types';
import type { Db } from './db';
import { TEXT, morningMessage } from './messages';
import { BLOCKS_PER_DAY, WORK_MIN, timerProgress } from './timerWatch';

/** Точки вызова вечернего разговора и отчётов (наполняет таск 09, см. conversationStub.ts) */
export interface ConversationApi {
  startEvening(date: string): Promise<void>;
  /** 22:00 — одно напоминание, если вечер пропущен */
  eveningReminder(date: string): Promise<void>;
  weeklyReport(date: string): Promise<void>;
  monthlyReport(date: string): Promise<void>;
  /** Любое сообщение владельца, кроме команд бота */
  handleUpdate(msg: IncomingMessage): Promise<void>;
}

export interface IncomingMessage {
  chatId: string;
  text?: string;
  /** file_id голосового (скачивает таск 09) */
  voiceFileId?: string;
  photoFileId?: string;
  callbackData?: string;
}

/** Напоминание о публикации (из shared/channels.remindersFor) */
export interface PublicationReminder {
  channelId: string;
  text: string;
}

export interface SchedulerDeps {
  db: Db;
  send(text: string): Promise<boolean>;
  conversation: ConversationApi;
  /** Уже упорядоченные напоминания на сегодня; лимит режет планировщик */
  remindersFor(today: string): Promise<PublicationReminder[]>;
  backup(now: Date): Promise<void>;
  log?(message: string): void;
}

/** Абсолютный потолок напоминаний о публикациях в день («3 максмум») */
export const MAX_PUBLICATION_REMINDERS = 3;

const MORNING_WINDOW_MIN = 60;
const EVENING_WINDOW_MIN = 60;
const ALARM_WINDOW_MIN = 15;
const BACKUP_HM = '03:00';
/** Сколько после начала отдыха ещё можно сказать «пора на отдых», если сайт сам перевёл таймер */
const BREAK_START_GRACE_SEC = 180;

// Память в процессе — на случай, если запись в базу не прошла (не слать дважды)
const memory = new WeakMap<SchedulerDeps, Set<string>>();

function hmToMin(hm: string | undefined, fallback: string): number {
  const v = /^\d{1,2}:\d{2}$/.test(hm ?? '') ? hm! : fallback;
  const [h, m] = v.split(':').map(Number);
  return h * 60 + m;
}

function inWindow(nowMin: number, startMin: number, len: number): boolean {
  return nowMin >= startMin && nowMin < startMin + len;
}

const PRIORITY_RANK: Record<string, number> = { p1: 1, high: 1, p2: 2, medium: 2, p3: 3, low: 3, p4: 4 };

/** Главная задача дня из задач: не покупка, не выполненная, на сегодня или просроченная */
export function pickMainTask(tasks: Task[], today: string): Task | null {
  const open = tasks.filter(
    (t) => t.type !== 'habit' && t.kind !== 'shopping' && !t.completed && t.dueDate && t.dueDate.slice(0, 10) <= today,
  );
  open.sort((a, b) => {
    const pa = PRIORITY_RANK[a.priority ?? ''] ?? 5;
    const pb = PRIORITY_RANK[b.priority ?? ''] ?? 5;
    if (pa !== pb) return pa - pb;
    const ta = a.dueDate === today ? 0 : 1;
    const tb = b.dueDate === today ? 0 : 1;
    if (ta !== tb) return ta - tb;
    return (a.dueTime ?? '99:99').localeCompare(b.dueTime ?? '99:99');
  });
  return open[0] ?? null;
}

/** План дня, который сохраняет вечерний разговор (таск 09): kv `plan:<YYYY-MM-DD>` */
export interface DayPlan {
  mainTask?: string;
  mainTaskId?: string;
  firstBlockTask?: string;
}

/** Один тик планировщика. Безопасно вызывать сколько угодно раз: всё дедуплицируется. */
export async function runTick(deps: SchedulerDeps, now: Date = new Date()): Promise<void> {
  const log = deps.log ?? (() => {});
  const today = todayStr(now);
  const { h, m } = bishkekHM(now);
  const nowMin = h * 60 + m;
  let mem = memory.get(deps);
  if (!mem) memory.set(deps, (mem = new Set()));

  let settings: BotSettings | null = null;
  try {
    settings = await deps.db.getBotSettings();
  } catch (e) {
    log(`Не удалось прочитать bot_settings: ${(e as Error).message}`);
  }
  const lastSent: Record<string, string> = { ...(settings?.lastSent ?? {}) };

  const done = (key: string, value = today) => lastSent[key] === value || mem!.has(`${key}=${value}`);
  const mark = async (key: string, value = today) => {
    mem!.add(`${key}=${value}`);
    lastSent[key] = value;
    try {
      await deps.db.saveBotSettings({ lastSent: { ...lastSent } });
    } catch (e) {
      log(`Не удалось сохранить last_sent: ${(e as Error).message}`);
    }
  };
  const step = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      log(`${name}: ${(e as Error).message}`);
    }
  };

  // 03:00 — бэкап (в любой день, это не сообщение)
  if (inWindow(nowMin, hmToMin(BACKUP_HM, BACKUP_HM), 60) && !done('backup')) {
    await mark('backup');
    await step('Бэкап', () => deps.backup(now));
  }

  // Пятница — тишина. Без привязанного чата писать некому.
  if (isRecoveryDay(today) || !settings?.chatId) return;

  const morningMin = hmToMin(settings.morningHm, '08:00');
  const eveningMin = hmToMin(settings.eveningHm, '21:00');

  // Утро: одно короткое сообщение без вопросов
  if (inWindow(nowMin, morningMin, MORNING_WINDOW_MIN)) {
    if (!done('morning')) {
      await step('Утро', async () => {
        await mark('morning');
        const plan = (await deps.db.getKv<DayPlan>(`plan:${today}`)) ?? {};
        let mainTask = plan.mainTask ?? null;
        if (!mainTask) {
          const tasks = await deps.db.listTasks();
          const byId = plan.mainTaskId ? tasks.find((t) => t.id === plan.mainTaskId) : null;
          mainTask = (byId ?? pickMainTask(tasks, today))?.title ?? null;
        }
        await deps.send(
          morningMessage({ mainTask, firstBlockTask: plan.firstBlockTask, blocksPerDay: BLOCKS_PER_DAY, workMin: WORK_MIN }),
        );
      });
    }
    // Напоминания о публикациях — после утра, не больше лимита в день
    await step('Публикации', async () => {
      const limit = Math.min(MAX_PUBLICATION_REMINDERS, Math.max(0, settings!.reminderLimit ?? MAX_PUBLICATION_REMINDERS));
      const [day, list] = (lastSent.publications ?? '').split('|');
      const sentIds = day === today && list ? list.split(',') : [];
      if (sentIds.length >= limit) return;
      const reminders = await deps.remindersFor(today);
      for (const r of reminders) {
        if (sentIds.length >= limit) break;
        if (sentIds.includes(r.channelId) || mem!.has(`pub=${today}|${r.channelId}`)) continue;
        mem!.add(`pub=${today}|${r.channelId}`);
        sentIds.push(r.channelId);
        await mark('publications', `${today}|${sentIds.join(',')}`);
        await deps.send(r.text);
      }
    });
  }

  // Таймер: конец работы / отдыха — один раз
  await step('Таймер', () => checkTimer(deps, now, today, lastSent, done, mark, mem!));

  // Будильники здоровья
  await step('Будильники', async () => {
    const alarms = await deps.db.listHealthAlarms();
    for (const a of alarms) {
      if (!a.enabled || !a.time) continue;
      if (!inWindow(nowMin, hmToMin(a.time, '99:99'), ALARM_WINDOW_MIN)) continue;
      const key = `alarm:${a.id}`;
      if (done(key)) continue;
      if (a.repeatDaily === false && lastSent[key]) continue;
      await mark(key);
      await deps.send(TEXT.healthAlarm(a.title));
    }
  });

  // Вечер: четверг — «завтра восстановление», затем разговор и отчёты
  if (inWindow(nowMin, eveningMin, EVENING_WINDOW_MIN)) {
    const dow = dayOfWeek(today);
    if (dow === 4 && !done('thursday')) {
      await mark('thursday');
      await step('Четверг', async () => void (await deps.send(TEXT.thursday)));
    }
    if (!done('evening')) {
      await mark('evening');
      await step('Вечер', () => deps.conversation.startEvening(today));
    }
    if (dow === 0 && !done('weekly')) {
      await mark('weekly');
      await step('Отчёт недели', () => deps.conversation.weeklyReport(today));
    }
    if (monthKey(addDays(today, 1)) !== monthKey(today) && !done('monthly')) {
      await mark('monthly');
      await step('Отчёт месяца', () => deps.conversation.monthlyReport(today));
    }
  }

  // 22:00 — одно напоминание о пропущенном вечере (решает разговор)
  if (inWindow(nowMin, eveningMin + EVENING_WINDOW_MIN, 60) && !done('evening_reminder')) {
    await mark('evening_reminder');
    await step('Напоминание 22:00', () => deps.conversation.eveningReminder(today));
  }
}

async function checkTimer(
  deps: SchedulerDeps,
  now: Date,
  today: string,
  lastSent: Record<string, string>,
  done: (key: string, value?: string) => boolean,
  mark: (key: string, value?: string) => Promise<void>,
  mem: Set<string>,
): Promise<void> {
  const t = await deps.db.getTimerState();
  if (!t) return;
  const p = timerProgress(t, now.getTime());
  if (!p) return;

  if (t.phase === 'work' && p.expired) {
    const id = `work:${t.startedAt}`;
    if (t.notifiedEnd || done('timer_last', id)) return;
    await mark('timer_last', id);
    await mark('timer_work_end', now.toISOString());
    await deps.send(TEXT.workOver(p.targetSec));
    await deps.db.markTimerNotified(t.startedAt);
    return;
  }

  if (t.phase === 'break') {
    const startedMs = t.startedAt ? Date.parse(t.startedAt) : NaN;
    // Сайт сам перевёл таймер в отдых, а бот ещё не сказал «пора на отдых»
    const announced = lastSent.timer_work_end ? Date.parse(lastSent.timer_work_end) : NaN;
    const freshBreak = !Number.isNaN(startedMs) && now.getTime() - startedMs <= BREAK_START_GRACE_SEC * 1000;
    const alreadyAnnounced = !Number.isNaN(announced) && announced >= startedMs - 5 * 60_000;
    const breakStartId = `breakstart:${t.startedAt}`;
    if (freshBreak && !alreadyAnnounced && !p.expired && !mem.has(breakStartId)) {
      mem.add(breakStartId);
      await mark('timer_work_end', now.toISOString());
      const sessions = await deps.db.listFocusSessions(t.date ?? today).catch(() => []);
      const last = sessions.sort((a, b) => (a.startedAt ?? '').localeCompare(b.startedAt ?? '')).at(-1);
      await deps.send(TEXT.workOver((last?.minutes ?? WORK_MIN) * 60));
    }
    if (p.expired) {
      const id = `break:${t.startedAt}`;
      if (t.notifiedEnd || done('timer_last', id)) return;
      await mark('timer_last', id);
      await deps.send(TEXT.breakOver((t.blockIndex ?? 0) + 1, BLOCKS_PER_DAY));
      await deps.db.markTimerNotified(t.startedAt);
    }
  }
}

/** Запуск: тик каждые 30 секунд по Бишкеку. Возвращает остановку. */
export function startScheduler(deps: SchedulerDeps): () => void {
  let running = false;
  const task = cron.schedule(
    '*/30 * * * * *',
    async () => {
      if (running) return; // предыдущий тик ещё идёт
      running = true;
      try {
        await runTick(deps, new Date());
      } finally {
        running = false;
      }
    },
    { timezone: APP_TZ, name: 'questflow-tick' },
  );
  return () => void task.stop();
}
