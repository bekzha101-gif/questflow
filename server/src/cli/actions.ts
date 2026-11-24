// Действия, которые Claude выполняет в QuestFlow по команде владельца (голос или текст в чате Claude).
// Claude собирает JSON со списком действий, `qf apply` проверяет его, показывает, что поменяется,
// и записывает в Supabase. Правила этапов и наград — как на сайте (src/components/legacyMedia.ts).
import type { AiMemory, BigDataDay, Channel, ChannelStatus, Task, Video, VideoStage } from '../../../shared/types';
import { CHANNEL_STATUS_COLOR, CHANNEL_STATUS_LABEL, isChannelStatus } from '../../../shared/channels';
import { todayStr } from '../../../shared/time';
import { applyGame, closePendingDays } from '../conversation/game';
import type { ConversationStore } from '../conversation/store';

// Этапы как на сайте: точный этап — в legacyStage, в облаке — три
export type Stage = 'editing' | 'cover' | 'review' | 'published';
export const STAGE_LABEL: Record<Stage, string> = { editing: 'Монтаж', cover: 'Обложка и заголовок', review: 'Проверка', published: 'Выкладка' };
const TO_CLOUD: Record<Stage, VideoStage> = { editing: 'editing', cover: 'editing', review: 'review', published: 'published' };
export const isStage = (v: unknown): v is Stage => typeof v === 'string' && v in STAGE_LABEL;

