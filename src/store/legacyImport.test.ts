import { describe, it, expect } from 'vitest';
import { Store } from './core';
import { MemoryStorage, FakeCloud } from './testing';
import { runLegacyImport, needsLegacyImport, LEGACY_FLAG } from './legacyImport';
import { TABLE_NAMES } from './tables';

function legacyStorage() {
  const s = new MemoryStorage();
  s.setItem('questflow_tasks_v1', JSON.stringify([
    { id: 'task-1731', title: 'Монтаж видео', type: 'todo', priority: 'p1', projectId: 'proj-inbox', tags: [], difficulty: 'medium', expReward: 20, goldReward: 5, completed: false, subtasks: [] },
    { id: 'shop-1', title: 'Молоко', type: 'todo', priority: 'p4', projectId: '6h5FPgJ74x5g685w', tags: [], difficulty: 'trivial', expReward: 1, goldReward: 1, completed: false, subtasks: [] },
    { id: 'habit-water', title: 'Вода 2 л', type: 'habit', priority: 'p3', projectId: 'proj-inbox', tags: [], difficulty: 'easy', expReward: 5, goldReward: 1, completed: false, subtasks: [], habitDirection: 'positive', habitCounter: 3 },
  ]));
  s.setItem('questflow_projects_v1', JSON.stringify([{ id: 'proj-inbox', name: 'Входящие', color: '#888', icon: 'Inbox' }]));
  s.setItem('questflow_rewards_v1', JSON.stringify([{ id: 'rew-1', title: 'Кофе', cost: 50, type: 'real', icon: 'Coffee', description: '', timesPurchased: 2 }]));
  s.setItem('questflow_stats_v1', JSON.stringify({ level: 4, exp: 120, maxExp: 400, hp: 80, maxHp: 100, gold: 427, streak: 3, title: 'Герой', heroClass: 'Warrior', avatarUrl: '', soundEnabled: true }));
  s.setItem('questflow_timelogs', JSON.stringify([
    { id: 'log-1', title: 'Фокус', mode: 'work', targetMinutes: 120, actualMinutes: 90, startedAt: '2026-11-16T19:00:00.000Z', completedAt: '2026-11-16T20:30:00.000Z' },
  ]));
  s.setItem('questflow_bigdata_v1', JSON.stringify({
    monthName: 'Ноябрь', year: 2026, observations: 'заметка месяца',
    days: [
      { day: 1, dayOfWeek: 'вс', sleep: '7ч 40м', sleepMinutes: 460, sleepQualityPercent: 88, supplements: 'Erinamax, Tiger Milk', score: 8, why: 'Выспался', tags: ['Work', 'Tr'], dateStr: '2026-11-01' },
      { day: 2, dayOfWeek: 'пн', sleep: '', sleepMinutes: 0, supplements: '', score: null, why: '', tags: [], dateStr: '2026-11-02' },
    ],
  }));
  s.setItem('questflow_health_food_v1', JSON.stringify([{ id: 'food-1', timestamp: '2026-11-16T03:00:00.000Z', date: '2026-11-16', time: '09:00', mealType: 'breakfast', food: 'Овсянка', feeling: 'energetic' }]));
  s.setItem('questflow_health_alarms_v1', JSON.stringify([{ id: 'alarm-1', title: 'Медитация', time: '07:30', enabled: true, type: 'meditation', soundEnabled: true, repeatDaily: true }]));
  s.setItem('questflow_channels_v1', JSON.stringify([{ id: 'ch-1', name: 'Мой канал', handle: '@mine', avatar: '', color: '#f00', description: 'шахматы' }]));
  s.setItem('questflow_videos_v1', JSON.stringify([
    { id: 'v-1', title: 'Видео 1', channelId: 'ch-1', stage: 'scripting', isUploaded: false, expReward: 10, goldReward: 5 },
    { id: 'v-2', title: 'Видео 2', channelId: 'ch-1', stage: 'published', isUploaded: true, expReward: 10, goldReward: 5, publishDate: '2026-11-10' },
  ]));
  s.setItem('questflow_finances_v1', JSON.stringify([
    { id: 'tx-171', type: 'income', amount: 120, category: 'revenue', description: 'AdSense', date: '2026-11-05', channelOrProject: 'ch-1' },
    { id: 'tx-172', type: 'expense', amount: 30, category: 'tools', description: 'Подписка', date: '2026-11-06', channelOrProject: '' },
  ]));
  s.setItem('questflow_hidden_sections_v1', JSON.stringify(['studio']));
  return s;
}

function snapshot(store: Store) {
  return Object.fromEntries(TABLE_NAMES.map((t) => [t, JSON.stringify(store.items(t))]));
}

