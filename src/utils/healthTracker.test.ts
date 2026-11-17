import { describe, it, expect, afterEach } from 'vitest';
import { Store } from '../store/core';
import { MemoryStorage } from '../store/testing';
import {
  addFoodEntry,
  foodForDay,
  dueHealthAlarms,
  tickHealthAlarms,
  playHealthAlarmSound,
  DEFAULT_HEALTH_ALARMS,
} from './healthTracker';
import type { HealthAlarmConfig } from '../types/health';

const alarm = (p: Partial<HealthAlarmConfig>): HealthAlarmConfig => ({
  id: 'a1',
  title: 'Вода',
  time: '10:00',
  enabled: true,
  type: 'water',
  soundEnabled: true,
  repeatDaily: true,
  ...p,
});

describe('дневник питания', () => {
  it('запись переживает перезагрузку (новый экземпляр хранилища на том же кеше)', () => {
    const mem = new MemoryStorage();
    const s1 = new Store({ storage: mem });
    const now = new Date('2026-11-17T06:00:00Z'); // 12:00 по Бишкеку
    addFoodEntry({ mealType: 'lunch', food: 'Плов', feeling: 'normal' }, now, s1);
    const s2 = new Store({ storage: mem });
    const day = foodForDay(s2.items('health_food'), '2026-11-17');
    expect(day.map((f) => f.food)).toEqual(['Плов']);
  });

  it('после полуночи по Бишкеку запись идёт в новый день, а не во вчерашний по UTC', () => {
    const s = new Store({ storage: new MemoryStorage() });
    const now = new Date('2026-11-17T18:30:00Z'); // 00:30 18 ноября по Бишкеку
    const e = addFoodEntry({ mealType: 'snack', food: 'Кефир', feeling: 'normal' }, now, s);
    expect(e.date).toBe('2026-11-18');
    expect(e.time).toBe('00:30');
    expect(foodForDay(s.items('health_food'), '2026-11-18')).toHaveLength(1);
  });
});

describe('будильники здоровья', () => {
  it('срабатывает в своё время по Бишкеку для любого типа, один раз', () => {
    const now = new Date('2026-11-17T04:02:00Z'); // 10:02 Бишкек
    const due = dueHealthAlarms([alarm({})], now, []);
    expect(due.map((a) => a.id)).toEqual(['a1']);
    expect(dueHealthAlarms([alarm({})], now, ['a1'])).toEqual([]);
  });

  it('выключенный и не наступивший не срабатывают; давно прошедший тоже', () => {
    const now = new Date('2026-11-17T04:02:00Z');
    expect(dueHealthAlarms([alarm({ enabled: false })], now, [])).toEqual([]);
    expect(dueHealthAlarms([alarm({ time: '10:30' })], now, [])).toEqual([]);
    expect(dueHealthAlarms([alarm({ time: '08:00' })], now, [])).toEqual([]);
  });

  it('сканер: звук и уведомление один раз, отметка в хранилище, без таблицы — будильники по умолчанию', () => {
    const s = new Store({ storage: new MemoryStorage() });
    const played: string[] = [];
    const notified: string[] = [];
    const med = DEFAULT_HEALTH_ALARMS.find((a) => a.type === 'meditation')!;
    const [h, m] = med.time.split(':').map(Number);
    // время медитации по Бишкеку (UTC+6)
    const now = new Date(Date.UTC(2026, 10, 17, h - 6, m + 1));
    const deps = { store: s, now: () => now, play: (t: string) => played.push(t), notify: (t: string) => notified.push(t) };
    tickHealthAlarms(deps);
    tickHealthAlarms(deps);
    expect(notified).toHaveLength(1);
    expect(played).toHaveLength(1);
    // перезагрузка страницы: отметка сохранилась — второй раз не звонит
    tickHealthAlarms({ ...deps, store: s });
    expect(notified).toHaveLength(1);
  });
});

describe('звук будильника', () => {
  const g = globalThis as unknown as { window?: unknown };
  afterEach(() => {
    delete g.window;
  });

  it('один AudioContext на все звуки', () => {
    let created = 0;
    const node = () => ({
      connect() {},
      start() {},
      stop() {},
      type: '',
      frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
    });
    class FakeCtx {
      state = 'running';
      currentTime = 0;
      destination = {};
      constructor() {
        created++;
      }
      createOscillator = node;
      createGain = node;
      resume() {
        return Promise.resolve();
      }
    }
    g.window = { AudioContext: FakeCtx };
    playHealthAlarmSound('meditation');
    playHealthAlarmSound('alert');
    playHealthAlarmSound('heal');
    expect(created).toBe(1);
  });
});
