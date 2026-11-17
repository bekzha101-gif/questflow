import { describe, it, expect } from 'vitest';
import {
  tapHabit,
  habitSnapshot,
  normalizeConfig,
  renameSphere,
  removeSphere,
  addSphere,
  toggleSupplement,
  buildMonth,
  sleepFromText,
} from './bigDataTracker';

describe('привычки одним касанием', () => {
  it('первое касание отмечает и даёт награду, повторное снимает, третье — без награды', () => {
    let r = tapHabit({ doneIds: [], rewardedIds: [] }, 'h1');
    expect(r.state.doneIds).toEqual(['h1']);
    expect(r.reward).toBe(true);
    r = tapHabit(r.state, 'h1');
    expect(r.state.doneIds).toEqual([]);
    expect(r.reward).toBe(false);
    r = tapHabit(r.state, 'h1');
    expect(r.state.doneIds).toEqual(['h1']);
    expect(r.reward).toBe(false);
  });

  it('снимок дня: что сделано, что пропущено (привычки и ежедневные)', () => {
    const snap = habitSnapshot(['h1'], [
      { id: 'h1', title: 'Вода 2 л', type: 'habit' },
      { id: 'h2', title: 'Медитация', type: 'habit' },
      { id: 'd1', title: 'План на завтра', type: 'daily', completed: true },
      { id: 't1', title: 'Задача', type: 'todo' },
    ]);
    expect(snap).toEqual({ habitsDone: 2, habitsTotal: 3, habitsMissed: ['Медитация'] });
  });
});

describe('сферы', () => {
  const cfg = normalizeConfig(null);

  it('без настроек — пустые списки, без выдуманных сфер', () => {
    expect(cfg).toEqual({ spheres: [], criteria: [], supplements: [] });
  });

  it('добавить, переименовать, удалить; старые дни хранят метку текстом', () => {
    let c = addSphere(cfg, 'Work');
    const id = c.spheres[0].id;
    c = renameSphere(c, id, 'Work+');
    expect(c.spheres.map((s) => s.label)).toEqual(['Work+']);
    c = removeSphere(c, id);
    expect(c.spheres).toEqual([]);
    // день, где стояла старая метка, не меняется
    const day = { date: '2026-11-01', tags: ['Dr', 'Work'] };
    expect(buildMonth('2026-11', [day])[0].day?.tags).toEqual(['Dr', 'Work']);
  });
});

describe('БАДы и месяц', () => {
  it('галочка БАДа добавляет и убирает название в дне', () => {
    expect(toggleSupplement([], 'Erinamax')).toEqual(['Erinamax']);
    expect(toggleSupplement(['Erinamax', 'Tiger Milk'], 'Erinamax')).toEqual(['Tiger Milk']);
  });

  it('месяц из дней хранилища: все даты, пятница отмечена, чужие месяцы не попадают', () => {
    const m = buildMonth('2026-11', [
      { date: '2026-11-03', score: 7 },
      { date: '2026-08-12', score: 9 },
    ]);
    expect(m).toHaveLength(30);
    expect(m[2].day?.score).toBe(7);
    expect(m.find((x) => x.date === '2026-11-20')?.isRecovery).toBe(true);
    expect(m.find((x) => x.date === '2026-11-19')?.isRecovery).toBe(false);
    expect(buildMonth('2026-08', [{ date: '2026-08-12', score: 9 }])[11].day?.score).toBe(9);
  });

  it('сон из текста «7ч 40м» и «7.5»', () => {
    expect(sleepFromText('7ч 40м')).toBe(460);
    expect(sleepFromText('7.5')).toBe(450);
    expect(sleepFromText('')).toBeUndefined();
  });
});
