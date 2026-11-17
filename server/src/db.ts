// Доступ к Supabase с service-role ключом. Все запросы — только по user_id владельца
// (OWNER_USER_ID). Каждая запись шлёт updated_at: триггер 002 игнорирует UPDATE без
// более нового updated_at.
import { createClient } from '@supabase/supabase-js';
import type {
  BotSettings,
  Channel,
  FocusSession,
  HealthAlarm,
  TableName,
  Task,
  TimerState,
  Video,
} from '../../shared/types';

export type Row = Record<string, unknown>;

/** Все таблицы 002 — для ночного бэкапа */
export const ALL_TABLES: TableName[] = [
  'tasks2', 'projects2', 'rewards2', 'game_stats', 'game_events', 'achievements', 'goals', 'goal_weeks',
  'goal_steps', 'focus_sessions', 'timer_state', 'bigdata_days', 'bigdata_config', 'health_food',
  'health_alarms', 'channels2', 'videos2', 'income', 'bot_settings', 'ai_memory', 'kv',
];

const BOT_SETTINGS_COLUMNS = ['chat_id', 'morning_hm', 'evening_hm', 'reminder_limit', 'last_sent', 'conversation'];

export interface Db {
  getBotSettings(): Promise<BotSettings | null>;
  /** Частичное сохранение: меняет только переданные поля */
  saveBotSettings(patch: Partial<BotSettings>): Promise<void>;
  getTimerState(): Promise<TimerState | null>;
  /** notified_end = true для отрезка, начатого в startedAt (если отрезок уже другой — ничего) */
  markTimerNotified(startedAt: string | null | undefined): Promise<void>;
  listHealthAlarms(): Promise<HealthAlarm[]>;
  listTasks(): Promise<Task[]>;
  listChannels(): Promise<Channel[]>;
  listVideos(): Promise<Video[]>;
  listFocusSessions(date: string): Promise<FocusSession[]>;
  getKv<T = unknown>(key: string): Promise<T | null>;
  /** Все строки владельца по всем таблицам (для бэкапа) */
  dumpAll(): Promise<Record<string, Row[]>>;
}

const META = new Set(['user_id', 'updated_at', 'deleted', 'extra']);
const toCamel = (s: string) => s.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
const toSnake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

/** Строка Supabase → объект (поля из extra + колонки в camelCase, null опускаются) */
export function fromRow<T>(row: Row): T {
  const extra = row.extra && typeof row.extra === 'object' ? (row.extra as Row) : {};
  const out: Row = { ...extra };
  for (const [k, v] of Object.entries(row)) {
    if (META.has(k) || v === null || v === undefined) continue;
    out[toCamel(k)] = v;
  }
  return out as T;
}

/** Минимальный интерфейс клиента supabase-js, который нужен серверу (подменяется в тестах) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SupabaseLike = { from(table: string): any; auth?: any };

export interface DbOptions {
  now?: () => Date;
}

const PAGE = 1000;

export function createDb(client: SupabaseLike, ownerUserId: string, opts: DbOptions = {}): Db {
  const now = opts.now ?? (() => new Date());

  async function selectAll(table: string, includeDeleted = false): Promise<Row[]> {
    const out: Row[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await client
        .from(table)
        .select('*')
        .eq('user_id', ownerUserId)
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`${table}: ${error.message}`);
      const rows = (data ?? []) as Row[];
      out.push(...rows);
      if (rows.length < PAGE) break;
    }
    return includeDeleted ? out : out.filter((r) => r.deleted !== true);
  }

  async function single(table: string): Promise<Row | null> {
    const rows = await selectAll(table);
    return rows[0] ?? null;
  }

  async function list<T>(table: string): Promise<T[]> {
    return (await selectAll(table)).map((r) => fromRow<T>(r));
  }

  return {
    async getBotSettings() {
      const row = await single('bot_settings');
      return row ? fromRow<BotSettings>(row) : null;
    },

    async saveBotSettings(patch) {
      const row: Row = { user_id: ownerUserId, updated_at: now().toISOString() };
      for (const [k, v] of Object.entries(patch)) {
        const col = toSnake(k);
        if (v !== undefined && BOT_SETTINGS_COLUMNS.includes(col)) row[col] = v;
      }
      const { error } = await client.from('bot_settings').upsert(row, { onConflict: 'user_id' });
      if (error) throw new Error(`bot_settings: ${error.message}`);
    },

    async getTimerState() {
      const row = await single('timer_state');
      return row ? fromRow<TimerState>(row) : null;
    },

    async markTimerNotified(startedAt) {
      let q = client
        .from('timer_state')
        .update({ notified_end: true, updated_at: now().toISOString() })
        .eq('user_id', ownerUserId);
      if (startedAt) q = q.eq('started_at', startedAt);
      const { error } = await q;
      if (error) throw new Error(`timer_state: ${error.message}`);
    },

    listHealthAlarms: () => list<HealthAlarm>('health_alarms'),
    listTasks: () => list<Task>('tasks2'),
    listChannels: () => list<Channel>('channels2'),
    listVideos: () => list<Video>('videos2'),

    async listFocusSessions(date) {
      return (await list<FocusSession>('focus_sessions')).filter((s) => s.date === date);
    },

    async getKv<T>(key: string) {
      const { data, error } = await client
        .from('kv')
        .select('*')
        .eq('user_id', ownerUserId)
        .eq('key', key)
        .eq('deleted', false)
        .maybeSingle();
      if (error) throw new Error(`kv: ${error.message}`);
      return data ? ((data as Row).value as T) : null;
    },

    async dumpAll() {
      const out: Record<string, Row[]> = {};
      for (const t of ALL_TABLES) out[t] = await selectAll(t, true);
      return out;
    },
  };
}

/** Настоящий клиент Supabase с service-role ключом (без сессии в браузере) */
export function createSupabaseClient(url: string, serviceRoleKey: string): SupabaseLike {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
