// Биометрия Big Data: история замеров тела и анализов гормонов.
// Хранится одной записью в таблице kv под ключом `bigdata:biometrics` — { key, value: { entries: BioEntry[] } }.
// Каждая запись — дата + значения полей; удаление мягкое (deleted: true), историю не стираем.
// Стартует пустой: никаких демо-значений.
import { useCallback, useMemo } from 'react';
import { todayStr } from '@shared/time';
import { store as defaultStore, useRecord, type Store } from '../store';

export const BIO_KV_KEY = 'bigdata:biometrics';

export type BioKind = 'body' | 'labs';

export interface BioField {
  id: string;
  label: string;
  unit: string;
  step: string;
}

/** Замеры тела */
export const BODY_FIELDS: BioField[] = [
  { id: 'weightKg', label: 'Вес', unit: 'кг', step: '0.1' },
  { id: 'waistCm', label: 'Талия', unit: 'см', step: '0.1' },
  { id: 'armsCm', label: 'Руки (бицепс)', unit: 'см', step: '0.1' },
  { id: 'calvesCm', label: 'Икры', unit: 'см', step: '0.1' },
  { id: 'thighsCm', label: 'Бёдра', unit: 'см', step: '0.1' },
  { id: 'bodyFatPercent', label: '% жира', unit: '%', step: '0.1' },
];

/** Анализы гормонов (эстрадиол: пг/мл = нг/л) */
export const LAB_FIELDS: BioField[] = [
  { id: 'testosteroneNmol', label: 'Тестостерон', unit: 'нмоль/л', step: '0.01' },
  { id: 'estradiolPg', label: 'Эстрадиол', unit: 'пг/мл', step: '0.1' },
  { id: 'shbgNmol', label: 'ГСПГ (SHBG)', unit: 'нмоль/л', step: '0.1' },
  { id: 'lhMiu', label: 'ЛГ (LH)', unit: 'мМЕ/мл', step: '0.01' },
  { id: 'hematocritPercent', label: 'Гематокрит', unit: '%', step: '0.1' },
];

export const BIO_FIELDS: Record<BioKind, BioField[]> = { body: BODY_FIELDS, labs: LAB_FIELDS };

export interface BioEntry {
  id: string;
  kind: BioKind;
  /** Дата замера / анализа, YYYY-MM-DD */
  date: string;
  values: Record<string, number>;
  note?: string;
  createdAt: number;
  deleted?: boolean;
}

export interface BiometricsState {
  entries: BioEntry[];
}

interface KvRow {
  key: string;
  value?: unknown;
}

/** Привести сохранённое к рабочему виду (мусор отбрасывается, значения не выдумываются) */
export function normalizeBiometrics(raw: unknown): BiometricsState {
  const list = raw && typeof raw === 'object' && Array.isArray((raw as BiometricsState).entries) ? (raw as BiometricsState).entries : [];
  const entries: BioEntry[] = [];
  for (const e of list) {
    if (!e || typeof e.id !== 'string' || (e.kind !== 'body' && e.kind !== 'labs') || !/^\d{4}-\d{2}-\d{2}$/.test(String(e.date))) continue;
    const allowed = new Set(BIO_FIELDS[e.kind].map((f) => f.id));
    const values: Record<string, number> = {};
    for (const [k, v] of Object.entries(e.values ?? {})) if (allowed.has(k) && typeof v === 'number' && Number.isFinite(v)) values[k] = v;
    entries.push({ ...e, values, createdAt: Number(e.createdAt) || 0 });
  }
  return { entries };
}

/** Текст из поля ввода → число (пусто или мусор — поля нет) */
export function parseBioValues(kind: BioKind, input: Record<string, string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of BIO_FIELDS[kind]) {
    const t = (input[f.id] ?? '').trim().replace(',', '.');
    if (!t) continue;
    const n = Number(t);
    if (Number.isFinite(n) && n >= 0) out[f.id] = n;
  }
  return out;
}

const newId = () => `bio-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Добавить запись (без значений — ничего не меняется) */
export function addBioEntry(
  state: BiometricsState,
  kind: BioKind,
  date: string,
  values: Record<string, number>,
  note?: string,
  now: number = Date.now(),
): BiometricsState {
  if (!Object.keys(values).length || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return state;
  const entry: BioEntry = { id: newId(), kind, date, values, createdAt: now, ...(note?.trim() ? { note: note.trim() } : {}) };
  return { entries: [...state.entries, entry] };
}

/** Мягкое удаление записи */
export function removeBioEntry(state: BiometricsState, id: string): BiometricsState {
  return { entries: state.entries.map((e) => (e.id === id ? { ...e, deleted: true } : e)) };
}

/** Живые записи вида, новые сверху */
export function bioHistory(state: BiometricsState, kind: BioKind): BioEntry[] {
  return state.entries
    .filter((e) => e.kind === kind && !e.deleted)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

export interface BioLatest {
  field: BioField;
  value: number;
  date: string;
  prev?: { value: number; date: string };
  delta?: number;
}

/** Последнее значение каждого поля и изменение к прошлой записи с этим полем */
export function bioLatest(state: BiometricsState, kind: BioKind): BioLatest[] {
  const hist = bioHistory(state, kind);
  const out: BioLatest[] = [];
  for (const field of BIO_FIELDS[kind]) {
    const withField = hist.filter((e) => typeof e.values[field.id] === 'number');
    if (!withField.length) continue;
    const [last, before] = withField;
    const value = last.values[field.id];
    const item: BioLatest = { field, value, date: last.date };
    if (before) {
      const pv = before.values[field.id];
      item.prev = { value: pv, date: before.date };
      item.delta = Math.round((value - pv) * 100) / 100;
    }
    out.push(item);
  }
  return out;
}

// ─── Хранилище ───────────────────────────────────────────────────────────────

export function loadBiometrics(s: Store = defaultStore): BiometricsState {
  return normalizeBiometrics(s.get<KvRow>('kv', BIO_KV_KEY)?.value);
}

export function saveBiometrics(next: BiometricsState, s: Store = defaultStore) {
  s.upsert('kv', { key: BIO_KV_KEY, value: next });
}

export function useBiometrics() {
  const { value, save } = useRecord<KvRow>('kv', BIO_KV_KEY);
  const state = useMemo(() => normalizeBiometrics(value?.value), [value]);
  const add = useCallback(
    (kind: BioKind, date: string, values: Record<string, number>, note?: string) =>
      save({ key: BIO_KV_KEY, value: addBioEntry(state, kind, date || todayStr(), values, note) }),
    [state, save],
  );
  const remove = useCallback((id: string) => save({ key: BIO_KV_KEY, value: removeBioEntry(state, id) }), [state, save]);
  return { state, add, remove };
}
