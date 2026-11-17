// Данные вечернего разговора: чтение и запись таблиц 002 от имени владельца.
// Шов для тестов — интерфейс ConversationStore (в тестах — createMemoryStore из ./testing).
// Запись — целой строкой (все колонки, лишние поля в extra), как у сайта (src/store/mapping.ts),
// и всегда с updated_at: триггер 002 игнорирует UPDATE без более нового updated_at.
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
  GoalStep,
  GoalWeek,
  Income,
  Reward,
  TableName,
  Task,
  Video,
} from '../../../shared/types';
import type { SupabaseLike } from '../db';

export type Row = Record<string, unknown>;

/** Шаг недели с признаком «предложен Claude» (лежит в extra) */
export type StepRow = GoalStep & { proposed?: boolean; dropReason?: string; [extra: string]: unknown };

export interface ConversationStore {
  getConversation(): Promise<unknown>;
  saveConversation(state: unknown): Promise<void>;

  getDay(date: string): Promise<BigDataDay | null>;
  /** Дописать поля дня (остальные сохраняются) */
  patchDay(date: string, patch: Partial<BigDataDay>): Promise<BigDataDay>;
  listDays(fromDate: string, toDate: string): Promise<BigDataDay[]>;
  getBigDataConfig(): Promise<BigDataConfig | null>;

  listTasks(): Promise<Task[]>;
  saveTask(task: Task): Promise<void>;
  listFocusSessions(fromDate: string, toDate: string): Promise<FocusSession[]>;

  listGoals(): Promise<Goal[]>;
  saveGoal(goal: Goal): Promise<void>;
  listGoalWeeks(): Promise<GoalWeek[]>;
  saveGoalWeek(week: GoalWeek): Promise<void>;
  listGoalSteps(): Promise<StepRow[]>;
  saveGoalStep(step: StepRow): Promise<void>;

  listChannels(): Promise<Channel[]>;
  saveChannel(channel: Channel): Promise<void>;
  listVideos(): Promise<Video[]>;
  saveVideo(video: Video): Promise<void>;
  listIncome(): Promise<Income[]>;
  saveIncome(row: Income): Promise<void>;
  listRewards(): Promise<Reward[]>;

  getGameStats(): Promise<GameStats | null>;
  saveGameStats(stats: GameStats): Promise<void>;
  listGameEvents(): Promise<GameEvent[]>;
  /** Только вставка. false — строка с таким id уже есть (повтор): статы не применять */
  insertGameEvent(ev: GameEvent): Promise<boolean>;
  listAchievements(): Promise<AchievementRow[]>;
  insertAchievement(row: AchievementRow): Promise<void>;

  listAiMemory(): Promise<AiMemory[]>;
  saveAiMemory(row: AiMemory): Promise<void>;

  /** Дневник питания (health_food) за даты [fromDate, toDate] — для AI-советника */
  listHealthFood(fromDate: string, toDate: string): Promise<FoodEntry[]>;

  getKv<T = unknown>(key: string): Promise<T | null>;
  setKv(key: string, value: unknown): Promise<void>;
}

