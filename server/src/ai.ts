// AI-аналитик: Claude в аккаунте владельца через `claude -p … --output-format json` (подписка Max,
// без --bare: нужен вход Claude этого пользователя). Запасной путь — Claude API, только если в
// server/.env задан ANTHROPIC_API_KEY. Иначе null: отчёт уходит без AI-раздела, разговор повторит позже.
// Значение ключа никогда не попадает в логи и тексты ошибок.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// advisor — советник по здоровью и жизни: кнопка на сайте, анализ месяца, ответ на сайт
export type AiKind = 'day' | 'week' | 'month' | 'sleep_screenshot' | 'advisor';

export interface AiStep {
  goalId: string;
  title: string;
}

export interface AiResult {
  source: 'cli' | 'api';
  /** Короткий итог периода */
  summary: string;
  /** Что получилось хорошо */
  good: string[];
  /** Что можно сделать лучше */
  better: string[];
  /** Как поднять продуктивность */
  boost: string[];
  /** Долгие выводы для ai_memory (подаются в следующие анализы) */
  facts: string[];
  /** Шаги на следующую неделю (только kind = 'week') */
  steps: AiStep[];
  /** Ответ на вопрос пользователя (только kind = 'advisor', если вопрос был) */
  answer?: string;
  /** Сон со скриншота Sleep Cycle (только kind = 'sleep_screenshot') */
  sleep?: { sleepMin: number; quality?: number };
}

export interface Ai {
  analyze(kind: AiKind, payload: unknown): Promise<AiResult | null>;
}

/** Запуск CLI: аргументы, текст в stdin; возвращает stdout. Подменяется в тестах. */
export type CliRun = (args: string[], input: string, opts: { cwd?: string; timeoutMs: number }) => Promise<string>;

export interface AiOptions {
  runCli?: CliRun;
  /** Путь к claude.exe (по умолчанию ~/.local/bin/claude.exe или `claude` из PATH) */
  claudePath?: string;
  apiKey?: string;
  /** Модель для запасного API (ANTHROPIC_MODEL) */
  model?: string;
  fetch?: typeof fetch;
  /** Предел на один вызов `claude -p`, мс */
  timeoutMs?: number;
  /** Предел на запрос к Claude API, мс */
  apiTimeoutMs?: number;
  log?(message: string): void;
}

/**
 * Флаги, которые отключают общий контекст Claude Code: MCP-серверы, скиллы и слэш-команды,
 * файлы настроек (вместе с ними — глобальный CLAUDE.md и хуки). Вход в подписку остаётся.
 * --bare не используется: он требует ключ API вместо входа пользователя.
 */
export const CLI_ISOLATION_ARGS = [
  '--strict-mcp-config',
  '--mcp-config',
  '{"mcpServers":{}}',
  '--disable-slash-commands',
  '--setting-sources',
  '',
  '--no-session-persistence',
];

export const DEFAULT_API_MODEL = 'claude-sonnet-5-5';
const API_URL = 'https://api.anthropic.com/v1/messages';

export function defaultClaudePath(): string {
  const local = path.join(os.homedir(), '.local', 'bin', process.platform === 'win32' ? 'claude.exe' : 'claude');
  return fs.existsSync(local) ? local : 'claude';
}

/** Обычный запуск процесса с таймаутом (без shell: аргументы не разбираются оболочкой) */
export function spawnCli(command: string): CliRun {
  return (args, input, opts) =>
    new Promise((resolve, reject) => {
      const child = spawn(command, args, { cwd: opts.cwd, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      let out = '';
      let err = '';
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error(`claude: нет ответа за ${Math.round(opts.timeoutMs / 1000)} с`));
      }, opts.timeoutMs);
      child.stdout.setEncoding('utf8').on('data', (d: string) => (out += d));
      child.stderr.setEncoding('utf8').on('data', (d: string) => (err += d));
      child.on('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0 || out.trim()) resolve(out);
        else reject(new Error(`claude: код выхода ${code}: ${err.slice(0, 300)}`));
      });
      child.stdin.end(input, 'utf8');
    });
}

// ─── Промпт ──────────────────────────────────────────────────────────────────
const KIND_LABEL: Record<Exclude<AiKind, 'sleep_screenshot' | 'advisor'>, string> = {
  day: 'прошедший день',
  week: 'прошедшую неделю',
  month: 'прошедший месяц',
};

