// Расписания сервера по Asia/Bishkek. Один тик каждые 30 секунд решает, что пора сделать;
// «уже сделано сегодня» хранится в bot_settings.last_sent (переживает перезапуск).
// Пятница — день восстановления: ни одного сообщения (бэкап идёт).
import cron from 'node-cron';
import { APP_TZ, addDays, bishkekHM, dayOfWeek, isRecoveryDay, monthKey, todayStr } from '../../shared/time';
import type { BotSettings, Task } from '../../shared/types';
import type { Db } from './db';
import { TEXT, morningMessage } from './messages';
import { BLOCKS_PER_DAY, BREAK_MIN, WORK_MIN, computeTimer, settleTimer } from '../../shared/timer';

/** Точки вызова вечернего разговора и отчётов (реализация — src/conversation) */
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
  /**
   * Сколько тик ждёт вызов разговора (startEvening, отчёты, напоминание), мс. Разговор может стоять
   * в своём замке за долгим анализом Claude; дольше тик не ждёт — вызов идёт дальше в фоне,
   * а следующие тики (таймер, будильники) выходят вовремя.
   */
  conversationWaitMs?: number;
}

export const CONVERSATION_WAIT_MS = 20_000;

/** Абсолютный потолок напоминаний о публикациях в день («3 максмум») */
export const MAX_PUBLICATION_REMINDERS = 3;

