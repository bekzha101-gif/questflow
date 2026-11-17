// Шов к облаку: интерфейс RemoteTable и его реализация через Supabase.
// В тестах подменяется фейком; компоненты к Supabase напрямую не обращаются.
import type { SupabaseClient } from '@supabase/supabase-js';
import { TABLES, conflictTarget, type TableName } from './tables';
import type { Row } from './mapping';

export interface RemoteTable {
  /** Upsert строк по ключу таблицы (user_id добавляет реализация). Бросает ошибку при отказе. */
  upsert(rows: Row[]): Promise<void>;
  /** Все строки пользователя, включая мягко удалённые */
  select(): Promise<Row[]>;
  /** Подписка на изменения (Realtime). Возвращает отписку. */
  subscribe(onRow: (row: Row) => void): () => void;
}

export type RemoteFactory = (table: TableName) => RemoteTable;

const PAGE = 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

/** Реализация RemoteTable поверх supabase-js (anon-ключ + сессия пользователя, RLS) */
export function createSupabaseRemote(client: unknown, userId: string): RemoteFactory {
  const db = client as AnyClient;
  return (table) => ({
    async upsert(rows) {
      if (rows.length === 0) return;
      const payload = rows.map((r) => ({ ...r, user_id: userId }));
      // Журнал (game_events): insert с игнором дублей — строку бота сайт не перезаписывает
      const { error } = await db
        .from(table)
        .upsert(payload, { onConflict: conflictTarget(table), ...(TABLES[table].insertOnly ? { ignoreDuplicates: true } : {}) });
      if (error) throw new Error(`${table}: ${error.message}`);
    },
    async select() {
      const out: Row[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await db.from(table).select('*').range(from, from + PAGE - 1);
        if (error) throw new Error(`${table}: ${error.message}`);
        out.push(...((data ?? []) as Row[]));
        if (!data || data.length < PAGE) break;
      }
      return out;
    },
    subscribe(onRow) {
      const channel = db
        .channel(`qf2-${table}-${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` }, (payload: { new?: Row }) => {
          if (payload.new && Object.keys(payload.new).length > 0) onRow(payload.new);
        })
        .subscribe();
      return () => {
        void db.removeChannel(channel);
      };
    },
  });
}
