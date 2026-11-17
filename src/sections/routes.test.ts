import { describe, it, expect } from 'vitest';
import { SECTION_IDS, getSection, resolveTab, goalsViewFor, healthViewFor, progressViewFor } from './routes';

describe('маршруты: 5 разделов и старые id', () => {
  it('разделов ровно пять, в порядке макета', () => {
    expect([...SECTION_IDS]).toEqual(['today', 'goals', 'channels', 'health', 'progress']);
  });

  it('старые id из палитры и ссылок открывают новый раздел', () => {
    const expected: Record<string, string> = {
      quests: 'goals', tasks: 'goals', habits: 'goals', calendar: 'goals', shopping: 'goals',
      studio: 'channels', production: 'channels',
      life: 'health', bigdata: 'health',
      tavern: 'progress', team: 'progress', finances: 'progress',
    };
    for (const [old, section] of Object.entries(expected)) {
      expect(getSection(resolveTab(old)), old).toBe(section);
    }
  });

  it('удалённые Flow Shorts, Идеи, AI и «Ещё» не воскресают: открывается «Сегодня»', () => {
    for (const id of ['shorts', 'ideas', 'ai', 'more', 'что-то', '', null, undefined]) {
      expect(getSection(resolveTab(id as string | null | undefined)), String(id)).toBe('today');
    }
  });

  it('покупки, календарь и Big Data открываются на своей вкладке внутри раздела', () => {
    expect(goalsViewFor('shopping')).toBe('shopping');
    expect(goalsViewFor('calendar')).toBe('calendar');
    expect(goalsViewFor('goals')).toBe('tasks');
    expect(healthViewFor('bigdata')).toBe('bigdata');
    expect(healthViewFor('health')).toBe('health');
    expect(progressViewFor('finances')).toBe('finances');
    expect(progressViewFor('tavern')).toBe('rewards');
  });
});
