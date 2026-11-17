import { describe, expect, it } from 'vitest';
import * as data from './initialData';

describe('стартовые данные новой пустой базы', () => {
  it('статы с нуля: уровень 1, 0 опыта, 0 золота, серия 0', () => {
    expect(data.initialStats).toMatchObject({ level: 1, exp: 0, gold: 0, streak: 0, hp: 100, maxHp: 100 });
  });
  it('нет выдуманных задач, проектов, наград и босса (правило: не воскрешать старые задачи)', () => {
    expect(Object.keys(data).sort()).toEqual(['initialCalendarConfig', 'initialStats']);
  });
});
