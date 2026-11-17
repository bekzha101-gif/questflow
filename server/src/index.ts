// Точка входа сервера: бот + расписания. Запуск: npm start (после npm run build).
import path from 'node:path';
import { envFilePath, loadEnvFile, readConfig, redact, serverRoot } from './config';
import { createDb, createSupabaseClient } from './db';
import { createBotService } from './bot';
import { startScheduler, type ConversationApi } from './scheduler';
import { createConversationStub } from './conversationStub';
import { createPublicationSource, loadRemindersFor } from './publications';
import { runBackup } from './backup';

async function main() {
  loadEnvFile(envFilePath());
  const config = readConfig();
  const log = (m: string) => console.log(`[${new Date().toISOString()}] ${redact(m, config)}`);

  const db = createDb(createSupabaseClient(config.supabaseUrl, config.supabaseServiceRoleKey), config.ownerUserId);

  // Разговор подключается лениво: бот и разговор ссылаются друг на друга через send
  let conversation: ConversationApi | null = null;
  const service = createBotService({
    token: config.telegramBotToken,
    db,
    conversation: { handleUpdate: (m) => conversation!.handleUpdate(m) },
    log,
  });
  const send = (text: string) => service.send(text);
  conversation = createConversationStub(send);

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
    await service.stop().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  log('QuestFlow сервер запущен: бот и расписания (Asia/Bishkek)');
  await service.start(); // long polling; выход отсюда = бот остановлен
  throw new Error('Бот остановился');
}

main().catch((e) => {
  // Код выхода ≠ 0 — run.ps1 перезапустит процесс
  console.error(`[${new Date().toISOString()}] Сервер упал: ${(e as Error).message}`);
  process.exit(1);
});