const MORNING_WINDOW_MIN = 60;
const EVENING_WINDOW_MIN = 60;
const ALARM_WINDOW_MIN = 15;
const BACKUP_HM = '03:00';
/** Сколько после начала отдыха ещё можно сказать «пора на отдых», если сайт сам перевёл таймер */
const BREAK_START_GRACE_SEC = 180;
/** Событие таймера старше этого (бот был выключен) — не сообщать задним числом */
const STALE_TIMER_EVENT_MS = 5 * 60_000;

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
  const persist = async () => {
    try {
      await deps.db.saveBotSettings({ lastSent: { ...lastSent } });
    } catch (e) {
      log(`Не удалось сохранить last_sent: ${(e as Error).message}`);
    }
  };
  const mark = async (key: string, value = today) => {
    mem!.add(`${key}=${value}`);
    lastSent[key] = value;
    await persist();
  };
  /** Снять отметку: вернуть прежнее значение ключа */
  const unmark = async (key: string, value: string, prev: string | undefined) => {
    mem!.delete(`${key}=${value}`);
    if (lastSent[key] !== value) return;
    if (prev === undefined) delete lastSent[key];
    else lastSent[key] = prev;
    await persist();
  };
  /**
   * Отметить «сделано» и выполнить. Отметка ставится до отправки (второй тик не пошлёт дубль),
   * но при `send() === false` или ошибке снимается — следующий тик в окне повторит.
   */
  const once = async (name: string, key: string, value: string, fn: () => Promise<boolean | void>): Promise<boolean> => {
    const prev = lastSent[key];
    await mark(key, value);
    let ok = false;
    try {
      ok = (await fn()) !== false;
      if (!ok) log(`${name}: не доставлено, повторю следующим тиком`);
    } catch (e) {
      log(`${name}: ${(e as Error).message}`);
    }
    if (!ok) await unmark(key, value, prev);
    return ok;
  };
  const step = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      log(`${name}: ${(e as Error).message}`);
    }
  };
  const waitMs = deps.conversationWaitMs ?? CONVERSATION_WAIT_MS;
  /**
   * Вызов разговора с пределом ожидания. Не успел — тик идёт дальше, вызов продолжается в фоне;
   * если он потом упадёт, отметка снимается по свежим настройкам (следующий тик повторит).
   */
  const conversationCall = (name: string, key: string, fn: () => Promise<void>) =>
    once(name, key, today, async () => {
      const call = fn();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const waited = await Promise.race([
        call.then(() => 'done' as const),
        new Promise<'late'>((resolve) => (timer = setTimeout(() => resolve('late'), waitMs))),
      ]).finally(() => clearTimeout(timer));
      if (waited === 'late') {
        log(`${name}: разговор занят, продолжаю в фоне`);
        call.catch(async (e) => {
          log(`${name}: ${(e as Error).message}`);
          mem!.delete(`${key}=${today}`);
          try {
            const fresh = await deps.db.getBotSettings();
            const ls = { ...(fresh?.lastSent ?? {}) };
            if (ls[key] === today) {
              delete ls[key];
              await deps.db.saveBotSettings({ lastSent: ls });
            }
          } catch (e2) {
            log(`Не удалось снять отметку ${key}: ${(e2 as Error).message}`);
          }
        });
      }
    });

  // 03:00 — бэкап (в любой день, это не сообщение)
  if (inWindow(nowMin, hmToMin(BACKUP_HM, BACKUP_HM), 60) && !done('backup')) {
    await once('Бэкап', 'backup', today, () => deps.backup(now));
  }

  // Пятница — тишина. Без привязанного чата писать некому.
  if (isRecoveryDay(today) || !settings?.chatId) return;

  const morningMin = hmToMin(settings.morningHm, '08:00');
  const eveningMin = hmToMin(settings.eveningHm, '21:00');

  // Утро: одно короткое сообщение без вопросов
  if (inWindow(nowMin, morningMin, MORNING_WINDOW_MIN)) {
    if (!done('morning')) {
      await once('Утро', 'morning', today, async () => {
        const plan = (await deps.db.getKv<DayPlan>(`plan:${today}`)) ?? {};
        let mainTask = plan.mainTask ?? null;
        if (!mainTask) {
          const tasks = await deps.db.listTasks();
          const byId = plan.mainTaskId ? tasks.find((t) => t.id === plan.mainTaskId) : null;
          mainTask = (byId ?? pickMainTask(tasks, today))?.title ?? null;
        }
        return deps.send(
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
        const memKey = `pub=${today}|${r.channelId}`;
        if (sentIds.includes(r.channelId) || mem!.has(memKey)) continue;
        mem!.add(memKey);
        sentIds.push(r.channelId);
        const ok = await once('Публикации', 'publications', `${today}|${sentIds.join(',')}`, () => deps.send(r.text));
        if (!ok) {
          mem!.delete(memKey);
          sentIds.pop();
        }
      }
    });
  }

  // Таймер: конец работы / отдыха — один раз
  await step('Таймер', () => checkTimer(deps, now, today, lastSent, done, mark, once, mem!));

  // Будильники здоровья
  await step('Будильники', async () => {
    const alarms = await deps.db.listHealthAlarms();
    for (const a of alarms) {
      if (!a.enabled || !a.time) continue;
      if (!inWindow(nowMin, hmToMin(a.time, '99:99'), ALARM_WINDOW_MIN)) continue;
      const key = `alarm:${a.id}`;
      if (done(key)) continue;
      if (a.repeatDaily === false && lastSent[key]) continue;
      await once('Будильник', key, today, () => deps.send(TEXT.healthAlarm(a.title)));
    }
  });

  // Вечер: четверг — «завтра восстановление», затем разговор и отчёты
  if (inWindow(nowMin, eveningMin, EVENING_WINDOW_MIN)) {
    const dow = dayOfWeek(today);
    if (dow === 4 && !done('thursday')) {
      await once('Четверг', 'thursday', today, () => deps.send(TEXT.thursday));
    }
    if (!done('evening')) {
      await conversationCall('Вечер', 'evening', () => deps.conversation.startEvening(today));
    }
    if (dow === 0 && !done('weekly')) {
      await conversationCall('Отчёт недели', 'weekly', () => deps.conversation.weeklyReport(today));
    }
    if (monthKey(addDays(today, 1)) !== monthKey(today) && !done('monthly')) {
      await conversationCall('Отчёт месяца', 'monthly', () => deps.conversation.monthlyReport(today));
    }
  }

  // 22:00 — одно напоминание о пропущенном вечере (решает разговор)
  if (inWindow(nowMin, eveningMin + EVENING_WINDOW_MIN, 60) && !done('evening_reminder')) {
    await conversationCall('Напоминание 22:00', 'evening_reminder', () => deps.conversation.eveningReminder(today));
  }
}

