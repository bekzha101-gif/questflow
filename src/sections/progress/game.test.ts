import { describe, expect, it } from 'vitest';
import { Store } from '../../store/core';
import { FakeCloud, MemoryStorage } from '../../store/testing';
import type { GameEvent, GameStats } from '@shared/types';
import { RULES } from '@shared/gamification';
import { applyGame, logSessionOnce, resetGameStats, rewardBigDataFill, rewardRecoveryActivity, shownStreak, syncGameFacts } from './game';

const NOW = new Date('2026-11-17T06:00:00Z'); // вторник, 12:00 по Бишкеку

function makeStore(stats: Partial<GameStats> = {}) {
  const s = new Store({ storage: new MemoryStorage(), flushDelayMs: -1, now: () => NOW.getTime() });
  s.upsert('game_stats', { level: 1, exp: 0, maxExp: 100_000, hp: 100, maxHp: 100, gold: 0, streak: 0, ...stats });
  return s;
}
const statsOf = (s: Store) => s.get<GameStats>('game_stats', 'me') as GameStats;

describe('applyGame (сайт): журнал и статы в хранилище', () => {
  it('повтор блока фокуса с тем же id не начисляет золото второй раз', () => {
    const s = makeStore();
    applyGame({ kind: 'focus_block', ref: 'focus-2026-11-17-b1', minutes: 120, full: true }, { store: s, now: NOW });
    const gold = statsOf(s).gold;
    applyGame({ kind: 'focus_block', ref: 'focus-2026-11-17-b1', minutes: 120, full: true }, { store: s, now: NOW });
    expect(gold).toBeGreaterThan(0);
    expect(statsOf(s).gold).toBe(gold);
    expect(s.items<GameEvent>('game_events').filter((e) => e.kind === 'focus_block')).toHaveLength(1);
  });

  it('покупка при закрытом магазине отклоняется и золото не списывается', () => {
    const s = makeStore({ gold: 500, shopLocked: true });
    const r = applyGame({ kind: 'purchase', ref: 'rew:1', cost: 60 }, { store: s, now: NOW });
    expect(r.rejected).toBe('shop_locked');
    expect(statsOf(s).gold).toBe(500);
  });

  it('открытая ачивка пишется в achievements', () => {
    const s = makeStore();
    applyGame({ kind: 'income', ref: 'inc-1', amountUsd: 1000 }, { store: s, now: NOW });
    expect(s.items<{ id: string }>('achievements').map((a) => a.id)).toContain('income_1000');
  });
});

describe('syncGameFacts: итоги дней, цели, публикации', () => {
  it('первый запуск только ставит начало правил и ничего не штрафует', () => {
    const s = makeStore({ gold: 100 });
    syncGameFacts({ store: s, now: NOW });
    expect(statsOf(s).rulesSince).toBe('2026-11-17');
    expect(statsOf(s).gold).toBe(100);
  });

  it('закрывает пропущенные дни: норма — серия +1, пропуск — штраф', () => {
    const s = makeStore({ gold: 200, streak: 2, rulesSince: '2026-11-14', lastClosedDate: '2026-11-14' });
    // 15-е (вс): 3 полных блока, привычек нет → полный день (+ачивка «6 часов»); 16-е (пн): ничего → пропуск
    for (const b of [1, 2, 3]) {
      s.upsert('focus_sessions', { id: `focus-2026-11-15-b${b}`, date: '2026-11-15', startedAt: '2026-11-15T03:00:00Z', minutes: 120, mode: 'work', targetMinutes: 120 });
    }
    syncGameFacts({ store: s, now: NOW });
    const st = statsOf(s);
    expect(st.lastClosedDate).toBe('2026-11-16');
    expect(st.streak).toBe(0);
    expect(st.bestStreak).toBe(3);
    expect(st.gold).toBe(200 + RULES.missedNorm.gold + RULES.achievement.gold);
    // повторный запуск ничего не меняет
    syncGameFacts({ store: s, now: NOW });
    expect(statsOf(s).gold).toBe(200 + RULES.missedNorm.gold + RULES.achievement.gold);
  });

  it('цель недели достигнута → награда один раз; опубликованное видео → награда', () => {
    const s = makeStore({ rulesSince: '2026-11-17', lastClosedDate: '2026-11-16' });
    s.upsert('goals', { id: 'g1', month: '2026-11', title: '50 видео', kind: 'numeric', target: 50, current: 12, status: 'active' });
    s.upsert('videos2', { id: 'v1', channelId: 'c1', title: 'x', stage: 'published', publishedAt: '2026-11-17' });
    syncGameFacts({ store: s, now: NOW });
    syncGameFacts({ store: s, now: NOW });
    // 50 → недели 10/20/30/40: при 12 выполнена только первая
    expect(statsOf(s).gold).toBe(RULES.goalWeek.gold + RULES.videoPublished.gold);
  });
});

