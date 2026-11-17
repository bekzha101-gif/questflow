// Сброс ежедневных задач в новый день. Это автозапись: пока облако подключено, но не прочитано,
// кеш может быть старым (задача удалена на другом устройстве или ботом), и сброс воскресил бы её
// (CLAUDE.md п.1). Поэтому сброс ждёт чтения облака.
import { store as defaultStore, type Store } from '../../store';

interface DailyLike {
  id: string;
  type?: string;
  completed?: boolean;
}

/**
 * Снять отметки ежедневных задач, если сегодня сброса ещё не было.
 * true — сброс сделан (App запоминает дату и показывает уведомление); false — не нужен или рано.
 */
export function runDailyReset(today: string, lastReset: string | null, s: Store = defaultStore): boolean {
  if (lastReset === today) return false;
  if (!s.autoWritesAllowed()) return false;
  for (const t of s.items<DailyLike>('tasks2')) {
    if (t.type === 'daily' && t.completed) s.upsert('tasks2', { ...t, completed: false });
  }
  return true;
}
