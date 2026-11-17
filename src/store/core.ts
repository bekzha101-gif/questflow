// Ядро хранилища: локальный кеш (localStorage, ключи qf2_<table>) + очередь отправки по таблицам
// + слияние строк из облака (pull и Realtime). Конфликты: построчно, побеждает более поздний updated_at.
// Удаление — мягкое (deleted: true), поэтому удалённое не возвращается с другого устройства.
import { TABLES, TABLE_NAMES, type TableName } from './tables';
import { fromRow, keyOf, sameContent, toRow, tsOf, type Row } from './mapping';
import type { RemoteFactory } from './remote';

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem?(k: string): void;
}

export type SyncStatus = 'synced' | 'pending' | 'offline' | 'error';

export interface StoreOptions {
  storage: StorageLike;
  now?: () => number;
  isOnline?: () => boolean;
  /** Задержка автоотправки, мс; -1 — только ручной flush() (тесты) */
  flushDelayMs?: number;
}

export interface WriteOptions {
  /** Явная метка времени строки (перенос и сиды ставят старую, чтобы не перебить облако) */
  updatedAt?: string;
}

const CACHE_PREFIX = 'qf2_';
const QUEUE_PREFIX = 'qf2_queue_';
const ORDER_PREFIX = 'qf2_order_';
const RETRY_MS = 15_000;

/**
 * Метка записи, выведенной из запасного значения (записи ещё нет, облако не прочитано).
 * Старше меток переноса и сидов (2000-01-01), поэтому любая строка из облака её перебивает,
 * а триггер в базе не даст ей перезаписать облако.
 */
export const FALLBACK_TS = '1999-01-01T00:00:00.000Z';

export class Store {
  private storage: StorageLike;
  private now: () => number;
  private isOnline: () => boolean;
  private flushDelayMs: number;
  private cache = new Map<TableName, Map<string, Row>>();
  private queue = new Map<TableName, Map<string, Row>>();
  private memo = new Map<TableName, { version: number; items: unknown[] }>();
  private versions = new Map<TableName, number>();
  private order = new Map<TableName, string[]>();
  private listeners = new Set<() => void>();
  private remote: RemoteFactory | null = null;
  private unsubs: (() => void)[] = [];
  private flushing: Promise<void> | null = null;
  private flushAgain = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastTs = 0;
  private error: string | null = null;
  private pullError: string | null = null;
  private ready: boolean | null = null;
  private readyWaiters: ((ok: boolean) => void)[] = [];

