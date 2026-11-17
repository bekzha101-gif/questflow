// «Итог дня»: сколько часов фокуса и над чем — по строкам focus_sessions за день (по Бишкеку).
import type { FocusSession } from '@shared/types';
import { formatWorked } from '@shared/timer';

export interface DayBlock {
  id: string;
  blockIndex: number | null;
  title: string;
  minutes: number;
  resultLabel: string;
}

export interface DaySummary {
  totalMin: number;
  hoursLabel: string;
  blocks: DayBlock[];
}

/** Строка блока работы за день: без отдыха и удалённых */
export function isWorkSessionOf(s: FocusSession, date: string): boolean {
  return s.date === date && s.mode !== 'break' && !s.deleted;
}

function resultLabel(s: FocusSession): string {
  if (s.result === 'done') return 'готово';
  if (s.result === 'partial') return `${Number(s.progressPct) || 0}%`;
  if (s.result === 'dropped') return s.dropReason ? `бросил: ${s.dropReason}` : 'бросил';
  return 'без отметки';
}

export function daySummary(sessions: FocusSession[], today: string): DaySummary {
  const work = sessions
    .filter((s) => isWorkSessionOf(s, today))
    .sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)));
  const totalMin = work.reduce((sum, s) => sum + (Number(s.minutes) || 0), 0);
  return {
    totalMin,
    hoursLabel: formatWorked(totalMin * 60),
    blocks: work.map((s) => ({
      id: s.id,
      blockIndex: typeof s.blockIndex === 'number' ? s.blockIndex : null,
      title: typeof s.title === 'string' && s.title.trim() ? s.title : 'Без задачи',
      minutes: Number(s.minutes) || 0,
      resultLabel: resultLabel(s),
    })),
  };
}