// Колонки таблиц — копия src/store/tables.ts (должна совпадать с 002_questflow2.sql)
const COLUMNS: Partial<Record<TableName, readonly string[]>> = {
  tasks2: ['id', 'title', 'description', 'type', 'kind', 'priority', 'project_id', 'tags', 'difficulty', 'completed', 'completed_at', 'due_date', 'due_time', 'recurrence', 'streak_count', 'habit_direction', 'habit_counter', 'subtasks', 'progress_pct', 'drop_reason', 'goal_step_id', 'seed'],
  game_stats: ['level', 'exp', 'max_exp', 'hp', 'max_hp', 'gold', 'streak', 'best_streak', 'income_usd_total'],
  game_events: ['id', 'at', 'kind', 'delta_exp', 'delta_gold', 'delta_hp', 'ref', 'note'],
  achievements: ['id', 'unlocked_at'],
  goals: ['id', 'month', 'title', 'kind', 'target', 'unit', 'current', 'status', 'summary', 'seed'],
  goal_weeks: ['id', 'goal_id', 'week_index', 'target', 'actual', 'review'],
  goal_steps: ['id', 'goal_id', 'week_index', 'title', 'done', 'progress_pct'],
  focus_sessions: ['id', 'date', 'block_index', 'started_at', 'ended_at', 'minutes', 'task_id', 'result', 'progress_pct', 'drop_reason'],
  bigdata_days: ['date', 'sleep_min', 'sleep_quality', 'score', 'why', 'tags', 'supplements', 'criteria', 'note', 'water_ok', 'focus_min', 'report_status'],
  bigdata_config: ['spheres', 'criteria', 'supplements', 'seed'],
  channels2: ['id', 'name', 'niche', 'status', 'paused_until', 'cadence_per_day', 'edit_hours_min', 'edit_hours_max', 'abandon_reason', 'color', 'seed'],
  videos2: ['id', 'channel_id', 'title', 'stage', 'checklist', 'publish_date', 'published_at'],
  income: ['id', 'date', 'channel_id', 'amount_usd', 'source'],
  rewards2: ['id', 'title', 'cost', 'type', 'icon', 'description', 'times_purchased', 'buff_effect', 'tier', 'seed'],
  ai_memory: ['id', 'period', 'period_key', 'summary', 'facts'],
  kv: ['key', 'value'],
};

const META = new Set(['user_id', 'updated_at', 'deleted', 'extra']);
const toSnake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toCamel = (s: string) => s.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase());

function isDateColumn(c: string) {
  return c === 'date' || c.endsWith('_date') || c === 'paused_until';
}

/** Объект (camelCase) → строка таблицы: все колонки, лишнее — в extra */
export function toRow(table: TableName, item: object): Row {
  const cols = COLUMNS[table] ?? [];
  const set = new Set(cols);
  const row: Row = {};
  const extra: Row = {};
  for (const [k, v] of Object.entries(item)) {
    if (v === undefined || META.has(k)) continue;
    const sk = toSnake(k);
    if (set.has(sk)) row[sk] = v === '' ? null : isDateColumn(sk) && typeof v === 'string' ? v.slice(0, 10) : v;
    else extra[k] = v;
  }
  for (const c of cols) if (!(c in row)) row[c] = null;
  row.extra = extra;
  return row;
}

/** Строка → объект (поля extra + колонки, null опускаются) */
export function fromRow<T>(row: Row): T {
  const out: Row = { ...(row.extra && typeof row.extra === 'object' ? (row.extra as Row) : {}) };
  for (const [k, v] of Object.entries(row)) {
    if (META.has(k) || v === null || v === undefined) continue;
    out[toCamel(k)] = v;
  }
  return out as T;
}

const PAGE = 1000;

