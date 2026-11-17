// Ночной бэкап всех таблиц владельца в server/backups/questflow-YYYY-MM-DD.json.
// Хранится 60 дней; удаляются только файлы с этим шаблоном имени.
import fs from 'node:fs';
import path from 'node:path';
import { addDays, todayStr } from '../../shared/time';

export const BACKUP_KEEP_DAYS = 60;
const NAME = /^questflow-(\d{4}-\d{2}-\d{2})\.json$/;

export interface BackupOptions {
  dir: string;
  now: Date;
  dumpAll(): Promise<Record<string, unknown[]>>;
  keepDays?: number;
}

/** Пишет бэкап и чистит старые. Возвращает путь к файлу. */
export async function runBackup(opts: BackupOptions): Promise<string> {
  const tables = await opts.dumpAll(); // упало — ничего не пишем и не удаляем
  const date = todayStr(opts.now);
  fs.mkdirSync(opts.dir, { recursive: true });
  const file = path.join(opts.dir, `questflow-${date}.json`);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ createdAt: opts.now.toISOString(), date, tables }, null, 1), 'utf8');
  fs.renameSync(tmp, file);

  const oldest = addDays(date, -(opts.keepDays ?? BACKUP_KEEP_DAYS));
  for (const name of fs.readdirSync(opts.dir)) {
    const m = NAME.exec(name);
    if (m && m[1] < oldest) fs.rmSync(path.join(opts.dir, name), { force: true });
  }
  return file;
}
