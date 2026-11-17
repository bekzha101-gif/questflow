import { describe, expect, it } from 'vitest';
import { createDb, type SupabaseLike } from './db';

// Фейковый клиент supabase-js: запоминает вызовы цепочки
function fakeClient(rows: Record<string, unknown[]> = {}) {
  const calls: { table: string; op: string; args: unknown[] }[] = [];
  const client: SupabaseLike = {
    from(table: string) {
      const chain: Record<string, unknown> = {};
      const result = () => ({ data: rows[table] ?? [], error: null });
      for (const op of ['select', 'eq', 'range', 'update', 'upsert', 'maybeSingle']) {
        chain[op] = (...args: unknown[]) => {
          calls.push({ table, op, args });
          return chain;
        };
      }
      chain.then = (resolve: (v: unknown) => void) => resolve(result());
      return chain;
    },
  };
  return { client, calls };
}

const NOW = new Date('2026-11-17T03:00:00.000Z');

describe('db: запись шлёт updated_at и только по владельцу', () => {
  it('saveBotSettings: snake_case, user_id владельца, свежий updated_at, лишние поля отброшены', async () => {
    const { client, calls } = fakeClient();
    const db = createDb(client, 'owner-1', { now: () => NOW });
    await db.saveBotSettings({ chatId: '42', lastSent: { morning: '2026-11-17' }, junk: 1 } as never);
    const up = calls.find((c) => c.op === 'upsert')!;
    expect(up.table).toBe('bot_settings');
    expect(up.args[0]).toEqual({
      user_id: 'owner-1',
      updated_at: '2026-11-17T03:00:00.000Z',
      chat_id: '42',
      last_sent: { morning: '2026-11-17' },
    });
    expect(up.args[1]).toEqual({ onConflict: 'user_id' });
  });

  it('markTimerNotified: notified_end + updated_at, только для текущего отрезка', async () => {
    const { client, calls } = fakeClient();
    const db = createDb(client, 'owner-1', { now: () => NOW });
    await db.markTimerNotified('2026-11-17T01:00:00.000Z');
    expect(calls.find((c) => c.op === 'update')!.args[0]).toEqual({
      notified_end: true,
      updated_at: '2026-11-17T03:00:00.000Z',
    });
    const eqs = calls.filter((c) => c.op === 'eq').map((c) => c.args);
    expect(eqs).toContainEqual(['user_id', 'owner-1']);
    expect(eqs).toContainEqual(['started_at', '2026-11-17T01:00:00.000Z']);
  });

  it('чтение: фильтр по владельцу, удалённые строки скрыты, extra раскрыт', async () => {
    const { client, calls } = fakeClient({
      health_alarms: [
        { user_id: 'owner-1', id: 'a', title: 'Медитация', time: '17:15', enabled: true, extra: { note: 'x' }, deleted: false },
        { user_id: 'owner-1', id: 'b', title: 'Старое', time: '10:00', enabled: true, deleted: true },
      ],
    });
    const db = createDb(client, 'owner-1');
    const alarms = await db.listHealthAlarms();
    expect(alarms).toEqual([{ id: 'a', title: 'Медитация', time: '17:15', enabled: true, note: 'x' }]);
    expect(calls.filter((c) => c.op === 'eq').map((c) => c.args)).toContainEqual(['user_id', 'owner-1']);
  });
});
