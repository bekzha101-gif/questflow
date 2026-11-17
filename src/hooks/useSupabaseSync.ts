// Старый синк (push/pull целых массивов в таблицы 001) отключён: он затирал данные,
// терял удаления и не принимал текстовые id. Синхронизацию теперь ведёт src/store
// (таблицы 002, очередь, Realtime). Хук остался как переходник статуса для шапки.
import { useSyncStatus } from '../store';

export type HeaderSyncStatus = 'local' | 'syncing' | 'synced' | 'error';

export function useSupabaseSync(): { syncStatus: HeaderSyncStatus } {
  const s = useSyncStatus();
  const syncStatus: HeaderSyncStatus =
    s === 'synced' ? 'synced' : s === 'pending' ? 'syncing' : s === 'error' ? 'error' : 'local';
  return { syncStatus };
}
