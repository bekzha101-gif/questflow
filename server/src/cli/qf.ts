// qf — инструмент Claude для QuestFlow: читать каналы, видео, данные дня и записывать изменения.
// Запуск: node dist/server/src/cli/qf.js <команда> (из папки server, после npm run build).
//   evening [дата]        — всё для вечернего разговора: день, привычки, задачи, цели, БАДы, напоминания (JSON)
//   state                 — каналы, видео не выложенные и выложенные за 7 дней, напоминания (JSON)
//   reminders [дата]      — что выходит сегодня и завтра, просрочки, срочные (JSON)
//   snapshot day|week|month [дата] — данные для анализа (тот же срез, что у советника) (JSON)
//   apply <файл.json|-> [--dry] — проверить и выполнить действия (см. cli/actions.ts); --dry только показать
import fs from 'node:fs';
import { addDays, dayOfWeek, todayStr } from '../../../shared/time';
import { CHANNEL_STATUS_LABEL, channelTodo, effectiveStatus } from '../../../shared/channels';
import type { Channel, Video } from '../../../shared/types';
import { envFilePath, loadEnvFile, readConfig, redact } from '../config';
import { createSupabaseClient } from '../db';
import { createSupabaseStore, type ConversationStore } from '../conversation/store';
import { buildPayload } from '../conversation/context';
import { healthPayload } from '../advisor';
import { STAGE_LABEL, applyActions, describeActions, habitsOf, isStage, validateActions, type Ctx } from './actions';

const stageOf = (v: Video) => (isStage(v.legacyStage) && v.stage !== 'published' ? v.legacyStage : v.stage === 'review' ? 'review' : v.stage);

export interface Reminders {
  today: string;
  overdue: VideoLine[];
  publishToday: VideoLine[];
  publishTomorrow: VideoLine[];
  urgent: VideoLine[];
  /** Активные каналы без единого видео в работе */
  noPlan: string[];
}

interface VideoLine {
  id: string;
  channel: string;
  title: string;
  stage: string;
  publishDate?: string;
  urgent?: boolean;
}

function line(v: Video, channels: Channel[]): VideoLine {
  return {
    id: v.id,
    channel: channels.find((c) => c.id === v.channelId)?.name ?? '?',
    title: v.title,
    stage: STAGE_LABEL[stageOf(v) as keyof typeof STAGE_LABEL] ?? v.stage,
    ...(v.publishDate ? { publishDate: v.publishDate } : {}),
    ...(v.urgent === true ? { urgent: true } : {}),
  };
}

/** Напоминания о публикациях: просрочено, сегодня, завтра, срочные, каналы без плана */
export function remindersOf(channels: Channel[], videos: Video[], today: string): Reminders {
  const tomorrow = addDays(today, 1);
  const open = videos.filter((v) => v.stage !== 'published' && channels.some((c) => c.id === v.channelId));
  const pick = (f: (v: Video) => boolean) => open.filter(f).map((v) => line(v, channels));
  const active = channels.filter((c) => effectiveStatus(c, today) === 'active');
  return {
    today,
    overdue: pick((v) => !!v.publishDate && v.publishDate < today),
    publishToday: pick((v) => v.publishDate === today),
    publishTomorrow: pick((v) => v.publishDate === tomorrow),
    urgent: pick((v) => v.urgent === true),
    noPlan: active.filter((c) => !open.some((v) => v.channelId === c.id)).map((c) => c.name),
  };
}

async function state(store: ConversationStore, today: string) {
  const [channels, videos] = await Promise.all([store.listChannels(), store.listVideos()]);
  const weekAgo = addDays(today, -7);
  return {
    today,
    channels: channels.map((c) => {
      const todo = channelTodo(c, videos, today);
      return {
        id: c.id,
        name: c.name,
        status: CHANNEL_STATUS_LABEL[effectiveStatus(c, today)],
        ...(c.pausedUntil ? { pausedUntil: c.pausedUntil } : {}),
        ...(typeof c.transformer === 'string' ? { transformer: c.transformer } : {}),
        ...(c.niche ? { niche: c.niche } : {}),
        color: c.color,
        next: todo.label,
        videos: videos
          .filter((v) => v.channelId === c.id && (v.stage !== 'published' || (v.publishedAt ?? '') >= weekAgo))
          .map((v) => ({ ...line(v, channels), ...(v.publishedAt ? { publishedAt: v.publishedAt } : {}) })),
      };
    }),
    reminders: remindersOf(channels, videos, today),
  };
}

