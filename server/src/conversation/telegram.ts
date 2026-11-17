// Связка разговора с Telegram: кнопки → InlineKeyboard grammY, скачивание голосовых и фото.
// Ссылка на файл содержит токен бота — она нигде не печатается, в ошибках только код ответа.
import fs from 'node:fs';
import path from 'node:path';
import { InlineKeyboard, type Api } from 'grammy';
import type { Keyboard, TelegramFiles } from './types';

export function toInlineKeyboard(kb: Keyboard): InlineKeyboard {
  return new InlineKeyboard(kb.map((row) => row.map((b) => InlineKeyboard.text(b.text, b.data))));
}

/** Предел на скачивание файла из Telegram, мс */
export const TELEGRAM_FILE_TIMEOUT_MS = 60_000;

export function createTelegramFiles(
  api: Pick<Api, 'getFile'>,
  token: string,
  dir: string,
  doFetch: typeof fetch = fetch,
  timeoutMs = TELEGRAM_FILE_TIMEOUT_MS,
): TelegramFiles {
  return {
    async download(fileId, kind) {
      const file = await api.getFile(fileId);
      if (!file.file_path) return null;
      // Таймаут: зависшая загрузка держала бы замок разговора
      const res = await doFetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`Telegram не отдал файл: HTTP ${res.status}`);
      fs.mkdirSync(dir, { recursive: true });
      const ext = path.extname(file.file_path) || (kind === 'voice' ? '.ogg' : '.jpg');
      const out = path.join(dir, `${kind}-${Date.now()}${ext}`);
      fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
      return out;
    },
    async release(filePath) {
      await fs.promises.unlink(filePath).catch(() => {});
    },
  };
}
