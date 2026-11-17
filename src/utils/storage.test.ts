import { describe, it, expect, beforeEach } from 'vitest';
import { loadTasks } from './storage';

// localStorage в среде node подменяем памятью
const mem = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  },
});

const KEY = 'questflow_tasks_v1';
const shopping = { id: 'td-1', title: 'Магний', type: 'todo', projectId: '6h5FPgJ74x5g685w', tags: [], subtasks: [] };

describe('loadTasks не создаёт задач и привычек сам', () => {
  beforeEach(() => mem.clear());

  it('пустое хранилище → пустой список и ничего не записано', () => {
    expect(loadTasks()).toEqual([]);
    expect(mem.has(KEY)).toBe(false);
  });

  it('если остались только покупки, задача «task-notebook-ideas» не появляется', () => {
    mem.set(KEY, JSON.stringify([shopping]));
    expect(loadTasks().map((t) => t.id)).toEqual(['td-1']);
  });

  it('привычки не добавляются, когда пользователь их удалил', () => {
    mem.set(KEY, JSON.stringify([{ ...shopping, id: 'my-todo', projectId: 'proj-inbox' }]));
    expect(loadTasks().some((t) => t.type === 'habit')).toBe(false);
  });

  it('пустой список остаётся пустым', () => {
    mem.set(KEY, JSON.stringify([]));
    expect(loadTasks()).toEqual([]);
  });
});
