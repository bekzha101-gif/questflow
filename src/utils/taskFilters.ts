import { TaskItem } from '../types';

export const SHOPPING_PROJECT_ID = '6h5FPgJ74x5g685w';

// Покупка — отдельный признак kind (таблица tasks2). В типе TaskItem поля нет, поэтому расширяем здесь.
export type TaskKind = 'task' | 'shopping';
export type KindedTask = TaskItem & { kind?: TaskKind };

const LEGACY_SHOPPING_TAGS = ['покупки', 'желания', 'список покупок'];

/**
 * Покупка ли это. Решает признак kind. Только для старых записей без kind
 * работает прежнее правило: проект покупок или тег.
 * Покупки живут на своей вкладке и нигде больше не показываются.
 */
export function isShoppingTask(task: TaskItem): boolean {
  if (!task) return false;
  const kind = (task as KindedTask).kind;
  if (kind === 'shopping') return true;
  if (kind === 'task') return false;
  if (task.projectId === SHOPPING_PROJECT_ID) return true;
  return Boolean(task.tags && task.tags.some((tag) => LEGACY_SHOPPING_TAGS.includes(tag)));
}

/** Всё, кроме покупок: этот список получают все экраны, кроме вкладки «Покупки» */
export function selectRegularTasks<T extends TaskItem>(tasks: T[]): T[] {
  return tasks.filter((t) => !isShoppingTask(t));
}

export function selectShoppingTasks<T extends TaskItem>(tasks: T[]): T[] {
  return tasks.filter((t) => isShoppingTask(t));
}

/**
 * Собирает новую задачу. Если добавляют с вкладки «Покупки» (kind: 'shopping'),
 * это всегда обычное дело типа todo с признаком покупки.
 */
export function makeTask(
  input: Partial<TaskItem> & { title: string },
  ctx: { id: string; projectId: string; kind?: TaskKind },
): KindedTask {
  const kind: TaskKind = ctx.kind ?? 'task';
  const task: KindedTask = {
    type: 'todo',
    priority: 'p2',
    projectId: ctx.projectId,
    tags: [],
    difficulty: 'medium',
    expReward: 35,
    goldReward: 20,
    ...input,
    id: ctx.id,
    kind,
    completed: false,
    subtasks: input.subtasks || [],
  };
  if (kind === 'shopping') task.type = 'todo';
  return task;
}
