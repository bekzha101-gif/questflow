import { describe, expect, it } from 'vitest';
import { createSupabaseRemote } from './remote';

/** Клиент supabase-js в миниатюре: запоминает вызовы upsert и их параметры */
function fakeClient() {
  const calls: { table: string; rows: unknown[]; opts: Record<string, unknown> }[] = [];
  const client = {
    from: (table: string) => ({
      upsert: async (rows: unknown[], opts: Record<string, unknown>) => {
        calls.push({ table, rows, opts });
        return { error: null };
      },
    }),
  };
  return { client, calls };
}

describe('createSupabaseRemote', () => {
  it('game_events — только вставка: дубль игнорируется, строка бота не перезаписывается', async () => {
    const { client, calls } = fakeClient();
    const remote = createSupabaseRemote(client, 'u1');
    await remote('game_events').upsert([{ id: 'day_close:2026-11-16', kind: 'day_close', updated_at: '2026-11-17T00:00:00Z' }]);
    expect(calls[0].table).toBe('game_events');
    expect(calls[0].opts).toMatchObject({ onConflict: 'user_id,id', ignoreDuplicates: true });
  });

  it('прочие таблицы — обычный upsert (правка перезаписывает строку)', async () => {
    const { client, calls } = fakeClient();
    const remote = createSupabaseRemote(client, 'u1');
    await remote('tasks2').upsert([{ id: 't1', title: 'x' }]);
    expect(calls[0].opts.ignoreDuplicates).not.toBe(true);
  });
});
