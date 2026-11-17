// Единое время приложения: все «сегодня», «утро», «вечер», «пятница» — по Бишкеку.
// Нигде не использовать toISOString().split('T')[0] для «сегодня» — это UTC.
// Модуль чистый: без React и сети, общий для сайта и сервера.

export const APP_TZ = 'Asia/Bishkek';

/** Номер дня недели пятницы (0 — воскресенье): день полного восстановления */
export const RECOVERY_WEEKDAY = 5;

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: APP_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function bishkekParts(now: Date): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of partsFormatter.formatToParts(now)) out[p.type] = p.value;
  return out;
}

/** Сегодняшняя дата YYYY-MM-DD по Бишкеку */
export function todayStr(now: Date = new Date()): string {
  const p = bishkekParts(now);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Часы и минуты по Бишкеку */
export function bishkekHM(now: Date = new Date()): { h: number; m: number } {
  const p = bishkekParts(now);
  return { h: Number(p.hour) % 24, m: Number(p.minute) };
}

function parseDate(dateStr: string): number {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function formatUTC(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** День недели календарной даты: 0 — воскресенье … 6 — суббота */
export function dayOfWeek(dateStr: string): number {
  return new Date(parseDate(dateStr)).getUTCDay();
}

/** Пятница — день восстановления */
export function isRecoveryDay(dateStr: string): boolean {
  return dayOfWeek(dateStr) === RECOVERY_WEEKDAY;
}

/** Сдвиг календарной даты на n дней */
export function addDays(dateStr: string, n: number): string {
  return formatUTC(parseDate(dateStr) + n * 86_400_000);
}

/** Понедельник недели, в которую входит дата */
export function weekStart(dateStr: string): string {
  const dow = dayOfWeek(dateStr);
  return addDays(dateStr, -((dow + 6) % 7));
}

/** Ключ месяца 'YYYY-MM' */
export function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}
