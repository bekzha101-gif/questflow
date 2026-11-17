// Хранилище сайта: единственный путь к данным для компонентов.
// Компоненты не трогают localStorage и Supabase напрямую — только эти хуки.
import { useCallback, useMemo, useSyncExternalStore, type Dispatch, type SetStateAction } from 'react';
import { Store, type SyncStatus } from './core';
import { createSupabaseRemote } from './remote';
import { sameContent, toRow } from './mapping';
import { SINGLE_KEY, TABLE_NAMES, type TableName } from './tables';

export type { SyncStatus, TableName };
export { Store };

const memoryFallback = new Map<string, string>();
const browserStorage =
  typeof window !== 'undefined' && window.localStorage
    ? window.localStorage
    : {
        getItem: (k: string) => memoryFallback.get(k) ?? null,
        setItem: (k: string, v: string) => void memoryFallback.set(k, v),
        removeItem: (k: string) => void memoryFallback.delete(k),
      };

/** Общий экземпляр хранилища сайта */
export const store = new Store({ storage: browserStorage });

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void store.retryPull();
    void store.flush();
  });
  // Вернулись на вкладку — дочитать облако, если первая загрузка сорвалась
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void store.retryPull();
  });
  window.addEventListener('offline', () => store.notify());
  // Другая вкладка записала кеш — перечитываем таблицу
  window.addEventListener('storage', (e) => {
    if (!e.key?.startsWith('qf2_')) return;
    const table = e.key.replace(/^qf2_(queue_|order_)?/, '') as TableName;
    if (TABLE_NAMES.includes(table)) store.reloadFromStorage(table);
  });
}

let connectedUser: string | null = null;

/** Подключить облако для вошедшего пользователя (зовёт AuthGate) */
export function connectCloud(client: unknown, userId: string): Promise<boolean> {
  if (connectedUser === userId && store.isConnected) return store.whenReady();
  connectedUser = userId;
  return store.connect(createSupabaseRemote(client, userId));
}

export function disconnectCloud() {
  connectedUser = null;
  store.disconnect();
}

/** Отправить очередь сейчас */
export function syncNow(): Promise<void> {
  return store.flush();
}

// ─── Хуки ──────────────────────────────────────────────────────────────────
const subscribe = (fn: () => void) => store.subscribe(fn);

export function useCollection<T extends object>(table: TableName): {
  items: T[];
  upsert: (item: T) => void;
  remove: (id: string) => void;
} {
  const items = useSyncExternalStore(subscribe, () => store.items<T>(table));
  const upsert = useCallback((item: T) => store.upsert(table, item), [table]);
  const remove = useCallback((id: string) => store.remove(table, id), [table]);
  return { items, upsert, remove };
}

export function useRecord<T extends object>(table: TableName, key: string = SINGLE_KEY): {
  value: T | null;
  save: (v: T) => void;
} {
  const items = useSyncExternalStore(subscribe, () => store.items<T>(table));
  const value = useMemo(() => store.get<T>(table, key), [items, table, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useCallback(
    (v: T) => store.upsert(table, key === SINGLE_KEY ? v : { ...v, [keyField(table)]: key }),
    [table, key],
  );
  return { value, save };
}

/** Можно ли автозаписям писать: облака нет или оно прочитано (обновляется после чтения облака) */
export function useAutoWritesAllowed(): boolean {
  return useSyncExternalStore(subscribe, () => store.autoWritesAllowed());
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribe, () => store.status());
}

function keyField(table: TableName) {
  return table === 'kv' ? 'key' : table === 'bigdata_days' ? 'date' : 'id';
}

export interface Converter<A, T> {
  toApp: (item: T) => A;
  fromApp: (item: A) => T;
}

/**
 * Записать массив в коллекцию: изменённые строки — upsert, пропавшие — мягкое удаление.
 * Неизменённые строки не трогаются (не меняют updated_at и не уходят в сеть).
 */
export function writeCollection<T extends { id: string }>(table: TableName, next: T[]) {
  const seen = new Set<string>();
  for (const item of next) {
    if (!item || typeof item.id !== 'string') continue;
    seen.add(item.id);
    const cur = store.getRow(table, item.id);
    if (cur && !cur.deleted && sameContent(toRow(table, item), cur)) continue;
    store.upsert(table, item);
  }
  for (const cur of store.items<{ id: string }>(table)) {
    if (!seen.has(cur.id)) store.remove(table, cur.id);
  }
  store.setOrder(table, next.filter((x) => x && typeof x.id === 'string').map((x) => x.id));
}

/**
 * Коллекция как useState: [items, setItems]. Нужна, чтобы перевести App.tsx на store
 * без переписывания всех обработчиков (setTasks(prev => …)).
 */
export function useCollectionState<A extends { id: string }, T extends { id: string } = A>(
  table: TableName,
  conv?: Converter<A, T>,
): [A[], Dispatch<SetStateAction<A[]>>] {
  const raw = useSyncExternalStore(subscribe, () => store.items<T>(table));
  const items = useMemo(() => (conv ? raw.map(conv.toApp) : (raw as unknown as A[])), [raw]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = useCallback<Dispatch<SetStateAction<A[]>>>(
    (action) => {
      const curRaw = store.items<T>(table);
      const cur = conv ? curRaw.map(conv.toApp) : (curRaw as unknown as A[]);
      const next = typeof action === 'function' ? (action as (p: A[]) => A[])(cur) : action;
      writeCollection<T>(table, conv ? next.map(conv.fromApp) : (next as unknown as T[]));
    },
    [table], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return [items, set];
}

/** Одна запись как useState с запасным значением, пока записи нет */
export function useRecordState<T extends object>(
  table: TableName,
  fallback: T,
  key: string = SINGLE_KEY,
): [T, Dispatch<SetStateAction<T>>] {
  const { value } = useRecord<T>(table, key);
  const current = value ?? fallback;
  const set = useCallback<Dispatch<SetStateAction<T>>>(
    (action) => {
      store.writeRecord<T>(table, fallback, action, key, (v) => (key === SINGLE_KEY ? v : { ...v, [keyField(table)]: key }));
    },
    [table, key], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return [current, set];
}
