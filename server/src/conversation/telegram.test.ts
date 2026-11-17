import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTelegramFiles } from './telegram';

describe('createTelegramFiles', () => {
  it('скачивание файла идёт с таймаутом (AbortSignal)', async () => {
    let signal: AbortSignal | null | undefined;
    const fakeFetch = (async (_url: string, init?: RequestInit) => {
      signal = init?.signal;
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    }) as unknown as typeof fetch;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qf-tg-'));
    const files = createTelegramFiles({ getFile: async () => ({ file_id: 'f', file_unique_id: 'u', file_path: 'voice/a.ogg' }) }, 'TEST', dir, fakeFetch);
    const out = await files.download('f', 'voice');
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(out && fs.existsSync(out)).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
