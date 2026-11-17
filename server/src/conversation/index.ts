// Вечерний разговор (21:00 по Бишкеку): машина состояний в bot_settings.conversation.
// Шаги: сон → БАДы → оценка → хорошо/лучше → привычки → задачи и шаги → цели → публикации
// (за каждый день разговора) → новые каналы (первый вечер) → воскресенье: каналы и доход →
// конец месяца: желания → план на завтра → итог и анализ Claude (+ отчёт недели/месяца).
// Каждое изменение состояния сразу сохраняется — перезапуск продолжает с того же шага.
import { RULES, eveningMissedEvent, eveningReminderDue } from '../../../shared/gamification';
import { addDays, dayOfWeek, isRecoveryDay, monthKey, todayStr, weekStart } from '../../../shared/time';
import type { ConversationApi, IncomingMessage } from '../scheduler';
import { dateLabel } from './context';
import { applyGame, closePendingDays } from './game';
import { AI_LATER, dayAnalysis, dayFactsText, monthAnalysis, monthPlainText, weekAnalysis, weekPlainText } from './reports';
import { HANDLERS, NEW_CHANNELS_KEY, saveSleepFromPhoto, type Ask, type StepCtx } from './steps';
import type { ConvState, ConversationDeps, Input, PendingAi, Step } from './types';

export type { ConversationDeps, Keyboard, Button, TelegramFiles } from './types';
export { createSupabaseStore, type ConversationStore } from './store';

export interface Conversation extends ConversationApi {
  /** Повтор отложенных анализов (Claude был недоступен). Звать раз в несколько минут. */
  tick(now?: Date): Promise<void>;
}

export const CONV_TEXT = {
  greeting: 'Вечер. Подведём день: отвечай кнопками, текстом или голосовым.',
  reminder: 'Напоминание: вечерний разговор ждёт ответа. Без ответа день останется без отчёта и HP уменьшится.',
  voiceFailed: 'Не получилось распознать голосовое. Напиши, пожалуйста, текстом.',
  stale: 'Это кнопка от прошлого вопроса. Отвечаю на текущий:',
  idle: 'Сейчас разговора нет. Вечерний разговор начнётся в 21:00; чтобы начать раньше — напиши «вечер».',
  alreadyDone: 'Сегодня итог уже подведён.',
  stepAccepted: (t: string) => `Шаг принят: ${t}.`,
  missed: (date: string, hp: number | null) =>
    `Вечер ${dateLabel(date)} пропущен${hp ? `: ${hp} HP` : ''}. Сегодня спрошу за два дня.`,
};

const RETRY_FIRST_MIN = 30;
const RETRY_MAX_TRIES = 8;

function daySteps(date: string): Step[] {
  const ids: Step['id'][] = isRecoveryDay(date)
    ? ['recovery', 'score', 'good_better']
    : ['sleep', 'supplements', 'score', 'good_better', 'habits', 'items', 'goals', 'channels'];
  return ids.map((id) => ({ id, date }));
}

function isState(v: unknown): v is ConvState {
  return !!v && typeof v === 'object' && (v as ConvState).v === 1 && Array.isArray((v as ConvState).queue);
}