export function buildPrompt(kind: AiKind, payload: unknown): string {
  if (kind === 'sleep_screenshot') {
    const p = (payload ?? {}) as { imagePath?: string };
    return [
      `Открой файл картинки ${p.imagePath} инструментом Read. Это скриншот приложения Sleep Cycle.`,
      'Найди общее время сна (или время в постели, если сна нет) и качество сна в процентах.',
      'Ответь ТОЛЬКО JSON без пояснений: {"sleepMin": <минуты числом>, "quality": <процент числом или null>}.',
      'Если на картинке нет данных сна — ответь {"sleepMin": null, "quality": null}.',
    ].join('\n');
  }
  if (kind === 'advisor') {
    const q = String((payload as { question?: unknown })?.question ?? '').trim();
    const period = String((payload as { period?: unknown })?.period ?? 'month');
    const focus =
      period === 'day'
        ? 'Главное — прошедший день (дата date в данных): сравни его с прошлыми днями. Остальные 30 дней — для сравнения.'
        : period === 'week'
          ? 'Главное — последние 7 дней: сравни с прошлыми неделями. Остальные дни — для сравнения.'
          : 'Разбери последние 30 дней.';
    return [
      `Ты — личный советник Бакыта по здоровью и жизни (QuestFlow). ${focus}`,
      'Данные: дни Big Data (сон, качество сна, БАДы, вода, привычки, оценка дня 1–10 и почему, заметки), фокус по дням (норма 3 блока по 120 мин), задачи, цели, раздел health (журнал сна Sleep Cycle, протокол дня: вода, телефон и гаджеты перед сном, прогулка, медитация; урон и восстановление HP, дневник питания и самочувствие после еды), факторы влияния (influence) и прошлые выводы (memory).',
      'Ищи связи: сон, еда, БАДы, вода, вечерние гаджеты и прогулки — с оценкой дня, фокусом и HP. Пятница — день восстановления без работы.',
      'Пиши по-русски, коротко, конкретно, с цифрами и датами из данных. Ничего не выдумывай: если данных мало (меньше 10 дней) — прямо скажи «мало данных». Ты не врач: не ставь диагнозов и не назначай лекарства; при тревожных признаках советуй обратиться к врачу.',
      q ? `Вопрос пользователя: «${q}». Ответь на него в поле answer (3–6 предложений) по данным.` : 'Вопроса нет: поле answer оставь пустой строкой.',
      'Ответь ТОЛЬКО JSON без пояснений вокруг:',
      '{"summary": "1–2 предложения о периоде", "answer": "ответ на вопрос или пустая строка", "good": ["что помогает"], "better": ["что вредит или мешает"], "boost": ["конкретные шаги на следующие 2 недели"], "facts": ["долгие выводы для памяти"]}',
      '- good, better, boost: по 2–5 пунктов каждый, обязательно все три.',
      '- facts: 0–5 устойчивых связей (например «при сне < 6 ч оценка ниже на 2»).',
      '',
      'ДАННЫЕ (JSON):',
      JSON.stringify(payload),
    ].join('\n');
  }
  const stepsRule =
    kind === 'week'
      ? '- steps: 2–4 конкретных шага на СЛЕДУЮЩУЮ неделю для каждой активной цели из nextWeekGoals (goalId — id этой цели, title — действие одной строкой).'
      : '- steps: пустой массив.';
  return [
    `Ты — AI-аналитик продуктивности Бакыта (QuestFlow). Разбери ${KIND_LABEL[kind]} по данным ниже.`,
    'Данные: фокус по дням (минуты, блоки по 120 мин, норма 3 блока = 6 ч), задачи, цели месяца по неделям, сон, БАДы, привычки, оценки дня 1–10 и почему, заметки, каналы YouTube и публикации, доход, прошлые выводы (memory).',
    'Пятница — день восстановления без работы, её не ругай за отсутствие фокуса.',
    'Опирайся на прошлые выводы из memory и сравнивай с прошлыми периодами, если они есть («в прошлом месяце при сне < 6 ч оценка падала на …»).',
    'Пиши по-русски, коротко, конкретно, с цифрами из данных. Ничего не выдумывай: если данных мало (меньше 14 дней с оценкой) — прямо скажи «мало данных» вместо выводов о причинах.',
    'Ответь ТОЛЬКО JSON без пояснений вокруг:',
    '{"summary": "1–2 предложения", "good": ["что получилось хорошо"], "better": ["что можно сделать лучше"], "boost": ["как поднять продуктивность"], "facts": ["долгие выводы для памяти"], "steps": [{"goalId": "...", "title": "..."}]}',
    '- good, better, boost: по 2–4 пункта каждый, обязательно все три.',
    '- facts: 0–5 выводов, которые стоит помнить в следующих анализах (связи сна, БАДов, привычек с оценкой и фокусом).',
    stepsRule,
    '',
    'ДАННЫЕ (JSON):',
    JSON.stringify(payload),
  ].join('\n');
}

// ─── Разбор ответа ───────────────────────────────────────────────────────────
/** Текст ответа из конверта `--output-format json`; null — ошибка или лимит */
export function parseCliEnvelope(stdout: string): string | null {
  const trimmed = stdout.trim();
  let env: { result?: unknown; is_error?: boolean; subtype?: string } | null = null;
  try {
    env = JSON.parse(trimmed);
  } catch {
    // Иногда перед JSON бывают строки предупреждений — берём последнюю JSON-строку
    const last = trimmed.split(/\r?\n/).reverse().find((l) => l.trim().startsWith('{'));
    if (last) {
      try {
        env = JSON.parse(last);
      } catch {
        env = null;
      }
    }
  }
  if (!env || env.is_error || typeof env.result !== 'string') return null;
  return env.result;
}