async function ctxOf(store: ConversationStore): Promise<Ctx> {
  const [channels, videos, goals, tasks] = await Promise.all([store.listChannels(), store.listVideos(), store.listGoals(), store.listTasks()]);
  return { channels, videos, tasks, goalIds: goals.map((g) => g.id), goalTitles: Object.fromEntries(goals.map((g) => [g.id, g.title])) };
}

/** Всё для вечернего разговора одним JSON: день, привычки, открытые задачи, цели, БАДы, напоминания */
async function evening(store: ConversationStore, date: string) {
  const [day, config, tasks, goals, steps, channels, videos, plan] = await Promise.all([
    store.getDay(date),
    store.getBigDataConfig(),
    store.listTasks(),
    store.listGoals(),
    store.listGoalSteps(),
    store.listChannels(),
    store.listVideos(),
    store.getKv<Record<string, unknown>>(`plan:${addDays(date, 1)}`),
  ]);
  const doneIds = new Set(Array.isArray(day?.habitsDoneIds) ? (day!.habitsDoneIds as string[]) : []);
  const month = date.slice(0, 7);
  const monthGoals = goals.filter((g) => g.month === month);
  return {
    date,
    weekday: ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'][dayOfWeek(date)],
    day: day ?? null,
    supplements: (config?.supplements ?? []).map((s) => s.name),
    habits: habitsOf(tasks).map((h) => ({ id: h.id, title: h.title, type: h.type, done: doneIds.has(h.id) || (h.type === 'daily' && !!h.completed) })),
    openTasks: tasks
      .filter((t) => t.type !== 'habit' && t.type !== 'daily' && !t.completed && t.kind !== 'shopping')
      .slice(0, 15)
      .map((t) => ({ id: t.id, title: t.title, priority: t.priority, dueDate: t.dueDate, progressPct: t.progressPct })),
    goals: monthGoals.map((g) => ({ id: g.id, title: g.title, kind: g.kind, status: g.status, current: g.current, target: g.target, unit: g.unit })),
    goalSteps: steps
      .filter((s) => monthGoals.some((g) => g.id === s.goalId))
      .map((s) => ({ id: s.id, goalId: s.goalId, weekIndex: s.weekIndex, title: s.title, done: !!s.done })),
    tomorrowPlan: plan,
    reminders: remindersOf(channels, videos, date),
  };
}

async function main(argv: string[]) {
  loadEnvFile(envFilePath());
  const config = readConfig();
  const client = createSupabaseClient(config.supabaseUrl, config.supabaseServiceRoleKey);
  const store = createSupabaseStore(client, config.ownerUserId);
  const now = new Date();
  const today = todayStr(now);
  const out = (v: unknown) => console.log(JSON.stringify(v, null, 1));
  const [cmd, ...rest] = argv;
  try {
    if (cmd === 'state') return out(await state(store, today));
    if (cmd === 'evening') return out(await evening(store, rest[0] ?? today));
    if (cmd === 'reminders') {
      const [channels, videos] = await Promise.all([store.listChannels(), store.listVideos()]);
      return out(remindersOf(channels, videos, rest[0] ?? today));
    }
    if (cmd === 'snapshot') {
      const kind = rest[0] === 'day' || rest[0] === 'week' ? rest[0] : 'month';
      const date = rest[1] ?? today;
      return out({ ...(await buildPayload(store, kind, date)), health: await healthPayload(store, date) });
    }
    if (cmd === 'apply') {
      const src = rest.find((a) => a !== '--dry');
      if (!src) throw new Error('нужен файл с действиями или - для stdin');
      const raw = JSON.parse(fs.readFileSync(src === '-' ? 0 : src, 'utf8'));
      const ctx = await ctxOf(store);
      const { actions, errors } = validateActions(raw, ctx);
      if (errors.length) {
        console.log(`Ошибки, ничего не записано:\n${errors.map((e) => `- ${e}`).join('\n')}`);
        process.exitCode = 2;
        return;
      }
      const lines = describeActions(actions, ctx);
      if (rest.includes('--dry')) return console.log(`Будет сделано:\n${lines.map((l) => `- ${l}`).join('\n')}`);
      await applyActions(store, actions, now);
      return console.log(`Готово:\n${lines.map((l) => `- ${l}`).join('\n')}`);
    }
    console.log('Команды: evening [дата] | state | reminders [дата] | snapshot day|week|month [дата] | apply <файл|-> [--dry]');
    process.exitCode = 1;
  } catch (e) {
    console.error(`qf: ${redact((e as Error).message, config)}`);
    process.exitCode = 1;
  }
}

if (typeof require !== 'undefined' && require.main === module) void main(process.argv.slice(2));
