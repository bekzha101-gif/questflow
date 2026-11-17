// Распознавание голосовых: faster-whisper на видеокарте этого компьютера (бесплатно).
// Отдельный Python-процесс server/stt/transcribe.py; ответ — одна строка JSON {"text": "..."}.
// Whisper не установлен или упал → null: разговор просит написать текстом и ничего не теряет.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { serverRoot } from './config';

export interface Stt {
  transcribe(oggPath: string): Promise<string | null>;
}

export interface SttOptions {
  /** Интерпретатор Python с faster-whisper (WHISPER_PYTHON; по умолчанию venv server/stt/.venv, затем `python`) */
  python?: string;
  /** Модель (WHISPER_MODEL): small | medium | large-v3-turbo; по умолчанию medium */
  model?: string;
  /** cuda | cpu (WHISPER_DEVICE) */
  device?: string;
  timeoutMs?: number;
  /** Запуск процесса; подменяется в тестах */
  run?: (cmd: string, args: string[], timeoutMs: number) => Promise<string>;
  log?(message: string): void;
}

export function sttScriptPath(): string {
  return path.join(serverRoot(), 'stt', 'transcribe.py');
}

export function defaultPython(): string {
  const venv = path.join(serverRoot(), 'stt', '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  return fs.existsSync(venv) ? venv : 'python';
}

function execRun(cmd: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: timeoutMs, windowsHide: true, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${err.message} ${String(stderr).slice(-300)}`));
      else resolve(stdout);
    });
  });
}

export function createStt(opts: SttOptions = {}): Stt {
  const run = opts.run ?? execRun;
  const log = opts.log ?? (() => {});
  return {
    async transcribe(oggPath) {
      const python = opts.python ?? defaultPython();
      const args = [sttScriptPath(), oggPath, '--model', opts.model ?? 'medium', '--device', opts.device ?? 'cuda'];
      try {
        const out = await run(python, args, opts.timeoutMs ?? 120_000);
        const line = out.trim().split(/\r?\n/).reverse().find((l) => l.trim().startsWith('{'));
        if (!line) return null;
        const j = JSON.parse(line) as { text?: unknown; error?: unknown };
        if (typeof j.error === 'string') log(`Whisper: ${j.error}`);
        const text = typeof j.text === 'string' ? j.text.trim() : '';
        return text || null;
      } catch (e) {
        log(`Whisper недоступен: ${(e as Error).message}`);
        return null;
      }
    },
  };
}
