import React, { useEffect, useMemo, useState } from 'react';
import { Coffee, Eye, EyeOff, Flame, Pause, Play, Square, Tag } from 'lucide-react';
import type { TaskItem, TimeLogEntry, Project } from '../types';
import type { FocusSession, Goal, GoalStep } from '@shared/types';
import { todayStr, isRecoveryDay } from '@shared/time';
import {
  BLOCKS_PER_DAY,
  BREAK_MIN,
  blockRecord,
  blockReward,
  canStartBlock,
  cancelBlock,
  computeTimer,
  dayNormDone,
  formatWorked,
  nextAfterExpire,
  nextBlockNumber,
  pauseTimer,
  resumeTimer,
  startBlock,
} from '@shared/timer';
import { useCollection } from '../store';
import { playQuestCompleteSound, playCoinSound, playBreakBellSound, playWorkReadySound } from '../utils/sound';
import { triggerQuestConfetti } from '../utils/confetti';
import { sendDesktopNotification, requestDesktopNotificationPermission } from '../utils/recoveryCycle';
import { claimTimerEvent } from '../utils/timerStorage';
import { useNow, useTimerState } from './timer/useTimerState';
import { buildTargetGroups, parseTargetRef, resultUpdates, type BlockResultInput } from './timer/targets';
import { pendingResultSession } from './timer/sessions';
import { TaskPicker } from './timer/TaskPicker';
import { BlockResultModal } from './timer/BlockResultModal';

interface TogglTimerBarProps {
  tasks: TaskItem[];
  projects: Project[];
  onLogSession: (entry: TimeLogEntry) => void;
  onCompleteTask?: (taskId: string) => void;
  /** Больше не используется: в пятницу таймер закрыт без «разблокировки со штрафом» */
  onDamageHp?: (damageAmount: number, reason: string) => void;
  isCalendarConnected?: boolean;
}

/** Событие считается свежим (уведомлять), если случилось не раньше этого срока назад */
const FRESH_MS = 90_000;
/** Досрочное «Завершить» раньше минуты — отмена блока без записи */
const MIN_LOG_SEC = 60;

const blockLabel = (n: number) => `Блок ${n} из ${BLOCKS_PER_DAY}`;

