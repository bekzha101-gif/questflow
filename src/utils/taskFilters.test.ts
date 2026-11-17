import { describe, it, expect } from 'vitest';
import type { TaskItem } from '../types';
import { isShoppingTask, selectRegularTasks, selectShoppingTasks, makeTask } from './taskFilters';

const base = (over: Record<string, unknown>): TaskItem =>
  ({ id: 'x', title: 'x', type: 'todo', priority: 'p2', projectId: 'proj-inbox', tags: [], difficulty: 'easy',
     expReward: 1, goldReward: 1, completed: false, subtasks: [], ...over }) as TaskItem;

describe('покупки отделены от задач одним признаком kind', () => {
  it('kind: shopping — покупка, обычная задача — нет', () => {
    expect(isShoppingTask(base({ kind: 'shopping' }))).toBe(true);
    expect(isShoppingTask(base({ kind: 'task' }))).toBe(false);
  });

  it('снятый тег не превращает покупку в задачу, а добавленный не превращает задачу в покупку', () => {
    expect(isShoppingTask(base({ kind: 'shopping', tags: [] }))).toBe(true);
    expect(isShoppingTask(base({ kind: 'task', tags: ['покупки'] }))).toBe(false);
  });

  it('старая задача без kind определяется по проекту и тегам', () => {
    expect(isShoppingTask(base({ projectId: '6h5FPgJ74x5g685w' }))).toBe(true);
    expect(isShoppingTask(base({ tags: ['список покупок'] }))).toBe(true);
    expect(isShoppingTask(base({}))).toBe(false);
  });

  it('selectRegularTasks убирает покупки, selectShoppingTasks оставляет только их', () => {
    const list = [base({ id: 'a' }), base({ id: 'b', kind: 'shopping' }), base({ id: 'c', type: 'daily' })];
    expect(selectRegularTasks(list).map((t) => t.id)).toEqual(['a', 'c']);
    expect(selectShoppingTasks(list).map((t) => t.id)).toEqual(['b']);
  });

  it('makeTask с вкладки «Покупки» ставит kind: shopping и тип todo', () => {
    const t = makeTask({ title: 'Магний', type: 'habit' }, { id: 'task-1', projectId: 'proj-inbox', kind: 'shopping' });
    expect(t).toMatchObject({ id: 'task-1', kind: 'shopping', type: 'todo', completed: false });
    expect(isShoppingTask(t)).toBe(true);
  });

  it('makeTask без вкладки покупок делает обычную задачу и не пишет inFocusFlow', () => {
    const t = makeTask({ title: 'Позвонить' }, { id: 'task-2', projectId: 'proj-inbox' });
    expect(t.kind).toBe('task');
    expect('inFocusFlow' in t).toBe(false);
  });
});
