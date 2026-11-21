import { describe, it, expect } from 'vitest';
import { SECTION_IDS, getSection, resolveTab, goalsViewFor, healthViewFor, progressViewFor } from './routes';

describe('маршруты: 4 раздела и старые id', () => {
  it('разделов четыре: «Сегодня» стал вкладкой внутри «Целей»', () => {
    expect([...SECTION_IDS]).toEqual(['goals', 'channels', 'health', 'progress']);
  });

  it('старые id из палитры и ссылок открывают новый раздел', () => {
    const expected: Record<string, string> = {
      today: 'goals', quests: 'goals', tasks: 'goals', habits: 'goals', calendar: 'goals', shopping: 'goals',
      studio: 'channels', production: 'channels',
      life: 'health', bigdata: 'health',
      tavern: 'progress', team: 'progress', finances: 'progress',
    };
    for (const [old, section] of Object.entries(expected)) {
      expect(getSection(resolveTab(old)), old).toBe(section);
    }
  });

  it('удалённые Flow Shorts, Идеи, AI и «Ещё» не воскресают: открывается «Цели» на вкладке «Сегодня»', () => {
    for (const id of ['shorts', 'ideas', 'ai', 'more', 'что-то', '', null, undefined]) {
      const tab = resolveTab(id as string | null | undefined);
      expect(getSection(tab), String(id)).toBe('goals');
      expect(goalsViewFor(tab), String(id)).toBe('today');
    }
  });

  it('покупки, календарь и Big Data открываются на своей вкладке внутри раздела', () => {
    expect(goalsViewFor('shopping')).toBe('shopping');
    expect(goalsViewFor('calendar')).toBe('calendar');
    expect(goalsViewFor('goals')).toBe('today');
    expect(goalsViewFor('tasks')).toBe('tasks');
    expect(healthViewFor('bigdata')).toBe('bigdata');
    expect(healthViewFor('health')).toBe('health');
    expect(progressViewFor('finances')).toBe('finances');
    expect(progressViewFor('tavern')).toBe('rewards');
  });
});