function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Таймер дня 120/20 × 3. Состояние — timer_state в Supabase (переживает паузу, закрытие вкладки
// и браузера, видно с другого устройства); правила — shared/timer.ts. Управление только на сайте.
export const TogglTimerBar: React.FC<TogglTimerBarProps> = ({ tasks, onLogSession, onCompleteTask, isCalendarConnected = false }) => {
  const [state, commit] = useTimerState();
  const now = useNow();
  const today = todayStr(new Date(now));
  const view = computeTimer(state, now);

  const goalsStore = useCollection<Goal>('goals');
  const goals = goalsStore.items;
  const steps = useCollection<GoalStep>('goal_steps');
  const sessions = useCollection<FocusSession>('focus_sessions');
  const tasksStore = useCollection<TaskItem>('tasks2');

  const [pickerOpen, setPickerOpen] = useState(false);
  const [peek, setPeek] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Блоки, закончившиеся при закрытом сайте (для подписи в окне отметки)
  const [closedBlocks, setClosedBlocks] = useState<string[]>([]);

  const groups = useMemo(
    () => buildTargetGroups({ tasks, steps: steps.items, goals, today }),
    [tasks, steps.items, goals, today],
  );

  const titleOf = (ref: string | null | undefined): string => {
    const t = parseTargetRef(ref);
    if (!t) return 'Без задачи';
    if (t.kind === 'task') return tasks.find((x) => x.id === t.id)?.title ?? 'Задача';
    if (t.kind === 'step') return steps.items.find((x) => x.id === t.id)?.title ?? 'Шаг недели';
    return goals.find((x) => x.id === t.id)?.title ?? 'Цель месяца';
  };

  // ─── Конец блока работы: запись в focus_sessions, отдых 20 мин сам ─────────────
  const finishWork = (at: number) => {
    const rec = blockRecord(state, at);
    if (!rec) return;
    commit(nextAfterExpire(state, at));
    setPeek(false);
    if (rec.minutes < 1 || !claimTimerEvent(`work:${rec.id}`)) return;
    if (sessions.items.some((s) => s.id === rec.id)) return;

    const reward = blockReward(rec.minutes, rec.full);
    const entry = {
      id: rec.id,
      title: titleOf(rec.taskId),
      mode: 'work',
      targetMinutes: state.targetMin,
      actualMinutes: rec.minutes,
      startedAt: rec.startedAt,
      completedAt: rec.endedAt,
      taskId: rec.taskId ?? undefined,
      expEarned: reward.exp,
      goldEarned: reward.gold,
      blockIndex: rec.blockIndex,
    } as TimeLogEntry;
    onLogSession(entry);

    const worked = formatWorked(rec.minutes * 60);
    setNotice(`Отработано: ${worked}`);
    window.setTimeout(() => setNotice(null), 10_000);

    const fresh = at - Date.parse(rec.endedAt) < FRESH_MS;
    if (!fresh) {
      setClosedBlocks((prev) => [...prev, rec.id]);
      return;
    }
    if (rec.full) {
      playQuestCompleteSound();
      triggerQuestConfetti();
    }
    playCoinSound();
    playBreakBellSound();
    sendDesktopNotification('Пора на отдых', `Отдых ${BREAK_MIN} минут. Встань, разомнись, выпей воды.`, 'questflow-timer-rest');
    sendDesktopNotification(`Ты проработал ${worked}`, `${blockLabel(rec.blockIndex)} записан.`, 'questflow-timer-worked');
  };

  // Тик: истёкшая работа переходит в отдых (и при открытии сайта после закрытия — по факту)
  const expiredWork = state.phase === 'work' && view.expired;
  useEffect(() => {
    if (expiredWork) finishWork(now);
  });

  // Конец отдыха: уведомление один раз; работа сама не стартует
  const breakOver = state.phase === 'break' && view.expired;
  const nextBlock = nextBlockNumber(state, today);
  useEffect(() => {
    if (!breakOver || !state.startedAt) return;
    const endMs = Date.parse(state.startedAt) + (state.targetMin * 60 - state.accumulatedSec) * 1000;
    if (now - endMs > FRESH_MS || !claimTimerEvent(`break:${state.startedAt}`)) return;
    playWorkReadySound();
    sendDesktopNotification(
      'Отдых закончился',
      nextBlock <= BLOCKS_PER_DAY ? `Можно начинать ${blockLabel(nextBlock).toLowerCase()}.` : 'Норма дня выполнена.',
      'questflow-timer-break',
    );
  }, [breakOver, state.startedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Сигнал для расширения Brain.fm: музыка только пока идёт фокус (CLAUDE.md п.13)
  const isFocusRunning = state.phase === 'work' && state.running && !view.expired;
  useEffect(() => {
    document.documentElement.dataset.questflowFocus = isFocusRunning ? 'on' : 'off';
    window.dispatchEvent(new CustomEvent('questflow:focus', { detail: { playing: isFocusRunning } }));
  }, [isFocusRunning]);

  // ─── Действия ───────────────────────────────────────────────────────────────
  const recovery = isRecoveryDay(today);
  const canStart = canStartBlock(state, today);

  const handlePick = (ref: string | null) => {
    setPickerOpen(false);
    if (state.phase === 'work') {
      commit({ ...state, taskId: ref });
      return;
    }
    if (!canStart) return;
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      void requestDesktopNotificationPermission();
    }
    setPeek(false);
    commit(startBlock(state, Date.now(), { today, taskId: ref }));
  };

  const handlePauseResume = () => {
    const t = Date.now();
    commit(state.running ? pauseTimer(state, t) : resumeTimer(state, t));
  };

  const handleFinishEarly = () => {
    if (state.phase !== 'work') return;
    if (computeTimer(state, Date.now()).elapsedSec < MIN_LOG_SEC) commit(cancelBlock(state));
    else finishWork(Date.now());
  };

  // ─── Отметка блока: готово / процент / бросил ───────────────────────────────
  const pending = state.phase === 'work' ? null : pendingResultSession(sessions.items, today);

  const applyResult = (input: BlockResultInput) => {
    if (!pending) return;
    sessions.upsert({
      ...pending,
      result: input.result,
      progressPct: input.result === 'done' ? 100 : input.progressPct,
      dropReason: input.dropReason,
    });
    const target = parseTargetRef(pending.taskId);
    if (!target) return;
    if (target.kind === 'task') {
      const task = tasksStore.items.find((t) => t.id === target.id);
      if (!task) return;
      const upd = resultUpdates('task', input);
      if (Object.keys(upd.patch).length) tasksStore.upsert({ ...task, ...upd.patch });
      if (upd.complete && !task.completed) onCompleteTask?.(task.id);
    } else if (target.kind === 'step') {
      const step = steps.items.find((s) => s.id === target.id);
      const upd = resultUpdates('step', input);
      if (step && Object.keys(upd.patch).length) steps.upsert({ ...step, ...upd.patch });
    } else {
      const goal = goals.find((g) => g.id === target.id);
      const upd = resultUpdates('goal', input, goal);
      if (goal && Object.keys(upd.patch).length) goalsStore.upsert({ ...goal, ...upd.patch });
    }
  };

  const skipResult = () => {
    if (pending) sessions.upsert({ ...pending, resultSkipped: true });
  };

  // ─── Вид ────────────────────────────────────────────────────────────────────
  const normDone = dayNormDone(state, today);
  const doneBlocks = state.date === today ? (state.phase === 'work' ? state.blockIndex - 1 : state.blockIndex) : 0;
  const currentTitle = state.phase === 'idle' ? null : titleOf(state.taskId);
  const startLabel = normDone ? 'Ещё блок' : `Начать ${blockLabel(nextBlock).toLowerCase()}`;

  const dots = (
    <div className="flex items-center gap-1" aria-label={`Блоков сегодня: ${Math.max(0, doneBlocks)} из ${BLOCKS_PER_DAY}`}>
      {Array.from({ length: BLOCKS_PER_DAY }, (_, i) => {
        const n = i + 1;
        const cls =
          n <= doneBlocks
            ? 'bg-emerald-400'
            : state.phase === 'work' && state.date === today && n === state.blockIndex
              ? 'bg-emerald-400/40'
              : 'bg-white/[0.08]';
        return <i key={n} className={`block w-5 h-1.5 rounded-full ${cls}`} />;
      })}
    </div>
  );

  let status: React.ReactNode;
  if (state.phase === 'work' && state.running && !peek) {
    status = (
      <span className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        <span className="text-sm font-semibold text-zinc-100">Работает</span>
      </span>
    );
  } else if (state.phase === 'work') {
    status = (
      <span className="font-mono text-sm font-semibold text-zinc-100">
        {formatClock(state.running ? view.remainingSec : view.elapsedSec)}
        <span className="ml-1.5 font-sans text-[10px] uppercase text-zinc-500">{state.running ? 'осталось' : 'пауза'}</span>
      </span>
    );
  } else if (state.phase === 'break' && !view.expired) {
    status = (
      <span className="font-mono text-sm font-semibold text-emerald-300">
        {formatClock(view.remainingSec)}
        <span className="ml-1.5 font-sans text-[10px] uppercase text-zinc-500">{state.running ? 'отдых' : 'отдых, пауза'}</span>
      </span>
    );
  } else if (state.phase === 'break') {
    status = <span className="text-sm font-semibold text-zinc-100">{normDone ? 'Норма дня выполнена' : 'Отдых закончился'}</span>;
  } else {
    status = <span className="text-sm font-semibold text-zinc-100">{normDone ? 'Норма дня выполнена' : blockLabel(nextBlock)}</span>;
  }

  const sub =
    state.phase === 'work'
      ? `Слепой режим · ${blockLabel(state.blockIndex)}`
      : state.phase === 'break' && !view.expired
        ? `Отдых ${BREAK_MIN} мин после блока ${state.blockIndex}`
        : normDone
          ? `${BLOCKS_PER_DAY} блока по 2 ч сделаны`
          : 'Работа 2 ч, затем отдых 20 мин';

  if (recovery && state.phase !== 'work') {
    return (
      <div className="w-full border-b border-white/[0.07] bg-[#0e0e13] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center gap-3">
          <Coffee className="w-4 h-4 text-rose-300 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-semibold text-rose-200">Пятница — день восстановления</div>
            <div className="text-[11px] text-zinc-400">Таймер выключен. Сегодня день отдыха: уберите гаджеты и идите в баню.</div>
          </div>
        </div>
      </div>
    );
  }

  const isBreak = state.phase === 'break' && !view.expired;
  return (
    <div className={`w-full border-b sticky top-0 z-30 ${isBreak ? 'bg-[#0c1410] border-emerald-500/20' : 'bg-[#0e0e13] border-white/[0.07]'}`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2 shrink-0">
          {isBreak ? <Coffee className="w-4 h-4 text-emerald-300" /> : <Flame className="w-4 h-4 text-zinc-400" />}
          {status}
          {state.phase === 'work' && state.running && (
            <button
              onClick={() => setPeek(!peek)}
              className="p-1 rounded-lg text-zinc-500 hover:text-zinc-200"
              title={peek ? 'Скрыть время (слепой режим)' : 'Показать оставшееся время'}
              aria-label={peek ? 'Скрыть время' : 'Показать время'}
            >
              {peek ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-3 min-w-0 flex-1">
          {dots}
          <span className="text-[11px] text-zinc-500 truncate">{sub}</span>
        </div>

        {currentTitle && (
          <button
            onClick={() => setPickerOpen(true)}
            className="order-last sm:order-none basis-full sm:basis-auto flex items-center gap-1.5 min-w-0 max-w-full sm:max-w-xs px-2.5 py-1 rounded-xl bg-white/[0.03] border border-white/[0.07] text-xs text-zinc-300 hover:border-white/[0.14]"
            title="Сменить задачу блока"
          >
            <Tag className="w-3 h-3 text-zinc-500 shrink-0" />
            <span className="truncate">{currentTitle}</span>
          </button>
        )}

        {notice && <span className="text-[11px] font-medium text-emerald-300">{notice}</span>}

        <div className="ml-auto flex items-center gap-2 shrink-0">
          {state.phase !== 'idle' && !(state.phase === 'break' && view.expired) && (
            <button
              onClick={handlePauseResume}
              className="w-8 h-8 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-zinc-200 flex items-center justify-center"
              title={state.running ? 'Пауза' : 'Продолжить'}
              aria-label={state.running ? 'Пауза' : 'Продолжить'}
            >
              {state.running ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
            </button>
          )}
          {state.phase === 'work' && (
            <button
              onClick={handleFinishEarly}
              className="h-8 px-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-xs text-zinc-300 flex items-center gap-1.5"
              title="Закончить блок сейчас: время запишется, начнётся отдых"
            >
              <Square className="w-3 h-3 fill-current" />
              <span className="hidden sm:inline">Завершить</span>
            </button>
          )}
          {state.phase !== 'work' && (
            <button
              onClick={() => setPickerOpen(true)}
              disabled={!canStart}
              className={`h-8 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 ${
                isBreak ? 'bg-white/[0.06] text-zinc-200 hover:bg-white/[0.1]' : 'bg-zinc-100 text-zinc-950 hover:bg-white'
              }`}
            >
              <Play className="w-3 h-3 fill-current" />
              {startLabel}
            </button>
          )}
          {isCalendarConnected && <span className="w-2 h-2 rounded-full bg-blue-500" title="Google Календарь подключён к таймеру" />}
        </div>
      </div>

      {pickerOpen && (
        <TaskPicker
          title={state.phase === 'work' ? `${blockLabel(state.blockIndex)}: сменить задачу` : startLabel}
          groups={groups}
          selectedRef={state.taskId ?? null}
          onPick={handlePick}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {pending && !pickerOpen && (
        <BlockResultModal
          blockLabel={typeof pending.blockIndex === 'number' ? blockLabel(pending.blockIndex) : 'Блок'}
          workedLabel={formatWorked((Number(pending.minutes) || 0) * 60)}
          title={typeof pending.title === 'string' && pending.title ? pending.title : titleOf(pending.taskId)}
          whileClosed={closedBlocks.includes(pending.id)}
          onSave={applyResult}
          onSkip={skipResult}
        />
      )}
    </div>
  );
};
