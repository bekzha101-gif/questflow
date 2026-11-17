// Шаги вечернего разговора. Каждый шаг: ask — вопрос (или 'skip', если спрашивать нечего),
// answer — разбор ответа (кнопка, текст или расшифровка голосового) и запись данных.
// Все записи идут через ConversationStore, награды — через applyGame (правила shared/gamification).
import { effectiveStatus, lastPublishedOf, remindersFor } from '../../../shared/channels';
import { currentWeekIndex } from '../../../shared/goals';
import { addDays, isRecoveryDay, monthKey } from '../../../shared/time';
import type { Channel, Task, Video } from '../../../shared/types';
import { dateLabel, formatMin } from './context';
import { applyGame } from './game';
import { isNo, matchNames, parseList, parseMoney, parseNumber, parsePercent, parseScore, parseSleep } from './parse';
import type { ConversationStore } from './store';
import type { ConvState, ConversationDeps, Cursor, Input, Keyboard, Step, StepId } from './types';

export interface Ask {
  text: string;
  keyboard?: Keyboard;
}
export type AnswerResult = 'next' | 'stay' | 'reask';

export interface StepCtx {
  deps: ConversationDeps;
  store: ConversationStore;
  now: Date;
  today: string;
  state: ConvState;
  reply(text: string, keyboard?: Keyboard): Promise<void>;
}

export interface Handler {
  ask(c: StepCtx, step: Step, cur: Cursor): Promise<Ask | 'skip'>;
  answer(c: StepCtx, step: Step, cur: Cursor, input: Input): Promise<AnswerResult>;
}

/** Активности дня восстановления (как DEFAULT_RECOVERY_ACTIVITIES на сайте) */
export const RECOVERY_ACTIVITIES = [
  { id: 'sauna_pool', title: 'Баня или бассейн' },
  { id: 'nature_walk', title: 'Прогулка 10 000+ шагов' },
  { id: 'meditation', title: 'Медитация 20–30 мин' },
  { id: 'massage_stretching', title: 'Массаж, МФР, растяжка' },
];

export const TXT = {
  skip: 'Пропустить',
  done: 'Готово',
  notUnderstood: 'Не понял ответ. Нажми кнопку или напиши ещё раз.',
};

// ─── Помощники ───────────────────────────────────────────────────────────────
const btn = (c: StepCtx, text: string, action: string) => ({ text, data: `qf:${c.state.seq}:${action}` });

function prefix(c: StepCtx, step: Step): string {
  return step.date !== c.state.date ? `За ${dateLabel(step.date)}. ` : '';
}

function rows<T>(items: T[], per: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += per) out.push(items.slice(i, i + per));
  return out;
}

/** Кнопки-переключатели: «[x] Название» */
function toggles(c: StepCtx, cur: Cursor, extra: { text: string; action: string }[]): Keyboard {
  const list = cur.list ?? [];
  const sel = new Set(cur.sel ?? []);
  const kb = rows(
    list.map((it, i) => btn(c, `${sel.has(it.id) ? '[x]' : '[ ]'} ${it.title}`.slice(0, 60), `t:${i}`)),
    2,
  );
  kb.push(extra.map((e) => btn(c, e.text, e.action)));
  return kb;
}

function toggle(cur: Cursor, action: string): boolean {
  const m = action.match(/^t:(\d+)$/);
  const it = m ? cur.list?.[Number(m[1])] : undefined;
  if (!it) return false;
  const sel = new Set(cur.sel ?? []);
  if (sel.has(it.id)) sel.delete(it.id);
  else sel.add(it.id);
  cur.sel = [...sel];
  return true;
}

const habitsOf = (tasks: Task[]) => tasks.filter((t) => (t.type === 'habit' || t.type === 'daily') && t.kind !== 'shopping');
const isPlanned = (ch: Channel) => ch.planned === true;
const leadChannels = (chs: Channel[], date: string) => chs.filter((ch) => !isPlanned(ch) && effectiveStatus(ch, date) === 'active');
const atDate = (c: StepCtx, date: string) => (date === c.today ? c.now.toISOString() : `${date}T20:00:00+06:00`);

