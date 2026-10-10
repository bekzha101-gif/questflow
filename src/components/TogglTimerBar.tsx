import React, { useState, useEffect, useRef } from 'react';
import { TaskItem, TimeLogEntry, Project } from '../types';
import { 
  Play, 
  Pause, 
  Square, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Flame, 
  Coffee, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  Calendar, 
  Check, 
  Settings2,
  Tag
} from 'lucide-react';
import { playQuestCompleteSound, playCoinSound } from '../utils/sound';
import { triggerQuestConfetti } from '../utils/confetti';
import { loadRecoveryCycleConfig, getDayCycleInfo, getTodayStr } from '../utils/recoveryCycle';

interface TogglTimerBarProps {
  tasks: TaskItem[];
  projects: Project[];
  onLogSession: (entry: TimeLogEntry) => void;
  onCompleteTask?: (taskId: string) => void;
  onDamageHp?: (damageAmount: number, reason: string) => void;
  isCalendarConnected?: boolean;
}

type TimerMode = 'work' | 'break';
type AmbientSound = 'none' | 'brown' | 'gamma' | 'alpha';

export const TogglTimerBar: React.FC<TogglTimerBarProps> = ({
  tasks,
  projects,
  onLogSession,
  onCompleteTask,
  onDamageHp,
  isCalendarConnected = false,
}) => {
  // Check if today is recovery detox day (7+1 cycle)
  const todayStr = getTodayStr();
  const recoveryConfig = loadRecoveryCycleConfig();
  const cycleInfo = getDayCycleInfo(todayStr, recoveryConfig);
  const isDetoxDay = cycleInfo.isRecoveryDay;
  const [isUnlockedForDetox, setIsUnlockedForDetox] = useState(false);

  // Timer Mode: work (default 120m) vs break (default 20m)
  const [mode, setMode] = useState<TimerMode>('work');
  
  // Custom configurable durations in minutes
  const [workDuration, setWorkDuration] = useState<number>(() => {
    const saved = localStorage.getItem('questflow_timer_work_duration');
    return saved ? parseInt(saved, 10) : 120;
  });
  const [breakDuration, setBreakDuration] = useState<number>(() => {
    const saved = localStorage.getItem('questflow_timer_break_duration');
    return saved ? parseInt(saved, 10) : 20;
  });

  // Target duration based on current mode
  const currentTargetMinutes = mode === 'work' ? workDuration : breakDuration;

  // Active activity title and selected task
  const [title, setTitle] = useState(() => {
    return localStorage.getItem('questflow_timer_title') || 'Подчесать всю тетрадь, исправить и внедрить все идеи.';
  });
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(() => {
    return localStorage.getItem('questflow_timer_selected_task_id') || 'task-notebook-ideas';
  });
  const [isTaskDropdownOpen, setIsTaskDropdownOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('questflow_timer_title', title);
  }, [title]);

  useEffect(() => {
    if (selectedTaskId) {
      localStorage.setItem('questflow_timer_selected_task_id', selectedTaskId);
    }
  }, [selectedTaskId]);

  // Time state
  const [timeLeft, setTimeLeft] = useState(currentTargetMinutes * 60);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);

  // Countdown vs Stopwatch mode
  const [timerType, setTimerType] = useState<'countdown' | 'stopwatch'>('countdown');

  // Ambient sound
  const [ambientSound, setAmbientSound] = useState<AmbientSound>('none');
  const audioCtxRef = useRef<AudioContext | null>(null);
  const soundNodeRef = useRef<{ osc?: OscillatorNode; gain?: GainNode; noise?: AudioNode } | null>(null);

  // Save durations to localStorage
  useEffect(() => {
    localStorage.setItem('questflow_timer_work_duration', workDuration.toString());
  }, [workDuration]);

  useEffect(() => {
    localStorage.setItem('questflow_timer_break_duration', breakDuration.toString());
  }, [breakDuration]);

  // Reset timer when target duration changes while idle
  useEffect(() => {
    if (!isRunning) {
      setTimeLeft(currentTargetMinutes * 60);
      setElapsedSeconds(0);
    }
  }, [currentTargetMinutes, mode, isRunning]);

  // ─── Web Audio API Soundscape Synthesizer ──────────────────────────────────
  const startAmbientSound = (type: AmbientSound) => {
    stopAmbientSound();
    if (type === 'none') return;

    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.12, ctx.currentTime);
      masterGain.connect(ctx.destination);

      if (type === 'gamma' || type === 'alpha') {
        const offset = type === 'gamma' ? 40 : 10;
        const oscLeft = ctx.createOscillator();
        const oscRight = ctx.createOscillator();
        const merger = ctx.createChannelMerger(2);

        oscLeft.frequency.setValueAtTime(216, ctx.currentTime);
        oscRight.frequency.setValueAtTime(216 + offset, ctx.currentTime);

        oscLeft.type = 'sine';
        oscRight.type = 'sine';

        oscLeft.connect(merger, 0, 0);
        oscRight.connect(merger, 0, 1);
        merger.connect(masterGain);

        oscLeft.start();
        oscRight.start();

        soundNodeRef.current = { osc: oscLeft, gain: masterGain };
      } else if (type === 'brown') {
        const bufferSize = ctx.sampleRate * 2;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          output[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = output[i];
          output[i] *= 3.5;
        }

        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, ctx.currentTime);

        whiteNoise.connect(filter);
        filter.connect(masterGain);
        whiteNoise.start();

        soundNodeRef.current = { gain: masterGain, noise: whiteNoise };
      }
    } catch {
      // Audio context policy fallback
    }
  };

  const stopAmbientSound = () => {
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch {}
      audioCtxRef.current = null;
      soundNodeRef.current = null;
    }
  };

  // Timer Tick Effect
  useEffect(() => {
    let interval: any = null;
    if (isRunning) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);

        if (timerType === 'countdown') {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              // Timer finished!
              handleFinishSession(true);
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isRunning, timerType, mode]);

  // Handle Play/Pause
  const handleTogglePlay = () => {
    if (!isRunning) {
      if (!sessionStartTime) {
        setSessionStartTime(new Date());
      }
      setIsRunning(true);
      if (ambientSound !== 'none') {
        startAmbientSound(ambientSound);
      }
    } else {
      setIsRunning(false);
      stopAmbientSound();
    }
  };

  // Handle Switch Mode (Work <-> Break)
  const handleSwitchMode = (newMode: TimerMode) => {
    if (isRunning) {
      // Promptly save current session before switching
      handleFinishSession(false);
    }
    setMode(newMode);
    const targetMin = newMode === 'work' ? workDuration : breakDuration;
    setTimeLeft(targetMin * 60);
    setElapsedSeconds(0);
    setIsRunning(false);
    setSessionStartTime(null);
  };

  // Finish and Log Session into Calendar
  const handleFinishSession = (isNaturalCompletion: boolean) => {
    setIsRunning(false);
    stopAmbientSound();

    const actualMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
    const now = new Date();
    const startTime = sessionStartTime || new Date(now.getTime() - actualMinutes * 60 * 1000);

    const isWork = mode === 'work';
    const sessionTitle = title.trim() || (isWork ? 'Фокус-работа' : 'Перерыв');

    // Calculate EXP & Gold
    const expEarned = isWork ? Math.round(actualMinutes * 1.5) + (isNaturalCompletion ? 50 : 0) : 0;
    const goldEarned = isWork ? Math.round(actualMinutes * 0.8) + (isNaturalCompletion ? 25 : 0) : 0;

    const entry: TimeLogEntry = {
      id: `timelog-${Date.now()}`,
      title: sessionTitle,
      mode,
      targetMinutes: currentTargetMinutes,
      actualMinutes,
      startedAt: startTime.toISOString(),
      completedAt: now.toISOString(),
      taskId: selectedTaskId || undefined,
      expEarned,
      goldEarned,
    };

    onLogSession(entry);

    if (isWork) {
      playQuestCompleteSound();
      playCoinSound();
      triggerQuestConfetti();
    }

    // Reset session timer
    setElapsedSeconds(0);
    setTimeLeft(currentTargetMinutes * 60);
    setSessionStartTime(null);
  };

  // Format seconds to HH:MM:SS or MM:SS
  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const displayedSeconds = timerType === 'countdown' ? timeLeft : elapsedSeconds;

  // Active uncompleted tasks for quick linking
  const activeTasks = tasks.filter((t) => !t.completed);

  // If today is active recovery detox day, lock the timer unless user intentionally overrides with HP penalty
  if (isDetoxDay && !isUnlockedForDetox) {
    return (
      <div className="w-full bg-gradient-to-r from-rose-950/70 via-[#180d12] to-rose-950/70 border-b border-rose-500/40 shadow-xl sticky top-0 z-30 transition-all select-none">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-lg shadow-sm">
              🧖‍♂️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-rose-200 tracking-tight">
                  РЕЖИМ АКТИВНОГО ВОССТАНОВЛЕНИЯ (ДЕНЬ 8)
                </span>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-rose-500/25 text-rose-300 border border-rose-500/40 font-bold">
                  ЦИФРОВОЙ ДЕТОКС
                </span>
              </div>
              <p className="text-[11px] text-rose-300 font-semibold mt-0.5">
                «Сегодня день отдыха. Уберите гаджеты и идите в баню!»
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const confirmed = window.confirm(
                  '⚠️ ВНИМАНИЕ: Сегодня день активного восстановления!\n\nЕсли вы сорвете детокс и включите рабочий таймер, персонаж получит -20 HP штрафа.\n\nВы действительно хотите нарушить детокс?'
                );
                if (confirmed) {
                  if (onDamageHp) {
                    onDamageHp(20, 'Нарушение дня активного восстановления (-20 HP)');
                  }
                  setIsUnlockedForDetox(true);
                }
              }}
              className="px-3.5 py-1.5 rounded-xl bg-rose-900/50 hover:bg-rose-900/80 border border-rose-500/50 text-rose-200 text-xs font-bold transition-all tactile-btn flex items-center gap-1.5 shadow"
            >
              <span>⚠️ Нарушить детокс (-20 HP)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#111116] border-b border-white/[0.08] shadow-lg sticky top-0 z-30 transition-all">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Left: Input & Task Selector */}
        <div className="flex-1 w-full md:w-auto flex items-center gap-2">
          {/* Mode Pill Switcher */}
          <div className="flex items-center p-0.5 rounded-xl bg-zinc-900 border border-white/10 shrink-0">
            <button
              onClick={() => handleSwitchMode('work')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'work'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Фокус ({workDuration}м)</span>
            </button>
            <button
              onClick={() => handleSwitchMode('break')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'break'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Coffee className="w-3.5 h-3.5 text-emerald-400" />
              <span>Отдых ({breakDuration}м)</span>
            </button>
          </div>

          {/* Activity Description Input */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder={mode === 'work' ? 'Над чем вы работаете?' : 'Название перерыва...'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-zinc-900/90 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
            />
            {selectedTaskId && (
              <span className="absolute right-2 top-1.5 text-[10px] text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                <Tag className="w-2.5 h-2.5 text-amber-400" /> Задача
              </span>
            )}
          </div>

          {/* Quick Task Link Dropdown Button */}
          <div className="relative">
            <button
              onClick={() => setIsTaskDropdownOpen(!isTaskDropdownOpen)}
              className="px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-white/10 hover:border-white/20 text-xs text-zinc-300 flex items-center gap-1 transition-colors"
              title="Привязать к существующей задаче"
            >
              <Tag className="w-3.5 h-3.5 text-zinc-400" />
              <ChevronDown className="w-3 h-3 text-zinc-500" />
            </button>

            {isTaskDropdownOpen && (
              <div className="absolute left-0 mt-2 w-64 max-h-56 overflow-y-auto bg-[#14141a] border border-white/10 rounded-2xl shadow-2xl p-2 z-50 space-y-1">
                <div className="text-[10px] font-bold text-zinc-500 px-2 py-1 uppercase tracking-wider">
                  Выбрать задачу
                </div>
                <button
                  onClick={() => {
                    setSelectedTaskId(null);
                    setIsTaskDropdownOpen(false);
                  }}
                  className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white"
                >
                  Свободная запись (без задачи)
                </button>
                {activeTasks.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedTaskId(t.id);
                      setTitle(t.title);
                      setIsTaskDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                      selectedTaskId === t.id ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    <span className="truncate">{t.title}</span>
                    <span className="text-[9px] text-zinc-500 font-mono">P{t.priority.replace('p', '')}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center / Right: Timer Display & Controls */}
        <div className="flex items-center gap-3 shrink-0">
          
          {/* Settings & Sound */}
          <div className="flex items-center gap-1">
            {/* Ambient Soundscape */}
            <button
              onClick={() => {
                const order: AmbientSound[] = ['none', 'brown', 'gamma', 'alpha'];
                const next = order[(order.indexOf(ambientSound) + 1) % order.length];
                setAmbientSound(next);
                if (isRunning) startAmbientSound(next);
              }}
              className={`p-1.5 rounded-xl border transition-all text-xs flex items-center gap-1 ${
                ambientSound !== 'none'
                  ? 'bg-purple-950/30 border-purple-500/30 text-purple-300'
                  : 'bg-zinc-900 border-white/10 text-zinc-500 hover:text-zinc-300'
              }`}
              title={`Звуковой фон: ${
                ambientSound === 'none' ? 'Выключен' :
                ambientSound === 'brown' ? 'Коричневый шум' :
                ambientSound === 'gamma' ? 'Гамма-волны 40Hz' : 'Альфа-волны 10Hz'
              }`}
            >
              {ambientSound === 'none' ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span className="text-[10px] hidden sm:inline uppercase font-bold">
                {ambientSound === 'none' ? 'Звук' : ambientSound}
              </span>
            </button>

            {/* Duration Settings Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className="p-1.5 rounded-xl bg-zinc-900 border border-white/10 hover:border-white/20 text-zinc-400 hover:text-zinc-200 text-xs transition-colors"
                title="Настройка минут фокуса и перерыва"
              >
                <Settings2 className="w-3.5 h-3.5" />
              </button>

              {isSettingsOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-[#14141a] border border-white/10 rounded-2xl shadow-2xl p-3.5 z-50 space-y-3">
                  <div className="text-xs font-bold text-zinc-200 border-b border-white/10 pb-2">
                    Настройка таймера
                  </div>

                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1 font-medium">
                      Фокус / Работа (минут)
                    </label>
                    <div className="flex items-center gap-1.5 mb-2">
                      {[45, 60, 90, 120].map((mins) => (
                        <button
                          key={mins}
                          onClick={() => setWorkDuration(mins)}
                          className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                            workDuration === mins ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                          }`}
                        >
                          {mins}м
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      min={5}
                      max={360}
                      value={workDuration}
                      onChange={(e) => setWorkDuration(Math.max(1, parseInt(e.target.value, 10) || 120))}
                      className="w-full bg-zinc-900 border border-white/10 rounded-xl px-2.5 py-1 text-xs text-zinc-200 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1 font-medium">
                      Перерыв / Отдых (минут)
                    </label>
                    <div className="flex items-center gap-1.5 mb-2">
                      {[10, 15, 20, 30].map((mins) => (
                        <button
                          key={mins}
                          onClick={() => setBreakDuration(mins)}
                          className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                            breakDuration === mins ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                          }`}
                        >
                          {mins}м
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={breakDuration}
                      onChange={(e) => setBreakDuration(Math.max(1, parseInt(e.target.value, 10) || 20))}
                      className="w-full bg-zinc-900 border border-white/10 rounded-xl px-2.5 py-1 text-xs text-zinc-200 font-mono"
                    />
                  </div>

                  <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[11px] text-zinc-400">Тип таймера:</span>
                    <button
                      onClick={() => setTimerType(timerType === 'countdown' ? 'stopwatch' : 'countdown')}
                      className="text-[11px] font-bold text-amber-400 hover:underline"
                    >
                      {timerType === 'countdown' ? 'Обратный отсчёт' : 'Секундомер'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Time Display */}
          <div className="flex items-center gap-2 bg-zinc-900/90 border border-white/10 rounded-xl px-3 py-1 font-mono text-base font-bold tracking-wider text-zinc-100 select-none">
            <span className={isRunning ? (mode === 'work' ? 'text-amber-400 animate-pulse' : 'text-emerald-400 animate-pulse') : 'text-zinc-200'}>
              {formatTime(displayedSeconds)}
            </span>
            <span className="text-[10px] text-zinc-500 font-sans font-medium uppercase">
              {timerType === 'countdown' ? 'осталось' : 'прошло'}
            </span>
          </div>

          {/* Play/Pause Button */}
          <button
            onClick={handleTogglePlay}
            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold transition-all shadow-md active:scale-95 ${
              isRunning
                ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
                : 'bg-zinc-100 hover:bg-white text-zinc-950'
            }`}
            title={isRunning ? 'Пауза' : 'Запустить таймер'}
          >
            {isRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>

          {/* Stop and Save Button */}
          {(isRunning || elapsedSeconds > 0) && (
            <button
              onClick={() => handleFinishSession(false)}
              className="p-2 rounded-xl bg-red-950/40 border border-red-500/30 hover:bg-red-900/50 text-red-300 transition-all flex items-center gap-1 text-xs active:scale-95"
              title="Завершить сессию и записать в календарь"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span className="text-[11px] font-bold hidden sm:inline">Записать</span>
            </button>
          )}

          {/* Google Calendar sync indicator */}
          {isCalendarConnected && (
            <div className="w-2 h-2 rounded-full bg-blue-500" title="Google Календарь подключен к таймеру" />
          )}
        </div>
      </div>
    </div>
  );
};
