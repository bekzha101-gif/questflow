import { describe, expect, it } from 'vitest';
import { Store } from '../../store/core';
import { FakeCloud, MemoryStorage } from '../../store/testing';
import type { RemoteFactory } from '../../store/remote';
import { runDailyReset } from './dailyReset';

const NOW = Date.parse('2026-11-17T03:00:00Z'); // 09:00 по Бишкеку

/** Облако, которое отвечает на select только после release() */
function slowCloud(cloud: FakeCloud) {
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => (release = r));
  const factory: RemoteFactory = (t) => {
    const base = cloud.factory(t);
    return { ...base, select: async () => (await gate, base.select()) };
  };
  return { factory, release: () => release() };
}

describe('runDailyReset', () => {
  it('запись из старого кеша до чтения облака не перебивает более новую строку облака (удалённая задача не воскресает)', async () => {
    const storage = new MemoryStorage();
    // Старый кеш браузера: ежедневная задача выполнена вчера
    const old = new Store({ storage, flushDelayMs: -1, now: () => Date.parse('2026-11-15T10:00:00Z') });
    old.upsert('tasks2', { id: 'd1', title: 'Зарядка', type: 'daily', completed: true });
    storage.removeItem('qf2_queue_tasks2'); // строка тогда же ушла в облако

    // В облаке её позже удалили (другое устройство / бот)
    const cloud = new FakeCloud();
    cloud.emit('tasks2', { id: 'd1', title: 'Зарядка', type: 'daily', completed: true, deleted: true, updated_at: '2026-11-16T10:00:00.000Z', extra: {} });

    const s = new Store({ storage, flushDelayMs: -1, now: () => NOW });
    const slow = slowCloud(cloud);
    const connecting = s.connect(slow.factory);

    // Сайт открылся, облако ещё читается: сброс ничего не пишет
    expect(runDailyReset('2026-11-17', '2026-11-16', s)).toBe(false);
    expect(s.pendingCount()).toBe(0);

    slow.release();
    await connecting;
    await s.flush();
    expect(cloud.rows('tasks2')[0]).toMatchObject({ id: 'd1', deleted: true });
    expect(s.items('tasks2')).toHaveLength(0);

    // После чтения облака сброс проходит и удалённое не трогает
    expect(runDailyReset('2026-11-17', '2026-11-16', s)).toBe(true);
    await s.flush();
    expect(cloud.rows('tasks2')[0]).toMatchObject({ deleted: true });
  });

  it('облако не прочиталось (failed) — сброс ждёт', async () => {
    const s = new Store({ storage: new MemoryStorage(), flushDelayMs: -1, now: () => NOW });
    s.upsert('tasks2', { id: 'd1', title: 'Зарядка', type: 'daily', completed: true });
    const cloud = new FakeCloud();
    cloud.failing = true;
    await s.connect(cloud.factory);
    expect(runDailyReset('2026-11-17', '2026-11-16', s)).toBe(false);
    expect(s.get<{ completed: boolean }>('tasks2', 'd1')?.completed).toBe(true);
  });

  it('локальный режим: снимает отметки ежедневных, остальное не трогает; второй раз за день — нет', () => {
    const s = new Store({ storage: new MemoryStorage(), flushDelayMs: -1, now: () => NOW });
    s.upsert('tasks2', { id: 'd1', title: 'Зарядка', type: 'daily', completed: true });
    s.upsert('tasks2', { id: 't1', title: 'Монтаж', type: 'todo', completed: true });
    expect(runDailyReset('2026-11-17', '2026-11-16', s)).toBe(true);
    expect(s.get<{ completed: boolean }>('tasks2', 'd1')?.completed).toBe(false);
    expect(s.get<{ completed: boolean }>('tasks2', 't1')?.completed).toBe(true);
    expect(runDailyReset('2026-11-17', '2026-11-17', s)).toBe(false);
  });
});
