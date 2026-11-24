// Настройки сервера из server/.env. Значения секретов никогда не печатаются —
// в ошибках и логах только имена переменных.
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

export const ENV_NAMES = {
  supabaseUrl: 'SUPABASE_URL',
  supabaseServiceRoleKey: 'SUPABASE_SERVICE_ROLE_KEY',
  ownerUserId: 'OWNER_USER_ID',
  anthropicApiKey: 'ANTHROPIC_API_KEY',
} as const;

export interface ServerConfig {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  ownerUserId: string;
  /** Необязательно: запасной путь к Claude API */
  anthropicApiKey?: string;
}

/** Корень папки server/ (работает и из src, и из dist/server/src) */
export function serverRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(path.join(dir, 'tsconfig.json'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

export function envFilePath(): string {
  return path.join(serverRoot(), '.env');
}

/** Читает server/.env в process.env (без вывода в консоль) */
export function loadEnvFile(file = envFilePath()): void {
  dotenv.config({ path: file, quiet: true });
}

/** Собирает настройки; при нехватке бросает ошибку с именами переменных (без значений) */
export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const required = ['supabaseUrl', 'supabaseServiceRoleKey', 'ownerUserId'] as const;
  const missing = required.filter((k) => !env[ENV_NAMES[k]]?.trim()).map((k) => ENV_NAMES[k]);
  if (missing.length) {
    throw new Error(`Не заданы переменные в server/.env: ${missing.join(', ')}. Шаблон: server/.env.example`);
  }
  const value = (k: keyof typeof ENV_NAMES) => env[ENV_NAMES[k]]?.trim() || undefined;
  return {
    supabaseUrl: value('supabaseUrl')!,
    supabaseServiceRoleKey: value('supabaseServiceRoleKey')!,
    ownerUserId: value('ownerUserId')!,
    anthropicApiKey: value('anthropicApiKey'),
  };
}

/** Убирает значения секретов из текста (на случай, если библиотека вставила их в ошибку) */
export function redact(text: string, config: Partial<ServerConfig>): string {
  let out = text;
  for (const v of [config.supabaseServiceRoleKey, config.anthropicApiKey]) {
    if (v && v.length >= 8) out = out.split(v).join('[скрыто]');
  }
  return out;
}