function extractJson(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const v = JSON.parse(body.slice(start, end + 1));
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((s) => s.trim()) : [];

export function parseAiText(kind: AiKind, text: string): Omit<AiResult, 'source'> | null {
  const j = extractJson(text);
  if (!j) return null;
  if (kind === 'sleep_screenshot') {
    const min = Number(j.sleepMin);
    if (!(min > 0)) return null;
    const q = j.quality === null || j.quality === undefined ? undefined : Number(j.quality);
    return {
      summary: '',
      good: [],
      better: [],
      boost: [],
      facts: [],
      steps: [],
      sleep: { sleepMin: Math.round(min), ...(q !== undefined && Number.isFinite(q) ? { quality: Math.round(q) } : {}) },
    };
  }
  const good = strings(j.good);
  const better = strings(j.better);
  const boost = strings(j.boost);
  if (!good.length && !better.length && !boost.length) return null;
  const steps = Array.isArray(j.steps)
    ? (j.steps as unknown[])
        .map((s) => s as { goalId?: unknown; title?: unknown })
        .filter((s) => typeof s?.goalId === 'string' && typeof s?.title === 'string' && s.title.trim() !== '')
        .map((s) => ({ goalId: String(s.goalId), title: String(s.title).trim() }))
    : [];
  const base = { summary: typeof j.summary === 'string' ? j.summary.trim() : '', good, better, boost, facts: strings(j.facts), steps };
  if (kind === 'advisor') return { ...base, steps: [], answer: typeof j.answer === 'string' ? j.answer.trim() : '' };
  return base;
}

// ─── Анализ ──────────────────────────────────────────────────────────────────
export function createAi(opts: AiOptions = {}): Ai {
  const log = opts.log ?? (() => {});
  const run = opts.runCli ?? spawnCli(opts.claudePath ?? defaultClaudePath());
  const timeoutMs = opts.timeoutMs ?? 240_000;
  const apiTimeoutMs = opts.apiTimeoutMs ?? 90_000;
  const doFetch = opts.fetch ?? (globalThis.fetch as typeof fetch | undefined);

  async function viaCli(kind: AiKind, prompt: string, payload: unknown): Promise<string | null> {
    const image = kind === 'sleep_screenshot';
    const args = ['-p', '--output-format', 'json', ...CLI_ISOLATION_ARGS];
    // Картинку CLI читает своим инструментом Read; для текста инструменты не нужны
    if (image) args.push('--tools', 'Read', '--allowedTools', 'Read', '--max-turns', '4');
    else args.push('--tools', '', '--max-turns', '2');
    const imagePath = image ? (payload as { imagePath?: string })?.imagePath : undefined;
    const cwd = imagePath ? path.dirname(imagePath) : os.tmpdir();
    const out = await run(args, prompt, { cwd, timeoutMs });
    return parseCliEnvelope(out);
  }

  async function viaApi(kind: AiKind, prompt: string, payload: unknown): Promise<string | null> {
    if (!opts.apiKey || !doFetch) return null;
    const content: unknown[] = [];
    if (kind === 'sleep_screenshot') {
      const p = (payload as { imagePath?: string }) ?? {};
      if (!p.imagePath) return null;
      const ext = path.extname(p.imagePath).toLowerCase();
      const mediaType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      const data = fs.readFileSync(p.imagePath).toString('base64');
      content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data } });
      content.push({ type: 'text', text: prompt.replace(/^Открой файл[^\n]*\n/, 'На картинке — скриншот приложения Sleep Cycle.\n') });
    } else {
      content.push({ type: 'text', text: prompt });
    }
    const res = await doFetch(API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': opts.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: opts.model || DEFAULT_API_MODEL, max_tokens: 2000, messages: [{ role: 'user', content }] }),
      // Без таймаута зависший запрос держал бы замок разговора (и планировщик) бесконечно
      signal: AbortSignal.timeout(apiTimeoutMs),
    });
    if (!res.ok) throw new Error(`Claude API: HTTP ${res.status}`);
    const body = (await res.json()) as { content?: { type?: string; text?: string }[] };
    return (body.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('\n') || null;
  }

  return {
    async analyze(kind, payload) {
      const prompt = buildPrompt(kind, payload);
      try {
        const text = await viaCli(kind, prompt, payload);
        const parsed = text ? parseAiText(kind, text) : null;
        if (parsed) return { ...parsed, source: 'cli' };
        log(`claude -p (${kind}): ответ без нужного JSON или ошибка/лимит`);
      } catch (e) {
        log(`claude -p (${kind}) недоступен: ${(e as Error).message}`);
      }
      try {
        const text = await viaApi(kind, prompt, payload);
        const parsed = text ? parseAiText(kind, text) : null;
        if (parsed) return { ...parsed, source: 'api' };
      } catch (e) {
        log(`Claude API (${kind}) недоступен: ${(e as Error).message}`);
      }
      return null;
    },
  };
}