/** Хранилище поверх Supabase (service-role клиент, только строки владельца) */
export function createSupabaseStore(client: SupabaseLike, ownerUserId: string, now: () => Date = () => new Date()): ConversationStore {
  async function selectAll(table: TableName): Promise<Row[]> {
    const out: Row[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await client.from(table).select('*').eq('user_id', ownerUserId).range(from, from + PAGE - 1);
      if (error) throw new Error(`${table}: ${error.message}`);
      const rows = (data ?? []) as Row[];
      out.push(...rows);
      if (rows.length < PAGE) break;
    }
    return out.filter((r) => r.deleted !== true);
  }
  const list = async <T>(table: TableName) => (await selectAll(table)).map((r) => fromRow<T>(r));

  async function upsert(table: TableName, item: object, conflict: string) {
    const row = { ...toRow(table, item), user_id: ownerUserId, updated_at: now().toISOString(), deleted: false };
    const { error } = await client.from(table).upsert(row, { onConflict: conflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }

  async function getOne<T>(table: TableName, keyCol: string, key: string): Promise<T | null> {
    const { data, error } = await client.from(table).select('*').eq('user_id', ownerUserId).eq(keyCol, key).maybeSingle();
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || (data as Row).deleted === true) return null;
    return fromRow<T>(data as Row);
  }

  const single = async <T>(table: TableName) => {
    const rows = await selectAll(table);
    return rows[0] ? fromRow<T>(rows[0]) : null;
  };

  return {
    async getConversation() {
      const { data, error } = await client.from('bot_settings').select('conversation').eq('user_id', ownerUserId).maybeSingle();
      if (error) throw new Error(`bot_settings: ${error.message}`);
      return (data as Row | null)?.conversation ?? null;
    },
    async saveConversation(state) {
      const { error } = await client
        .from('bot_settings')
        .upsert({ user_id: ownerUserId, conversation: state, updated_at: now().toISOString() }, { onConflict: 'user_id' });
      if (error) throw new Error(`bot_settings: ${error.message}`);
    },

    getDay: (date) => getOne<BigDataDay>('bigdata_days', 'date', date),
    async patchDay(date, patch) {
      const cur = (await getOne<BigDataDay>('bigdata_days', 'date', date)) ?? { date };
      const next = { ...cur, ...patch, date } as BigDataDay;
      await upsert('bigdata_days', next, 'user_id,date');
      return next;
    },
    async listDays(fromDate, toDate) {
      return (await list<BigDataDay>('bigdata_days')).filter((d) => d.date >= fromDate && d.date <= toDate);
    },
    getBigDataConfig: () => single<BigDataConfig>('bigdata_config'),

    listTasks: () => list<Task>('tasks2'),
    saveTask: (t) => upsert('tasks2', t, 'user_id,id'),
    async listFocusSessions(fromDate, toDate) {
      return (await list<FocusSession>('focus_sessions')).filter((s) => s.date >= fromDate && s.date <= toDate);
    },

    listGoals: () => list<Goal>('goals'),
    saveGoal: (g) => upsert('goals', g, 'user_id,id'),
    listGoalWeeks: () => list<GoalWeek>('goal_weeks'),
    saveGoalWeek: (w) => upsert('goal_weeks', w, 'user_id,id'),
    listGoalSteps: () => list<StepRow>('goal_steps'),
    saveGoalStep: (s) => upsert('goal_steps', s, 'user_id,id'),

    listChannels: () => list<Channel>('channels2'),
    saveChannel: (c) => upsert('channels2', c, 'user_id,id'),
    listVideos: () => list<Video>('videos2'),
    saveVideo: (v) => upsert('videos2', v, 'user_id,id'),
    listIncome: () => list<Income>('income'),
    saveIncome: (r) => upsert('income', r, 'user_id,id'),
    listRewards: () => list<Reward>('rewards2'),

    getGameStats: () => single<GameStats>('game_stats'),
    saveGameStats: (s) => upsert('game_stats', s, 'user_id'),
    listGameEvents: () => list<GameEvent>('game_events'),
    async insertGameEvent(ev) {
      const row = { ...toRow('game_events', ev), user_id: ownerUserId, updated_at: now().toISOString(), deleted: false };
      const { error } = await client.from('game_events').insert(row);
      if (!error) return true;
      // 23505 — нарушение уникальности (user_id, id): событие уже записано (сайтом или прошлым запуском)
      if ((error as { code?: string }).code === '23505') return false;
      throw new Error(`game_events: ${error.message}`);
    },
    listAchievements: () => list<AchievementRow>('achievements'),
    insertAchievement: (a) => upsert('achievements', a, 'user_id,id'),

    listAiMemory: () => list<AiMemory>('ai_memory'),
    saveAiMemory: (m) => upsert('ai_memory', m, 'user_id,id'),

    async listHealthFood(fromDate, toDate) {
      return (await list<FoodEntry>('health_food')).filter((f) => typeof f.date === 'string' && f.date >= fromDate && f.date <= toDate);
    },

    async getKv<T>(key: string) {
      const row = await getOne<{ key: string; value: unknown }>('kv', 'key', key);
      return row ? ((row.value as T) ?? null) : null;
    },
    setKv: (key, value) => upsert('kv', { key, value }, 'user_id,key'),
  };
}