describe('syncGameFacts до чтения облака', () => {
  it('запись из старого кеша до чтения не перебивает более новую строку облака', async () => {
    const storage = new MemoryStorage();
    const old = new Store({ storage, flushDelayMs: -1, now: () => Date.parse('2026-11-15T10:00:00Z') });
    old.upsert('game_stats', { level: 1, exp: 0, maxExp: 100_000, hp: 100, maxHp: 100, gold: 100, streak: 0, rulesSince: '2026-11-10', lastClosedDate: '2026-11-14' });
    storage.removeItem('qf2_queue_game_stats'); // тогда же ушло в облако

    // Облако новее: бот закрыл дни и начислил золото
    const cloud = new FakeCloud();
    cloud.emit('game_stats', {
      level: 1, exp: 0, max_exp: 100_000, hp: 100, max_hp: 100, gold: 500, streak: 0,
      extra: { rulesSince: '2026-11-10', lastClosedDate: '2026-11-16' },
      deleted: false, updated_at: '2026-11-16T20:00:00.000Z',
    });

    const s = new Store({ storage, flushDelayMs: -1, now: () => NOW.getTime() });
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const connecting = s.connect((t) => {
      const base = cloud.factory(t);
      return { ...base, select: async () => (await gate, base.select()) };
    });

    syncGameFacts({ store: s, now: NOW });
    expect(s.pendingCount()).toBe(0);

    release();
    await connecting;
    await s.flush();
    expect(statsOf(s).gold).toBe(500);
    expect(cloud.rows('game_stats')[0]).toMatchObject({ gold: 500 });
  });
});

describe('resetGameStats («Сбросить прогресс»)', () => {
  it('сбрасывает только статы: задачи и награды не удаляются', () => {
    const s = makeStore({ level: 9, exp: 500, gold: 900 });
    s.upsert('tasks2', { id: 't1', title: 'Монтаж', type: 'todo' });
    s.upsert('rewards2', { id: 'r1', title: 'Кино', cost: 100 });
    resetGameStats({ level: 1, exp: 0, maxExp: 100, hp: 100, maxHp: 100, gold: 0, streak: 0 }, { store: s });
    expect(statsOf(s)).toMatchObject({ level: 1, exp: 0, gold: 0 });
    expect(s.items('tasks2')).toHaveLength(1);
    expect(s.items('rewards2')).toHaveLength(1);
    expect(s.getRow('tasks2', 't1')?.deleted).toBe(false);
  });
});

describe('награды со стабильным ref от факта', () => {
  const FRIDAY = new Date('2026-11-20T06:00:00Z'); // пятница, 12:00 по Бишкеку

  it('день Big Data: ref — дата дня, повтор того же дня — duplicate', () => {
    const s = makeStore();
    const first = rewardBigDataFill('2026-11-16', { store: s, now: NOW });
    expect(first.applied).toBe(true);
    expect(statsOf(s).gold).toBe(RULES.bigdataFill.gold);
    const again = rewardBigDataFill('2026-11-16', { store: s, now: NOW });
    expect(again.rejected).toBe('duplicate');
    expect(statsOf(s).gold).toBe(RULES.bigdataFill.gold);
  });

  it('активность пятницы: только сегодняшняя пятница, повтор — duplicate', () => {
    const s = makeStore();
    // прошлая пятница — без награды
    expect(rewardRecoveryActivity('2026-11-13', 'banya', { store: s, now: FRIDAY })).toBeNull();
    // будущая пятница — без награды
    expect(rewardRecoveryActivity('2026-11-27', 'banya', { store: s, now: FRIDAY })).toBeNull();
    // сегодня не пятница
    expect(rewardRecoveryActivity('2026-11-17', 'banya', { store: s, now: NOW })).toBeNull();
    expect(statsOf(s).gold).toBe(0);

    const r = rewardRecoveryActivity('2026-11-20', 'banya', { store: s, now: FRIDAY });
    expect(r?.applied).toBe(true);
    expect(statsOf(s).gold).toBe(RULES.recoveryActivity.gold);
    expect(s.items<GameEvent>('game_events').map((e) => e.id)).toContain('recovery_activity:2026-11-20:banya');
    expect(rewardRecoveryActivity('2026-11-20', 'banya', { store: s, now: FRIDAY })?.rejected).toBe('duplicate');
    expect(statsOf(s).gold).toBe(RULES.recoveryActivity.gold);
  });
});

describe('logSessionOnce (App.handleLogSession)', () => {
  it('запись с существующим id заменяет строку, а не добавляет дубль', () => {
    const a = { id: 'focus-1', title: 'A', actualMinutes: 60 };
    const b = { id: 'focus-2', title: 'B', actualMinutes: 30 };
    const next = logSessionOnce([b, a], { id: 'focus-1', title: 'A', actualMinutes: 120 });
    expect(next.map((x) => x.id)).toEqual(['focus-2', 'focus-1']);
    expect(next.find((x) => x.id === 'focus-1')?.actualMinutes).toBe(120);
    expect(logSessionOnce([b], a).map((x) => x.id)).toEqual(['focus-1', 'focus-2']);
  });
});

describe('серия до первого полного дня', () => {
  it('до первого закрытого дня серия показывает 0, даже если в статах старая единица', () => {
    expect(shownStreak({ streak: 1 } as unknown as GameStats)).toBe(0);
    expect(shownStreak({ streak: 3, lastClosedDate: '2026-11-16' } as unknown as GameStats)).toBe(3);
  });

  it('первый запуск правил обнуляет старую серию; первый полный день даёт 1, а не 2', () => {
    const s = makeStore({ streak: 1 });
    syncGameFacts({ store: s, now: new Date('2026-11-15T06:00:00Z') });
    expect(statsOf(s).streak).toBe(0);
    for (const b of [1, 2, 3]) {
      s.upsert('focus_sessions', { id: `focus-2026-11-15-b${b}`, date: '2026-11-15', startedAt: '2026-11-15T03:00:00Z', minutes: 120, mode: 'work', targetMinutes: 120 });
    }
    syncGameFacts({ store: s, now: new Date('2026-11-16T06:00:00Z') });
    expect(statsOf(s).lastClosedDate).toBe('2026-11-15');
    expect(statsOf(s).streak).toBe(1);
  });
});