const PRIORITY: Record<string, number> = { p1: 1, high: 1, p2: 2, medium: 2, p3: 3, low: 3, p4: 4 };
function openTodos(tasks: Task[]): Task[] {
  return tasks
    .filter((t) => t.type === 'todo' && t.kind !== 'shopping' && !t.completed)
    .sort((a, b) => (PRIORITY[a.priority ?? ''] ?? 5) - (PRIORITY[b.priority ?? ''] ?? 5) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
}

// ─── Сон ─────────────────────────────────────────────────────────────────────
export async function saveSleepFromPhoto(c: StepCtx, date: string, photoPath: string): Promise<boolean> {
  const r = await c.deps.ai.analyze('sleep_screenshot', { imagePath: photoPath });
  if (!r?.sleep) return false;
  await c.store.patchDay(date, { sleepMin: r.sleep.sleepMin, ...(typeof r.sleep.quality === 'number' ? { sleepQuality: r.sleep.quality } : {}) });
  await c.reply(`Сон за ${dateLabel(date)}: ${formatMin(r.sleep.sleepMin)}${typeof r.sleep.quality === 'number' ? `, качество ${r.sleep.quality}%` : ''}. Записал.`);
  return true;
}

const sleep: Handler = {
  async ask(c, step) {
    const day = await c.store.getDay(step.date);
    if (typeof day?.sleepMin === 'number' && day.sleepMin > 0) return 'skip';
    return {
      text: `${prefix(c, step)}Сон: пришли скриншот Sleep Cycle за прошлую ночь или напиши, например, «7ч 30м 85%».`,
      keyboard: [[btn(c, TXT.skip, 'skip')]],
    };
  },
  async answer(c, step, _cur, input) {
    if (input.action === 'skip') return 'next';
    if (input.photoPath) {
      if (await saveSleepFromPhoto(c, step.date, input.photoPath)) return 'next';
      await c.reply('Не смог прочитать скриншот. Напиши сон текстом: «7ч 30м 85%».');
      return 'stay';
    }
    const text = input.text ?? '';
    const s = parseSleep(text);
    if (s) {
      await c.store.patchDay(step.date, { sleepMin: s.sleepMin, ...(s.quality !== undefined ? { sleepQuality: s.quality } : {}) });
      return 'next';
    }
    if (isNo(text)) return 'next';
    await c.reply('Не понял время сна. Пример: «7ч 30м 85%» или «6:45».');
    return 'stay';
  },
};

// ─── БАДы ────────────────────────────────────────────────────────────────────
const supplements: Handler = {
  async ask(c, step, cur) {
    if (!cur.init) {
      const cfg = await c.store.getBigDataConfig();
      const list = (cfg?.supplements ?? []).map((s) => ({ id: s.id, title: s.name }));
      if (!list.length) return 'skip';
      const day = await c.store.getDay(step.date);
      const had = new Set(day?.supplements ?? []);
      Object.assign(cur, { init: true, list, sel: list.filter((s) => had.has(s.title)).map((s) => s.id) });
    }
    return {
      text: `${prefix(c, step)}Какие БАДы пил сегодня? Нажми или напиши названия.`,
      keyboard: toggles(c, cur, [
        { text: TXT.done, action: 'done' },
        { text: 'Ничего', action: 'none' },
      ]),
    };
  },
  async answer(c, step, cur, input) {
    if (input.action && toggle(cur, input.action)) return 'reask';
    let ids = cur.sel ?? [];
    if (input.action === 'none' || (input.text && isNo(input.text))) ids = [];
    else if (input.text) {
      const found = matchNames(input.text, cur.list ?? []);
      if (!found.length) {
        await c.reply(TXT.notUnderstood);
        return 'stay';
      }
      ids = found.map((f) => f.id);
    } else if (input.action !== 'done') return 'stay';
    const names = (cur.list ?? []).filter((s) => ids.includes(s.id)).map((s) => s.title);
    await c.store.patchDay(step.date, { supplements: names });
    return 'next';
  },
};

// ─── Оценка дня ──────────────────────────────────────────────────────────────
const score: Handler = {
  async ask(c, step, cur) {
    if (cur.mode === 'why') return { text: 'Почему такая оценка?', keyboard: [[btn(c, TXT.skip, 'skip')]] };
    return {
      text: `${prefix(c, step)}Оценка дня от 1 до 10 и почему? Можно одним сообщением: «7, потому что…»`,
      keyboard: [...rows(Array.from({ length: 10 }, (_v, i) => btn(c, String(i + 1), `n:${i + 1}`)), 5), [btn(c, TXT.skip, 'skip')]],
    };
  },
  async answer(c, step, cur, input) {
    if (cur.mode === 'why') {
      if (input.action === 'skip') return 'next';
      if (!input.text) return 'stay';
      await c.store.patchDay(step.date, { why: input.text.trim() });
      return 'next';
    }
    if (input.action === 'skip' || (input.text && isNo(input.text))) return 'next';
    const n = input.action?.match(/^n:(\d+)$/);
    const parsed = n ? { score: Number(n[1]), why: '' } : input.text ? parseScore(input.text) : null;
    if (!parsed) {
      await c.reply('Нужна оценка числом от 1 до 10.');
      return 'stay';
    }
    await c.store.patchDay(step.date, { score: parsed.score, ...(parsed.why ? { why: parsed.why } : {}) });
    if (parsed.why) return 'next';
    cur.mode = 'why';
    return 'reask';
  },
};

// ─── Хорошо / лучше ──────────────────────────────────────────────────────────
const goodBetter: Handler = {
  async ask(c, step) {
    return {
      text: `${prefix(c, step)}Что сделал хорошо и что мог сделать лучше?`,
      keyboard: [[btn(c, TXT.skip, 'skip')]],
    };
  },
  async answer(c, step, _cur, input) {
    if (input.action === 'skip') return 'next';
    if (!input.text?.trim()) return 'stay';
    const text = input.text.trim();
    const day = await c.store.getDay(step.date);
    // Заметка дня идёт AI в контексте; заметку, написанную на сайте, не перетираем
    await c.store.patchDay(step.date, { goodBetter: text, ...(day?.note?.trim() ? {} : { note: text }) });
    return 'next';
  },
};

// ─── Привычки ────────────────────────────────────────────────────────────────
/** Отметить привычки дня: касания (habitsDoneIds), ежедневные — галочкой, награды по правилам */
export async function markHabits(c: StepCtx, date: string, ids: string[]): Promise<string[]> {
  const tasks = await c.store.listTasks();
  const habits = habitsOf(tasks);
  const day = (await c.store.getDay(date)) ?? { date };
  const doneIds = new Set<string>(Array.isArray(day.habitsDoneIds) ? (day.habitsDoneIds as string[]) : []);
  const rewarded = new Set<string>(Array.isArray(day.habitsRewardedIds) ? (day.habitsRewardedIds as string[]) : []);
  const marked: string[] = [];
  for (const h of habits.filter((x) => ids.includes(x.id))) {
    if (h.type === 'habit') doneIds.add(h.id);
    else if (date === c.today && !h.completed) {
      await c.store.saveTask({ ...h, completed: true, completedAt: c.now.toISOString(), streakCount: (h.streakCount ?? 0) + 1 });
      h.completed = true;
    } else doneIds.add(h.id);
    if (!rewarded.has(h.id)) {
      const r = await applyGame(c.store, { kind: h.type === 'habit' ? 'habit' : 'daily', ref: `${date}:${h.id}` }, c.now);
      if (r.applied || r.rejected === 'duplicate') rewarded.add(h.id);
    }
    marked.push(h.title);
  }
  const done = (t: Task) => doneIds.has(t.id) || (t.type === 'daily' && date === c.today && !!t.completed);
  const water = habits.some((h) => done(h) && /вод/i.test(h.title));
  await c.store.patchDay(date, {
    habitsDoneIds: [...doneIds],
    habitsRewardedIds: [...rewarded],
    habitsDone: habits.filter(done).length,
    habitsTotal: habits.length,
    habitsMissed: habits.filter((h) => !done(h)).map((h) => h.title),
    ...(water ? { waterOk: true } : {}),
  });
  return marked;
}

const habits: Handler = {
  async ask(c, step, cur) {
    if (!cur.init) {
      const tasks = habitsOf(await c.store.listTasks());
      if (!tasks.length) return 'skip';
      const day = await c.store.getDay(step.date);
      const doneIds = new Set(Array.isArray(day?.habitsDoneIds) ? (day.habitsDoneIds as string[]) : []);
      const sel = tasks.filter((t) => doneIds.has(t.id) || (t.type === 'daily' && step.date === c.today && t.completed)).map((t) => t.id);
      Object.assign(cur, { init: true, list: tasks.map((t) => ({ id: t.id, title: t.title })), sel });
    }
    return {
      text: `${prefix(c, step)}Какие привычки выполнил? Нажми или скажи голосом, например: «воду выпил, медитировал».`,
      keyboard: toggles(c, cur, [
        { text: TXT.done, action: 'done' },
        { text: 'Ничего', action: 'none' },
      ]),
    };
  },
  async answer(c, step, cur, input) {
    if (input.action && toggle(cur, input.action)) return 'reask';
    let ids: string[];
    if (input.action === 'none' || (input.text && isNo(input.text))) ids = [];
    else if (input.text) {
      const found = matchNames(input.text, cur.list ?? []);
      if (!found.length) {
        await c.reply('Не узнал привычки в ответе. Нажми кнопки или назови их иначе.');
        return 'stay';
      }
      ids = [...new Set([...(cur.sel ?? []), ...found.map((f) => f.id)])];
    } else if (input.action === 'done') ids = cur.sel ?? [];
    else return 'stay';
    const marked = await markHabits(c, step.date, ids);
    await c.reply(marked.length ? `Отметил: ${marked.join(', ')}.` : 'Привычки не отмечены.');
    return 'next';
  },
};

// ─── Задачи и шаги целей: сделано / % / бросил — почему ──────────────────────
const items: Handler = {
  async ask(c, step, cur) {
    if (!cur.init) {
      const [tasks, sessions, goals, steps] = await Promise.all([
        c.store.listTasks(),
        c.store.listFocusSessions(step.date, step.date),
        c.store.listGoals(),
        c.store.listGoalSteps(),
      ]);
      const worked = new Set(sessions.map((s) => s.taskId).filter(Boolean));
      const due = openTodos(tasks).filter((t) => (t.dueDate && t.dueDate.slice(0, 10) <= step.date) || worked.has(t.id));
      const month = monthKey(step.date);
      const goalIds = new Set(goals.filter((g) => g.month === month && g.status === 'active').map((g) => g.id));
      const week = currentWeekIndex(month, step.date);
      const weekSteps = steps.filter((s) => goalIds.has(s.goalId) && s.weekIndex === week && !s.done && !s.proposed);
      const list = [
        ...due.slice(0, 6).map((t) => ({ id: t.id, title: t.title, kind: 'task' })),
        ...weekSteps.slice(0, 4).map((s) => ({ id: s.id, title: s.title, kind: 'step' })),
      ];
      if (!list.length) return 'skip';
      Object.assign(cur, { init: true, list, index: 0 });
    }
    const it = cur.list![cur.index ?? 0];
    const what = it.kind === 'step' ? 'Шаг недели' : 'Задача';
    if (cur.mode === 'pct') return { text: `«${it.title}»: сколько процентов сделано?`, keyboard: [[25, 50, 75, 90].map((n) => btn(c, `${n}%`, `n:${n}`))] };
    if (cur.mode === 'why') return { text: `«${it.title}»: почему бросил?`, keyboard: [[btn(c, TXT.skip, 'skip')]] };
    return {
      text: `${prefix(c, step)}${what} ${(cur.index ?? 0) + 1} из ${cur.list!.length}: «${it.title}». Как с ней?`,
      keyboard: [
        [btn(c, 'Сделано', 'r:done'), btn(c, 'Частично', 'r:partial')],
        [btn(c, 'Бросил', 'r:dropped'), btn(c, TXT.skip, 'skip')],
      ],
    };
  },
  async answer(c, step, cur, input) {
    const it = cur.list![cur.index ?? 0];
    const nextItem = (): AnswerResult => {
      cur.index = (cur.index ?? 0) + 1;
      cur.mode = undefined;
      return cur.index >= cur.list!.length ? 'next' : 'reask';
    };
    const save = async (patch: { done?: boolean; pct?: number; dropReason?: string }) => {
      if (it.kind === 'step') {
        const s = (await c.store.listGoalSteps()).find((x) => x.id === it.id);
        if (!s) return;
        await c.store.saveGoalStep({
          ...s,
          ...(patch.done ? { done: true, progressPct: 100 } : {}),
          ...(patch.pct !== undefined ? { progressPct: patch.pct, done: patch.pct >= 100 } : {}),
          ...(patch.dropReason ? { dropReason: patch.dropReason } : {}),
        });
        return;
      }
      const t = (await c.store.listTasks()).find((x) => x.id === it.id);
      if (!t) return;
      const complete = patch.done || (patch.pct ?? 0) >= 100;
      await c.store.saveTask({
        ...t,
        ...(complete ? { completed: true, completedAt: atDate(c, step.date), progressPct: 100 } : {}),
        ...(patch.pct !== undefined && !complete ? { progressPct: patch.pct } : {}),
        ...(patch.dropReason ? { dropReason: patch.dropReason } : {}),
      });
      // Та же награда, что у сайта при галочке: одна задача — один раз (ref = id задачи)
      if (complete) await applyGame(c.store, { kind: 'task', ref: t.id }, c.now);
    };

    if (cur.mode === 'pct') {
      const n = input.action?.match(/^n:(\d+)$/) ? Number(input.action.slice(2)) : input.text ? parsePercent(input.text) : null;
      if (n === null) return 'stay';
      await save({ pct: n });
      return nextItem();
    }
    if (cur.mode === 'why') {
      if (input.action !== 'skip' && !input.text) return 'stay';
      await save({ dropReason: input.text?.trim() || 'без причины' });
      return nextItem();
    }
    const action = input.action ?? '';
    const text = (input.text ?? '').toLowerCase();
    if (action === 'skip' || (text && isNo(text))) return nextItem();
    if (action === 'r:done' || /^(сделал|сделано|готово|done|да)/.test(text)) {
      await save({ done: true });
      return nextItem();
    }
    if (action === 'r:partial') {
      cur.mode = 'pct';
      return 'reask';
    }
    if (action === 'r:dropped') {
      cur.mode = 'why';
      return 'reask';
    }
    if (/бросил|не буду|отказал/.test(text)) {
      await save({ dropReason: input.text!.trim() });
      return nextItem();
    }
    const pct = text ? parsePercent(text) : null;
    if (pct !== null) {
      await save({ pct });
      return nextItem();
    }
    await c.reply(TXT.notUnderstood);
    return 'stay';
  },
};

// ─── Цели месяца (дотошно по каждой активной) ────────────────────────────────
const goalsStep: Handler = {
  async ask(c, step, cur) {
    if (!cur.init) {
      const goals = (await c.store.listGoals()).filter((g) => g.month === monthKey(step.date) && g.status === 'active');
      if (!goals.length) return 'skip';
      Object.assign(cur, { init: true, list: goals.map((g) => ({ id: g.id, title: g.title, kind: g.kind })), index: 0 });
    }
    const it = cur.list![cur.index ?? 0];
    const g = (await c.store.listGoals()).find((x) => x.id === it.id);
    if (!g) return { text: `Цель «${it.title}» не найдена.`, keyboard: [[btn(c, TXT.skip, 'skip')]] };
    if (g.kind === 'numeric') {
      return {
        text: `${prefix(c, step)}Цель «${g.title}»: сейчас ${g.current ?? 0} из ${g.target}${g.unit ? ` ${g.unit}` : ''}. Сколько прибавилось за день?`,
        keyboard: [[0, 1, 2, 3, 5].map((n) => btn(c, String(n), `n:${n}`)), [btn(c, TXT.skip, 'skip')]],
      };
    }
    return {
      text: `${prefix(c, step)}Цель «${g.title}»: сейчас ${g.current ?? 0}%. Какой процент теперь?`,
      keyboard: [[btn(c, 'Без изменений', 'skip')]],
    };
  },
  async answer(c, _step, cur, input) {
    const it = cur.list![cur.index ?? 0];
    const nextItem = (): AnswerResult => {
      cur.index = (cur.index ?? 0) + 1;
      return cur.index >= cur.list!.length ? 'next' : 'reask';
    };
    if (input.action === 'skip' || (input.text && isNo(input.text))) return nextItem();
    const n = input.action?.match(/^n:(\d+)$/) ? Number(input.action.slice(2)) : input.text ? parseNumber(input.text) : null;
    if (n === null) {
      await c.reply('Нужно число.');
      return 'stay';
    }
    const g = (await c.store.listGoals()).find((x) => x.id === it.id);
    if (g) {
      const current = g.kind === 'numeric' ? (g.current ?? 0) + n : Math.min(100, Math.max(0, n));
      await c.store.saveGoal({ ...g, current });
    }
    return nextItem();
  },
};

// ─── Публикации за день ──────────────────────────────────────────────────────
async function publishOne(c: StepCtx, ch: Channel, date: string): Promise<Video> {
  const videos = await c.store.listVideos();
  const at = atDate(c, date);
  const ready = videos
    .filter((v) => v.channelId === ch.id && v.stage !== 'published')
    .sort((a, b) => (a.publishDate ?? '9999').localeCompare(b.publishDate ?? '9999'))[0];
  const n = videos.filter((v) => v.channelId === ch.id).length + 1;
  const video: Video = ready
    ? { ...ready, stage: 'published', publishedAt: at, checklist: { plan: true, title: true, thumbnail: true, edit: true, upload: true } }
    : {
        id: `vid-${date}-${ch.id}-${n}`,
        channelId: ch.id,
        title: `${ch.name}: видео ${dateLabel(date)}`,
        stage: 'published',
        publishDate: date,
        publishedAt: at,
        checklist: { plan: true, title: true, thumbnail: true, edit: true, upload: true },
      };
  await c.store.saveVideo(video);
  await applyGame(c.store, { kind: 'video_published', ref: video.id }, c.now);
  return video;
}

const channelsStep: Handler = {
  async ask(c, step, cur) {
    if (!cur.init) {
      const list = leadChannels(await c.store.listChannels(), step.date).map((ch) => ({ id: ch.id, title: ch.name }));
      if (!list.length) return 'skip';
      Object.assign(cur, { init: true, list, sel: [] });
    }
    const count = (cur.sel ?? []).length;
    return {
      text: `${prefix(c, step)}Что опубликовал? Нажимай канал за каждое выложенное видео${count ? ` (уже записано: ${count})` : ''}.`,
      keyboard: [
        ...rows((cur.list ?? []).map((ch, i) => btn(c, ch.title.slice(0, 40), `t:${i}`)), 2),
        [btn(c, count ? TXT.done : 'Ничего', 'done')],
      ],
    };
  },
  async answer(c, step, cur, input) {
    const chs = await c.store.listChannels();
    const m = input.action?.match(/^t:(\d+)$/);
    if (m) {
      const it = cur.list?.[Number(m[1])];
      const ch = chs.find((x) => x.id === it?.id);
      if (!ch) return 'stay';
      await publishOne(c, ch, step.date);
      cur.sel = [...(cur.sel ?? []), ch.id];
      return 'reask';
    }
    if (input.action === 'done' || (input.text && isNo(input.text))) return 'next';
    if (input.text) {
      const found = matchNames(input.text, cur.list ?? []);
      if (!found.length) {
        await c.reply('Не узнал каналы. Нажми кнопки или напиши «ничего».');
        return 'stay';
      }
      for (const f of found) {
        const ch = chs.find((x) => x.id === f.id);
        if (ch) await publishOne(c, ch, step.date);
      }
      await c.reply(`Записал публикации: ${found.map((f) => f.title).join(', ')}.`);
      return 'next';
    }
    return 'stay';
  },
};

// ─── Пятница: восстановление ─────────────────────────────────────────────────
const recovery: Handler = {
  async ask(c, step, cur) {
    if (!cur.init) {
      const kv = await c.store.getKv<{ done?: string[] }>(`recovery:${step.date}`);
      Object.assign(cur, { init: true, list: RECOVERY_ACTIVITIES, sel: Array.isArray(kv?.done) ? kv!.done : [] });
    }
    return {
      text: `${prefix(c, step)}Пятница — день восстановления. Что из этого было?`,
      keyboard: toggles(c, cur, [
        { text: TXT.done, action: 'done' },
        { text: 'Ничего', action: 'none' },
      ]),
    };
  },
  async answer(c, step, cur, input) {
    if (input.action && toggle(cur, input.action)) return 'reask';
    let ids: string[];
    if (input.action === 'none' || (input.text && isNo(input.text))) ids = [];
    else if (input.text) ids = [...new Set([...(cur.sel ?? []), ...matchNames(input.text, RECOVERY_ACTIVITIES).map((a) => a.id)])];
    else if (input.action === 'done') ids = cur.sel ?? [];
    else return 'stay';
    const key = `recovery:${step.date}`;
    const kv = (await c.store.getKv<{ done?: string[]; rewarded?: string[] }>(key)) ?? {};
    const rewarded = new Set(Array.isArray(kv.rewarded) ? kv.rewarded : []);
    for (const id of ids) {
      if (rewarded.has(id)) continue;
      await applyGame(c.store, { kind: 'recovery_activity', ref: `${step.date}:${id}` }, c.now);
      rewarded.add(id);
    }
    await c.store.setKv(key, { done: ids, rewarded: [...rewarded] });
    return 'next';
  },
};

// ─── Первый вечер: 4 новых канала (G01) ──────────────────────────────────────
export const NEW_CHANNELS_KEY = 'onboarding:new_channels';

const newChannels: Handler = {
  async ask(c, _step, cur) {
    if (cur.mode === 'plan') {
      const name = (cur.names as string[])[cur.index ?? 0];
      return { text: `План для «${name}»: ниша, сколько видео и как часто, когда старт?`, keyboard: [[btn(c, TXT.skip, 'skip')]] };
    }
    return {
      text: 'Ты собирался запустить 4 новых канала. Как ты их назвал? Пришли названия — каждое с новой строки. Потом спрошу планы по каждому.',
      keyboard: [[btn(c, 'Спроси позже', 'later'), btn(c, 'Новых не будет', 'none')]],
    };
  },
  async answer(c, _step, cur, input) {
    if (cur.mode !== 'plan') {
      if (input.action === 'later') return 'next';
      if (input.action === 'none' || (input.text && isNo(input.text))) {
        await c.store.setKv(NEW_CHANNELS_KEY, { done: true, at: c.now.toISOString(), names: [] });
        return 'next';
      }
      const names = input.text ? parseList(input.text).slice(0, 8) : [];
      if (!names.length) return 'stay';
      Object.assign(cur, { mode: 'plan', names, index: 0, plans: [] });
      return 'reask';
    }
    if (input.action !== 'skip' && !input.text) return 'stay';
    const names = cur.names as string[];
    const name = names[cur.index ?? 0];
    const plan = input.action === 'skip' ? '' : input.text!.trim();
    const existing = await c.store.listChannels();
    const id = `ch-new-${Date.parse(c.now.toISOString()).toString(36)}-${(cur.index ?? 0) + 1}`;
    if (!existing.some((ch) => ch.name.toLowerCase() === name.toLowerCase())) {
      await c.store.saveChannel({
        id,
        name,
        niche: plan.slice(0, 120) || undefined,
        status: 'paused',
        cadencePerDay: 1,
        planned: true,
        plan,
        createdBy: 'bot',
      });
    }
    cur.index = (cur.index ?? 0) + 1;
    if (cur.index < names.length) return 'reask';
    await c.store.setKv(NEW_CHANNELS_KEY, { done: true, at: c.now.toISOString(), names });
    await c.reply(`Записал новые каналы: ${names.join(', ')}. Они в разделе «Каналы» со статусом «пауза» — включи, когда запустишь.`);
    return 'next';
  },
};

// ─── Воскресенье: какие каналы ведёшь, почему забросил ───────────────────────
const weekChannels: Handler = {
  async ask(c, step, cur) {
    if (!cur.init) {
      const chs = (await c.store.listChannels()).filter((ch) => ch.status !== 'archived' && !isPlanned(ch));
      if (!chs.length) return 'skip';
      Object.assign(cur, {
        init: true,
        list: chs.map((ch) => ({ id: ch.id, title: ch.name })),
        sel: chs.filter((ch) => effectiveStatus(ch, step.date) === 'active').map((ch) => ch.id),
      });
    }
    if (cur.mode === 'why') {
      const r = (cur.reasons as { id: string; name: string; stalled: boolean }[])[cur.index ?? 0];
      return {
        text: r.stalled ? `По «${r.name}» не было видео 7+ дней. Почему?` : `Почему забросил «${r.name}»?`,
        keyboard: [[btn(c, TXT.skip, 'skip')]],
      };
    }
    return {
      text: 'Воскресенье. Какие каналы ты сейчас ведёшь? Отметь и нажми «Готово».',
      keyboard: toggles(c, cur, [{ text: TXT.done, action: 'done' }]),
    };
  },
  async answer(c, step, cur, input) {
    const chs = await c.store.listChannels();
    if (cur.mode === 'why') {
      const reasons = cur.reasons as { id: string; name: string; stalled: boolean }[];
      const r = reasons[cur.index ?? 0];
      if (input.action !== 'skip' && !input.text) return 'stay';
      const ch = chs.find((x) => x.id === r.id);
      const why = input.text?.trim() || '';
      if (ch && why) await c.store.saveChannel(r.stalled ? { ...ch, stallReason: why } : { ...ch, abandonReason: why });
      cur.index = (cur.index ?? 0) + 1;
      return cur.index >= reasons.length ? 'next' : 'reask';
    }
    if (input.action && toggle(cur, input.action)) return 'reask';
    if (input.text) {
      const found = matchNames(input.text, cur.list ?? []);
      if (!found.length && !isNo(input.text)) {
        await c.reply('Не узнал каналы. Отметь кнопками.');
        return 'stay';
      }
      cur.sel = found.map((f) => f.id);
    } else if (input.action !== 'done') return 'stay';

    const sel = new Set(cur.sel ?? []);
    const videos = await c.store.listVideos();
    const reasons: { id: string; name: string; stalled: boolean }[] = [];
    const weekAgo = addDays(step.date, -7);
    for (const it of cur.list ?? []) {
      const ch = chs.find((x) => x.id === it.id);
      if (!ch) continue;
      if (sel.has(ch.id)) {
        if (ch.status !== 'active') await c.store.saveChannel({ ...ch, status: 'active', pausedUntil: undefined });
        const last = lastPublishedOf(ch.id, videos);
        if (!last || last < weekAgo) reasons.push({ id: ch.id, name: ch.name, stalled: true });
      } else if (effectiveStatus(ch, step.date) === 'active') {
        await c.store.saveChannel({ ...ch, status: 'abandoned' });
        reasons.push({ id: ch.id, name: ch.name, stalled: false });
      }
    }
    if (!reasons.length) return 'next';
    Object.assign(cur, { mode: 'why', reasons, index: 0 });
    return 'reask';
  },
};

// ─── Воскресенье: доход по каналам в USD ─────────────────────────────────────
const income: Handler = {
  async ask(c, step, cur) {
    if (!cur.init) {
      const list = leadChannels(await c.store.listChannels(), step.date).map((ch) => ({ id: ch.id, title: ch.name }));
      if (!list.length) return 'skip';
      Object.assign(cur, { init: true, list, index: 0 });
    }
    const it = cur.list![cur.index ?? 0];
    return { text: `Доход с «${it.title}» за неделю в USD? (0 — не было)`, keyboard: [[btn(c, '0', 'n:0')]] };
  },
  async answer(c, step, cur, input) {
    const it = cur.list![cur.index ?? 0];
    const amount = input.action === 'n:0' ? 0 : input.text ? parseMoney(input.text) : null;
    if (amount === null) {
      await c.reply('Нужна сумма числом, например 12.5.');
      return 'stay';
    }
    if (amount > 0) {
      const row = { id: `inc-${step.date}-${it.id}`, date: step.date, channelId: it.id, amountUsd: amount, source: 'bot' };
      const had = (await c.store.listIncome()).some((r) => r.id === row.id);
      await c.store.saveIncome(row);
      if (!had) await applyGame(c.store, { kind: 'income', ref: row.id, amountUsd: amount }, c.now);
    }
    cur.index = (cur.index ?? 0) + 1;
    return cur.index >= cur.list!.length ? 'next' : 'reask';
  },
};

// ─── Конец месяца: не поменялись ли желания ──────────────────────────────────
const wishes: Handler = {
  async ask(c) {
    const rewards = await c.store.listRewards();
    const names = rewards.map((r) => `${r.title} (${r.cost})`).slice(0, 12);
    return {
      text: `Конец месяца. Не поменялись ли желания? Сейчас награды: ${names.length ? names.join(', ') : 'пока нет'}. Напиши, что убрать или добавить, или «нет».`,
      keyboard: [[btn(c, 'Всё так же', 'skip')]],
    };
  },
  async answer(c, step, _cur, input) {
    if (input.action === 'skip' || (input.text && isNo(input.text))) return 'next';
    if (!input.text) return 'stay';
    await c.store.setKv(`wishes:${monthKey(step.date)}`, { text: input.text.trim(), at: c.now.toISOString() });
    await c.reply('Записал. Награды поправь в магазине на сайте — сам я их не меняю.');
    return 'next';
  },
};

// ─── План на завтра ──────────────────────────────────────────────────────────
interface PlanKv {
  mainTask?: string;
  mainTaskId?: string;
  firstBlockTask?: string;
  videos?: string;
  reminders?: string[];
}

const planMain: Handler = {
  async ask(c, step, cur) {
    const tomorrow = addDays(step.date, 1);
    if (isRecoveryDay(tomorrow)) return 'skip';
    if (!cur.init) {
      const list = openTodos(await c.store.listTasks()).slice(0, 5).map((t) => ({ id: t.id, title: t.title }));
      Object.assign(cur, { init: true, list });
    }
    return {
      text: `План на завтра (${dateLabel(tomorrow)}). Какая главная задача? Нажми или напиши свою — с неё начнётся первый блок.`,
      keyboard: [...(cur.list ?? []).map((t, i) => [btn(c, t.title.slice(0, 60), `p:${i}`)]), [btn(c, TXT.skip, 'skip')]],
    };
  },
  async answer(c, step, cur, input) {
    if (input.action === 'skip') return 'next';
    const key = `plan:${addDays(step.date, 1)}`;
    const plan = (await c.store.getKv<PlanKv>(key)) ?? {};
    const m = input.action?.match(/^p:(\d+)$/);
    const picked = m ? cur.list?.[Number(m[1])] : undefined;
    if (picked) await c.store.setKv(key, { ...plan, mainTask: picked.title, mainTaskId: picked.id, firstBlockTask: picked.title });
    else if (input.text?.trim()) await c.store.setKv(key, { ...plan, mainTask: input.text.trim(), firstBlockTask: input.text.trim() });
    else return 'stay';
    return 'next';
  },
};

const planVideos: Handler = {
  async ask(c, step, cur) {
    const tomorrow = addDays(step.date, 1);
    if (isRecoveryDay(tomorrow)) return 'skip';
    if (!cur.init) {
      const [chs, videos] = await Promise.all([c.store.listChannels(), c.store.listVideos()]);
      cur.init = true;
      cur.reminders = remindersFor(chs, videos, tomorrow, 5).map((r) => r.text);
    }
    const rem = cur.reminders as string[];
    return {
      text: `${rem.length ? `По графику на завтра:\n${rem.map((r) => `- ${r}`).join('\n')}\n` : ''}Какие видео выложить завтра и на какие каналы, что запустить в монтаж? Коротко.`,
      keyboard: [[btn(c, 'Как по графику', 'skip')]],
    };
  },
  async answer(c, step, cur, input) {
    const key = `plan:${addDays(step.date, 1)}`;
    const plan = (await c.store.getKv<PlanKv>(key)) ?? {};
    const reminders = cur.reminders as string[];
    if (input.action === 'skip') await c.store.setKv(key, { ...plan, reminders });
    else if (input.text?.trim()) await c.store.setKv(key, { ...plan, videos: input.text.trim(), reminders });
    else return 'stay';
    return 'next';
  },
};

// Шаг 'final' (итог и анализ) живёт в движке: ему нужны отчёты и очередь повторов
export const HANDLERS: Record<Exclude<StepId, 'final'>, Handler> = {
  sleep,
  supplements,
  score,
  good_better: goodBetter,
  habits,
  items,
  goals: goalsStep,
  channels: channelsStep,
  recovery,
  new_channels: newChannels,
  week_channels: weekChannels,
  income,
  wishes,
  plan_main: planMain,
  plan_videos: planVideos,
};
