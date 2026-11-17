// Описание таблиц 002 для хранилища: ключ строки и колонки (snake_case).
// Должно совпадать с supabase/migrations/002_questflow2.sql.
// Поля объекта, которых нет в колонках, уходят в колонку extra (jsonb).
import type { TableName } from '@shared/types';

export type { TableName };

/** Ключ строки: id / date / key; 'user_id' — одна запись на пользователя */
export type KeyColumn = 'id' | 'date' | 'key' | 'user_id';

export interface TableDef {
  key: KeyColumn;
  /** Колонки содержимого (без user_id, updated_at, deleted, extra) */
  columns: readonly string[];
}

export const TABLES: Record<TableName, TableDef> = {
  tasks2: {
    key: 'id',
    columns: ['id', 'title', 'description', 'type', 'kind', 'priority', 'project_id', 'tags', 'difficulty', 'completed', 'completed_at', 'due_date', 'due_time', 'recurrence', 'streak_count', 'habit_direction', 'habit_counter', 'subtasks', 'progress_pct', 'drop_reason', 'goal_step_id', 'seed'],
  },
  projects2: { key: 'id', columns: ['id', 'name', 'color', 'icon', 'is_favorite', 'seed'] },
  rewards2: {
    key: 'id',
    columns: ['id', 'title', 'cost', 'type', 'icon', 'description', 'times_purchased', 'buff_effect', 'tier', 'seed'],
  },
  game_stats: {
    key: 'user_id',
    columns: ['level', 'exp', 'max_exp', 'hp', 'max_hp', 'gold', 'streak', 'best_streak', 'income_usd_total'],
  },
  game_events: { key: 'id', columns: ['id', 'at', 'kind', 'delta_exp', 'delta_gold', 'delta_hp', 'ref', 'note'] },
  achievements: { key: 'id', columns: ['id', 'unlocked_at'] },
  goals: {
    key: 'id',
    columns: ['id', 'month', 'title', 'kind', 'target', 'unit', 'current', 'status', 'summary', 'seed'],
  },
  goal_weeks: { key: 'id', columns: ['id', 'goal_id', 'week_index', 'target', 'actual', 'review'] },
  goal_steps: { key: 'id', columns: ['id', 'goal_id', 'week_index', 'title', 'done', 'progress_pct'] },
  focus_sessions: {
    key: 'id',
    columns: ['id', 'date', 'block_index', 'started_at', 'ended_at', 'minutes', 'task_id', 'result', 'progress_pct', 'drop_reason'],
  },
  timer_state: {
    key: 'user_id',
    columns: ['phase', 'running', 'started_at', 'accumulated_sec', 'target_min', 'block_index', 'task_id', 'date', 'notified_end'],
  },
  bigdata_days: {
    key: 'date',
    columns: ['date', 'sleep_min', 'sleep_quality', 'score', 'why', 'tags', 'supplements', 'criteria', 'note', 'water_ok', 'focus_min', 'report_status'],
  },
  bigdata_config: { key: 'user_id', columns: ['spheres', 'criteria', 'supplements', 'seed'] },
  health_food: { key: 'id', columns: ['id', 'timestamp', 'date', 'time', 'meal_type', 'food', 'feeling', 'notes'] },
  health_alarms: { key: 'id', columns: ['id', 'title', 'time', 'enabled', 'type', 'sound_enabled', 'repeat_daily'] },
  channels2: {
    key: 'id',
    columns: ['id', 'name', 'niche', 'status', 'paused_until', 'cadence_per_day', 'edit_hours_min', 'edit_hours_max', 'abandon_reason', 'color', 'seed'],
  },
  videos2: { key: 'id', columns: ['id', 'channel_id', 'title', 'stage', 'checklist', 'publish_date', 'published_at'] },
  income: { key: 'id', columns: ['id', 'date', 'channel_id', 'amount_usd', 'source'] },
  bot_settings: {
    key: 'user_id',
    columns: ['chat_id', 'morning_hm', 'evening_hm', 'reminder_limit', 'last_sent', 'conversation'],
  },
  ai_memory: { key: 'id', columns: ['id', 'period', 'period_key', 'summary', 'facts'] },
  kv: { key: 'key', columns: ['key', 'value'] },
};

export const TABLE_NAMES = Object.keys(TABLES) as TableName[];

/** Ключ записи для таблиц «одна запись на пользователя» */
export const SINGLE_KEY = 'me';

/** on_conflict для upsert */
export function conflictTarget(table: TableName): string {
  const key = TABLES[table].key;
  return key === 'user_id' ? 'user_id' : `user_id,${key}`;
}
