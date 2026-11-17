import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_API_MODEL, createAi, type CliRun } from './ai';

const goodJson = JSON.stringify({
  summary: 'День ровный',
  good: ['3 блока фокуса'],
  better: ['лечь до 0:00'],
  boost: ['первый блок сразу после подъёма'],
  facts: ['сон < 6 ч → оценка ниже на 2'],
  steps: [],
});

/** Ответ `claude -p --output-format json`: конверт с полем result */
const envelope = (result: string, isError = false) => JSON.stringify({ type: 'result', subtype: 'success', is_error: isError, result });

describe('ai.analyze', () => {
  it('зовёт `claude -p … --output-format json` без --bare и разбирает 3 блока', async () => {
    const calls: { args: string[]; input: string }[] = [];
    const run: CliRun = async (args, input) => {
      calls.push({ args, input });
      return envelope('Вот разбор:\n```json\n' + goodJson + '\n```');
    };
    const ai = createAi({ runCli: run });
    const r = await ai.analyze('day', { date: '2026-11-17', days: [] });
    expect(r).not.toBeNull();
    expect(r!.source).toBe('cli');
    expect(r!.good).toEqual(['3 блока фокуса']);
    expect(r!.better).toEqual(['лечь до 0:00']);
    expect(r!.boost).toEqual(['первый блок сразу после подъёма']);
    expect(calls[0].args).toContain('-p');
    expect(calls[0].args.join(' ')).toContain('--output-format json');
    expect(calls[0].args).not.toContain('--bare');
    expect(calls[0].input).toContain('2026-11-17');
  });

  it('CLI недоступен и ключа API нет → null (отчёт уйдёт без AI)', async () => {
    const ai = createAi({ runCli: async () => Promise.reject(new Error('spawn claude ENOENT')) });
    expect(await ai.analyze('day', { date: '2026-11-17' })).toBeNull();
  });

  it('CLI вернул ошибку лимита → запасной Claude API, если задан ключ', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ content: [{ type: 'text', text: goodJson }] }), { status: 200 }));
    const ai = createAi({
      runCli: async () => envelope('Claude AI usage limit reached', true),
      apiKey: 'test-key-not-real',
      fetch: fetchMock as unknown as typeof fetch,
    });
    const r = await ai.analyze('week', { date: '2026-11-22' });
    expect(r?.source).toBe('api');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('test-key-not-real');
  });

  it('скриншот сна: CLI получает путь к картинке и право читать файл', async () => {
    let seen: { args: string[]; input: string } | null = null;
    const ai = createAi({
      runCli: async (args, input) => {
        seen = { args, input };
        return envelope('{"sleepMin": 452, "quality": 85}');
      },
    });
    const r = await ai.analyze('sleep_screenshot', { imagePath: 'C:/tmp/qf/sleep.jpg' });
    expect(r?.sleep).toEqual({ sleepMin: 452, quality: 85 });
    expect(seen!.input).toContain('C:/tmp/qf/sleep.jpg');
    expect(seen!.args.join(' ')).toContain('--allowedTools Read');
  });

  it('ответ без JSON → null', async () => {
    const ai = createAi({ runCli: async () => envelope('не могу') });
    expect(await ai.analyze('day', {})).toBeNull();
  });

  it('текст: инструменты, MCP, скиллы и настройки (глобальный CLAUDE.md) отключены', async () => {
    let args: string[] = [];
    const ai = createAi({
      runCli: async (a) => {
        args = a;
        return envelope(goodJson);
      },
    });
    await ai.analyze('day', { date: '2026-11-17' });
    const line = args.join(' ');
    expect(args[args.indexOf('--tools') + 1]).toBe('');
    expect(args).toContain('--strict-mcp-config');
    expect(JSON.parse(args[args.indexOf('--mcp-config') + 1])).toEqual({ mcpServers: {} });
    expect(args).toContain('--disable-slash-commands');
    expect(args[args.indexOf('--setting-sources') + 1]).toBe('');
    expect(line).not.toContain('--bare');
    expect(line).not.toContain('Read');
  });

  it('скриншот: из инструментов только Read, MCP отключены', async () => {
    let args: string[] = [];
    const ai = createAi({
      runCli: async (a) => {
        args = a;
        return envelope('{"sleepMin": 452}');
      },
    });
    await ai.analyze('sleep_screenshot', { imagePath: 'C:/tmp/qf/sleep.jpg' });
    expect(args[args.indexOf('--tools') + 1]).toBe('Read');
    expect(args).toContain('--strict-mcp-config');
  });

  it('запрос к Claude API идёт с таймаутом (AbortSignal)', async () => {
    let signal: AbortSignal | undefined;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Response(JSON.stringify({ content: [{ type: 'text', text: goodJson }] }), { status: 200 });
    });
    const ai = createAi({ runCli: async () => envelope('', true), apiKey: 'test-key', fetch: fetchMock as unknown as typeof fetch });
    await ai.analyze('day', {});
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it('модель API по умолчанию — claude-sonnet-5-5', () => {
    expect(DEFAULT_API_MODEL).toBe('claude-sonnet-5-5');
  });
});
