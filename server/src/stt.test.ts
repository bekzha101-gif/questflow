import { describe, expect, it } from 'vitest';
import { createStt } from './stt';

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

  it('Whisper не установлен (процесс упал) → null', async () => {
    const stt = createStt({ run: async () => Promise.reject(new Error("ModuleNotFoundError: No module named 'faster_whisper'")) });
    expect(await stt.transcribe('C:/tmp/voice.ogg')).toBeNull();
  });

  it('пустая расшифровка или ошибка в ответе → null', async () => {
    expect(await createStt({ run: async () => '{"text": "  "}' }).transcribe('a.ogg')).toBeNull();
    expect(await createStt({ run: async () => '{"error": "cuda"}' }).transcribe('a.ogg')).toBeNull();
  });
});
