import { describe, expect, it } from 'vitest';
import { shoppingCategoryCounts } from './ShoppingListView';
import type { TaskItem } from '../types';

const buy = (over: Partial<TaskItem> & { kind?: 'task' | 'shopping' }): TaskItem =>
  ({ id: 'b', title: 'Покупка', type: 'todo', kind: 'shopping', priority: 'p2', projectId: 'proj-inbox', tags: [], difficulty: 'easy', completed: false, subtasks: [], ...over }) as unknown as TaskItem;

describe('счётчики категорий покупок', () => {
  it('при 0 покупок все счётчики 0', () => {
    expect(shoppingCategoryCounts([])).toEqual({ all: 0, nootropics: 0, study: 0, tech: 0, health: 0, completed: 0 });
  });

  it('считают только покупки: обычные задачи с похожими словами не учитываются', () => {
    const task = buy({ id: 't', title: 'Купить iPhone чехол', kind: 'task' });
    expect(shoppingCategoryCounts([task])).toEqual({ all: 0, nootropics: 0, study: 0, tech: 0, health: 0, completed: 0 });
  });

  it('по категориям: активные — по своей категории, купленные — только в «Куплено»', () => {
    const items = [
      buy({ id: '1', title: 'Мухомор капсулы' }),
      buy({ id: '2', title: 'iPhone 16' }),
      buy({ id: '3', title: 'Обувь barefoot' }),
      buy({ id: '4', title: 'Курс по монтажу', completed: true }),
    ];
    expect(shoppingCategoryCounts(items)).toEqual({ all: 3, nootropics: 1, study: 0, tech: 1, health: 1, completed: 1 });
  });
});
