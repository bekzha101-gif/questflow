import { describe, it, expect } from 'vitest';
import { Store } from './core';
import { FakeCloud, MemoryStorage } from './testing';
import { ensureSeeds } from './seeds';
import { TABLE_NAMES } from './tables';

const mk = () => new Store({ storage: new MemoryStorage(), isOnline: () => true, flushDelayMs: -1 });
const snap = (s: Store) => JSON.stringify(TABLE_NAMES.map((t) => s.items(t)));

describe('ensureSeeds: стартовые данные из брифинга', () => {
  it('на пустых таблицах создаёт цели ноября, 5 каналов, сферы, БАДы и награды с seed: true', async () => {
    const store = mk();
    await ensureSeeds(store);

    const goals = store.items<Record<string, unknown>>('goals');
    expect(goals).toHaveLength(6);
    expect(goals.every((g) => g.month === '2026-11' && g.seed === true)).toBe(true);
    expect(goals.find((g) => g.kind === 'numeric')).toMatchObject({ target: 40 });

    const channels = store.items<Record<string, unknown>>('channels2');
    expect(channels.map((c) => c.name)).toEqual(['AKKDLASA', 'BEATIFUL MAN', 'AGENT CODE', 'ARMY ANALITICS', 'TRIHGOK']);
    expect(channels.map((c) => c.cadencePerDay)).toEqual([1, 2, 1, 0.5, 0.5]);
    expect(channels[0]).toMatchObject({ editHoursMin: 2, editHoursMax: 3, status: 'active', seed: true });
    expect(channels[1]).toMatchObject({ editHoursMin: 3, editHoursMax: 5 });

    const tasks = store.items<Record<string, unknown>>('tasks2');
    expect(tasks).toHaveLength(1);
    expect(String(tasks[0].title)).toContain('2 превью');
    expect(tasks[0]).toMatchObject({ seed: true, kind: 'task' });

    const cfg = store.get<Record<string, unknown>>('bigdata_config', 'me');
    expect((cfg?.spheres as { label: string }[]).map((s) => s.label)).toEqual(['Work', 'Work+', 'Tr', 'Tr+', 'Soc', 'Soc+']);
    expect(cfg?.supplements).toEqual([
      { id: 'erinamax', name: 'Erinamax', dose: '4 таб.' },
      { id: 'tiger-milk', name: 'Tiger Milk', dose: '8 таб.' },
    ]);

    const rewards = store.items<Record<string, unknown>>('rewards2');
    expect(rewards.filter((r) => r.tier === 'small')).toHaveLength(6);
    expect(rewards.filter((r) => r.tier === 'big')).toHaveLength(2);
    expect(rewards.every((r) => r.seed === true)).toBe(true);
  });

  it('второй запуск ничего не меняет', async () => {
    const store = mk();
    await ensureSeeds(store);
    const before = snap(store);
    await ensureSeeds(store);
    expect(snap(store)).toBe(before);
  });

  it('не трогает непустые таблицы и не воскрешает удалённое', async () => {
    const store = mk();
    store.upsert('channels2', { id: 'ch-mine', name: 'Мой канал', status: 'active', cadencePerDay: 1 });
    store.upsert('goals', { id: 'g-mine', month: '2026-11', title: 'Своя цель', kind: 'percent', target: 100, status: 'active' });
    store.upsert('bigdata_config', { spheres: [{ id: 'x', label: 'Своя' }], criteria: [], supplements: [] });
    await ensureSeeds(store);
    expect(store.items<Record<string, unknown>>('channels2').map((c) => c.id)).toEqual(['ch-mine']);
    expect(store.items('goals')).toHaveLength(1);
    expect(store.items('tasks2')).toHaveLength(0);
    expect((store.get<Record<string, unknown>>('bigdata_config', 'me')?.spheres as unknown[]).length).toBe(1);

    // награду из сидов удалили — повторный запуск её не возвращает
    store.remove('rewards2', store.items<{ id: string }>('rewards2')[0].id);
    const left = store.items('rewards2').length;
    await ensureSeeds(store);
    expect(store.items('rewards2')).toHaveLength(left);
  });

  it('при подключённом облаке ждёт его данные и не сеет, если облако не прочитано', async () => {
    const cloud = new FakeCloud();
    cloud.emit('channels2', { id: 'ch-cloud', name: 'Из облака', status: 'active', cadence_per_day: 1, updated_at: '2026-11-17T05:00:00Z', deleted: false, extra: {} });
    const store = mk();
    await store.connect(cloud.factory);
    await ensureSeeds(store);
    expect(store.items<Record<string, unknown>>('channels2').map((c) => c.id)).toEqual(['ch-cloud']);

    const offline = new FakeCloud();
    offline.failing = true;
    const s2 = mk();
    await s2.connect(offline.factory);
    await ensureSeeds(s2);
    expect(s2.items('goals')).toHaveLength(0);
  });
});
