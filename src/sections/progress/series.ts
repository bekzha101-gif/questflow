// Ряды для графиков «Прогресса»: часы фокуса и оценка дня по датам (Бишкек), доход по каналам.
import type { BigDataDay, FocusSession, Income } from '@shared/types';
import { addDays } from '@shared/time';
import { isWorkSessionOf } from '../today/daySummary';

/** n дат, заканчивая today (по возрастанию) */
export function lastDates(today: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));
}

/** Минуты фокуса по датам */
export function focusSeries(sessions: FocusSession[], dates: string[]): number[] {
  return dates.map((d) => sessions.filter((s) => isWorkSessionOf(s, d)).reduce((sum, s) => sum + (Number(s.minutes) || 0), 0));
}

/** Оценка дня 1–10 по датам; нет оценки — null */
export function scoreSeries(days: BigDataDay[], dates: string[]): (number | null)[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  return dates.map((d) => {
    const v = byDate.get(d)?.score;
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  });
}

/** Доход по каналам, USD, по убыванию суммы */
export function incomeByChannel(rows: Income[]): { channelId: string; total: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = r.channelId ?? '';
    m.set(k, Math.round(((m.get(k) ?? 0) + (Number(r.amountUsd) || 0)) * 100) / 100);
  }
  return [...m.entries()].map(([channelId, total]) => ({ channelId, total })).sort((a, b) => b.total - a.total);
}