describe('runLegacyImport: перенос старых ключей questflow_* в новые таблицы', () => {
  it('сначала скачивает JSON-бэкап, затем переносит все разделы; старые ключи остаются', async () => {
    const storage = legacyStorage();
    const store = new Store({ storage, isOnline: () => true, flushDelayMs: -1 });
    const events: string[] = [];
    let backup: Record<string, unknown> = {};

    expect(needsLegacyImport(storage)).toBe(true);
    const report = await runLegacyImport({
      store,
      storage,
      now: new Date('2026-11-16T19:30:00Z'),
      download: (name, json) => {
        events.push(`download:${name}`);
        expect(store.hasAnyRow('tasks2')).toBe(false);
        backup = JSON.parse(json);
      },
      onWrite: () => events.push('write'),
    });

    expect(events[0]).toBe('download:questflow-backup-2026-11-17.json');
    expect(events.slice(1).every((e) => e === 'write')).toBe(true);
    expect((backup.localStorage as Record<string, string>)['questflow_tasks_v1']).toContain('Монтаж видео');

    const tasks = store.items<Record<string, unknown>>('tasks2');
    expect(tasks.map((t) => t.id).sort()).toEqual(['habit-water', 'shop-1', 'task-1731']);
    expect(tasks.find((t) => t.id === 'shop-1')?.kind).toBe('shopping');
    expect(tasks.find((t) => t.id === 'task-1731')).toMatchObject({ kind: 'task', expReward: 20 });
    expect(store.items('projects2')).toHaveLength(1);
    expect(store.items<Record<string, unknown>>('rewards2')[0]).toMatchObject({ id: 'rew-1', tier: 'small', timesPurchased: 2 });
    expect(store.get('game_stats', 'me')).toMatchObject({ level: 4, gold: 427, heroClass: 'Warrior' });
    expect(store.items<Record<string, unknown>>('focus_sessions')[0]).toMatchObject({ id: 'log-1', minutes: 90, date: '2026-11-17' });
    const days = store.items<Record<string, unknown>>('bigdata_days');
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({ date: '2026-11-01', sleepMin: 460, score: 8, supplements: ['Erinamax', 'Tiger Milk'] });
    expect(store.items('health_food')).toHaveLength(1);
    expect(store.items('health_alarms')).toHaveLength(1);
    expect(store.items<Record<string, unknown>>('channels2')[0]).toMatchObject({ id: 'ch-1', name: 'Мой канал', status: 'active' });
    const videos = store.items<Record<string, unknown>>('videos2');
    expect(videos.find((v) => v.id === 'v-1')?.stage).toBe('editing');
    expect(videos.find((v) => v.id === 'v-2')?.stage).toBe('published');
    expect(store.items<Record<string, unknown>>('income')).toEqual([expect.objectContaining({ id: 'tx-171', amountUsd: 120 })]);
    // всё, что не легло в таблицы, лежит целиком в kv
    expect(store.get('kv', 'legacy:questflow_hidden_sections_v1')).toMatchObject({ value: ['studio'] });
    expect(store.get('kv', 'legacy:questflow_bigdata_v1')).not.toBeNull();

    expect(report.counts.tasks2).toBe(3);
    expect(storage.getItem('questflow_tasks_v1')).not.toBeNull();
    expect(storage.getItem(LEGACY_FLAG)).not.toBeNull();
    expect(needsLegacyImport(storage)).toBe(false);
  });

  it('повторный перенос ничего не дублирует и не меняет', async () => {
    const storage = legacyStorage();
    const store = new Store({ storage, isOnline: () => true, flushDelayMs: -1 });
    await runLegacyImport({ store, storage, download: () => {} });
    const before = snapshot(store);

    const again = await runLegacyImport({ store, storage, download: () => {} });
    expect(again.alreadyImported).toBe(true);
    const forced = await runLegacyImport({ store, storage, download: () => {}, force: true });
    expect(Object.values(forced.counts).every((n) => n === 0)).toBe(true);
    expect(snapshot(store)).toEqual(before);
  });

  it('не перезаписывает то, что уже есть в облаке (второе устройство)', async () => {
    const cloud = new FakeCloud();
    cloud.emit('tasks2', { id: 'task-1731', title: 'Монтаж видео — уже правил на Mac', type: 'todo', updated_at: '2026-11-17T05:00:00Z', deleted: false, extra: {} });
    cloud.emit('tasks2', { id: 'habit-water', title: 'Вода 2 л', type: 'habit', updated_at: '2026-11-17T05:00:00Z', deleted: true, extra: {} });
    const storage = legacyStorage();
    const store = new Store({ storage, isOnline: () => true, flushDelayMs: -1 });
    await store.connect(cloud.factory);

    await runLegacyImport({ store, storage, download: () => {} });
    await store.flush();
    const byId = Object.fromEntries(cloud.rows('tasks2').map((r) => [r.id, r]));
    expect(byId['task-1731'].title).toBe('Монтаж видео — уже правил на Mac');
    expect(byId['habit-water'].deleted).toBe(true);
    expect(byId['shop-1']).toBeDefined();
  });
});
