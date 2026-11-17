// Подмены для тестов хранилища: память вместо localStorage и фейковое облако (RemoteTable).
import type { RemoteFactory, RemoteTable } from './remote';
import type { Row } from './mapping';
import { keyOf } from './mapping';
import type { TableName } from './tables';
import type { StorageLike } from './core';

export class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.has(k) ? (this.data.get(k) as string) : null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  keys() {
    return [...this.data.keys()];
  }
}

/** Фейковое облако: строки по таблицам, сбой по флагу, ручная рассылка Realtime */
export class FakeCloud {
  tables = new Map<TableName, Map<string, Row>>();
  failing = false;
  /** Отклонять строки, для которых предикат вернул true (как ошибка БД на одной строке) */
  reject: ((table: TableName, row: Row) => boolean) | null = null;
  upsertCalls = 0;
  private subs = new Map<TableName, Set<(row: Row) => void>>();

  table(t: TableName) {
    if (!this.tables.has(t)) this.tables.set(t, new Map());
    return this.tables.get(t) as Map<string, Row>;
  }

  rows(t: TableName) {
    return [...this.table(t).values()];
  }

  /** Записать строку «с сервера» (как бот) и разослать её подписчикам Realtime */
  emit(t: TableName, row: Row) {
    this.table(t).set(keyOf(t, row), row);
    for (const fn of this.subs.get(t) ?? []) fn(row);
  }

  factory: RemoteFactory = (t): RemoteTable => ({
    upsert: async (rows) => {
      this.upsertCalls++;
      if (this.failing) throw new Error('network down');
      if (this.reject && rows.some((r) => this.reject?.(t, r))) throw new Error('rejected row');
      for (const r of rows) this.table(t).set(keyOf(t, r), JSON.parse(JSON.stringify(r)));
    },
    select: async () => {
      if (this.failing) throw new Error('network down');
      return this.rows(t).map((r) => JSON.parse(JSON.stringify(r)));
    },
    subscribe: (fn) => {
      if (!this.subs.has(t)) this.subs.set(t, new Set());
      this.subs.get(t)?.add(fn);
      return () => this.subs.get(t)?.delete(fn);
    },
  });
}
