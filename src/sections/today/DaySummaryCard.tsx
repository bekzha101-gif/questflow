import type { FocusSession } from '@shared/types';
import { todayStr } from '@shared/time';
import { BLOCKS_PER_DAY } from '@shared/timer';
import { useCollection } from '../../store';
import { useNow } from '../../components/timer/useTimerState';
import { daySummary } from './daySummary';

// Карточка «Итог дня»: часы фокуса и над чем работал по блокам. Стоит над четырьмя колонками,
// раскладку колонок не меняет (CLAUDE.md п.16).
export function DaySummaryCard() {
  const sessions = useCollection<FocusSession>('focus_sessions').items;
  const today = todayStr(new Date(useNow(60_000)));
  const sum = daySummary(sessions, today);

  return (
    <section
      aria-label="Итог дня"
      className="shrink-0 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 sm:px-6 py-2 border-b border-white/[0.06] bg-[#0b0b0f] text-xs"
    >
      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Итог дня</span>
      <span className="font-mono text-zinc-100">{sum.hoursLabel}</span>
      <span className="text-zinc-500">
        блоков {sum.blocks.length} из {BLOCKS_PER_DAY}
      </span>
      {sum.blocks.length === 0 ? (
        <span className="text-zinc-600">Блоков сегодня ещё не было</span>
      ) : (
        <ol className="flex flex-wrap gap-x-4 gap-y-1 min-w-0">
          {sum.blocks.map((b, i) => (
            <li key={b.id} className="flex items-center gap-1.5 min-w-0 max-w-full">
              <span className="text-zinc-500 shrink-0">{b.blockIndex ?? i + 1}.</span>
              <span className="text-zinc-200 truncate max-w-[16rem]">{b.title}</span>
              <span className="font-mono text-zinc-500 shrink-0">{b.minutes} мин</span>
              <span className="text-zinc-400 shrink-0">· {b.resultLabel}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
