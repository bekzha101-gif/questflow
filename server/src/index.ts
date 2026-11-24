// Точка входа домашнего сервера: AI-советник для сайта и ночной бэкап. Запуск: npm start (после npm run build).
// Telegram-бот, вечерний разговор и голос убраны 2026-11-24 по просьбе владельца: управление — через Claude напрямую.
import fs from 'node:fs';
import path from 'node:path';
import { todayStr } from '../../shared/time';
import { envFilePath, loadEnvFile, readConfig, redact, serverRoot, type ServerConfig } from './config';
import { createDb, createSupabaseClient } from './db';
import { createAi } from './ai';
import { ADVISOR_POLL_MS, createAdvisor } from './advisor';
import { createSupabaseStore } from './conversation/store';
import { runBackup } from './backup';

// Конфиг виден обработчику падения: текст ошибки проходит через redact, если конфиг уже прочитан
let loadedConfig: ServerConfig | null = null;

/** Строка лога о падении сервера: секреты из конфига скрыты */
export function crashLine(e: unknown, config: ServerConfig | null, at: Date = new Date()): string {
  const message = e instanceof Error ? e.message : String(e);
  return `[${at.toISOString()}] Сервер упал: ${config ? redact(message, config) : message}`;
}

/** Бэкап раз в сутки: файла за сегодня (по Бишкеку) ещё нет — пишем */
export function backupDue(dir: string, now: Date): boolean {
  return !fs.existsSync(path.join(dir, `questflow-${todayStr(now)}.json`));
}

const BACKUP_CHECK_MS = 30 * 60_000;

async function main() {
  loadEnvFile(envFilePath());
  const config = readConfig();
  loadedConfig = config;
  const log = (m: string) => console.log(`[${new Date().toISOString()}] ${redact(m, config)}`);

  const client = createSupabaseClient(config.supabaseUrl, config.supabaseServiceRoleKey);
  const db = createDb(client, config.ownerUserId);
  const store = createSupabaseStore(client, config.ownerUserId);
  const ai = createAi({ apiKey: config.anthropicApiKey, model: process.env.ANTHROPIC_MODEL?.trim() || undefined, log });

  // AI-советник: запрос с сайта (kv ai_advisor) → Claude по данным месяца → ответ на сайт
  const advisor = createAdvisor({ store, ai, log });
  const advisorTick = () => void advisor.tick().catch((e) => log(`AI-советник: ${(e as Error).message}`));
  setInterval(advisorTick, ADVISOR_POLL_MS);
  advisorTick();

  const backupDir = path.join(serverRoot(), 'backups');
  const backupTick = async () => {
    const now = new Date();
    if (!backupDue(backupDir, now)) return;
    try {
      const file = await runBackup({ dir: backupDir, now, dumpAll: () => db.dumpAll() });
      log(`Бэкап записан: ${path.basename(file)}`);
    } catch (e) {
      log(`Бэкап не удался: ${(e as Error).message}`);
    }
  };
  setInterval(() => void backupTick(), BACKUP_CHECK_MS);
  void backupTick();

  const shutdown = () => process.exit(0);
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  log('QuestFlow сервер запущен: AI-советник и бэкап');
  await new Promise(() => {}); // работает, пока процесс не остановят
}

// Запуск только как программа (node dist/.../index.js), не при импорте в тестах
if (typeof module !== 'undefined' && typeof require !== 'undefined' && require.main === module) {
  main().catch((e) => {
    // Код выхода ≠ 0 — run.ps1 перезапустит процесс
    console.error(crashLine(e, loadedConfig));
    process.exit(1);
  });
}
