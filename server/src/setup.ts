// Установщик: `npm run setup` в папке server/.
// Пошагово объясняет, как создать бота в @BotFather, спрашивает токен и ключи, проверяет
// каждый, пишет server/.env (он в .gitignore) и ждёт /start, чтобы привязать чат владельца
// и отправить первое сообщение. Значения секретов никогда не печатаются.
import fs from 'node:fs';
import readline from 'node:readline';
import { Writable } from 'node:stream';
import dotenv from 'dotenv';
import { ENV_NAMES, envFilePath } from './config';
import { createSupabaseClient } from './db';
import { TEXT } from './messages';

export interface TelegramUpdate {
  update_id: number;
  message?: {
    chat: { id: number; type: string };
    from?: { first_name?: string; last_name?: string; username?: string };
    text?: string;
  };
}

export interface SetupIO {
  print(text: string): void;
  /** secret — ввод не отображается на экране */
  ask(question: string, opts?: { secret?: boolean }): Promise<string>;
}

export interface SetupDeps {
  io: SetupIO;
  telegram: {
    getMe(token: string): Promise<{ username: string }>;
    getUpdates(token: string, offset: number, timeoutSec: number): Promise<TelegramUpdate[]>;
    sendMessage(token: string, chatId: number | string, text: string): Promise<void>;
  };
  supabase: {
    /** Бросает ошибку, если ключ не service-role или таблиц 002 нет */
    checkServiceKey(url: string, key: string): Promise<void>;
    /** Возвращает email владельца */
    checkOwner(url: string, key: string, userId: string): Promise<string>;
    bindChat(url: string, key: string, userId: string, chatId: string): Promise<void>;
  };
  readEnv(): string | null;
  writeEnv(content: string): void;
  /** Сколько раз по 30 с ждать /start */
  maxStartPolls?: number;
}

const ATTEMPTS = 5;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function short(e: unknown): string {
  return (e as Error)?.message?.split('\n')[0]?.slice(0, 200) ?? 'неизвестная ошибка';
}

