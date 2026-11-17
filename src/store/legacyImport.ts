// Перенос старых данных браузера (ключи questflow_*) в новые таблицы.
// Порядок: 1) скачать JSON-бэкап всех ключей; 2) записать в хранилище (оттуда — в облако).
// Повтор безопасен: пишутся только строки, которых ещё нет (в т.ч. удалённых) — ничего не дублируется
// и не перезаписывается. Старые ключи localStorage не стираются.
import { todayStr } from '@shared/time';
import type { Store, StorageLike } from './core';
import { store as defaultStore } from './index';
import type { TableName } from './tables';
import { SINGLE_KEY } from './tables';
import { keyOf, toRow } from './mapping';
import { timeLogToSession } from './adapters';
import type { TimeLogEntry } from '../types';

export const LEGACY_FLAG = 'qf2_legacy_imported';

/** Маркер в облаке (kv): перенос уже сделан с какого-то устройства — другие устройства старые строки не шлют */
export const CLOUD_IMPORT_MARKER = 'legacy_imported';

/** Метка времени перенесённых строк: старше любых настоящих правок, поэтому облако всегда выигрывает */
export const LEGACY_TS = '2000-01-01T00:00:00.000Z';

/** Ключи с данными, ради которых нужен перенос */
const DATA_KEYS = [
  'questflow_tasks_v1',
  'questflow_projects_v1',
  'questflow_rewards_v1',
  'questflow_stats_v1',
  'questflow_timelogs',
  'questflow_bigdata_v1',
  'questflow_health_food_v1',
  'questflow_health_alarms_v1',
  'questflow_channels_v1',
  'questflow_videos_v1',
  'questflow_finances_v1',
];

/** Не уходят в облако: ключи доступа и токены сторонних сервисов */
const PRIVATE_KEYS = new Set([
  'questflow_supabase_url',
  'questflow_supabase_anon_key',
  'questflow_calendar_config_v1',
  'questflow_google_fit_config_v1',
]);

/** Демо-транзакции старого FinancesTracker — не данные пользователя */
const DEMO_TX = new Set(['tx-1', 'tx-2', 'tx-3', 'tx-4']);

export interface ImportReport {
  /** Сколько новых строк записано в каждую таблицу */
  counts: Partial<Record<TableName, number>>;
  /** Перенос уже был (флаг qf2_legacy_imported) — ничего не делали */
  alreadyImported: boolean;
  /** Перенос пропущен, потому что в облаке уже есть перенесённые данные (бэкап всё равно скачан) */
  cloudAlreadyImported?: boolean;
  /** Имя скачанного файла бэкапа */
  backupFile: string | null;
}

export interface ImportOptions {
  store?: Store;
  storage?: StorageLike & { length?: number; key?(i: number): string | null; keys?(): string[] };
  /** Скачать файл (по умолчанию — через браузер) */
  download?: (filename: string, json: string) => void;
  /** Вызывается на каждую запись (для тестов порядка) */
  onWrite?: () => void;
  /** Повторить, даже если флаг стоит */
  force?: boolean;
  now?: Date;
}

type AnyStorage = NonNullable<ImportOptions['storage']>;

function listKeys(s: AnyStorage): string[] {
  if (typeof s.keys === 'function') return s.keys();
  const out: string[] = [];
  const n = s.length ?? 0;
  for (let i = 0; i < n; i++) {
    const k = s.key?.(i);
    if (k) out.push(k);
  }
  return out;
}

function parse(raw: string | null): unknown {
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function arr(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Record<string, unknown>[]) : [];
}

function browserDownload(filename: string, json: string) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Есть ли в облаке маркер переноса (вызывать после чтения облака) */
export function cloudHasLegacyImport(store: Store): boolean {
  return store.get('kv', CLOUD_IMPORT_MARKER) !== null;
}

/** Нужен ли перенос: флага нет, а старые данные есть */
export function needsLegacyImport(storage?: StorageLike): boolean {
  const s = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!s || s.getItem(LEGACY_FLAG)) return false;
  return DATA_KEYS.some((k) => {
    const v = parse(s.getItem(k));
    return Array.isArray(v) ? v.length > 0 : v != null;
  });
}

const VIDEO_STAGE: Record<string, 'editing' | 'review' | 'published'> = {
  scripting: 'editing',
  voiceover: 'editing',
  editing: 'editing',
  review: 'review',
  scheduled: 'review',
  published: 'published',
};

