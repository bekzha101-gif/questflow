// Доменные типы QuestFlow 2.0 — общие для сайта и сервера.
// Поля в camelCase; в Supabase те же поля в snake_case (см. supabase/migrations/002_questflow2.sql).
// Поля, которых нет среди колонок таблицы, хранятся в колонке extra (jsonb) и не теряются.

/** Таблицы Supabase 002 */
export type TableName =
  | 'tasks2'
  | 'projects2'
  | 'rewards2'
  | 'game_stats'
  | 'game_events'
  | 'achievements'
  | 'goals'
  | 'goal_weeks'
  | 'goal_steps'
  | 'focus_sessions'
  | 'timer_state'
  | 'bigdata_days'
  | 'bigdata_config'
  | 'health_food'
  | 'health_alarms'
  | 'channels2'
  | 'videos2'
  | 'income'
  | 'bot_settings'
  | 'ai_memory'
  | 'kv';

// ─── Задачи ──────────────────────────────────────────────────────────────────
export type TaskType = 'habit' | 'daily' | 'todo';
/** Покупка — отдельный признак, в задачах никогда не показывается */
export type TaskKind = 'task' | 'shopping';

export interface Task {
  id: string;
  title: string;
  description?: string;
  type: TaskType;
  kind?: TaskKind;
  priority?: string;
  projectId?: string;
  tags?: string[];
  difficulty?: string;
  completed?: boolean;
  completedAt?: string;
  dueDate?: string;
  dueTime?: string;
  recurrence?: string;
  streakCount?: number;
  habitDirection?: string;
  habitCounter?: number;
  subtasks?: { id: string; text: string; completed: boolean }[];
  progressPct?: number;
  dropReason?: string;
  goalStepId?: string;
  seed?: boolean;
  [extra: string]: unknown;
}

export interface Project {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  isFavorite?: boolean;
  seed?: boolean;
}

export type RewardTier = 'small' | 'big';

export interface Reward {
  id: string;
  title: string;
  cost: number;
  type?: 'real' | 'game';
  icon?: string;
  description?: string;
  timesPurchased?: number;
  buffEffect?: string;
  tier?: RewardTier;
  seed?: boolean;
}

// ─── Геймификация ────────────────────────────────────────────────────────────
export interface GameStats {
  level: number;
  exp: number;
  maxExp: number;
  hp: number;
  maxHp: number;
  gold: number;
  streak: number;
  bestStreak?: number;
  incomeUsdTotal?: number;
  [extra: string]: unknown;
}

export interface GameEvent {
  id: string;
  at: string;
  kind: string;
  deltaExp?: number;
  deltaGold?: number;
  deltaHp?: number;
  ref?: string;
  note?: string;
}

export interface AchievementRow {
  id: string;
  unlockedAt: string;
}

// ─── Цели ────────────────────────────────────────────────────────────────────
export type GoalKind = 'numeric' | 'percent';
export type GoalStatus = 'active' | 'done' | 'failed' | 'archived';

export interface Goal {
  id: string;
  /** 'YYYY-MM' */
  month: string;
  title: string;
  kind: GoalKind;
  target: number;
  unit?: string;
  current?: number;
  status: GoalStatus;
  summary?: string;
  seed?: boolean;
}

export interface GoalWeek {
  id: string;
  goalId: string;
  /** 1..4 */
  weekIndex: number;
  target: number;
  actual?: number;
  review?: string;
}

export interface GoalStep {
  id: string;
  goalId: string;
  weekIndex: number;
  title: string;
  done?: boolean;
  progressPct?: number;
}

// ─── Фокус и таймер ──────────────────────────────────────────────────────────
export type FocusResult = 'done' | 'partial' | 'dropped';

export interface FocusSession {
  id: string;
  /** YYYY-MM-DD по Бишкеку */
  date: string;
  blockIndex?: number;
  startedAt: string;
  endedAt?: string;
  minutes: number;
  taskId?: string;
  result?: FocusResult;
  progressPct?: number;
  dropReason?: string;
  [extra: string]: unknown;
}