  constructor(opts: StoreOptions) {
    this.storage = opts.storage;
    this.now = opts.now ?? Date.now;
    this.isOnline = opts.isOnline ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine));
    this.flushDelayMs = opts.flushDelayMs ?? 400;
  }

  // ─── Локальный кеш ────────────────────────────────────────────────────────
  private load(prefix: string, table: TableName): Map<string, Row> {
    try {
      const raw = this.storage.getItem(prefix + table);
      if (raw) return new Map(Object.entries(JSON.parse(raw) as Record<string, Row>));
    } catch {
      // повреждённый кеш — начинаем с пустого, облако дошлёт строки
    }
    return new Map();
  }

  private cacheOf(table: TableName) {
    let m = this.cache.get(table);
    if (!m) {
      m = this.load(CACHE_PREFIX, table);
      this.cache.set(table, m);
    }
    return m;
  }

  private queueOf(table: TableName) {
    let m = this.queue.get(table);
    if (!m) {
      m = this.load(QUEUE_PREFIX, table);
      this.queue.set(table, m);
    }
    return m;
  }

  private persist(table: TableName) {
    try {
      this.storage.setItem(CACHE_PREFIX + table, JSON.stringify(Object.fromEntries(this.cacheOf(table))));
      this.storage.setItem(QUEUE_PREFIX + table, JSON.stringify(Object.fromEntries(this.queueOf(table))));
    } catch (e) {
      console.error('qf2: не удалось сохранить локальный кеш', e);
    }
  }

  /** Перечитать таблицу из storage (другая вкладка записала) */
  reloadFromStorage(table: TableName) {
    this.cache.delete(table);
    this.queue.delete(table);
    this.order.delete(table);
    this.touch(table);
  }

  private touch(table: TableName) {
    this.versions.set(table, (this.versions.get(table) ?? 0) + 1);
    this.notify();
  }

  notify() {
    for (const fn of this.listeners) fn();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private stamp(): string {
    this.lastTs = Math.max(this.now(), this.lastTs + 1);
    return new Date(this.lastTs).toISOString();
  }

  // ─── Чтение ──────────────────────────────────────────────────────────────
  /** Живые (не удалённые) объекты таблицы; ссылка стабильна, пока таблица не менялась */
  items<T>(table: TableName): T[] {
    const version = this.versions.get(table) ?? 0;
    const m = this.memo.get(table);
    if (m && m.version === version) return m.items as T[];
    let rows = [...this.cacheOf(table).entries()].filter(([, r]) => !r.deleted);
    const order = this.orderOf(table);
    if (order.length) {
      const pos = new Map(order.map((k, i) => [k, i]));
      // строки, которых нет в порядке (пришли из облака), — сверху
      rows = rows
        .map(([k, r], i) => ({ k, r, p: pos.has(k) ? (pos.get(k) as number) : -rows.length + i }))
        .sort((a, b) => a.p - b.p)
        .map(({ k, r }) => [k, r] as [string, Row]);
    }
    const items = rows.map(([, r]) => fromRow<T>(table, r));
    this.memo.set(table, { version, items });
    return items;
  }

  private orderOf(table: TableName): string[] {
    let o = this.order.get(table);
    if (!o) {
      try {
        o = JSON.parse(this.storage.getItem(ORDER_PREFIX + table) ?? '[]') as string[];
      } catch {
        o = [];
      }
      this.order.set(table, o);
    }
    return o;
  }

  /** Локальный порядок показа (в облако не уходит) */
  setOrder(table: TableName, keys: string[]) {
    const cur = this.orderOf(table);
    if (cur.length === keys.length && cur.every((k, i) => k === keys[i])) return;
    this.order.set(table, keys);
    try {
      this.storage.setItem(ORDER_PREFIX + table, JSON.stringify(keys));
    } catch {
      // порядок не критичен
    }
    this.touch(table);
  }

  getRow(table: TableName, key: string): Row | undefined {
    return this.cacheOf(table).get(key);
  }

  get<T>(table: TableName, key: string): T | null {
    const r = this.getRow(table, key);
    return r && !r.deleted ? fromRow<T>(table, r) : null;
  }

  /** Есть ли в таблице хоть одна строка (удалённые тоже считаются) */
  hasAnyRow(table: TableName): boolean {
    return this.cacheOf(table).size > 0;
  }

  /** Есть ли строка с ключом (в т.ч. удалённая) */
  hasKey(table: TableName, key: string): boolean {
    return this.cacheOf(table).has(key);
  }

  // ─── Запись ──────────────────────────────────────────────────────────────
  upsert<T extends object>(table: TableName, item: T, opts: WriteOptions = {}) {
    this.write(table, toRow(table, item), false, opts);
  }

  /**
   * Записать одну запись как setState: next = action(prev ?? fallback).
   * Явная правка пользователя (по умолчанию) пишется с обычной меткой «сейчас».
   * Автозапись (`{auto: true}`): если записи нет (или она сама из запасного значения, а облако
   * не прочитано), строка получает FALLBACK_TS и не может перебить настоящие данные из облака.
   */
  writeRecord<T extends object>(
    table: TableName,
    fallback: T,
    action: T | ((prev: T) => T),
    key: string,
    item: (v: T) => object,
    opts: { auto?: boolean } = {},
  ) {
    const row = this.getRow(table, key);
    const live = row && !row.deleted ? row : undefined;
    const prev = live ? fromRow<T>(table, live) : fallback;
    const next = typeof action === 'function' ? (action as (p: T) => T)(prev) : action;
    const obj = item(next);
    if (live && sameContent(toRow(table, obj), live)) return;
    const derived = opts.auto === true && (!live || (live.updated_at === FALLBACK_TS && this.ready !== true));
    this.upsert(table, obj, derived ? { updatedAt: FALLBACK_TS } : {});
  }

  /**
   * Можно ли автозаписям (сброс дня, итоги игры) писать сейчас: облака нет (локальный режим)
   * или оно прочитано. Пока облако подключено, но не прочитано (или чтение не удалось),
   * кеш может быть старым — автозапись из него перебила бы свежие строки с другого устройства и бота.
   */
  autoWritesAllowed(): boolean {
    return this.remote === null || this.ready === true;
  }

  remove(table: TableName, key: string) {
    const cur = this.getRow(table, key);
    if (!cur || cur.deleted) return;
    this.write(table, { ...cur }, true, {});
  }

  private write(table: TableName, row: Row, deleted: boolean, opts: WriteOptions) {
    const full: Row = { ...row, deleted, updated_at: opts.updatedAt ?? this.stamp() };
    const key = keyOf(table, full);
    if (TABLES[table].key === 'user_id') delete full.user_id;
    this.cacheOf(table).set(key, full);
    this.queueOf(table).set(key, full);
    this.persist(table);
    this.touch(table);
    this.scheduleFlush(this.flushDelayMs);
  }

  // ─── Облако ──────────────────────────────────────────────────────────────
  /** Применить строку из облака: берём её, если она не старее локальной и ожидающей отправки */
  applyRemote(table: TableName, incoming: Row, silent = false) {
    const row: Row = { ...incoming };
    delete row.user_id;
    const key = keyOf(table, row);
    const local = this.cacheOf(table).get(key);
    const pending = this.queueOf(table).get(key);
    if (pending && tsOf(pending) > tsOf(row)) return;
    if (local && tsOf(local) > tsOf(row)) return;
    this.cacheOf(table).set(key, row);
    if (pending) this.queueOf(table).delete(key);
    this.persist(table);
    if (!silent) this.touch(table);
    else this.versions.set(table, (this.versions.get(table) ?? 0) + 1);
  }

  get isConnected() {
    return this.remote !== null;
  }

  /** Подключить облако: скачать все таблицы, подписаться на Realtime, дослать очередь. true — облако прочитано полностью. */
  async connect(remote: RemoteFactory): Promise<boolean> {
    this.disconnect();
    this.remote = remote;
    this.ready = null;
    const results = await Promise.allSettled(
      TABLE_NAMES.map(async (t) => {
        const rows = await remote(t).select();
        for (const r of rows) this.applyRemote(t, r, true);
      }),
    );
    if (this.remote !== remote) return false;
    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    this.pullError = failed.length ? String(failed[0].reason?.message ?? failed[0].reason) : null;
    this.error = this.pullError;
    for (const t of TABLE_NAMES) {
      this.unsubs.push(remote(t).subscribe((row) => this.applyRemote(t, row)));
    }
    this.setReady(failed.length === 0);
    this.notify();
    await this.flush();
    return failed.length === 0;
  }

  disconnect() {
    for (const u of this.unsubs) u();
    this.unsubs = [];
    this.remote = null;
    this.pullError = null;
    this.error = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.setReady(false);
    this.ready = null;
    this.notify();
  }

  private setReady(ok: boolean) {
    this.ready = ok;
    const waiters = this.readyWaiters;
    this.readyWaiters = [];
    for (const w of waiters) w(ok);
  }

  /** Дождаться первичной загрузки из облака. false — облака нет или прочитать не удалось. */
  whenReady(timeoutMs = 10_000): Promise<boolean> {
    if (!this.remote) return Promise.resolve(false);
    if (this.ready !== null) return Promise.resolve(this.ready);
    return new Promise((resolve) => {
      const t = setTimeout(() => resolve(false), timeoutMs);
      this.readyWaiters.push((ok) => {
        clearTimeout(t);
        resolve(ok);
      });
    });
  }

  private scheduleFlush(ms: number) {
    if (ms < 0 || !this.remote) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, ms);
  }

  pendingCount(): number {
    let n = 0;
    for (const t of TABLE_NAMES) n += this.queueOf(t).size;
    return n;
  }

  /** Отправить очередь. Таблицы независимы; при отказе пачки строки шлются по одной. */
  async flush(): Promise<void> {
    if (this.flushing) {
      this.flushAgain = true;
      return this.flushing;
    }
    this.flushing = this.doFlush().finally(() => {
      this.flushing = null;
    });
    await this.flushing;
    if (this.flushAgain) {
      this.flushAgain = false;
      await this.flush();
    }
  }

  private async doFlush() {
    const remote = this.remote;
    if (!remote || !this.isOnline()) {
      this.notify();
      return;
    }
    let error: string | null = null;
    for (const t of TABLE_NAMES) {
      const q = this.queueOf(t);
      if (q.size === 0) continue;
      const batch = [...q.values()];
      try {
        await remote(t).upsert(batch);
        this.ack(t, batch);
      } catch (e) {
        if (batch.length > 1 && this.isOnline()) {
          for (const r of batch) {
            try {
              await remote(t).upsert([r]);
              this.ack(t, [r]);
            } catch (e2) {
              error = (e2 as Error).message ?? String(e2);
            }
          }
        } else {
          error = (e as Error).message ?? String(e);
        }
      }
    }
    this.error = error ?? this.pullError;
    if (error) {
      console.warn('qf2: ошибка синхронизации', error);
      this.scheduleFlush(RETRY_MS);
    }
    this.notify();
  }

  private ack(table: TableName, sent: Row[]) {
    const q = this.queueOf(table);
    for (const r of sent) {
      const key = keyOf(table, r);
      const cur = q.get(key);
      if (cur && tsOf(cur) === tsOf(r)) q.delete(key);
    }
    this.persist(table);
  }

  lastError(): string | null {
    return this.error;
  }

  status(): SyncStatus {
    if (!this.remote || !this.isOnline()) return 'offline';
    if (this.error) return 'error';
    if (this.pendingCount() > 0) return 'pending';
    return 'synced';
  }
}