export async function runLegacyImport(opts: ImportOptions = {}): Promise<ImportReport> {
  const storage = (opts.storage ?? window.localStorage) as AnyStorage;
  const store = opts.store ?? defaultStore;
  if (!opts.force && storage.getItem(LEGACY_FLAG)) {
    return { counts: {}, alreadyImported: true, backupFile: null };
  }

  // Перенос идёт только в прочитанное облако: иначе неизвестно, что там уже есть,
  // и старые строки этого браузера могли бы вернуть удалённое на другом устройстве
  if (!store.isConnected) throw new Error('Войдите в аккаунт: данные переносятся только в облако');
  if (!(await store.whenReady())) throw new Error('Нет связи с облаком');

  // 1. Бэкап всех ключей до любой записи
  const keys = listKeys(storage).filter((k) => k.startsWith('questflow_'));
  const raw: Record<string, string | null> = {};
  for (const k of keys) raw[k] = storage.getItem(k);
  const now = opts.now ?? new Date();
  const backupFile = `questflow-backup-${todayStr(now)}.json`;
  const backup = { source: 'questflow_full_backup', version: 2, exportedAt: now.toISOString(), localStorage: raw };
  (opts.download ?? browserDownload)(backupFile, JSON.stringify(backup, null, 2));

  // В облаке уже есть перенос (с другого устройства) — старые данные этого браузера не отправляем
  if (!opts.force && cloudHasLegacyImport(store)) {
    storage.setItem(LEGACY_FLAG, now.toISOString());
    return { counts: {}, alreadyImported: true, cloudAlreadyImported: true, backupFile };
  }

  // 2. Запись только отсутствующих строк
  const counts: Partial<Record<TableName, number>> = {};
  const put = (table: TableName, item: Record<string, unknown>) => {
    const key = keyOf(table, toRow(table, item));
    if (!key || key === 'null' || key === 'undefined' || store.hasKey(table, key)) return;
    store.upsert(table, item, { updatedAt: LEGACY_TS });
    counts[table] = (counts[table] ?? 0) + 1;
    opts.onWrite?.();
  };
  const get = (k: string) => parse(storage.getItem(k));

  for (const t of arr(get('questflow_tasks_v1'))) if (typeof t.id === 'string') put('tasks2', t);
  for (const p of arr(get('questflow_projects_v1'))) if (typeof p.id === 'string') put('projects2', p);
  for (const r of arr(get('questflow_rewards_v1'))) if (typeof r.id === 'string') put('rewards2', { tier: 'small', ...r });

  const stats = get('questflow_stats_v1');
  if (stats && typeof stats === 'object' && !Array.isArray(stats)) {
    const s = stats as Record<string, unknown>;
    if (!store.hasKey('game_stats', SINGLE_KEY)) put('game_stats', { bestStreak: s.streak, ...s });
  }

  for (const l of arr(get('questflow_timelogs'))) {
    if (typeof l.id === 'string') put('focus_sessions', timeLogToSession(l as unknown as TimeLogEntry));
  }

  const bigdata = get('questflow_bigdata_v1');
  if (bigdata && typeof bigdata === 'object') {
    for (const d of arr((bigdata as { days?: unknown }).days)) {
      const date = String(d.dateStr ?? '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const supp = typeof d.supplements === 'string' && d.supplements.trim() && d.supplements !== '(ничего)'
        ? d.supplements.split(/\s*,\s*/).filter(Boolean)
        : [];
      const tags = Array.isArray(d.tags) ? (d.tags as string[]) : [];
      const sleepMin = Number(d.sleepMinutes) || 0;
      const filled = sleepMin > 0 || d.score != null || (typeof d.why === 'string' && d.why.trim()) || tags.length || supp.length;
      if (!filled) continue;
      put('bigdata_days', {
        date,
        sleepMin: sleepMin || undefined,
        sleepQuality: d.sleepQualityPercent ?? undefined,
        score: d.score ?? undefined,
        why: d.why || undefined,
        tags,
        supplements: supp,
        legacySleep: d.sleep || undefined,
        legacyAutoSynced: d.isAutoSynced || undefined,
      });
    }
  }

  for (const f of arr(get('questflow_health_food_v1'))) if (typeof f.id === 'string') put('health_food', f);
  for (const a of arr(get('questflow_health_alarms_v1'))) if (typeof a.id === 'string') put('health_alarms', a);

  for (const c of arr(get('questflow_channels_v1'))) {
    if (typeof c.id !== 'string') continue;
    const { description, ...rest } = c;
    put('channels2', { status: 'active', cadencePerDay: 1, niche: description, ...rest });
  }
  for (const v of arr(get('questflow_videos_v1'))) {
    if (typeof v.id !== 'string') continue;
    const stage = v.isUploaded ? 'published' : VIDEO_STAGE[String(v.stage)] ?? 'editing';
    const { stage: legacyStage, ...rest } = v;
    put('videos2', {
      ...rest,
      stage,
      legacyStage,
      checklist: { plan: false, title: false, thumbnail: false, edit: stage !== 'editing', upload: stage === 'published' },
    });
  }

  for (const tx of arr(get('questflow_finances_v1'))) {
    if (typeof tx.id !== 'string' || tx.type !== 'income' || DEMO_TX.has(tx.id)) continue;
    put('income', {
      id: tx.id,
      date: tx.date,
      amountUsd: Number(tx.amount) || 0,
      channelId: tx.channelOrProject || undefined,
      source: tx.category,
      description: tx.description,
    });
  }

  // 3. Всё остальное (и копии исходных ключей) — в kv целиком, чтобы в облаке было всё
  for (const k of keys) {
    if (PRIVATE_KEYS.has(k)) continue;
    put('kv', { key: `legacy:${k}`, value: parse(raw[k]) });
  }

  if (!cloudHasLegacyImport(store)) store.upsert('kv', { key: CLOUD_IMPORT_MARKER, value: { at: now.toISOString(), counts } });
  storage.setItem(LEGACY_FLAG, now.toISOString());
  void store.flush();
  return { counts, alreadyImported: false, backupFile };
}
