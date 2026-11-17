// Точка входа сервера: бот + расписания. Запуск: npm start (после npm run build).
import os from 'node:os';
import path from 'node:path';
import { envFilePath, loadEnvFile, readConfig, redact, serverRoot, type ServerConfig } from './config';
import { createDb, createSupabaseClient } from './db';
import { createBotService } from './bot';
import { startScheduler, type ConversationApi } from './scheduler';
import { createAi } from './ai';
import { createStt } from './stt';
import { createConversation, createSupabaseStore } from './conversation';
import { createTelegramFiles, toInlineKeyboard } from './conversation/telegram';
import { createPublicationSource, loadRemindersFor } from './publications';
import { runBackup } from './backup';

// Конфиг виден обработчику падения: текст ошибки проходит через redact, если конфиг уже прочитан
let loadedConfig: ServerConfig | null = null;

/** Строка лога о падении сервера: секреты из конфига скрыты */
export function crashLine(e: unknown, config: ServerConfig | null, at: Date = new Date()): string {
  const message = e instanceof Error ? e.message : String(e);
  return `[${at.toISOString()}] Сервер упал: ${config ? redact(message, config) : message}`;
}

async function main() {
  loadEnvFile(envFilePath());
  const config = readConfig();
  loadedConfig = config;
  const log = (m: string) => console.log(`[${new Date().toISOString()}] ${redact(m, config)}`);

  const client = createSupabaseClient(config.supabaseUrl, config.supabaseServiceRoleKey);
  const db = createDb(client, config.ownerUserId);

  // Разговор подключается лениво: бот и разговор ссылаются друг на друга через send
  let conversation: ConversationApi | null = null;
  const service = createBotService({
    token: config.telegramBotToken,
    db,
    conversation: { handleUpdate: (m) => conversation!.handleUpdate(m) },
    log,
  });
  const send = (text: string) => service.send(text);
  // Вечерний разговор, голос и AI-аналитик (таск 09)
  const evening = createConversation({
    store: createSupabaseStore(client, config.ownerUserId),
    send: (text, keyboard) => service.send(text, keyboard ? toInlineKeyboard(keyboard) : undefined),
    ai: createAi({ apiKey: config.anthropicApiKey, model: process.env.ANTHROPIC_MODEL?.trim() || undefined, log }),
    stt: createStt({
      python: process.env.WHISPER_PYTHON?.trim() || undefined,
      model: process.env.WHISPER_MODEL?.trim() || undefined,
      device: process.env.WHISPER_DEVICE?.trim() || undefined,
      hints: (process.env.WHISPER_HINTS ?? '').split(','),
      log,
    }),
    files: createTelegramFiles(service.bot.api, config.telegramBotToken, path.join(os.tmpdir(), 'questflow-bot')),
    log,
  });
  conversation = evening;
  // Повтор анализов, которые не удались (Claude был недоступен или упёрся в лимит)
  const retryTimer = setInterval(() => void evening.tick().catch((e) => log(`Повтор анализа: ${(e as Error).message}`)), 5 * 60_000);

  const stopScheduler = startScheduler({
    db,
    send,
    conversation,
    remindersFor: createPublicationSource(db, loadRemindersFor(), log),
    backup: async (now) => {
      const file = await runBackup({ dir: path.join(serverRoot(), 'backups'), now, dumpAll: () => db.dumpAll() });
      log(`Бэкап записан: ${path.basename(file)}`);
    },
    log,
  });

  const shutdown = async () => {
    stopScheduler();
    clearInterval(retryTimer);
    await service.stop().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  log('QuestFlow сервер запущен: бот и расписания (Asia/Bishkek)');
  await service.start(); // long polling; выход отсюда = бот остановлен
  throw new Error('Бот остановился');
}

// Запуск только как программа (node dist/.../index.js), не при импорте в тестах
if (typeof module !== 'undefined' && typeof require !== 'undefined' && require.main === module) {
  main().catch((e) => {
    // Код выхода ≠ 0 — run.ps1 перезапустит процесс
    console.error(crashLine(e, loadedConfig));
    process.exit(1);
  });
}
