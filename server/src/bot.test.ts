import { describe, expect, it } from 'vitest';
import type { Update } from 'grammy/types';
import { createBotService } from './bot';
import type { Db } from './db';
import type { BotSettings } from '../../shared/types';
import type { IncomingMessage } from './scheduler';

// Telegram подменён: все вызовы API перехватываются, в сеть ничего не уходит
function setup(initial: Partial<BotSettings> = {}) {
  let settings: BotSettings = { morningHm: '08:00', eveningHm: '21:00', reminderLimit: 3, ...initial };
  const api: { method: string; payload: Record<string, unknown> }[] = [];
  const handled: IncomingMessage[] = [];
  const db = {
    getBotSettings: async () => settings,
    saveBotSettings: async (p: Partial<BotSettings>) => {
      settings = { ...settings, ...p };
    },
  } as unknown as Db;
  const service = createBotService({
    token: 'test-token',
    db,
    conversation: { handleUpdate: async (m) => void handled.push(m) },
    botInfo: {
      id: 1, is_bot: true, first_name: 'QuestFlow', username: 'questflow_test_bot',
      can_join_groups: false, can_read_all_group_messages: false, supports_inline_queries: false,
      can_connect_to_business: false, has_main_web_app: false, has_topics_enabled: false,
      allows_users_to_create_topics: false,
    } as never,
  });
  service.bot.api.config.use(async (_prev, method, payload) => {
    api.push({ method, payload: payload as Record<string, unknown> });
    return { ok: true, result: { message_id: 1, date: 0, chat: { id: 0, type: 'private' } } } as never;
  });
  return { service, api, handled, getSettings: () => settings };
}

let updateId = 1;
function textUpdate(chatId: number, text: string): Update {
  return {
    update_id: updateId++,
    message: {
      message_id: updateId,
      date: 0,
      chat: { id: chatId, type: 'private', first_name: 'X' },
      from: { id: chatId, is_bot: false, first_name: 'X' },
      text,
      ...(text.startsWith('/') ? { entities: [{ type: 'bot_command', offset: 0, length: text.split(' ')[0].length }] } : {}),
    },
  } as Update;
}

describe('бот отвечает только владельцу', () => {
  it('без привязки /start не привязывает чат: привязка только через npm run setup', async () => {
    const { service, api, handled, getSettings } = setup();
    await service.bot.handleUpdate(textUpdate(555, '/start'));
    await service.bot.handleUpdate(textUpdate(555, 'привет'));
    expect(getSettings().chatId).toBeUndefined();
    expect(api.map((c) => [c.method, c.payload.chat_id, c.payload.text])).toEqual([
      ['sendMessage', 555, 'Этот бот приватный.'],
      ['sendMessage', 555, 'Этот бот приватный.'],
    ]);
    expect(handled).toEqual([]);
  });

  it('чужой chat id получает «бот приватный» и ничего больше', async () => {
    const { service, api, handled, getSettings } = setup({ chatId: '555' });
    await service.bot.handleUpdate(textUpdate(777, '/start'));
    await service.bot.handleUpdate(textUpdate(777, 'покажи мои задачи'));
    expect(api.map((c) => [c.method, c.payload.chat_id, c.payload.text])).toEqual([
      ['sendMessage', 777, 'Этот бот приватный.'],
      ['sendMessage', 777, 'Этот бот приватный.'],
    ]);
    expect(handled).toEqual([]);
    expect(getSettings().chatId).toBe('555');
  });

  it('сообщение владельца уходит в разговор', async () => {
    const { service, handled, api } = setup({ chatId: '555' });
    await service.bot.handleUpdate(textUpdate(555, 'воду выпил, медитировал'));
    expect(handled).toEqual([{ chatId: '555', text: 'воду выпил, медитировал' }]);
    expect(api).toEqual([]);
  });

  it('send() пишет только в привязанный чат; без привязки — не пишет', async () => {
    const a = setup({ chatId: '555' });
    expect(await a.service.send('Пора на отдых.')).toBe(true);
    expect(a.api.map((c) => [c.payload.chat_id, c.payload.text])).toEqual([['555', 'Пора на отдых.']]);
    const b = setup();
    expect(await b.service.send('Пора на отдых.')).toBe(false);
    expect(b.api).toEqual([]);
  });
});
