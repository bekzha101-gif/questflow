import { Target, Timer } from 'lucide-react';
import type { TaskItem, TimeLogEntry } from '../../types';
import { todayStr, isRecoveryDay } from '@shared/time';
import { BLOCKS_PER_DAY, computeTimer, dayNormDone, nextBlockNumber } from '@shared/timer';
import { pickMainTask, focusHoursToday, FOCUS_HOURS_NORM } from './mainTask';
import { useNow, useTimerState } from '../../components/timer/useTimerState';

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Состояние таймера для строки (timer_state). Сам таймер живёт в TogglTimerBar над экраном.
function useTimerLabel(): string {
  const [state] = useTimerState();
  const now = useNow();
  const today = todayStr(new Date(now));
  const v = computeTimer(state, now);
  if (state.phase === 'work') {
    // Во время работы цифры скрыты («слепой фокус», CLAUDE.md п.5)
    return state.running ? `Фокус идёт · блок ${state.blockIndex} из ${BLOCKS_PER_DAY}` : 'Фокус на паузе';
  }
  if (state.phase === 'break' && !v.expired) return `Отдых ${formatClock(v.remainingSec)}`;
  if (isRecoveryDay(today)) return 'Пятница: восстановление';
  if (dayNormDone(state, today)) return 'Норма дня выполнена';
  return `Блок ${nextBlockNumber(state, today)} из ${BLOCKS_PER_DAY} не начат`;
}

function formatHours(h: number): string {
  return String(Math.round(h * 10) / 10).replace('.', ',');
}

// Строка над четырьмя колонками: главная задача дня · таймер · часы фокуса сегодня / 6
export function FocusStrip({ tasks, timeLogs }: { tasks: TaskItem[]; timeLogs: TimeLogEntry[] }) {
  const today = todayStr();
  const main = pickMainTask(tasks, today);
  const hours = focusHoursToday(timeLogs, today);
  const timerLabel = useTimerLabel();
  const pct = Math.min(100, Math.round((hours / FOCUS_HOURS_NORM) * 100));

  return (
    <div
      aria-label="Главная задача, таймер и часы фокуса"
      className="shrink-0 flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 sm:px-6 py-2 border-b border-white/[0.06] bg-[#0b0b0f]"
    >
      <div className="flex items-center gap-2 min-w-0 flex-1 basis-56">
        <Target className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 shrink-0">Главная задача</span>
        <span className={`text-sm truncate ${main ? 'text-zinc-100 font-medium' : 'text-zinc-500'}`}>
          {main ? main.title : 'Не выбрана: добавь задачу'}
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-zinc-300">
        <Timer className="w-3.5 h-3.5 text-zinc-500" />
        <span>{timerLabel}</span>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="text-zinc-500">Фокус</span>
        <span className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <span className="block h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
        </span>
        <span className="font-mono text-zinc-200">
          {formatHours(hours)} / {FOCUS_HOURS_NORM} ч
        </span>
      </div>
    </div>
  );
}
