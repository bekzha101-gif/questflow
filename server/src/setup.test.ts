import { describe, expect, it } from 'vitest';
import { runSetup, type SetupDeps, type TelegramUpdate } from './setup';

// Заведомо ненастоящие значения — только для теста
const TOKEN = '123456789:TEST_fake_token_for_unit_tests_only_xx';
const URL = 'https://example-test.supabase.co';
const SERVICE = 'test-service-role-key-not-real-0123456789';
const OWNER = '11111111-2222-4333-8444-555555555555';

function makeDeps(answers: string[], opts: { existingEnv?: string; updates?: TelegramUpdate[][] } = {}) {
  const out: string[] = [];
  const asked: { q: string; secret: boolean }[] = [];
  const sent: { chatId: number | string; text: string }[] = [];
  const bound: string[] = [];
  let written: string | null = null;
  const updates = [...(opts.updates ?? [[{ update_id: 10, message: { chat: { id: 555, type: 'private' }, from: { first_name: 'Бакыт', username: 'bakyt' }, text: '/start' } }]])];
  const deps: SetupDeps = {
    io: {
      print: (t) => void out.push(t),
      ask: async (q, o) => {
        asked.push({ q, secret: !!o?.secret });
        if (!answers.length) throw new Error(`Нет ответа на вопрос: ${q}`);
        return answers.shift()!;
      },
    },
    telegram: {
      getMe: async (token) => {
        if (token !== TOKEN) throw new Error('401 Unauthorized');
        return { username: 'questflow_test_bot' };
      },
      getUpdates: async () => updates.shift() ?? [],
      sendMessage: async (_t, chatId, text) => void sent.push({ chatId, text }),
    },
    supabase: {
      checkServiceKey: async (url, key) => {
        if (url !== URL || key !== SERVICE) throw new Error('Invalid API key');
      },
      checkOwner: async (_u, _k, id) => {
        if (id !== OWNER) throw new Error('User not found');
        return 'owner@example.test';
      },
      bindChat: async (_u, _k, _id, chatId) => void bound.push(chatId),
    },
    readEnv: () => opts.existingEnv ?? null,
    writeEnv: (c) => {
      written = c;
    },
  };
  return { deps, out, asked, sent, bound, written: () => written };
}

describe('npm run setup', () => {
  it('проходит все шаги до «бот работает» и первого сообщения в Telegram', async () => {
    const t = makeDeps([TOKEN, URL, SERVICE, OWNER, '', 'да']);
    const res = await runSetup(t.deps);
    expect(res.ok).toBe(true);
    const env = t.written()!;
    expect(env).toContain(`TELEGRAM_BOT_TOKEN=${TOKEN}`);
    expect(env).toContain(`SUPABASE_URL=${URL}`);
    expect(env).toContain(`SUPABASE_SERVICE_ROLE_KEY=${SERVICE}`);
    expect(env).toContain(`OWNER_USER_ID=${OWNER}`);
    expect(env).toMatch(/^ANTHROPIC_API_KEY=$/m);
    expect(t.bound).toEqual(['555']);
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0].chatId).toBe(555);
    const printed = t.out.join('\n');
    expect(printed).toContain('@BotFather');
    expect(printed).toContain('Бот работает');
  });

  it('ни один секрет не печатается в терминал; токен и ключи спрашиваются скрытым вводом', async () => {
    const t = makeDeps([TOKEN, URL, SERVICE, OWNER, '', 'да']);
    await runSetup(t.deps);
    const printed = t.out.join('\n') + t.asked.map((a) => a.q).join('\n');
    expect(printed).not.toContain(TOKEN);
    expect(printed).not.toContain(SERVICE);
    expect(t.asked.filter((a) => a.secret)).toHaveLength(3); // токен, service-role, Claude API
  });

  it('неверный токен — объясняет и спрашивает ещё раз', async () => {
    const t = makeDeps(['123:wrong_but_wellformed_token_value_abcdefgh', TOKEN, URL, SERVICE, OWNER, '', 'да']);
    const res = await runSetup(t.deps);
    expect(res.ok).toBe(true);
    expect(t.out.join('\n')).toMatch(/Telegram не принял токен/);
  });

  it('при повторной настройке Enter оставляет прежние значения', async () => {
    const existing = [
      `TELEGRAM_BOT_TOKEN=${TOKEN}`, `SUPABASE_URL=${URL}`, `SUPABASE_SERVICE_ROLE_KEY=${SERVICE}`,
      `OWNER_USER_ID=${OWNER}`, 'ANTHROPIC_API_KEY=',
    ].join('\n');
    const t = makeDeps(['', '', '', '', '', 'да'], { existingEnv: existing });
    const res = await runSetup(t.deps);
    expect(res.ok).toBe(true);
    expect(t.written()).toContain(`SUPABASE_SERVICE_ROLE_KEY=${SERVICE}`);
  });

  it('если /start нажал не владелец — не привязывает его и ждёт дальше', async () => {
    const t = makeDeps([TOKEN, URL, SERVICE, OWNER, '', 'нет', 'да'], {
      updates: [
        [{ update_id: 1, message: { chat: { id: 777, type: 'private' }, from: { first_name: 'Чужой' }, text: '/start' } }],
        [{ update_id: 2, message: { chat: { id: 555, type: 'private' }, from: { first_name: 'Бакыт' }, text: '/start' } }],
      ],
    });
    const res = await runSetup(t.deps);
    expect(res.ok).toBe(true);
    expect(t.bound).toEqual(['555']);
    expect(t.sent.map((s) => s.chatId)).toEqual([555]);
  });
});
