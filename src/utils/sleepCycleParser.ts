// Sleep Cycle CSV → сон по дням Big Data (bigdata_days: sleep_min, sleep_quality).
// Формат экспорта Sleep Cycle: разделитель «;», колонки Start;End;Sleep quality;...;
// длительность — «Asleep (seconds)» / «Time in bed (seconds)» (новый экспорт) или «Time in bed» как «7:35» (старый).
// Ночь относится к дате пробуждения (End). Время в файле — местное время телефона; если в строке есть
// часовой пояс (Z или +06:00), дата считается по Бишкеку через shared/time.ts.
// Ничего не выдумываем: нет длительности — ночь пропускается, нет качества — качество не пишется.
import { todayStr } from '@shared/time';
import type { BigDataDay } from '@shared/types';

/** Одна ночь из файла */
export interface SleepCycleNight {
  /** Дата дня Big Data (YYYY-MM-DD) — день пробуждения */
  date: string;
  start: string;
  end: string;
  sleepMin: number;
  /** Качество сна, % (если было в файле) */
  sleepQuality?: number;
}

/** Разбить строку CSV с учётом кавычек */
function splitRow(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === delimiter && !quoted) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/** Дата дня из отметки времени Sleep Cycle */
export function sleepCycleDate(stamp: string): string | null {
  const s = stamp.trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  // Есть часовой пояс — переводим в Бишкек; нет — это уже местное время, берём дату как есть
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
    const d = new Date(s.replace(' ', 'T'));
    if (!Number.isNaN(d.getTime())) return todayStr(d);
  }
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** «7:35» / «7:35:10» → минуты */
function hmToMin(v: string): number | undefined {
  const p = v.split(':').map((x) => Number(x));
  if (p.length < 2 || p.some((x) => !Number.isFinite(x))) return undefined;
  return p[0] * 60 + p[1] + (p[2] ? Math.round(p[2] / 60) : 0);
}

function num(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number(v.replace('%', '').replace(',', '.').trim());
  return Number.isFinite(n) ? n : undefined;
}

/** Минуты из пары отметок времени (если длительности в файле нет) */
function diffMin(start: string, end: string): number | undefined {
  const a = new Date(start.trim().replace(' ', 'T'));
  const b = new Date(end.trim().replace(' ', 'T'));
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return undefined;
  const d = Math.round((b.getTime() - a.getTime()) / 60000);
  return d > 0 ? d : undefined;
}

/** Разобрать CSV Sleep Cycle. Несколько записей на одну дату (дневной сон) складываются. */
export function parseSleepCycleCsv(csvText: string): SleepCycleNight[] {
  const lines = csvText
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = splitRow(lines[0], delimiter).map((h) => h.toLowerCase());
  const col = (...names: string[]) => headers.findIndex((h) => names.some((n) => h === n || h.startsWith(n)));

  const iStart = col('start', 'начало');
  const iEnd = col('end', 'конец');
  const iQuality = col('sleep quality', 'качество');
  const iAsleepSec = col('asleep (seconds)');
  const iBedSec = col('time in bed (seconds)');
  const iBed = headers.findIndex((h) => h === 'time in bed' || h === 'время в постели');
  if (iStart < 0 || iEnd < 0) return [];

  const byDate = new Map<string, SleepCycleNight & { longest: number }>();
  for (const line of lines.slice(1)) {
    const c = splitRow(line, delimiter);
    const start = c[iStart] ?? '';
    const end = c[iEnd] ?? '';
    const date = sleepCycleDate(end) ?? sleepCycleDate(start);
    if (!date) continue;

    const asleep = iAsleepSec >= 0 ? num(c[iAsleepSec]) : undefined;
    const bedSec = iBedSec >= 0 ? num(c[iBedSec]) : undefined;
    const bed = iBed >= 0 && c[iBed] ? hmToMin(c[iBed]) : undefined;
    const minutes =
      asleep && asleep > 0 ? Math.round(asleep / 60) : bedSec && bedSec > 0 ? Math.round(bedSec / 60) : bed && bed > 0 ? bed : diffMin(start, end);
    if (!minutes || minutes <= 0) continue;

    const q = iQuality >= 0 ? num(c[iQuality]) : undefined;
    const quality = q !== undefined && q >= 0 && q <= 100 ? Math.round(q) : undefined;

    const prev = byDate.get(date);
    if (!prev) {
      byDate.set(date, { date, start, end, sleepMin: minutes, ...(quality !== undefined ? { sleepQuality: quality } : {}), longest: minutes });
    } else {
      // Качество — от самой длинной записи за дату
      const longer = minutes > prev.longest;
      byDate.set(date, {
        ...prev,
        sleepMin: prev.sleepMin + minutes,
        longest: Math.max(prev.longest, minutes),
        ...(longer && quality !== undefined ? { sleepQuality: quality } : {}),
      });
    }
  }
  return [...byDate.values()]
    .map(({ longest: _longest, ...n }) => n)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Что запишет импорт */
export interface SleepImportPlan {
  /** Дни, которые можно записать без вопросов (сна в дне ещё нет) */
  fresh: { date: string; sleepMin: number; sleepQuality?: number }[];
  /** Дни, где сон уже заполнен вручную другими значениями — только после подтверждения */
  conflicts: { date: string; sleepMin: number; sleepQuality?: number; currentMin?: number; currentQuality?: number }[];
  /** Дни, где в дне уже те же значения */
  same: string[];
}

/** Сравнить ночи из файла с днями Big Data */
export function planSleepImport(nights: SleepCycleNight[], days: BigDataDay[]): SleepImportPlan {
  const byDate = new Map(days.filter((d) => d && typeof d.date === 'string').map((d) => [d.date, d]));
  const plan: SleepImportPlan = { fresh: [], conflicts: [], same: [] };
  for (const n of nights) {
    const d = byDate.get(n.date);
    const curMin = d?.sleepMin && d.sleepMin > 0 ? d.sleepMin : undefined;
    const curQ = typeof d?.sleepQuality === 'number' ? d.sleepQuality : undefined;
    const item = { date: n.date, sleepMin: n.sleepMin, ...(n.sleepQuality !== undefined ? { sleepQuality: n.sleepQuality } : {}) };
    if (curMin === undefined && curQ === undefined) plan.fresh.push(item);
    else if (curMin === n.sleepMin && (n.sleepQuality === undefined || curQ === n.sleepQuality)) plan.same.push(n.date);
    else plan.conflicts.push({ ...item, currentMin: curMin, currentQuality: curQ });
  }
  return plan;
}

/** Записи для bigdata_days и итог «добавлено N, пропущено M» */
export function applySleepImport(
  plan: SleepImportPlan,
  overwrite: boolean,
): { writes: { date: string; patch: Partial<BigDataDay> }[]; added: number; skipped: number } {
  const rows = overwrite ? [...plan.fresh, ...plan.conflicts] : plan.fresh;
  const writes = rows.map((r) => ({
    date: r.date,
    patch: { sleepMin: r.sleepMin, ...(r.sleepQuality !== undefined ? { sleepQuality: r.sleepQuality } : {}) } as Partial<BigDataDay>,
  }));
  return { writes, added: writes.length, skipped: plan.same.length + (overwrite ? 0 : plan.conflicts.length) };
}
