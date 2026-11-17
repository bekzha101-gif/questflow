// Преобразование объектов приложения (camelCase) в строки Supabase (snake_case) и обратно.
import { TABLES, SINGLE_KEY, type TableName } from './tables';
import { SHOPPING_PROJECT_ID } from '../utils/taskFilters';

export type Row = Record<string, unknown> & {
  updated_at?: string;
  deleted?: boolean;
  extra?: Record<string, unknown>;
};

const META = new Set(['user_id', 'updated_at', 'deleted']);

export const toSnake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
export const toCamel = (s: string) => s.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase());

function isDateColumn(c: string) {
  return c === 'date' || c.endsWith('_date') || c === 'paused_until';
}
function isTimestampColumn(c: string) {
  return c.endsWith('_at') || c === 'timestamp' || c === 'at';
}

function sanitize(column: string, v: unknown): unknown {
  if (v === undefined || v === '') return null;
  if (isDateColumn(column)) {
    return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;
  }
  if (isTimestampColumn(column)) {
    if (typeof v === 'number') return new Date(v).toISOString();
    return typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null;
  }
  return v;
}

/** Покупка определяется одним признаком kind; для старых задач — по проекту и тегам */
function deriveTaskKind(item: Record<string, unknown>): 'task' | 'shopping' {
  if (item.projectId === SHOPPING_PROJECT_ID) return 'shopping';
  const tags = Array.isArray(item.tags) ? (item.tags as string[]) : [];
  if (tags.includes('покупки') || tags.includes('желания') || tags.includes('список покупок')) return 'shopping';
  return 'task';
}

/** Объект приложения → строка таблицы (все колонки, лишние поля — в extra) */
export function toRow(table: TableName, item: object): Row {
  const def = TABLES[table];
  const cols = new Set(def.columns);
  const row: Row = {};
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(item)) {
    if (v === undefined || META.has(k) || k === 'extra') continue;
    const sk = toSnake(k);
    if (cols.has(sk)) row[sk] = sanitize(sk, v);
    else extra[k] = v;
  }
  for (const c of def.columns) if (!(c in row)) row[c] = null;
  if (table === 'tasks2' && row.kind == null) row.kind = deriveTaskKind(item as Record<string, unknown>);
  row.extra = extra;
  return row;
}

/** Строка таблицы → объект приложения (null-поля опускаются) */
export function fromRow<T>(table: TableName, row: Row): T {
  const def = TABLES[table];
  const item: Record<string, unknown> = { ...(row.extra && typeof row.extra === 'object' ? row.extra : {}) };
  for (const c of def.columns) {
    const v = row[c];
    if (v === null || v === undefined) continue;
    item[toCamel(c)] = v;
  }
  return item as T;
}

/** Ключ строки внутри таблицы */
export function keyOf(table: TableName, row: Row): string {
  const key = TABLES[table].key;
  return key === 'user_id' ? SINGLE_KEY : String(row[key]);
}

function canonical(v: unknown, top = false): unknown {
  if (Array.isArray(v)) return v.map((x) => canonical(x));
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      if (top && META.has(k)) continue;
      const x = (v as Record<string, unknown>)[k];
      if (x === null || x === undefined) continue;
      out[k] = canonical(x);
    }
    return out;
  }
  return v;
}

/** Одинаково ли содержимое строк (без служебных полей) */
export function sameContent(a: Row | undefined, b: Row | undefined): boolean {
  if (!a || !b) return false;
  return JSON.stringify(canonical(a, true)) === JSON.stringify(canonical(b, true));
}

export function tsOf(row: Row | undefined): number {
  const t = row?.updated_at ? Date.parse(row.updated_at) : NaN;
  return Number.isNaN(t) ? 0 : t;
}
