import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createStt, keepFailedVoice, STT_TIMEOUT_MS } from './stt';

describe('stt.transcribe', () => {
  it('вызывает server/stt/transcribe.py с файлом и возвращает текст', async () => {
    let seen: string[] = [];
    const stt = createStt({
      python: 'py-test',
      run: async (cmd, args) => {
        seen = [cmd, ...args];
        return JSON.stringify({ text: ' Воду выпил, медитировал. ', language: 'ru' });
      },
    });
    expect(await stt.transcribe('C:/tmp/voice.ogg')).toBe('Воду выпил, медитировал.');
    expect(seen[0]).toBe('py-test');
    expect(seen.some((a) => a.replace(/\\/g, '/').endsWith('stt/transcribe.py'))).toBe(true);
    expect(seen).toContain('C:/tmp/voice.ogg');
  });

  it('слова-подсказки из .env и из базы уходят в --hints без повторов', async () => {
    let seen: string[] = [];
    const stt = createStt({
      hints: ['Эринамакс', ' '],
      run: async (_cmd, args) => {
        seen = args;
        return '{"text": "ok"}';
      },
    });
    await stt.transcribe('a.ogg', ['Tiger Milk', 'Эринамакс']);
    expect(seen.slice(seen.indexOf('--hints'))).toEqual(['--hints', 'Эринамакс, Tiger Milk']);
    await stt.transcribe('a.ogg');
    expect(seen).toContain('--hints');
    await createStt({ run: async (_c, a) => ((seen = a), '{"text": "ok"}') }).transcribe('a.ogg');
    expect(seen).not.toContain('--hints');
  });

  it('Whisper не установлен (процесс упал) → null', async () => {
    const stt = createStt({ run: async () => Promise.reject(new Error("ModuleNotFoundError: No module named 'faster_whisper'")) });
    expect(await stt.transcribe('C:/tmp/voice.ogg')).toBeNull();
  });

  it('пустая расшифровка или ошибка в ответе → null', async () => {
    expect(await createStt({ run: async () => '{"text": "  "}' }).transcribe('a.ogg')).toBeNull();
    expect(await createStt({ run: async () => '{"error": "cuda"}' }).transcribe('a.ogg')).toBeNull();
  });
});

describe('длинное голосовое при занятой видеокарте', () => {
  it('ждёт расшифровку до 15 минут, а не 2', async () => {
    let got = 0;
    const stt = createStt({ run: async (_c, _a, t) => ((got = t), '{"text":"ок"}') });
    await stt.transcribe('x.oga');
    expect(got).toBe(STT_TIMEOUT_MS);
    expect(STT_TIMEOUT_MS).toBeGreaterThanOrEqual(15 * 60_000);
  });

  it('нерасшифрованное голосовое сохраняется копией', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qf-voice-'));
    const src = path.join(dir, 'voice-1.oga');
    fs.writeFileSync(src, 'opus');
    const kept = keepFailedVoice(src, path.join(dir, 'kept'));
    expect(kept && fs.readFileSync(kept, 'utf8')).toBe('opus');
    expect(keepFailedVoice(path.join(dir, 'нет.oga'), path.join(dir, 'kept'))).toBeNull();
  });
});
