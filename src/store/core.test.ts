import { describe, it, expect } from 'vitest';
import { Store } from './core';
import { FakeCloud, MemoryStorage } from './testing';

interface Todo {
  id: string;
  title: string;
  type: 'todo';
  completed?: boolean;
}

function setup(opts: { online?: boolean } = {}) {
  const storage = new MemoryStorage();
  const cloud = new FakeCloud();
  let online = opts.online ?? true;
  let t = Date.parse('2026-11-17T08:00:00Z');
  const store = new Store({
    storage,
    isOnline: () => online,
    now: () => (t += 1000),
    flushDelayMs: -1,
  });
  return { storage, cloud, store, setOnline: (v: boolean) => (online = v) };
}

describe('store: офлайн-очередь, удаления, ошибки, Realtime', () => {
  it('правка без сети видна сразу и уходит в облако, когда сеть появилась', async () => {
    const { store, cloud, setOnline } = setup({ online: false });
    await store.connect(cloud.factory);
    store.upsert<Todo>('tasks2', { id: 'task-1', title: 'Монтаж AKKDLASA', type: 'todo' });

    expect(store.items<Todo>('tasks2').map((x) => x.title)).toEqual(['Монтаж AKKDLASA']);
    await store.flush();
    expect(cloud.rows('tasks2')).toHaveLength(0);
    expect(store.status()).toBe('offline');

    setOnline(true);
    await store.flush();
    expect(cloud.rows('tasks2').map((r) => r.title)).toEqual(['Монтаж AKKDLASA']);
    expect(store.status()).toBe('synced');
  });

  it('очередь переживает перезапуск вкладки', async () => {
    const { store, cloud, storage, setOnline } = setup({ online: false });
    await store.connect(cloud.factory);
    store.upsert<Todo>('tasks2', { id: 'task-2', title: 'Обложка', type: 'todo' });

    setOnline(true);
    const reopened = new Store({ storage, isOnline: () => true, flushDelayMs: -1 });
    expect(reopened.items<Todo>('tasks2').map((x) => x.id)).toEqual(['task-2']);
    await reopened.connect(cloud.factory);
    expect(cloud.rows('tasks2').map((r) => r.id)).toEqual(['task-2']);
  });

  it('удаление синкается и задача не возвращается из облака', async () => {
    const { store, cloud } = setup();
    await store.connect(cloud.factory);
    store.upsert<Todo>('tasks2', { id: 'task-3', title: 'Удалить меня', type: 'todo' });
    await store.flush();
    store.remove('tasks2', 'task-3');
    await store.flush();

    expect(store.items('tasks2')).toHaveLength(0);
    expect(cloud.rows('tasks2')[0].deleted).toBe(true);

    // другое устройство: чистый кеш, тянет из облака
    const other = new Store({ storage: new MemoryStorage(), isOnline: () => true, flushDelayMs: -1 });
    await other.connect(cloud.factory);
    expect(other.items('tasks2')).toHaveLength(0);
  });

  it('ошибка отправки видна как error, данные не теряются и досылаются', async () => {
    const { store, cloud } = setup();
    await store.connect(cloud.factory);
    cloud.failing = true;
    store.upsert<Todo>('tasks2', { id: 'task-4', title: 'Проверка', type: 'todo' });
    await store.flush();
    expect(store.status()).toBe('error');
    expect(store.items<Todo>('tasks2')).toHaveLength(1);

    cloud.failing = false;
    await store.flush();
    expect(store.status()).toBe('synced');
    expect(cloud.rows('tasks2')).toHaveLength(1);
  });

  it('плохая строка не блокирует остальные в той же таблице', async () => {
    const { store, cloud } = setup();
    await store.connect(cloud.factory);
    cloud.reject = (_t, r) => r.id === 'bad';
    store.upsert<Todo>('tasks2', { id: 'bad', title: 'x', type: 'todo' });
    store.upsert<Todo>('tasks2', { id: 'good', title: 'y', type: 'todo' });
    await store.flush();
    expect(cloud.rows('tasks2').map((r) => r.id)).toEqual(['good']);
    expect(store.status()).toBe('error');
  });

  it('изменение в облаке (Realtime) появляется без перезагрузки', async () => {
    const { store, cloud } = setup();
    await store.connect(cloud.factory);
    let notified = 0;
    store.subscribe(() => notified++);

    cloud.emit('tasks2', {
      id: 'from-bot',
      title: 'Записал бот',
      type: 'todo',
      updated_at: '2026-11-17T09:00:00Z',
      deleted: false,
      extra: {},
    });
    expect(store.items<Todo>('tasks2').map((x) => x.title)).toEqual(['Записал бот']);
    expect(notified).toBeGreaterThan(0);
  });

  it('последний выигрывает построчно: старая строка из облака не затирает свежую локальную', async () => {
    const { store, cloud } = setup({ online: false });
    await store.connect(cloud.factory);
    store.upsert<Todo>('tasks2', { id: 'task-5', title: 'Новое имя', type: 'todo' });
    cloud.emit('tasks2', { id: 'task-5', title: 'Старое имя', type: 'todo', updated_at: '2026-11-01T00:00:00Z', deleted: false, extra: {} });
    expect(store.items<Todo>('tasks2')[0].title).toBe('Новое имя');

    cloud.emit('tasks2', { id: 'task-5', title: 'Из бота позже', type: 'todo', updated_at: '2026-11-18T00:00:00Z', deleted: false, extra: {} });
    expect(store.items<Todo>('tasks2')[0].title).toBe('Из бота позже');
  });

  it('поля без колонки не теряются (уходят в extra)', async () => {
    const { store, cloud } = setup();
    await store.connect(cloud.factory);
    store.upsert('tasks2', { id: 'task-6', title: 'С наградой', type: 'todo', expReward: 25, projectId: 'proj-1' });
    await store.flush();
    const row = cloud.rows('tasks2')[0];
    expect(row.project_id).toBe('proj-1');
    expect(row.extra).toEqual({ expReward: 25 });

    const other = new Store({ storage: new MemoryStorage(), isOnline: () => true, flushDelayMs: -1 });
    await other.connect(cloud.factory);
    expect(other.items<Record<string, unknown>>('tasks2')[0]).toMatchObject({ expReward: 25, projectId: 'proj-1', kind: 'task' });
  });

  it('запись из запасного значения до чтения облака не перебивает перенесённые данные', async () => {
    // Облако: статы, перенесённые с Mac (метка переноса 2000-01-01)
    const cloud = new FakeCloud();
    cloud.emit('game_stats', { level: 7, gold: 900, streak: 10, updated_at: '2000-01-01T00:00:00.000Z', deleted: false, extra: {} });
    const { store } = setup();
    const fallback = { level: 4, gold: 427, streak: 0 };

    // Новый браузер: эффект «новый день» пишет streak+1 поверх запасных статов, облако ещё не подключено
    store.writeRecord('game_stats', fallback, (p: typeof fallback) => ({ ...p, streak: p.streak + 1 }), 'me', (v) => v);
    await store.connect(cloud.factory);

    expect(store.get('game_stats', 'me')).toMatchObject({ level: 7, gold: 900, streak: 10 });
    expect(cloud.rows('game_stats')[0]).toMatchObject({ level: 7, gold: 900, streak: 10 });

    // после чтения облака обычная правка снова получает свежую метку и уходит в облако
    store.writeRecord('game_stats', fallback, (p: typeof fallback) => ({ ...p, streak: p.streak + 1 }), 'me', (v) => v);
    await store.flush();
    expect(cloud.rows('game_stats')[0]).toMatchObject({ level: 7, streak: 11 });
  });
});
