import { TaskItem } from '../types';

export const SHOPPING_PROJECT_ID = '6h5FPgJ74x5g685w';

/**
 * Checks whether a task belongs to the Shopping List (Список покупок).
 * Shopping items are kept isolated in their dedicated Shopping List view
 * so they don't clutter the daily tasks or goals panels.
 */
export function isShoppingTask(task: TaskItem): boolean {
  if (!task) return false;
  if (task.projectId === SHOPPING_PROJECT_ID) return true;
  if (task.tags && (
    task.tags.includes('покупки') || 
    task.tags.includes('желания') || 
    task.tags.includes('список покупок')
  )) {
    return true;
  }
  return false;
}
