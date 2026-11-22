// Распознавание голосовых: faster-whisper на видеокарте этого компьютера (бесплатно).
// Отдельный Python-процесс server/stt/transcribe.py; ответ — одна строка JSON {"text": "..."}.
// Whisper не установлен или упал → null: разговор просит написать текстом и ничего не теряет.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { serverRoot } from './config';

export interface Stt {
  /** hints — слова, которые Whisper должен узнавать (названия БАДов и т. п.) */
  transcribe(oggPath: string, hints?: string[]): Promise<string | null>;
}

export interface SttOptions {
  /** Интерпретатор Python с faster-whisper (WHISPER_PYTHON; по умолчанию venv server/stt/.venv, затем `python`) */
  python?: string;
  /** Модель (WHISPER_MODEL): small | medium | large-v3-turbo | large-v3; по умолчанию large-v3 (самая точная) */
  model?: string;
  /** cuda | cpu (WHISPER_DEVICE) */
  device?: string;
  /** Постоянные слова-подсказки (WHISPER_HINTS через запятую) */
  hints?: string[];
  timeoutMs?: number;
  /** Запуск процесса; подменяется в тестах */
  run?: (cmd: string, args: string[], timeoutMs: number) => Promise<string>;
  log?(message: string): void;
}

export const STT_TIMEOUT_MS = 15 * 60_000;

/** Копия нерасшифрованного голосового в server/logs/voice-failed: чтобы не пропало, его можно расшифровать позже */
export function keepFailedVoice(oggPath: string, dir = path.join(serverRoot(), 'logs', 'voice-failed')): string | null {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, path.basename(oggPath));
    fs.copyFileSync(oggPath, dest);
    return dest;
  } catch {
    return null;
  }
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
    async transcribe(oggPath, hints = []) {
      const python = opts.python ?? defaultPython();
      const args = [sttScriptPath(), oggPath, '--model', opts.model ?? 'large-v3', '--device', opts.device ?? 'cuda'];
      const words = [...new Set([...(opts.hints ?? []), ...hints].map((w) => w.trim()).filter(Boolean))].slice(0, 40);
      if (words.length) args.push('--hints', words.join(', '));
      try {
        // 15 минут: когда видеокарта занята рендерами, длинное голосовое за 2 минуты не успевало (22.11.2026)
        const out = await run(python, args, opts.timeoutMs ?? STT_TIMEOUT_MS);
        const line = out.trim().split(/\r?\n/).reverse().find((l) => l.trim().startsWith('{'));
        if (!line) return null;
        const j = JSON.parse(line) as { text?: unknown; error?: unknown; device?: unknown };
        if (typeof j.error === 'string') log(`Whisper: ${j.error}`);
        // Модель не влезла в видеокарту и ушла на процессор — медленно, стоит знать
        if (typeof j.device === 'string' && j.device.startsWith('cpu')) log(`Whisper работает на процессоре (${j.device}): видеокарта недоступна`);
        const text = typeof j.text === 'string' ? j.text.trim() : '';
        return text || null;
      } catch (e) {
        log(`Whisper недоступен: ${(e as Error).message}`);
        return null;
      }
    },
  };
}