export type Action =
  | { type: 'add_channel'; name: string; niche?: string; status?: ChannelStatus; transformer?: string }
  | {
      type: 'update_channel';
      channelId: string;
      name?: string;
      niche?: string;
      status?: ChannelStatus;
      color?: string;
      transformer?: string;
      pausedUntil?: string;
      abandonReason?: string;
    }
  | { type: 'delete_channel'; channelId: string }
  | { type: 'add_video'; channelId: string; title: string; stage?: Stage; publishDate?: string; urgent?: boolean }
  | { type: 'move_video'; videoId: string; stage: Stage }
  | { type: 'rename_video'; videoId: string; title: string }
  | { type: 'set_publish_date'; videoId: string; publishDate: string | null }
  | { type: 'set_urgent'; videoId: string; urgent: boolean }
  | { type: 'delete_video'; videoId: string }
  | { type: 'patch_day'; date: string; patch: Partial<BigDataDay> }
  | { type: 'add_goal_step'; goalId: string; weekIndex: number; title: string }
  | { type: 'save_ai_memory'; period: AiMemory['period']; periodKey: string; summary: string; facts?: string[] }
  | { type: 'mark_habits'; date: string; taskIds: string[] }
  | { type: 'update_task'; taskId: string; done?: boolean; progressPct?: number; dropReason?: string }
  | { type: 'update_goal'; goalId: string; add?: number; set?: number }
  | { type: 'add_income'; date: string; amountUsd: number; channelId?: string; source?: string }
  | { type: 'set_plan'; date: string; mainTask: string; mainTaskId?: string }
  | { type: 'finish_report'; date: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const opt = (v: unknown) => str(v) || undefined;
const PERIODS = new Set(['day', 'week', 'month']);

export interface Ctx {
  channels: Channel[];
  videos: Video[];
  goalIds: string[];
  tasks?: Task[];
  goalTitles?: Record<string, string>;
}

/** Привычки и ежедневные дела (без списка покупок) */
export const habitsOf = (tasks: Task[]) => tasks.filter((t) => (t.type === 'habit' || t.type === 'daily') && t.kind !== 'shopping');

/** Проверить действия: неизвестные id, этапы, даты — ошибка с понятным текстом */
export function validateActions(raw: unknown, ctx: Ctx): { actions: Action[]; errors: string[] } {
  const list = Array.isArray(raw) ? raw : Array.isArray((raw as { actions?: unknown })?.actions) ? (raw as { actions: unknown[] }).actions : null;
  if (!list) return { actions: [], errors: ['нужен массив действий или {"actions": [...]}'] };
  const ch = new Set(ctx.channels.map((c) => c.id));
  const vid = new Set(ctx.videos.map((v) => v.id));
  const goals = new Set(ctx.goalIds);
  const tasks = new Set((ctx.tasks ?? []).map((t) => t.id));
  const actions: Action[] = [];
  const errors: string[] = [];
  list.forEach((a: Record<string, unknown>, i) => {
    const bad = (m: string) => errors.push(`#${i + 1} ${String(a?.type)}: ${m}`);
    if (!a || typeof a !== 'object') return bad('не объект');
    const channelOk = () => ch.has(str(a.channelId)) || (bad(`нет канала ${str(a.channelId)}`), false);
    const videoOk = () => vid.has(str(a.videoId)) || (bad(`нет видео ${str(a.videoId)}`), false);
    switch (a.type) {
      case 'add_channel': {
        const name = str(a.name);
        if (!name) return bad('нет name');
        if (a.status !== undefined && !isChannelStatus(a.status)) return bad('неизвестный status');
        actions.push({ type: 'add_channel', name, niche: opt(a.niche), status: a.status as ChannelStatus | undefined, transformer: opt(a.transformer) });
        return;
      }
      case 'update_channel': {
        if (!channelOk()) return;
        if (a.status !== undefined && !isChannelStatus(a.status)) return bad('неизвестный status');
        if (a.color !== undefined && !COLOR_RE.test(str(a.color))) return bad('color — в виде #rrggbb');
        if (a.pausedUntil !== undefined && !DATE_RE.test(str(a.pausedUntil))) return bad('pausedUntil — YYYY-MM-DD');
        actions.push({
          type: 'update_channel',
          channelId: str(a.channelId),
          name: opt(a.name),
          niche: opt(a.niche),
          status: a.status as ChannelStatus | undefined,
          color: opt(a.color),
          transformer: opt(a.transformer),
          pausedUntil: opt(a.pausedUntil),
          abandonReason: opt(a.abandonReason),
        });
        return;
      }
      case 'delete_channel':
        if (channelOk()) actions.push({ type: 'delete_channel', channelId: str(a.channelId) });
        return;
      case 'add_video': {
        if (!channelOk()) return;
        const title = str(a.title);
        if (!title) return bad('нет title');
        if (a.stage !== undefined && !isStage(a.stage)) return bad('неизвестный stage');
        if (a.publishDate !== undefined && !DATE_RE.test(str(a.publishDate))) return bad('publishDate — YYYY-MM-DD');
        actions.push({
          type: 'add_video',
          channelId: str(a.channelId),
          title,
          stage: a.stage as Stage | undefined,
          publishDate: opt(a.publishDate),
          urgent: a.urgent === true || undefined,
        });
        return;
      }
      case 'move_video':
        if (!videoOk()) return;
        if (!isStage(a.stage)) return bad('неизвестный stage');
        actions.push({ type: 'move_video', videoId: str(a.videoId), stage: a.stage });
        return;
      case 'rename_video':
        if (!videoOk()) return;
        if (!str(a.title)) return bad('нет title');
        actions.push({ type: 'rename_video', videoId: str(a.videoId), title: str(a.title) });
        return;
      case 'set_publish_date':
        if (!videoOk()) return;
        if (a.publishDate !== null && !DATE_RE.test(str(a.publishDate))) return bad('publishDate — YYYY-MM-DD или null');
        actions.push({ type: 'set_publish_date', videoId: str(a.videoId), publishDate: a.publishDate === null ? null : str(a.publishDate) });
        return;
      case 'set_urgent':
        if (videoOk()) actions.push({ type: 'set_urgent', videoId: str(a.videoId), urgent: a.urgent !== false });
        return;
      case 'delete_video':
        if (videoOk()) actions.push({ type: 'delete_video', videoId: str(a.videoId) });
        return;
      case 'patch_day': {
        const date = str(a.date);
        if (!DATE_RE.test(date)) return bad('date — YYYY-MM-DD');
        if (!a.patch || typeof a.patch !== 'object' || Array.isArray(a.patch)) return bad('patch — объект полей дня');
        actions.push({ type: 'patch_day', date, patch: a.patch as Partial<BigDataDay> });
        return;
      }
      case 'add_goal_step': {
        const goalId = str(a.goalId);
        if (!goals.has(goalId)) return bad(`нет цели ${goalId}`);
        if (!Number.isInteger(a.weekIndex)) return bad('weekIndex — целое число');
        if (!str(a.title)) return bad('нет title');
        actions.push({ type: 'add_goal_step', goalId, weekIndex: a.weekIndex as number, title: str(a.title) });
        return;
      }
      case 'save_ai_memory': {
        if (!PERIODS.has(str(a.period))) return bad('period — day, week или month');
        if (!str(a.periodKey) || !str(a.summary)) return bad('нужны periodKey и summary');
        const facts = Array.isArray(a.facts) ? a.facts.filter((f): f is string => typeof f === 'string' && !!f.trim()) : undefined;
        actions.push({ type: 'save_ai_memory', period: str(a.period) as AiMemory['period'], periodKey: str(a.periodKey), summary: str(a.summary), facts });
        return;
      }
      case 'mark_habits': {
        const date = str(a.date);
        if (!DATE_RE.test(date)) return bad('date — YYYY-MM-DD');
        const ids = Array.isArray(a.taskIds) ? a.taskIds.map(str).filter(Boolean) : [];
        const unknown = ids.filter((x) => !tasks.has(x));
        if (unknown.length) return bad(`нет задач ${unknown.join(', ')}`);
        actions.push({ type: 'mark_habits', date, taskIds: ids });
        return;
      }
      case 'update_task': {
        if (!tasks.has(str(a.taskId))) return bad(`нет задачи ${str(a.taskId)}`);
        const pct = a.progressPct;
        if (pct !== undefined && (typeof pct !== 'number' || pct < 0 || pct > 100)) return bad('progressPct — 0..100');
        actions.push({ type: 'update_task', taskId: str(a.taskId), done: a.done === true || undefined, progressPct: pct as number | undefined, dropReason: opt(a.dropReason) });
        return;
      }
      case 'update_goal': {
        if (!goals.has(str(a.goalId))) return bad(`нет цели ${str(a.goalId)}`);
        const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
        if (num(a.add) === undefined && num(a.set) === undefined) return bad('нужно add или set числом');
        actions.push({ type: 'update_goal', goalId: str(a.goalId), add: num(a.add), set: num(a.set) });
        return;
      }
      case 'add_income': {
        const date = str(a.date);
        if (!DATE_RE.test(date)) return bad('date — YYYY-MM-DD');
        if (typeof a.amountUsd !== 'number' || !(a.amountUsd > 0)) return bad('amountUsd — число больше 0');
        if (a.channelId !== undefined && !ch.has(str(a.channelId))) return bad(`нет канала ${str(a.channelId)}`);
        actions.push({ type: 'add_income', date, amountUsd: a.amountUsd, channelId: opt(a.channelId), source: opt(a.source) });
        return;
      }
      case 'set_plan': {
        const date = str(a.date);
        if (!DATE_RE.test(date)) return bad('date — YYYY-MM-DD');
        if (!str(a.mainTask)) return bad('нет mainTask');
        if (a.mainTaskId !== undefined && !tasks.has(str(a.mainTaskId))) return bad(`нет задачи ${str(a.mainTaskId)}`);
        actions.push({ type: 'set_plan', date, mainTask: str(a.mainTask), mainTaskId: opt(a.mainTaskId) });
        return;
      }
      case 'finish_report': {
        const date = str(a.date);
        if (!DATE_RE.test(date)) return bad('date — YYYY-MM-DD');
        actions.push({ type: 'finish_report', date });
        return;
      }
      default:
        bad('неизвестное действие');
    }
  });
  return { actions, errors };
}

const dmy = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;

/** Понятное описание действий по-русски */
export function describeActions(actions: Action[], ctx: Ctx): string[] {
  const chName = (id: string) => ctx.channels.find((c) => c.id === id)?.name ?? '?';
  const v = (id: string) => ctx.videos.find((x) => x.id === id);
  const vName = (id: string) => `«${v(id)?.title ?? '?'}» (${chName(v(id)?.channelId ?? '')})`;
  const tName = (id: string) => `«${ctx.tasks?.find((t) => t.id === id)?.title ?? '?'}»`;
  return actions.map((a) => {
    switch (a.type) {
      case 'add_channel':
        return `новый канал «${a.name}»${a.status ? `, ${CHANNEL_STATUS_LABEL[a.status]}` : ''}${a.transformer ? `, Transformer: ${a.transformer}` : ''}`;
      case 'update_channel': {
        const parts = [
          a.name && `название «${a.name}»`,
          a.status && `статус ${CHANNEL_STATUS_LABEL[a.status]}`,
          a.color && `цвет ${a.color}`,
          a.niche && `ниша «${a.niche}»`,
          a.transformer && `Transformer: ${a.transformer}`,
          a.pausedUntil && `пауза до ${dmy(a.pausedUntil)}`,
          a.abandonReason && `причина: ${a.abandonReason}`,
        ].filter(Boolean);
        return `канал ${chName(a.channelId)}: ${parts.join(', ') || 'без изменений'}`;
      }
      case 'delete_channel':
        return `УДАЛИТЬ канал ${chName(a.channelId)}`;
      case 'add_video':
        return `новое видео «${a.title}» на ${chName(a.channelId)} → ${STAGE_LABEL[a.stage ?? 'editing']}${a.publishDate ? `, выход ${dmy(a.publishDate)}` : ''}${a.urgent ? ', СРОЧНО' : ''}`;
      case 'move_video':
        return `${vName(a.videoId)} → ${STAGE_LABEL[a.stage]}`;
      case 'rename_video':
        return `${vName(a.videoId)} → название «${a.title}»`;
      case 'set_publish_date':
        return `${vName(a.videoId)} → ${a.publishDate ? `выход ${dmy(a.publishDate)}` : 'без даты'}`;
      case 'set_urgent':
        return `${vName(a.videoId)} → ${a.urgent ? 'срочно' : 'не срочно'}`;
      case 'delete_video':
        return `УДАЛИТЬ видео ${vName(a.videoId)}`;
      case 'patch_day':
        return `день ${dmy(a.date)}: ${Object.keys(a.patch).join(', ')}`;
      case 'add_goal_step':
        return `шаг к цели (неделя ${a.weekIndex + 1}): ${a.title}`;
      case 'save_ai_memory':
        return `вывод анализа (${a.period} ${a.periodKey}) сохранён`;
      case 'mark_habits':
        return `привычки ${dmy(a.date)}: ${a.taskIds.map(tName).join(', ') || 'ничего'}`;
      case 'update_task':
        return `задача ${tName(a.taskId)}: ${a.done ? 'сделана' : a.progressPct !== undefined ? `${a.progressPct}%` : ''}${a.dropReason ? `, брошена: ${a.dropReason}` : ''}`;
      case 'update_goal':
        return `цель «${ctx.goalTitles?.[a.goalId] ?? a.goalId}»: ${a.set !== undefined ? `теперь ${a.set}` : `+${a.add}`}`;
      case 'add_income':
        return `доход $${a.amountUsd} за ${dmy(a.date)}${a.channelId ? ` (${chName(a.channelId)})` : ''}`;
      case 'set_plan':
        return `главная задача на ${dmy(a.date)}: ${a.mainTask}`;
      case 'finish_report':
        return `отчёт за ${dmy(a.date)} закрыт, награда за Big Data`;
    }
  });
}

/** Видео с новым этапом: чек-лист и дата выкладки — как на сайте (videoToCloud) */
export function withStage(v: Video, stage: Stage, today: string): Video {
  const cloud = TO_CLOUD[stage];
  const checklist = { plan: false, title: false, thumbnail: false, edit: false, upload: false, ...(v.checklist ?? {}) };
  if (stage !== 'editing') checklist.edit = true;
  if (cloud !== 'editing') {
    checklist.title = true;
    checklist.thumbnail = true;
  }
  if (cloud === 'published') checklist.upload = true;
  const out: Video = { ...v, stage: cloud, legacyStage: stage, isUploaded: cloud === 'published', checklist };
  if (cloud === 'published') out.publishedAt = v.publishedAt ?? today;
  else delete out.publishedAt;
  return out;
}

/** Выполнить действия; награда за выкладку — один раз на видео, как на сайте */
export async function applyActions(store: ConversationStore, actions: Action[], now: Date): Promise<void> {
  const today = todayStr(now);
  let n = 0;
  const id = (p: string) => `${p}-${now.getTime()}-${(n += 1)}`;
  for (const a of actions) {
    switch (a.type) {
      case 'add_channel': {
        const status = a.status ?? 'active';
        await store.saveChannel({
          id: id('ch'),
          name: a.name,
          status,
          cadencePerDay: 1,
          color: CHANNEL_STATUS_COLOR[status],
          ...(a.niche ? { niche: a.niche } : {}),
          ...(a.transformer ? { transformer: a.transformer } : {}),
        });
        break;
      }
      case 'update_channel': {
        const c = (await store.listChannels()).find((x) => x.id === a.channelId);
        if (!c) break;
        const next: Channel = { ...c };
        if (a.name) next.name = a.name;
        if (a.niche) next.niche = a.niche;
        if (a.transformer) next.transformer = a.transformer;
        if (a.abandonReason) next.abandonReason = a.abandonReason;
        if (a.status) {
          next.status = a.status;
          next.color = CHANNEL_STATUS_COLOR[a.status];
          if (a.status !== 'paused') delete next.pausedUntil;
        }
        if (a.pausedUntil) next.pausedUntil = a.pausedUntil;
        if (a.color) next.color = a.color;
        await store.saveChannel(next);
        break;
      }
      case 'delete_channel':
        await store.deleteChannel(a.channelId);
        break;
      case 'add_video': {
        const base: Video = {
          id: id('vid'),
          channelId: a.channelId,
          title: a.title,
          stage: 'editing',
          ...(a.publishDate ? { publishDate: a.publishDate } : {}),
          ...(a.urgent ? { urgent: true } : {}),
        };
        const v = withStage(base, a.stage ?? 'editing', today);
        await store.saveVideo(v);
        if (v.stage === 'published') await applyGame(store, { kind: 'video_published', ref: v.id }, now);
        break;
      }
      case 'patch_day':
        await store.patchDay(a.date, a.patch);
        break;
      case 'add_goal_step':
        await store.saveGoalStep({ id: id('step'), goalId: a.goalId, weekIndex: a.weekIndex, title: a.title, done: false, proposed: true });
        break;
      case 'mark_habits':
        await markHabits(store, a.date, a.taskIds, now);
        break;
      case 'update_task': {
        const t = (await store.listTasks()).find((x) => x.id === a.taskId);
        if (!t) break;
        const complete = a.done || (a.progressPct ?? 0) >= 100;
        await store.saveTask({
          ...t,
          ...(complete ? { completed: true, completedAt: now.toISOString(), progressPct: 100 } : {}),
          ...(a.progressPct !== undefined && !complete ? { progressPct: a.progressPct } : {}),
          ...(a.dropReason ? { dropReason: a.dropReason } : {}),
        });
        // Та же награда, что у сайта при галочке: одна задача — один раз
        if (complete) await applyGame(store, { kind: 'task', ref: t.id }, now);
        break;
      }
      case 'update_goal': {
        const g = (await store.listGoals()).find((x) => x.id === a.goalId);
        if (!g) break;
        const current = a.set !== undefined ? a.set : (Number(g.current) || 0) + (a.add ?? 0);
        await store.saveGoal({ ...g, current: g.kind === 'numeric' ? current : Math.min(100, Math.max(0, current)) });
        break;
      }
      case 'add_income': {
        const row = { id: id('inc'), date: a.date, amountUsd: a.amountUsd, ...(a.channelId ? { channelId: a.channelId } : {}), ...(a.source ? { source: a.source } : {}) };
        await store.saveIncome(row);
        await applyGame(store, { kind: 'income', ref: row.id, amountUsd: a.amountUsd }, now);
        break;
      }
      case 'set_plan': {
        const key = `plan:${a.date}`;
        const plan = (await store.getKv<Record<string, unknown>>(key)) ?? {};
        await store.setKv(key, { ...plan, mainTask: a.mainTask, firstBlockTask: a.mainTask, ...(a.mainTaskId ? { mainTaskId: a.mainTaskId } : {}) });
        break;
      }
      case 'finish_report':
        await store.patchDay(a.date, { reportStatus: 'done' });
        await applyGame(store, { kind: 'bigdata_fill', ref: a.date }, now);
        await closePendingDays(store, today, now);
        break;
      case 'save_ai_memory':
        await store.saveAiMemory({ id: `${a.period}-${a.periodKey}`, period: a.period, periodKey: a.periodKey, summary: a.summary, ...(a.facts ? { facts: a.facts } : {}) });
        break;
      default: {
        const v = (await store.listVideos()).find((x) => x.id === a.videoId);
        if (!v) break;
        if (a.type === 'delete_video') await store.deleteVideo(v.id);
        else if (a.type === 'rename_video') await store.saveVideo({ ...v, title: a.title });
        else if (a.type === 'set_urgent') await store.saveVideo({ ...v, urgent: a.urgent });
        else if (a.type === 'set_publish_date') {
          const next = { ...v };
          if (a.publishDate) next.publishDate = a.publishDate;
          else delete next.publishDate;
          await store.saveVideo(next);
        } else {
          const next = withStage(v, a.stage, today);
          // Выложено — срочность больше не нужна
          if (next.stage === 'published') delete next.urgent;
          await store.saveVideo(next);
          if (next.stage === 'published' && v.stage !== 'published') await applyGame(store, { kind: 'video_published', ref: v.id }, now);
        }
      }
    }
  }
}

/** Отметить привычки дня: касания (habitsDoneIds), ежедневные — галочкой; награды по правилам сайта */
export async function markHabits(store: ConversationStore, date: string, ids: string[], now: Date): Promise<void> {
  const today = todayStr(now);
  const habits = habitsOf(await store.listTasks());
  const day = (await store.getDay(date)) ?? { date };
  const doneIds = new Set<string>(Array.isArray(day.habitsDoneIds) ? (day.habitsDoneIds as string[]) : []);
  const rewarded = new Set<string>(Array.isArray(day.habitsRewardedIds) ? (day.habitsRewardedIds as string[]) : []);
  for (const h of habits.filter((x) => ids.includes(x.id))) {
    if (h.type === 'habit') doneIds.add(h.id);
    else if (date === today && !h.completed) {
      await store.saveTask({ ...h, completed: true, completedAt: now.toISOString(), streakCount: (h.streakCount ?? 0) + 1 });
      h.completed = true;
    } else doneIds.add(h.id);
    if (!rewarded.has(h.id)) {
      const r = await applyGame(store, { kind: h.type === 'habit' ? 'habit' : 'daily', ref: `${date}:${h.id}` }, now);
      if (r.applied || r.rejected === 'duplicate') rewarded.add(h.id);
    }
  }
  const done = (t: Task) => doneIds.has(t.id) || (t.type === 'daily' && date === today && !!t.completed);
  const water = habits.some((h) => done(h) && /вод/i.test(h.title));
  await store.patchDay(date, {
    habitsDoneIds: [...doneIds],
    habitsRewardedIds: [...rewarded],
    habitsDone: habits.filter(done).length,
    habitsTotal: habits.length,
    habitsMissed: habits.filter((h) => !done(h)).map((h) => h.title),
    ...(water ? { waterOk: true } : {}),
  });
}
