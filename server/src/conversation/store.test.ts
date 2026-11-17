import { describe, expect, it } from 'vitest';
import { createSupabaseStore } from './store';

/** Мини-подмена supabase-js: запоминает insert/upsert, на повторный insert отвечает 23505 */
function fakeClient() {
  const calls: { table: string; op: string; row: Record<string, unknown> }[] = [];
  const ids = new Set<string>();
  return {
    calls,
    from(table: string) {
      return {
        insert: async (row: Record<string, unknown>) => {
          calls.push({ table, op: 'insert', row });
          const key = `${table}:${row.id}`;
          if (ids.has(key)) return { error: { code: '23505', message: 'duplicate key' } };
          ids.add(key);
          return { error: null };
        },
        upsert: async (row: Record<string, unknown>) => {
          calls.push({ table, op: 'upsert', row });
          return { error: null };
        },
      };
    },
  };
}

describe('хранилище разговора (Supabase)', () => {
  it('game_events: только вставка; повтор того же id → false (статы не применять)', async () => {
    const c = fakeClient();
    const store = createSupabaseStore(c, 'owner-1', () => new Date('2026-11-17T15:00:00Z'));
    const ev = { id: 'evening_missed:2026-11-17', at: '2026-11-18T15:00:00Z', kind: 'evening_missed', ref: '2026-11-17', deltaHp: -15 };
    expect(await store.insertGameEvent(ev)).toBe(true);
    expect(await store.insertGameEvent(ev)).toBe(false);
    expect(c.calls[0].row).toMatchObject({ user_id: 'owner-1', id: ev.id, delta_hp: -15, updated_at: '2026-11-17T15:00:00.000Z' });
  });

  it('запись строки: колонки в snake_case, лишние поля в extra, всегда updated_at', async () => {
    const c = fakeClient();
    const store = createSupabaseStore(c, 'owner-1', () => new Date('2026-11-17T15:00:00Z'));
    await store.saveChannel({ id: 'ch-1', name: 'Chess Pulse', status: 'paused', cadencePerDay: 1, planned: true, plan: 'шахматы' });
    const row = c.calls[0].row;
    expect(row).toMatchObject({ id: 'ch-1', name: 'Chess Pulse', cadence_per_day: 1, user_id: 'owner-1', updated_at: '2026-11-17T15:00:00.000Z' });
    expect(row.extra).toEqual({ planned: true, plan: 'шахматы' });
    expect(row.abandon_reason).toBeNull();
  });
});
