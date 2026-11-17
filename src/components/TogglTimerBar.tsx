import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Coffee, Eye, EyeOff, Flame, Pause, Play, Settings2, Square, Tag, Timer } from 'lucide-react';
import type { TaskItem, TimeLogEntry, Project } from '../types';
import type { FocusSession, Goal, GoalStep } from '@shared/types';
import { todayStr, isRecoveryDay } from '@shared/time';
import {
  BLOCKS_PER_DAY,
  BREAK_MIN,
  isStopwatch,
  blockRecord,
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
import { focusReward } from '@shared/gamification';
import { useCollection } from '../store';
import { playQuestCompleteSound, playCoinSound, playBreakBellSound, playWorkReadySound } from '../utils/sound';
import { triggerQuestConfetti } from '../utils/confetti';
import { sendDesktopNotification, requestDesktopNotificationPermission } from '../utils/recoveryCycle';
import { claimTimerEvent } from '../utils/timerStorage';
import { useNow, useTimerSettings, useTimerState } from './timer/useTimerState';
import { buildTargetGroups, parseTargetRef, resultUpdates, type BlockResultInput } from './timer/targets';
import { pendingResultSession } from './timer/sessions';
import { TaskPicker } from './timer/TaskPicker';
import { BlockResultModal } from './timer/BlockResultModal';
import { TimerSettingsPanel } from './timer/TimerSettingsPanel';

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

/** «2 ч», «1 ч 30 мин», «45 мин» */
function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} мин`;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Таймер дня (по умолчанию 120/20 × 3, длительности и секундомер — в настройках kv `timer_settings`).
// Состояние — timer_state в Supabase (переживает паузу, закрытие вкладки и браузера, видно с другого
// устройства); правила — shared/timer.ts. Управление только на сайте.
export const TogglTimerBar: React.FC<TogglTimerBarProps> = ({ tasks, onLogSession, onCompleteTask, isCalendarConnected = false }) => {
  const [state, commit] = useTimerState();
  const [settings, saveSettings] = useTimerSettings();
  const now = useNow();
  const today = todayStr(new Date(now));
  const view = computeTimer(state, now);

  const goalsStore = useCollection<Goal>('goals');
  const goals = goalsStore.items;
  const steps = useCollection<GoalStep>('goal_steps');
  const sessions = useCollection<FocusSession>('focus_sessions');
  const tasksStore = useCollection<TaskItem>('tasks2');

  const [pickerOpen, setPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
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
  /** Название блока: своё («Над чем вы работаете?») или по выбранной цели */
  const blockTitle = (s: { title?: string | null; taskId?: string | null }): string => s.title?.trim() || titleOf(s.taskId);

  // Окно настроек закрывается кликом мимо него
  useEffect(() => {
    if (!settingsOpen) return;
    const onDown = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [settingsOpen]);

  // ─── Конец блока работы: запись в focus_sessions; отсчёт — дальше отдых сам, секундомер — ожидание ─
  const finishWork = (at: number) => {
    const rec = blockRecord(state, at);
    const stopwatch = isStopwatch(state);
    if (!rec) return;
    commit(nextAfterExpire(state, at));
    setPeek(false);
    if (rec.minutes < 1 || !claimTimerEvent(`work:${rec.id}`)) return;
    if (sessions.items.some((s) => s.id === rec.id)) return;

    // Подпись награды; начисляет App через правила (shared/gamification)
    const reward = focusReward(rec.minutes, rec.full);
    const entry = {
      id: rec.id,
      title: blockTitle(state),
      mode: 'work',
      // У секундомера плана нет: «план» в календаре — сколько отработано
      targetMinutes: stopwatch ? rec.minutes : state.targetMin,
      timerType: stopwatch ? 'stopwatch' : 'countdown',
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
    if (!stopwatch) {
      playBreakBellSound();
      const breakMin = Number(state.breakMin) > 0 ? Number(state.breakMin) : BREAK_MIN;
      sendDesktopNotification('Пора на отдых', `Отдых ${breakMin} минут. Встань, разомнись, выпей воды.`, 'questflow-timer-rest');
    }
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

  const handlePick = (ref: string | null, name: string | null) => {
    setPickerOpen(false);
    if (state.phase === 'work') {
      commit({ ...state, taskId: ref, title: name });
      return;
    }
    if (!canStart) return;
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      void requestDesktopNotificationPermission();
    }
    setPeek(false);
    setSettingsOpen(false);
    commit(startBlock(state, Date.now(), { today, taskId: ref, settings, title: name }));
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
  const stopwatchRun = isStopwatch(state);
  const currentTitle = state.phase === 'idle' ? null : blockTitle(state);
  // Своё название и цель одновременно: цель показываем подсказкой
  const currentTarget = state.phase !== 'idle' && state.title?.trim() && state.taskId ? titleOf(state.taskId) : null;
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
    // Секундомер показывает прошедшее, отсчёт — оставшееся (на паузе — прошедшее)
    status = (
      <span className="font-mono text-sm font-semibold text-zinc-100">
        {formatClock(state.running && !stopwatchRun ? view.remainingSec : view.elapsedSec)}
        <span className="ml-1.5 font-sans text-[10px] uppercase text-zinc-500">
          {!state.running ? 'пауза' : stopwatchRun ? 'прошло' : 'осталось'}
        </span>
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

  const plan =
    settings.timerType === 'stopwatch'
      ? 'Секундомер: без лимита, «Стоп» запишет время'
      : `Работа ${formatMinutes(settings.workMin)}, затем отдых ${settings.breakMin} мин`;
  const sub =
    state.phase === 'work'
      ? `Слепой режим · ${stopwatchRun ? 'секундомер · ' : ''}${blockLabel(state.blockIndex)}`
      : state.phase === 'break' && !view.expired
        ? `Отдых ${state.targetMin} мин после блока ${state.blockIndex}`
        : normDone
          ? `${BLOCKS_PER_DAY} блока сделаны`
          : plan;

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
              title={peek ? 'Скрыть время (слепой режим)' : stopwatchRun ? 'Показать прошедшее время' : 'Показать оставшееся время'}
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
            title="Сменить название или цель блока"
          >
            <Tag className="w-3 h-3 text-zinc-500 shrink-0" />
            <span className="truncate">{currentTitle}</span>
            {currentTarget && <span className="truncate text-zinc-500">· {currentTarget}</span>}
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
              title={stopwatchRun ? 'Стоп: блок закончится, время запишется' : 'Закончить блок сейчас: время запишется, начнётся отдых'}
            >
              <Square className="w-3 h-3 fill-current" />
              <span className="hidden sm:inline">{stopwatchRun ? 'Стоп' : 'Завершить'}</span>
            </button>
          )}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                settingsOpen ? 'bg-white/[0.1] text-zinc-100' : 'bg-white/[0.05] hover:bg-white/[0.09] text-zinc-400 hover:text-zinc-200'
              }`}
              title="Настройка таймера: минуты фокуса и отдыха, секундомер"
              aria-label="Настройка таймера"
              aria-expanded={settingsOpen}
            >
              {settings.timerType === 'stopwatch' ? <Timer className="w-3.5 h-3.5" /> : <Settings2 className="w-3.5 h-3.5" />}
            </button>
            {settingsOpen && (
              <TimerSettingsPanel settings={settings} onChange={saveSettings} blockRunning={state.phase === 'work'} />
            )}
          </div>
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
          title={state.phase === 'work' ? `${blockLabel(state.blockIndex)}: название и цель` : startLabel}
          groups={groups}
          selectedRef={state.phase === 'work' ? (state.taskId ?? null) : null}
          initialName={state.phase === 'work' ? (state.title ?? '') : ''}
          editing={state.phase === 'work'}
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
