import { describe, it, expect } from 'vitest';
import {
  getDayCycleInfo,
  loadRecoveryCycleConfig,
  toggleRecoveryActivity,
  emptyRecoveryDay,
  DEFAULT_RECOVERY_ACTIVITIES,
  canAddWorkTask,
} from './recoveryCycle';

describe('пятница — день восстановления (вместо 7+1)', () => {
  it('каждая пятница — восстановление, остальные дни — рабочие', () => {
    const cfg = loadRecoveryCycleConfig();
    // 2026-11-20 — пятница, 2026-11-17 — вторник, 2026-11-27 — следующая пятница
    expect(getDayCycleInfo('2026-11-20', cfg).isRecoveryDay).toBe(true);
    expect(getDayCycleInfo('2026-11-27', cfg).isRecoveryDay).toBe(true);
    expect(getDayCycleInfo('2026-11-17', cfg).isRecoveryDay).toBe(false);
    expect(getDayCycleInfo('2026-11-21', cfg).isRecoveryDay).toBe(false);
  });

  it('четверг знает, что завтра восстановление', () => {
    const cfg = loadRecoveryCycleConfig();
    expect(getDayCycleInfo('2026-11-19', cfg).isTomorrowRecovery).toBe(true);
    expect(getDayCycleInfo('2026-11-18', cfg).isTomorrowRecovery).toBe(false);
  });

  it('рабочую задачу в пятницу добавить нельзя', () => {
    expect(canAddWorkTask('2026-11-20')).toBe(false);
    expect(canAddWorkTask('2026-11-19')).toBe(true);
  });
});

describe('активности восстановления', () => {
  const sauna = DEFAULT_RECOVERY_ACTIVITIES[0];

  it('первая галочка даёт награду', () => {
    const r = toggleRecoveryActivity(emptyRecoveryDay(), sauna.id);
    expect(r.state.done).toContain(sauna.id);
    expect(r.reward?.id).toBe(sauna.id);
  });

  it('снять и поставить галочку снова — награды второй раз нет', () => {
    let s = toggleRecoveryActivity(emptyRecoveryDay(), sauna.id).state;
    s = toggleRecoveryActivity(s, sauna.id).state;
    expect(s.done).not.toContain(sauna.id);
    const again = toggleRecoveryActivity(s, sauna.id);
    expect(again.state.done).toContain(sauna.id);
    expect(again.reward).toBeNull();
  });

  it('неизвестная активность ничего не даёт', () => {
    const r = toggleRecoveryActivity(emptyRecoveryDay(), 'nope');
    expect(r.reward).toBeNull();
    expect(r.state.done).toEqual([]);
  });
});