export async function runSetup(deps: SetupDeps): Promise<{ ok: boolean }> {
  const { io } = deps;
  const old = deps.readEnv() ? dotenv.parse(deps.readEnv()!) : {};
  const values: Record<string, string> = {};

  /** Спрашивает значение; Enter — оставить прежнее. validate бросает ошибку с понятным текстом. */
  async function askValue(
    name: string,
    question: string,
    opts: { secret?: boolean; optional?: boolean },
    validate: (v: string) => Promise<string | void>,
  ): Promise<boolean> {
    const prev = old[name]?.trim() ?? '';
    for (let i = 0; i < ATTEMPTS; i++) {
      const hint = prev ? ' (Enter — оставить прежнее)' : opts.optional ? ' (Enter — пропустить)' : '';
      const raw = (await io.ask(`${question}${hint}: `, { secret: opts.secret })).trim();
      const v = raw || prev;
      if (!v) {
        if (opts.optional) {
          values[name] = '';
          return true;
        }
        io.print('Значение обязательно.');
        continue;
      }
      try {
        const note = await validate(v);
        values[name] = v;
        io.print(note ? `Проверено: ${note}` : 'Проверено.');
        return true;
      } catch (e) {
        io.print(short(e));
      }
    }
    io.print(`Не получилось после ${ATTEMPTS} попыток. Запусти npm run setup ещё раз.`);
    return false;
  }

  io.print(
    [
      'Настройка QuestFlow-бота. Шагов пять, ключи сохранятся только на этом компьютере в server/.env.',
      '',
      'Шаг 1. Создай бота в Telegram:',
      '  1) Открой в Telegram @BotFather и нажми Start.',
      '  2) Отправь команду /newbot.',
      '  3) Введи имя бота (любое, например QuestFlow).',
      '  4) Введи адрес бота — латиницей, в конце обязательно bot (например bakyt_questflow_bot).',
      '  5) BotFather пришлёт токен вида 123456789:AA... — скопируй его.',
      'Ввод токена и ключей на экране не виден — это нормально, просто вставь и нажми Enter.',
    ].join('\n'),
  );

  let botUsername = '';
  if (
    !(await askValue(ENV_NAMES.telegramBotToken, 'Токен бота', { secret: true }, async (v) => {
      if (!/^\d+:[\w-]{20,}$/.test(v)) throw new Error('Это не похоже на токен: он вида 123456789:AA... Скопируй его из сообщения BotFather целиком.');
      try {
        botUsername = (await deps.telegram.getMe(v)).username;
      } catch (e) {
        throw new Error(`Telegram не принял токен (${short(e)}). Проверь, что скопировал его целиком.`);
      }
      return `бот @${botUsername}`;
    }))
  ) return { ok: false };

  io.print(
    [
      '',
      'Шаг 2. Адрес проекта Supabase:',
      '  supabase.com/dashboard → твой проект → Project Settings → API → Project URL',
      '  (вида https://abcd1234.supabase.co).',
    ].join('\n'),
  );
  if (
    !(await askValue(ENV_NAMES.supabaseUrl, 'Project URL', {}, async (v) => {
      if (!/^https:\/\/[\w.-]+$/.test(v.replace(/\/$/, ''))) throw new Error('Адрес должен начинаться с https:// , например https://abcd1234.supabase.co');
    }))
  ) return { ok: false };
  values[ENV_NAMES.supabaseUrl] = values[ENV_NAMES.supabaseUrl].replace(/\/$/, '');
  const url = values[ENV_NAMES.supabaseUrl];

  io.print(
    [
      '',
      'Шаг 3. Секретный ключ Supabase (service_role):',
      '  там же, Project Settings → API → service_role (или Secret key) → Reveal → скопировать.',
      '  Это ключ полного доступа: он остаётся только на этом компьютере и никогда не попадает на сайт.',
    ].join('\n'),
  );
  if (
    !(await askValue(ENV_NAMES.supabaseServiceRoleKey, 'service_role ключ', { secret: true }, async (v) => {
      try {
        await deps.supabase.checkServiceKey(url, v);
      } catch (e) {
        throw new Error(`Supabase не принял ключ: ${short(e)}`);
      }
      return 'ключ service_role, таблицы QuestFlow 2 на месте';
    }))
  ) return { ok: false };
  const serviceKey = values[ENV_NAMES.supabaseServiceRoleKey];

  io.print(
    [
      '',
      'Шаг 4. Твой id в Supabase (чтобы бот видел твои данные):',
      '  Authentication → Users → строка с твоей почтой → User UID (вида 1a2b3c4d-...).',
    ].join('\n'),
  );
  if (
    !(await askValue(ENV_NAMES.ownerUserId, 'User UID', {}, async (v) => {
      if (!UUID.test(v)) throw new Error('UID вида 1a2b3c4d-1234-4abc-8def-0123456789ab — скопируй его целиком.');
      try {
        return `пользователь ${await deps.supabase.checkOwner(url, serviceKey, v)}`;
      } catch (e) {
        throw new Error(`Такого пользователя нет: ${short(e)}`);
      }
    }))
  ) return { ok: false };
  const ownerId = values[ENV_NAMES.ownerUserId];

  io.print(
    [
      '',
      'Шаг 5 (необязательно). Ключ Claude API — запасной путь для анализа, если `claude -p` по подписке недоступен.',
      '  console.anthropic.com → API Keys. Платный: примерно $3–10 в месяц. Можно пропустить.',
    ].join('\n'),
  );
  if (
    !(await askValue(ENV_NAMES.anthropicApiKey, 'Ключ Claude API', { secret: true, optional: true }, async (v) => {
      if (!v.startsWith('sk-ant-')) throw new Error('Ключ Claude API начинается с sk-ant-');
    }))
  ) return { ok: false };

  deps.writeEnv(
    [
      '# QuestFlow сервер — создано npm run setup. Не коммитить, не пересылать.',
      ...Object.values(ENV_NAMES).map((n) => `${n}=${values[n] ?? ''}`),
      '',
    ].join('\n'),
  );
  io.print('\nКлючи сохранены в server/.env.');

  // Привязка чата владельца
  io.print(
    [
      '',
      `Последний шаг: открой в Telegram бота @${botUsername} и нажми Start (или отправь /start).`,
      'Если бот уже запущен как служба, сначала останови его (см. server/docs/server.md).',
      'Жду /start...',
    ].join('\n'),
  );
  const token = values[ENV_NAMES.telegramBotToken];
  let offset = 0;
  const polls = deps.maxStartPolls ?? 20;
  for (let i = 0; i < polls; i++) {
    let updates: TelegramUpdate[];
    try {
      updates = await deps.telegram.getUpdates(token, offset, 30);
    } catch (e) {
      io.print(`Не удалось получить сообщения от Telegram: ${short(e)}`);
      return { ok: false };
    }
    for (const u of updates) {
      offset = Math.max(offset, u.update_id + 1);
      const m = u.message;
      if (!m || m.chat.type !== 'private' || !m.text || !/^\/start(\s|$)/.test(m.text)) continue;
      const who = [m.from?.first_name, m.from?.last_name].filter(Boolean).join(' ') + (m.from?.username ? ` (@${m.from.username})` : '');
      const answer = (await io.ask(`/start нажал ${who || 'кто-то'}. Это ты? (да/нет): `)).trim().toLowerCase();
      if (!['да', 'д', 'yes', 'y'].includes(answer)) {
        io.print('Пропускаю. Жду /start от тебя...');
        continue;
      }
      const chatId = String(m.chat.id);
      try {
        await deps.supabase.bindChat(url, serviceKey, ownerId, chatId);
        await deps.telegram.sendMessage(token, m.chat.id, `${TEXT.alive} ${TEXT.bound}`);
      } catch (e) {
        io.print(`Не получилось привязать чат: ${short(e)}`);
        return { ok: false };
      }
      io.print(
        [
          '',
          'Бот работает: первое сообщение отправлено тебе в Telegram.',
          'Дальше:',
          '  npm start — запустить бота в этом окне;',
          '  powershell -ExecutionPolicy Bypass -File scripts\\install-service.ps1 — автозапуск при включении компьютера.',
        ].join('\n'),
      );
      return { ok: true };
    }
  }
  io.print('Не дождался /start. Ключи сохранены — запусти npm run setup ещё раз и нажми Start в боте.');
  return { ok: false };
}

