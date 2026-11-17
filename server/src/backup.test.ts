import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runBackup } from './backup';

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qf-backup-'));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('ночной бэкап', () => {
  it('пишет файл с датой по Бишкеку и всеми таблицами', async () => {
    // 2026-11-16 21:00 UTC = 2026-11-17 03:00 в Бишкеке
    const now = new Date('2026-11-16T21:00:00.000Z');
    const file = await runBackup({
      dir,
      now,
      dumpAll: async () => ({ tasks2: [{ id: 't1', title: 'Задача' }], kv: [] }),
    });
    expect(path.basename(file)).toBe('questflow-2026-11-17.json');
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(data.tables.tasks2).toEqual([{ id: 't1', title: 'Задача' }]);
    expect(data.tables.kv).toEqual([]);
    expect(data.createdAt).toBe('2026-11-16T21:00:00.000Z');
  });

  it('удаляет бэкапы старше 60 дней, свежие и чужие файлы не трогает', async () => {
    for (const d of ['2026-09-17', '2026-09-18', '2026-09-19', '2026-11-01']) {
      fs.writeFileSync(path.join(dir, `questflow-${d}.json`), '{}');
    }
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'не трогать');
    await runBackup({ dir, now: new Date('2026-11-17T00:00:00.000Z'), dumpAll: async () => ({}) });
    // 2026-11-17 − 60 дней = 2026-09-18: всё, что раньше, удаляется
    expect(fs.readdirSync(dir).sort()).toEqual([
      'notes.txt',
      'questflow-2026-09-18.json',
      'questflow-2026-09-19.json',
      'questflow-2026-11-01.json',
      'questflow-2026-11-17.json',
    ]);
  });

  it('если выгрузка упала — старые бэкапы не удаляются', async () => {
    fs.writeFileSync(path.join(dir, 'questflow-2026-01-01.json'), '{}');
    await expect(
      runBackup({ dir, now: new Date('2026-11-17T00:00:00.000Z'), dumpAll: async () => Promise.reject(new Error('сеть')) }),
    ).rejects.toThrow('сеть');
    expect(fs.readdirSync(dir)).toEqual(['questflow-2026-01-01.json']);
  });
});