type Once = (name: string, key: string, value: string, fn: () => Promise<boolean | void>) => Promise<boolean>;

async function checkTimer(
  deps: SchedulerDeps,
  now: Date,
  today: string,
  lastSent: Record<string, string>,
  done: (key: string, value?: string) => boolean,
  mark: (key: string, value?: string) => Promise<void>,
  once: Once,
  mem: Set<string>,
): Promise<void> {
  const t = await deps.db.getTimerState();
  if (!t || !t.running || t.phase === 'idle' || !t.startedAt || Number.isNaN(Date.parse(t.startedAt))) return;
  const nowMs = now.getTime();

  // Сайт закрыт — бот сам «доводит» таймер, как сайт: истёкшая работа становится отдыхом (shared/timer).
  // Секундомер не истекает (settleTimer его не трогает) и в отдых не переходит: «пора на отдых» ему не шлём.
  const s = settleTimer(t, nowMs);
  const settledHere = s !== t;

  if (settledHere) {
    const id = `work:${t.startedAt}`;
    // Отдых начинается в момент конца работы: если это было давно, «пора на отдых» уже не к месту
    const staleWorkEnd = !!s.startedAt && nowMs - Date.parse(s.startedAt) > STALE_TIMER_EVENT_MS;
    if (!t.notifiedEnd && !done('timer_last', id) && staleWorkEnd) {
      await mark('timer_last', id);
      await mark('timer_work_end', now.toISOString());
    } else if (!t.notifiedEnd && !done('timer_last', id)) {
      const workedSec = (Number(t.targetMin) > 0 ? Number(t.targetMin) : WORK_MIN) * 60;
      await once('Таймер', 'timer_last', id, async () => {
        const ok = await deps.send(TEXT.workOver(workedSec));
        if (!ok) return false;
        await mark('timer_work_end', now.toISOString());
        await deps.db.markTimerNotified(t.startedAt);
        return true;
      });
    }
  }
  if (s.phase !== 'break' || !s.startedAt) return;
  const v = computeTimer(s, nowMs);
  const breakStarted = s.startedAt;

  if (!settledHere) {
    // Сайт сам перевёл таймер в отдых, а бот ещё не сказал «пора на отдых»
    const startedMs = Date.parse(breakStarted);
    const announced = lastSent.timer_work_end ? Date.parse(lastSent.timer_work_end) : NaN;
    const freshBreak = nowMs - startedMs <= BREAK_START_GRACE_SEC * 1000;
    const alreadyAnnounced = !Number.isNaN(announced) && announced >= startedMs - 5 * 60_000;
    const breakStartId = `breakstart:${breakStarted}`;
    if (freshBreak && !alreadyAnnounced && !v.expired && !mem.has(breakStartId)) {
      mem.add(breakStartId);
      const sessions = await deps.db.listFocusSessions(s.date ?? today).catch(() => []);
      const last = sessions.sort((a, b) => (a.startedAt ?? '').localeCompare(b.startedAt ?? '')).at(-1);
      const ok = await deps.send(TEXT.workOver((last?.minutes ?? WORK_MIN) * 60));
      if (ok) await mark('timer_work_end', now.toISOString());
      else mem.delete(breakStartId);
    }
  }

  if (v.expired) {
    const id = `break:${breakStarted}`;
    // notified_end строки в базе относится к ней самой: у отдыха, посчитанного здесь, его ещё нет
    if ((!settledHere && t.notifiedEnd) || done('timer_last', id)) return;
    // Отдых, который к этому тику уже давно кончился (бот был выключен), — без сообщения
    const breakEndMs = Date.parse(breakStarted) + (Number(s.targetMin) > 0 ? Number(s.targetMin) : BREAK_MIN) * 60_000;
    if (settledHere && nowMs - breakEndMs > STALE_TIMER_EVENT_MS) {
      await mark('timer_last', id);
      return;
    }
    await once('Таймер', 'timer_last', id, async () => {
      const ok = await deps.send(TEXT.breakOver((s.blockIndex ?? 0) + 1, BLOCKS_PER_DAY));
      if (ok && !settledHere) await deps.db.markTimerNotified(breakStarted);
      return ok;
    });
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