// ─── Настоящие зависимости ───────────────────────────────────────────────────

async function telegramCall<T>(token: string, method: string, body: unknown, timeoutMs = 40_000): Promise<T> {
  // Токен — только в адресе запроса; в ошибку он не попадает
  let res: Response;
  try {
    res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new Error('нет связи с api.telegram.org');
  }
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
  if (!data.ok) throw new Error(`${res.status}: ${data.description ?? 'ошибка Telegram'}`);
  return data.result as T;
}

function jwtRole(key: string): string | null {
  const parts = key.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')).role ?? null;
  } catch {
    return null;
  }
}

export const realSetupDeps = (io: SetupIO): SetupDeps => ({
  io,
  telegram: {
    getMe: (token) => telegramCall(token, 'getMe', {}),
    getUpdates: (token, offset, timeoutSec) =>
      telegramCall(token, 'getUpdates', { offset, timeout: timeoutSec, allowed_updates: ['message'] }, (timeoutSec + 10) * 1000),
    sendMessage: async (token, chatId, text) => void (await telegramCall(token, 'sendMessage', { chat_id: chatId, text })),
  },
  supabase: {
    async checkServiceKey(url, key) {
      if (key.startsWith('sb_publishable_') || jwtRole(key) === 'anon') {
        throw new Error('это публичный (anon/publishable) ключ, нужен service_role / secret');
      }
      const client = createSupabaseClient(url, key);
      const { error } = await client.from('bot_settings').select('user_id').limit(1);
      if (error) {
        throw new Error(
          /bot_settings/.test(error.message)
            ? 'нет таблицы bot_settings — сначала примени миграцию supabase/migrations/002_questflow2.sql'
            : error.message,
        );
      }
      // Только service-role может читать пользователей
      const admin = await client.auth.admin.listUsers({ page: 1, perPage: 1 });
      if (admin.error) throw new Error('ключ без прав service_role');
    },
    async checkOwner(url, key, userId) {
      const { data, error } = await createSupabaseClient(url, key).auth.admin.getUserById(userId);
      if (error || !data?.user) throw new Error(error?.message ?? 'не найден');
      return data.user.email ?? userId;
    },
    async bindChat(url, key, userId, chatId) {
      const { error } = await createSupabaseClient(url, key)
        .from('bot_settings')
        .upsert({ user_id: userId, chat_id: chatId, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (error) throw new Error(error.message);
    },
  },
  readEnv: () => (fs.existsSync(envFilePath()) ? fs.readFileSync(envFilePath(), 'utf8') : null),
  writeEnv: (content) => fs.writeFileSync(envFilePath(), content, { encoding: 'utf8', mode: 0o600 }),
});

/** Терминал: обычный и скрытый ввод */
export function terminalIO(): SetupIO & { close(): void } {
  let muted = false;
  const output = new Writable({
    write(chunk, _enc, cb) {
      if (!muted) process.stdout.write(chunk);
      cb();
    },
  });
  const rl = readline.createInterface({ input: process.stdin, output, terminal: true });
  return {
    print: (t) => console.log(t),
    ask: (q, o) =>
      new Promise((resolve) => {
        process.stdout.write(q);
        muted = !!o?.secret;
        rl.question('', (a) => {
          if (muted) process.stdout.write('\n');
          muted = false;
          resolve(a);
        });
      }),
    close: () => rl.close(),
  };
}

if (require.main === module) {
  const io = terminalIO();
  runSetup(realSetupDeps(io))
    .then((r) => {
      io.close();
      process.exit(r.ok ? 0 : 1);
    })
    .catch((e) => {
      io.close();
      console.error(`Настройка прервана: ${short(e)}`);
      process.exit(1);
    });
}
