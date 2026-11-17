import { describe, it, expect } from 'vitest';
import { Store } from './core';
import { FakeCloud, MemoryStorage } from './testing';
import { ensureSeeds } from './seeds';
import { TABLE_NAMES } from './tables';
import { channelTodo, lastPublishedDate, nextDueDates } from '@shared/channels';
import type { Channel } from '@shared/types';

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
    const todos = tasks.filter((t) => t.type === 'todo');
    expect(todos).toHaveLength(1);
    expect(String(todos[0].title)).toContain('2 превью');
    expect(todos[0]).toMatchObject({ seed: true, kind: 'task' });

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
    expect(store.items<Record<string, unknown>>('tasks2').filter((t) => t.type !== 'habit')).toHaveLength(0);
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

  it('привычки из брифинга: на пустой базе один раз заводит воду, медитацию и восстановление', async () => {
    const store = mk();
    await ensureSeeds(store);
    const habits = store.items<Record<string, unknown>>('tasks2').filter((t) => t.type === 'habit');
    expect(habits.map((h) => h.title)).toEqual(['2 литра воды', 'Медитация', 'Активное восстановление']);
    expect(habits.every((h) => h.seed === true && h.kind === 'task')).toBe(true);
    await ensureSeeds(store);
    expect(store.items<Record<string, unknown>>('tasks2').filter((t) => t.type === 'habit')).toHaveLength(3);
  });

  it('привычки: свои привычки не трогает, удалённую привычку из сидов не воскрешает', async () => {
    const own = mk();
    own.upsert('tasks2', { id: 'h-mine', title: 'Своя привычка', type: 'habit' });
    await ensureSeeds(own);
    expect(own.items<Record<string, unknown>>('tasks2').filter((t) => t.type === 'habit').map((h) => h.id)).toEqual(['h-mine']);

    const store = mk();
    await ensureSeeds(store);
    for (const h of store.items<{ id: string; type: string }>('tasks2').filter((t) => t.type === 'habit')) store.remove('tasks2', h.id);
    await ensureSeeds(store);
    expect(store.items<Record<string, unknown>>('tasks2').filter((t) => t.type === 'habit')).toHaveLength(0);
  });

  it('каналы: AKKDLASA выложено в день сида, ARMY ANALITICS выкладка завтра — у обоих «Следующее видео» завтра', async () => {
    const store = mk();
    await ensureSeeds(store);
    const byName = (n: string) => store.items<Channel>('channels2').find((c) => c.name === n) as Channel;
    const day = '2026-11-17';
    for (const c of [byName('AKKDLASA'), byName('ARMY ANALITICS')]) {
      expect(nextDueDates(c, lastPublishedDate(c, []), day, 1)).toEqual(['2026-11-18']);
      expect(channelTodo(c, [], day).dueDate).toBe('2026-11-18');
    }
  });

  it('будильники здоровья: на пустой базе записываются в health_alarms (их видит бот), удалённые не возвращаются', async () => {
    const store = mk();
    await ensureSeeds(store);
    const alarms = store.items<Record<string, unknown>>('health_alarms');
    expect(alarms.map((a) => a.id)).toEqual(['alarm-meditation', 'alarm-walk', 'alarm-gadgets', 'alarm-sleep']);
    expect(alarms.every((a) => a.seed === true)).toBe(true);
    for (const a of alarms) store.remove('health_alarms', String(a.id));
    await ensureSeeds(store);
    expect(store.items('health_alarms')).toHaveLength(0);

    const own = mk();
    own.upsert('health_alarms', { id: 'my-alarm', title: 'Своё', time: '07:00', enabled: true });
    await ensureSeeds(own);
    expect(own.items<{ id: string }>('health_alarms').map((a) => a.id)).toEqual(['my-alarm']);
  });
});
