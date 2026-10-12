import { TimeLogEntry } from '../types';
import { getTodayStr } from './recoveryCycle';

// План дня: норма блоков фокуса, главная задача и строка «ради чего»

export const BLOCK_MINUTES = 120; // один блок глубокой работы
export const DAILY_BLOCK_GOAL = 3; // норма дня, выбрана пользователем: 3 блока = 6 часов

const MAIN_TASK_KEY = 'questflow_main_task_v1'; // { date: 'YYYY-MM-DD', taskId }
const PURPOSE_KEY = 'questflow_purpose_v1';

function localDateStr(date: Date): string {
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

// Сколько минут фокуса записано за сегодня (по местному времени)
export function getFocusMinutesToday(timeLogs: TimeLogEntry[]): number {
  const today = getTodayStr();
  return timeLogs
    .filter((log) => log.mode === 'work' && localDateStr(new Date(log.completedAt)) === today)
    .reduce((sum, log) => sum + (log.actualMinutes || 0), 0);
}

export function formatFocusMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}м`;
  return `${hours}ч ${rest.toString().padStart(2, '0')}м`;
}

// Главная задача выбирается на один день: на следующий день выбор сбрасывается
export function loadMainTaskId(): string | null {
  try {
    const raw = localStorage.getItem(MAIN_TASK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.date === getTodayStr() ? parsed.taskId : null;
  } catch {
    return null;
  }
}

export function saveMainTaskId(taskId: string | null): void {
  try {
    if (taskId) {
      localStorage.setItem(MAIN_TASK_KEY, JSON.stringify({ date: getTodayStr(), taskId }));
    } else {
      localStorage.removeItem(MAIN_TASK_KEY);
    }
  } catch (e) {
    console.error('Failed to save main task:', e);
  }
}

export function loadPurpose(): string {
  try {
    return localStorage.getItem(PURPOSE_KEY) || '';
  } catch {
    return '';
  }
}

export function savePurpose(text: string): void {
  try {
    localStorage.setItem(PURPOSE_KEY, text);
  } catch (e) {
    console.error('Failed to save purpose:', e);
  }
}
