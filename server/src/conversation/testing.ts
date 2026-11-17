// Хранилище в памяти — подмена Supabase для тестов разговора (тот же интерфейс ConversationStore).
// Каждое сохранение проходит через JSON, как настоящая база: состояние нельзя испортить по ссылке.
import type { ConversationStore, StepRow } from './store';
import type {
  AchievementRow,
  AiMemory,
  BigDataConfig,
  BigDataDay,
  Channel,
  FocusSession,
  FoodEntry,
  GameEvent,
  GameStats,
  Goal,
  GoalWeek,
  Income,
  Reward,
  Task,
  Video,
} from '../../../shared/types';

export interface MemoryData {
  conversation: unknown;
  days: Record<string, BigDataDay>;
  config: BigDataConfig | null;
  tasks: Task[];
  sessions: FocusSession[];
  goals: Goal[];
  weeks: GoalWeek[];
  steps: StepRow[];
  channels: Channel[];
  videos: Video[];
  income: Income[];
  rewards: Reward[];
  stats: GameStats | null;
  events: GameEvent[];
  achievements: AchievementRow[];
  memory: AiMemory[];
  kv: Record<string, unknown>;
  /** Дневник питания (health_food) */
  food?: FoodEntry[];
}

const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

function upsertById<T extends { id: string }>(list: T[], item: T) {
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = clone(item);
  else list.push(clone(item));
}

export function emptyData(over: Partial<MemoryData> = {}): MemoryData {
  return {
    conversation: null,
    days: {},
    config: null,
    tasks: [],
    sessions: [],
    goals: [],
    weeks: [],
    steps: [],
    channels: [],
    videos: [],
    income: [],
    rewards: [],
    stats: null,
    events: [],
    achievements: [],
    memory: [],
    kv: {},
    ...over,
  };
}

export function createMemoryStore(data: MemoryData): ConversationStore {
  return {
    getConversation: async () => clone(data.conversation),
    saveConversation: async (s) => void (data.conversation = clone(s)),
    getDay: async (date) => clone(data.days[date] ?? null),
    patchDay: async (date, patch) => {
      data.days[date] = clone({ ...(data.days[date] ?? {}), ...patch, date } as BigDataDay);
      return clone(data.days[date]);
    },
    listDays: async (a, b) => clone(Object.values(data.days).filter((d) => d.date >= a && d.date <= b)),
    getBigDataConfig: async () => clone(data.config),
    listTasks: async () => clone(data.tasks),
    saveTask: async (t) => upsertById(data.tasks, t),
    listFocusSessions: async (a, b) => clone(data.sessions.filter((s) => s.date >= a && s.date <= b)),
    listGoals: async () => clone(data.goals),
    saveGoal: async (g) => upsertById(data.goals, g),
    listGoalWeeks: async () => clone(data.weeks),
    saveGoalWeek: async (w) => upsertById(data.weeks, w),
    listGoalSteps: async () => clone(data.steps),
    saveGoalStep: async (s) => upsertById(data.steps, s),
    listChannels: async () => clone(data.channels),
    saveChannel: async (c) => upsertById(data.channels, c),
    listVideos: async () => clone(data.videos),
    saveVideo: async (v) => upsertById(data.videos, v),
    listIncome: async () => clone(data.income),
    saveIncome: async (r) => upsertById(data.income, r),
    listRewards: async () => clone(data.rewards),
    getGameStats: async () => clone(data.stats),
    saveGameStats: async (s) => void (data.stats = clone(s)),
    listGameEvents: async () => clone(data.events),
    insertGameEvent: async (ev) => {
      if (data.events.some((e) => e.id === ev.id)) return false;
      data.events.push(clone(ev));
      return true;
    },
    listAchievements: async () => clone(data.achievements),
    insertAchievement: async (a) => upsertById(data.achievements, a),
    listAiMemory: async () => clone(data.memory),
    saveAiMemory: async (m) => upsertById(data.memory, m),
    listHealthFood: async (a, b) => clone((data.food ?? []).filter((f) => f.date >= a && f.date <= b)),
    getKv: async <T,>(key: string) => clone((data.kv[key] as T) ?? null),
    setKv: async (key, value) => void (data.kv[key] = clone(value)),
  };
}
