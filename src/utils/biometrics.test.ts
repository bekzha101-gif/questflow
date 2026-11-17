import { describe, it, expect } from 'vitest';
import { Store } from '../store/core';
import { MemoryStorage } from '../store/testing';
import {
  BIO_KV_KEY,
  addBioEntry,
  bioHistory,
  bioLatest,
  loadBiometrics,
  normalizeBiometrics,
  parseBioValues,
  removeBioEntry,
  saveBiometrics,
  type BiometricsState,
} from './biometrics';

const empty: BiometricsState = { entries: [] };

describe('биометрия', () => {
  it('стартует пустой', () => {
    const s = new Store({ storage: new MemoryStorage() });
    expect(loadBiometrics(s)).toEqual({ entries: [] });
    expect(bioLatest(loadBiometrics(s), 'body')).toEqual([]);
  });

  it('ввод: запятая как точка, пустые и мусорные поля не пишутся, чужие поля отбрасываются', () => {
    expect(parseBioValues('body', { weightKg: '81,5', waistCm: '', armsCm: 'abc', testosteroneNmol: '20' })).toEqual({ weightKg: 81.5 });
    expect(addBioEntry(empty, 'body', '2026-11-01', {})).toBe(empty);
  });

  it('последние значения и изменение к прошлой записи с этим полем', () => {
    let st = addBioEntry(empty, 'body', '2026-10-01', { weightKg: 82, waistCm: 86 }, undefined, 1);
    st = addBioEntry(st, 'body', '2026-11-01', { weightKg: 80.4 }, 'утро', 2);
    st = addBioEntry(st, 'labs', '2026-09-20', { testosteroneNmol: 18.2, hematocritPercent: 45 }, undefined, 3);

    const body = bioLatest(st, 'body');
    expect(body.find((b) => b.field.id === 'weightKg')).toMatchObject({ value: 80.4, date: '2026-11-01', prev: { value: 82, date: '2026-10-01' }, delta: -1.6 });
    expect(body.find((b) => b.field.id === 'waistCm')).toMatchObject({ value: 86, date: '2026-10-01' });
    expect(body.find((b) => b.field.id === 'waistCm')?.delta).toBeUndefined();
    expect(bioLatest(st, 'labs').map((l) => l.field.id)).toEqual(['testosteroneNmol', 'hematocritPercent']);
    expect(bioHistory(st, 'body').map((e) => e.date)).toEqual(['2026-11-01', '2026-10-01']);
  });

  it('удаление мягкое: запись остаётся с deleted, но не видна', () => {
    let st = addBioEntry(empty, 'body', '2026-10-01', { weightKg: 82 }, undefined, 1);
    st = addBioEntry(st, 'body', '2026-11-01', { weightKg: 80 }, undefined, 2);
    const id = bioHistory(st, 'body')[0].id;
    st = removeBioEntry(st, id);
    expect(st.entries).toHaveLength(2);
    expect(st.entries.find((e) => e.id === id)?.deleted).toBe(true);
    expect(bioLatest(st, 'body')[0]).toMatchObject({ value: 82 });
    expect(bioLatest(st, 'body')[0].delta).toBeUndefined();
  });

  it('хранится в kv под ключом bigdata:biometrics и переживает перезапуск', () => {
    const mem = new MemoryStorage();
    const s1 = new Store({ storage: mem });
    saveBiometrics(addBioEntry(empty, 'labs', '2026-11-10', { estradiolPg: 25.5, lhMiu: 4.1 }, undefined, 5), s1);
    expect(s1.get<{ key: string }>('kv', BIO_KV_KEY)?.key).toBe(BIO_KV_KEY);

    const s2 = new Store({ storage: mem });
    const st = loadBiometrics(s2);
    expect(st.entries).toHaveLength(1);
    expect(st.entries[0]).toMatchObject({ kind: 'labs', date: '2026-11-10', values: { estradiolPg: 25.5, lhMiu: 4.1 } });
  });

  it('битые записи из хранилища отбрасываются', () => {
    const st = normalizeBiometrics({
      entries: [
        { id: 'a', kind: 'body', date: '2026-11-01', values: { weightKg: 80, junk: 1, waistCm: 'x' }, createdAt: 1 },
        { id: 'b', kind: 'other', date: '2026-11-01', values: {} },
        { id: 'c', kind: 'labs', date: 'вчера', values: {} },
        null,
      ],
    });
    expect(st.entries).toEqual([{ id: 'a', kind: 'body', date: '2026-11-01', values: { weightKg: 80 }, createdAt: 1 }]);
    expect(normalizeBiometrics('мусор')).toEqual({ entries: [] });
  });
});
