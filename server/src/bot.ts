// Telegram-бот (grammY, long polling — открытый порт не нужен).
// Отвечает только владельцу: первый /start привязывает chat id в bot_settings,
// всем остальным — «Этот бот приватный.» и ничего больше.
import { Bot, type Context, type InlineKeyboard, type Keyboard } from 'grammy';
import type { UserFromGetMe } from 'grammy/types';
import type { Db } from './db';
import { TEXT } from './messages';
import type { ConversationApi, IncomingMessage } from './scheduler';

export type BotKeyboard = InlineKeyboard | Keyboard;

export interface BotDeps {
  token: string;
  db: Db;
  conversation: Pick<ConversationApi, 'handleUpdate'>;
  /** Для тестов: без запроса getMe */
  botInfo?: UserFromGetMe;
  log?(message: string): void;
}

export interface BotService {
  bot: Bot;
  /** Сообщение владельцу. false — чат ещё не привязан или Telegram отказал. */
  send(text: string, keyboard?: BotKeyboard): Promise<boolean>;
  /** Long polling; промис живёт, пока бот работает */
  start(): Promise<void>;
  stop(): Promise<void>;
}

function isStart(text: string | undefined): boolean {
  return !!text && /^\/start(@\w+)?(\s|$)/.test(text);
}

function toIncoming(ctx: Context, chatId: string): IncomingMessage {
  const msg: IncomingMessage = { chatId };
  const m = ctx.message;
  if (m?.text) msg.text = m.text;
  if (m?.caption) msg.text = m.caption;
  if (m?.voice) msg.voiceFileId = m.voice.file_id;
  if (m?.audio) msg.voiceFileId = m.audio.file_id;
  if (m?.photo?.length) msg.photoFileId = m.photo[m.photo.length - 1].file_id;
  if (ctx.callbackQuery?.data) msg.callbackData = ctx.callbackQuery.data;
  return msg;
}

export function createBotService(deps: BotDeps): BotService {
  const log = deps.log ?? (() => {});
  const bot = new Bot(deps.token, deps.botInfo ? { botInfo: deps.botInfo } : undefined);

  bot.on(['message', 'callback_query:data'], async (ctx) => {
    const chat = ctx.chat;
    if (!chat) return;
    const chatId = String(chat.id);
    const settings = await deps.db.getBotSettings();
    const owner = settings?.chatId ? String(settings.chatId) : null;
    const text = ctx.message?.text;

    // Привязка чата — только через npm run setup (владелец подтверждает «Это ты?»).
    // Пока чат не привязан, бот никого не привязывает сам: иначе хозяином стал бы первый, кто нажал /start.
    if (!owner || owner !== chatId) {
      if (!owner) log('Сообщение от непривязанного чата: привяжи бота через npm run setup');
      if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: TEXT.privateBot });
      else await ctx.reply(TEXT.privateBot);
      return;
    }

    if (isStart(text)) {
      await ctx.reply(TEXT.alive);
      return;
    }
    if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {});
    await deps.conversation.handleUpdate(toIncoming(ctx, chatId));
  });

  bot.catch((err) => log(`Ошибка обработки сообщения: ${err.message}`));

  return {
    bot,
    async send(text, keyboard) {
      const settings = await deps.db.getBotSettings();
      if (!settings?.chatId) {
        log('Сообщение не отправлено: чат владельца не привязан (/start)');
        return false;
      }
      try {
        await bot.api.sendMessage(settings.chatId, text, keyboard ? { reply_markup: keyboard } : undefined);
        return true;
      } catch (e) {
        log(`Telegram не принял сообщение: ${(e as Error).message}`);
        return false;
      }
    },
    start: () => bot.start({ drop_pending_updates: false, allowed_updates: ['message', 'callback_query'] }),
    stop: () => bot.stop(),
  };
}