export type TimerPhase = 'idle' | 'work' | 'break';
/** Обратный отсчёт (сам переходит на отдых) или секундомер (без лимита, только «Стоп») */
export type TimerType = 'countdown' | 'stopwatch';

/** Настройки таймера (kv `timer_settings`): одни на все устройства */
export interface TimerSettings {
  workMin: number;
  breakMin: number;
  timerType: TimerType;
}

export interface TimerState {
  phase: TimerPhase;
  running: boolean;
  /** ISO-время начала текущего отрезка (null, когда на паузе) */
  startedAt?: string | null;
  accumulatedSec: number;
  targetMin: number;
  blockIndex: number;
  taskId?: string | null;
  date?: string;
  notifiedEnd?: boolean;
  /** Тип текущего блока; нет поля — обратный отсчёт (старые строки). Колонки нет — уходит в extra. */
  timerType?: TimerType;
  /** Отдых после этого блока, мин (из настроек на момент старта); extra */
  breakMin?: number;
  /** Свободное название блока («Над чем вы работаете?»); extra */
  title?: string | null;
}

// ─── Big Data ────────────────────────────────────────────────────────────────
export type ReportStatus = 'none' | 'partial' | 'done' | 'missed';

export interface BigDataDay {
  /** YYYY-MM-DD — ключ */
  date: string;
  sleepMin?: number;
  sleepQuality?: number;
  score?: number;
  why?: string;
  tags?: string[];
  supplements?: string[];
  criteria?: Record<string, unknown>;
  note?: string;
  waterOk?: boolean;
  focusMin?: number;
  reportStatus?: ReportStatus;
  [extra: string]: unknown;
}

export interface Sphere {
  id: string;
  label: string;
  description?: string;
}

export interface Criterion {
  id: string;
  label: string;
  type: 'number' | 'boolean' | 'minutes' | 'text';
  unit?: string;
}

export interface Supplement {
  id: string;
  name: string;
  dose?: string;
}

export interface BigDataConfig {
  spheres: Sphere[];
  criteria: Criterion[];
  supplements: Supplement[];
  seed?: boolean;
}

// ─── Здоровье ────────────────────────────────────────────────────────────────
export interface FoodEntry {
  id: string;
  timestamp: string;
  date: string;
  time: string;
  mealType: string;
  food: string;
  feeling?: string;
  notes?: string;
}

export interface HealthAlarm {
  id: string;
  title: string;
  time: string;
  enabled: boolean;
  type: string;
  soundEnabled?: boolean;
  repeatDaily?: boolean;
}

// ─── Каналы ──────────────────────────────────────────────────────────────────
export type ChannelStatus = 'active' | 'paused' | 'abandoned' | 'archived';

export interface Channel {
  id: string;
  name: string;
  niche?: string;
  status: ChannelStatus;
  pausedUntil?: string;
  /** Видео в день: 2, 1, 0.5 (раз в 2 дня) */
  cadencePerDay: number;
  editHoursMin?: number;
  editHoursMax?: number;
  abandonReason?: string;
  color?: string;
  seed?: boolean;
  [extra: string]: unknown;
}

export type VideoStage = 'editing' | 'review' | 'published';

export interface VideoChecklist {
  plan: boolean;
  title: boolean;
  thumbnail: boolean;
  edit: boolean;
  upload: boolean;
}

export interface Video {
  id: string;
  channelId: string;
  title: string;
  stage: VideoStage;
  checklist?: VideoChecklist;
  publishDate?: string;
  publishedAt?: string;
  [extra: string]: unknown;
}

export interface Income {
  id: string;
  date: string;
  channelId?: string;
  amountUsd: number;
  source?: string;
  [extra: string]: unknown;
}

// ─── Бот и AI ────────────────────────────────────────────────────────────────
export interface BotSettings {
  chatId?: string;
  morningHm: string;
  eveningHm: string;
  reminderLimit: number;
  lastSent?: Record<string, string>;
  conversation?: unknown;
}

export interface AiMemory {
  id: string;
  period: 'day' | 'week' | 'month';
  periodKey: string;
  summary: string;
  facts?: unknown;
}

export interface KvEntry {
  key: string;
  value: unknown;
}