export function createConversation(deps: ConversationDeps): Conversation {
  const { store } = deps;
  const nowOf = () => (deps.now ? deps.now() : new Date());
  const log = deps.log ?? (() => {});

  // Один разговор — одна очередь: сообщения, расписание и повторы не перебивают друг друга
  let chain: Promise<unknown> = Promise.resolve();
  const locked = <T>(fn: () => Promise<T>): Promise<T> => {
    const p = chain.then(fn, fn);
    chain = p.catch(() => {});
    return p;
  };

  const load = async (): Promise<ConvState | null> => {
    const v = await store.getConversation();
    return isState(v) ? v : null;
  };
  const save = (s: ConvState) => store.saveConversation(s);

  const ctxFor = (state: ConvState, now: Date): StepCtx => ({
    deps,
    store,
    now,
    today: todayStr(now),
    state,
    reply: async (text, keyboard) => void (await deps.send(text, keyboard)),
  });
  const reportCtx = (now: Date) => ({ store, ai: deps.ai, send: deps.send, now });

  const addPending = (state: ConvState, kind: PendingAi['kind'], date: string, now: Date) => {
    if (state.pendingAi.some((p) => p.kind === kind && p.date === date)) return;
    state.pendingAi.push({ kind, date, tries: 0, nextAt: new Date(now.getTime() + RETRY_FIRST_MIN * 60_000).toISOString() });
  };

  const safe = async <T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch (e) {
      log(`Разговор, ${name}: ${(e as Error).message}`);
      return fallback;
    }
  };

  async function sendWeek(state: ConvState, date: string, now: Date) {
    const rc = reportCtx(now);
    await deps.send(await weekPlainText(rc, date));
    if (!(await safe('анализ недели', () => weekAnalysis(rc, date, 'Claude о неделе'), false))) {
      await deps.send(`${AI_LATER} Шаги на следующую неделю предложу вместе с ним.`);
      addPending(state, 'week', date, now);
    }
  }

  async function sendMonth(state: ConvState, date: string, now: Date) {
    const rc = reportCtx(now);
    await deps.send(await monthPlainText(rc, date));
    if (!(await safe('анализ месяца', () => monthAnalysis(rc, date, 'Claude о месяце'), false))) {
      await deps.send(AI_LATER);
      addPending(state, 'month', date, now);
    }
  }

  /** Итог разговора: статус дней, итог дня, анализ Claude, отчёты недели и месяца */
  async function runFinal(state: ConvState, now: Date) {
    for (const d of state.dates) {
      await store.patchDay(d, { reportStatus: 'done' });
      await safe('награда за день', () => applyGame(store, { kind: 'bigdata_fill', ref: d }, now), null);
    }
    const rc = reportCtx(now);
    let facts = await dayFactsText(rc, state.date);
    if (isRecoveryDay(addDays(state.date, 1))) facts += '\nЗавтра пятница — восстановление: без работы и интернета.';
    else facts += '\nПлан на завтра сохранён — утром пришлю главную задачу.';
    await deps.send(facts);
    if (!(await safe('анализ дня', () => dayAnalysis(rc, state.date, 'Анализ дня'), false))) {
      await deps.send(AI_LATER);
      addPending(state, 'day', state.date, now);
    }
    if (state.flags.week) await sendWeek(state, state.date, now);
    if (state.flags.month) await sendMonth(state, state.flags.monthDate ?? state.date, now);
  }

  /** Задать текущий вопрос; шаги, где спрашивать нечего, пропускаются. fresh — новый вопрос (сброс курсора). */
  async function askCurrent(state: ConvState, now: Date, fresh: boolean) {
    const ctx = ctxFor(state, now);
    while (state.queue.length) {
      const step = state.queue[0];
      if (step.id === 'final') {
        state.queue.shift();
        await save(state);
        await runFinal(state, now);
        fresh = true;
        continue;
      }
      if (fresh) {
        state.seq += 1;
        state.cur = {};
      }
      const handler = HANDLERS[step.id as Exclude<Step['id'], 'final'>];
      const a: Ask | 'skip' = await safe<Ask | 'skip'>(`вопрос ${step.id}`, () => handler.ask(ctx, step, state.cur), 'skip');
      if (a === 'skip') {
        state.queue.shift();
        fresh = true;
        continue;
      }
      await save(state);
      await deps.send(a.text, a.keyboard);
      return;
    }
    state.finished = true;
    await save(state);
  }

  async function startEveningNow(date: string, now: Date) {
    const prev = await load();
    if (prev && prev.date === date) {
      if (prev.finished) return;
      // Разговор уже идёт — просто повторить текущий вопрос
      await askCurrent(prev, now, false);
      return;
    }
    await safe('итоги прошлых дней', () => closePendingDays(store, date, now), []);

    const pendingAi = prev?.pendingAi ?? [];
    const dates: string[] = [];
    const notes: string[] = [];
    const carry: ConvState = { v: 1, date, dates, startedAt: now.toISOString(), answered: false, reminded: false, finished: false, queue: [], seq: prev?.seq ?? 0, cur: {}, flags: {}, pendingAi };

    if (prev && !prev.finished && prev.date < date) {
      if (!prev.answered) {
        const ev = eveningMissedEvent(prev.date);
        const r = ev ? await safe('штраф за пропуск', () => applyGame(store, ev, now), null) : null;
        await store.patchDay(prev.date, { reportStatus: 'missed' });
        notes.push(CONV_TEXT.missed(prev.date, r?.applied ? RULES.eveningMissed.hp : null));
        dates.push(prev.date);
      } else {
        await store.patchDay(prev.date, { reportStatus: 'partial' });
      }
      // Отчёты недели/месяца прошлого вечера не дошли — отправить сейчас
      if (prev.flags.week) await safe('отчёт недели', () => sendWeek(carry, prev.date, now), undefined);
      if (prev.flags.month) await safe('отчёт месяца', () => sendMonth(carry, prev.flags.monthDate ?? prev.date, now), undefined);
    }
    if (dayOfWeek(date) === 6) {
      const friday = addDays(date, -1);
      if (!dates.includes(friday)) dates.push(friday);
    }
    dates.push(date);

    const sunday = dayOfWeek(date) === 0;
    // Конец месяца — сегодня; или вчера, если это была пятница (в пятницу бот молчит):
    // тогда отчёт месяца и вопрос о желаниях — в субботнем разговоре, за прошлый месяц
    const monthDate =
      monthKey(addDays(date, 1)) !== monthKey(date)
        ? date
        : dayOfWeek(date) === 6 && monthKey(addDays(date, -1)) !== monthKey(date)
          ? addDays(date, -1)
          : null;
    const queue: Step[] = dates.flatMap(daySteps);
    const onboarding = await store.getKv<{ done?: boolean }>(NEW_CHANNELS_KEY);
    if (!onboarding?.done) queue.push({ id: 'new_channels', date });
    if (sunday) queue.push({ id: 'week_channels', date }, { id: 'income', date });
    if (monthDate) queue.push({ id: 'wishes', date: monthDate });
    queue.push({ id: 'plan_main', date }, { id: 'plan_videos', date }, { id: 'final', date });

    const state: ConvState = { ...carry, queue, flags: { week: sunday, month: monthDate !== null, ...(monthDate ? { monthDate } : {}) } };
    await save(state);
    await deps.send([CONV_TEXT.greeting, ...notes].join('\n'));
    await askCurrent(state, now, true);
  }

  async function acceptSteps(data: string) {
    const steps = await store.listGoalSteps();
    const one = data.startsWith('qa:');
    const key = data.slice(3);
    const chosen = steps.filter((s) => s.proposed && (one ? s.id === key : s.proposedFor === key));
    for (const s of chosen) await store.saveGoalStep({ ...s, proposed: false });
    await deps.send(chosen.length ? chosen.map((s) => CONV_TEXT.stepAccepted(s.title)).join('\n') : 'Эти шаги уже приняты.');
  }

  async function handle(msg: IncomingMessage) {
    const now = nowOf();
    const today = todayStr(now);
    const data = msg.callbackData ?? '';
    if (data.startsWith('qa:') || data.startsWith('qA:')) return acceptSteps(data);

    let state = await load();
    let text = msg.text;
    if (msg.voiceFileId) {
      const file = deps.files ? await safe('скачать голосовое', () => deps.files!.download(msg.voiceFileId!, 'voice'), null) : null;
      const heard = file ? await deps.stt.transcribe(file) : null;
      if (file) await deps.files?.release?.(file).catch(() => {});
      if (!heard) {
        await deps.send(CONV_TEXT.voiceFailed);
        return;
      }
      text = heard;
      await deps.send(`Расшифровал: «${heard}»`);
    }
    const photoPath = msg.photoFileId && deps.files ? await safe('скачать фото', () => deps.files!.download(msg.photoFileId!, 'photo'), null) : null;
    try {
      if (!state || state.finished) {
        if (photoPath) {
          const ok = await saveSleepFromPhoto(ctxFor(state ?? ({ date: today, seq: 0 } as ConvState), now), today, photoPath);
          if (!ok) await deps.send('Не смог прочитать скриншот сна.');
          return;
        }
        if (text && /^\/?(вечер|evening)\b/i.test(text.trim())) {
          if (state?.date === today) await deps.send(CONV_TEXT.alreadyDone);
          else await startEveningNow(today, now);
          return;
        }
        await deps.send(CONV_TEXT.idle);
        return;
      }

      state.answered = true;
      if (state.queue[0]?.id === 'final') return askCurrent(state, now, true);
      const step = state.queue[0];
      const input: Input = {};
      if (data) {
        const m = data.match(/^qf:(\d+):(.+)$/);
        if (!m) return;
        if (Number(m[1]) !== state.seq) {
          await save(state);
          await deps.send(CONV_TEXT.stale);
          return askCurrent(state, now, false);
        }
        input.action = m[2];
      } else if (photoPath) {
        if (step.id !== 'sleep') {
          // Скриншот сна можно прислать на любом шаге: записываем и продолжаем текущий вопрос
          const ok = await saveSleepFromPhoto(ctxFor(state, now), step.date, photoPath);
          if (!ok) await deps.send('Не смог прочитать скриншот сна.');
          await save(state);
          return;
        }
        input.photoPath = photoPath;
      } else if (text) input.text = text;
      else return;

      const res = await HANDLERS[step.id as Exclude<Step['id'], 'final'>].answer(ctxFor(state, now), step, state.cur, input);
      if (res === 'next') {
        state.queue.shift();
        await askCurrent(state, now, true);
      } else if (res === 'reask') await askCurrent(state, now, false);
      else await save(state);
    } finally {
      if (photoPath) await deps.files?.release?.(photoPath).catch(() => {});
    }
  }

  async function retryPending(now: Date) {
    // Пятница — день восстановления: бот молчит, повтор ждёт субботы
    if (isRecoveryDay(todayStr(now))) return;
    const state = await load();
    if (!state || !state.pendingAi.length) return;
    const rc = reportCtx(now);
    const left: PendingAi[] = [];
    for (const p of state.pendingAi) {
      if (Date.parse(p.nextAt) > now.getTime()) {
        left.push(p);
        continue;
      }
      const header =
        p.kind === 'day' ? `Анализ дня ${dateLabel(p.date)} (с опозданием)` : p.kind === 'week' ? `Claude о неделе до ${dateLabel(p.date)} (с опозданием)` : `Claude о месяце (с опозданием)`;
      const run = p.kind === 'day' ? dayAnalysis : p.kind === 'week' ? weekAnalysis : monthAnalysis;
      const ok = await safe(`повтор анализа ${p.kind}`, () => run(rc, p.date, header), false);
      if (ok) continue;
      const tries = p.tries + 1;
      if (tries >= RETRY_MAX_TRIES) {
        log(`Анализ ${p.kind} за ${p.date} так и не удался — снят с повтора`);
        continue;
      }
      left.push({ ...p, tries, nextAt: new Date(now.getTime() + 60 * 60_000 * tries).toISOString() });
    }
    // Состояние могло поменяться, пока шёл анализ — перечитать и заменить только очередь
    const fresh = (await load()) ?? state;
    fresh.pendingAi = left;
    await save(fresh);
  }

  return {
    startEvening: (date) => locked(() => startEveningNow(date, nowOf())),

    eveningReminder: (date) =>
      locked(async () => {
        const now = nowOf();
        const state = await load();
        if (!state || state.date !== date || state.finished) return;
        if (!eveningReminderDue(now, { answered: state.answered, reminded: state.reminded }, date)) return;
        state.reminded = true;
        await save(state);
        await deps.send(CONV_TEXT.reminder);
        await askCurrent(state, now, false);
      }),

    weeklyReport: (date) =>
      locked(async () => {
        const now = nowOf();
        const state = await load();
        // Воскресный разговор сам отправит отчёт недели в конце (после вопросов про каналы и доход)
        if (state && state.date === date && state.flags.week) return;
        const s = state ?? ({ pendingAi: [] } as unknown as ConvState);
        await sendWeek(s, date, now);
        if (state) await save(s);
      }),

    monthlyReport: (date) =>
      locked(async () => {
        const now = nowOf();
        const state = await load();
        if (state && state.date === date && state.flags.month) return;
        const s = state ?? ({ pendingAi: [] } as unknown as ConvState);
        await sendMonth(s, date, now);
        if (state) await save(s);
      }),

    handleUpdate: (msg) => locked(() => handle(msg)),

    tick: (now) => locked(() => retryPending(now ?? nowOf())),
  };
}

/** Ключ недели для шагов, предложенных в воскресенье (понедельник следующей недели) */
export const nextWeekKey = (sunday: string) => weekStart(addDays(sunday, 1));
