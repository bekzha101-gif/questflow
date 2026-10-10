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
import { 
  playQuestCompleteSound, 
  playCoinSound, 
  playBreakBellSound, 
  playWorkReadySound 
} from '../utils/sound';
import { triggerQuestConfetti } from '../utils/confetti';
import { 
  loadRecoveryCycleConfig, 
  getDayCycleInfo, 
  getTodayStr,
  sendDesktopNotification,
  requestDesktopNotificationPermission
} from '../utils/recoveryCycle';
import { 
  TimerMode, 
  AmbientSound, 
  PersistentTimerSession,
  loadPersistentTimerSession, 
  savePersistentTimerSession, 
  clearPersistentTimerSession, 
  calculateCurrentTimerState, 
  subscribeTimerChannel 
} from '../utils/timerStorage';

interface TogglTimerBarProps {
  tasks: TaskItem[];
  projects: Project[];
  onLogSession: (entry: TimeLogEntry) => void;
  onCompleteTask?: (taskId: string) => void;
  onDamageHp?: (damageAmount: number, reason: string) => void;
  isCalendarConnected?: boolean;
}

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

  // Load initial persistent session from offline storage
  const initialSavedSession = useRef(loadPersistentTimerSession()).current;
  const initialCalculated = initialSavedSession ? calculateCurrentTimerState(initialSavedSession) : null;
  const initialExpired = Boolean(initialSavedSession && initialCalculated && initialCalculated.isExpired);

  // Offline expired session state for modal confirmation (User choice A1)
  const [expiredOfflineSession, setExpiredOfflineSession] = useState<{
    session: PersistentTimerSession;
    state: ReturnType<typeof calculateCurrentTimerState>;
  } | null>(() => {
    if (initialExpired && initialSavedSession && initialCalculated) {
      return { session: initialSavedSession, state: initialCalculated };
    }
    return null;
  });

  // Timer Mode: work (default 120m) vs break (default 20m)
  const [mode, setMode] = useState<TimerMode>(() => {
    if (initialSavedSession && !initialExpired) return initialSavedSession.mode;
    return 'work';
  });
  
  // Custom configurable durations in minutes
  const [workDuration, setWorkDuration] = useState<number>(() => {
    if (initialSavedSession?.mode === 'work' && initialSavedSession.targetMinutes) {
      return initialSavedSession.targetMinutes;
    }
    const saved = localStorage.getItem('questflow_timer_work_duration');
    return saved ? parseInt(saved, 10) : 120;
  });
  const [breakDuration, setBreakDuration] = useState<number>(() => {
    if (initialSavedSession?.mode === 'break' && initialSavedSession.targetMinutes) {
      return initialSavedSession.targetMinutes;
    }
    const saved = localStorage.getItem('questflow_timer_break_duration');
    return saved ? parseInt(saved, 10) : 20;
  });

  // Target duration based on current mode
  const currentTargetMinutes = mode === 'work' ? workDuration : breakDuration;

  // Active activity title and selected task
  const [title, setTitle] = useState(() => {
    if (initialSavedSession && !initialExpired && initialSavedSession.title) {
      return initialSavedSession.title;
    }
    return localStorage.getItem('questflow_timer_title') || 'Подчесать всю тетрадь, исправить и внедрить все идеи.';
  });
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(() => {
    if (initialSavedSession && !initialExpired) {
      return initialSavedSession.selectedTaskId;
    }
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

  // Time state loaded from persistent session
  const [elapsedSeconds, setElapsedSeconds] = useState(() => {
    if (initialSavedSession && !initialExpired && initialCalculated) {
      return initialCalculated.elapsedSeconds;
    }
    return 0;
  });
  const [timeLeft, setTimeLeft] = useState(() => {
    if (initialSavedSession && !initialExpired && initialCalculated) {
      return initialCalculated.timeLeft;
    }
    return (mode === 'work' ? workDuration : breakDuration) * 60;
  });
  const [isRunning, setIsRunning] = useState(() => {
    if (initialSavedSession && !initialExpired) {
      return initialSavedSession.isRunning;
    }
    return false;
  });
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(() => {
    if (initialSavedSession && !initialExpired && initialSavedSession.startTime) {
      return new Date(initialSavedSession.startTime);
    }
    return null;
  });

  // Countdown vs Stopwatch mode
  const [timerType, setTimerType] = useState<'countdown' | 'stopwatch'>(() => {
    if (initialSavedSession && !initialExpired && initialSavedSession.timerType) {
      return initialSavedSession.timerType;
    }
    return 'countdown';
  });

  // Ambient sound
  const [ambientSound, setAmbientSound] = useState<AmbientSound>(() => {
    if (initialSavedSession && initialSavedSession.ambientSound) {
      return initialSavedSession.ambientSound;
    }
    return 'none';
  });

  // Autoplay recovery gesture listener (User choice A2)
  const [isAudioWaitingForGesture, setIsAudioWaitingForGesture] = useState(() => {
    return Boolean(
      initialSavedSession &&
      !initialExpired &&
      initialSavedSession.isRunning &&
      initialSavedSession.ambientSound !== 'none'
    );
  });

  const audioCtxRef = useRef<AudioContext | null>(null);
  const soundNodeRef = useRef<{ osc?: OscillatorNode; gain?: GainNode; noise?: AudioNode } | null>(null);
  const accumulatedSecondsRef = useRef<number>(
    initialSavedSession && !initialExpired ? initialSavedSession.accumulatedSeconds : 0
  );

  // Save durations to localStorage
  useEffect(() => {
    localStorage.setItem('questflow_timer_work_duration', workDuration.toString());
  }, [workDuration]);

  useEffect(() => {
    localStorage.setItem('questflow_timer_break_duration', breakDuration.toString());
  }, [breakDuration]);

  // Reset timer when target duration changes while idle
  useEffect(() => {
    if (!isRunning && !expiredOfflineSession) {
      setTimeLeft(currentTargetMinutes * 60);
      setElapsedSeconds(0);
      accumulatedSecondsRef.current = 0;
    }
  }, [currentTargetMinutes, mode, isRunning, expiredOfflineSession]);

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

  // Refs to avoid stale closures in interval
  const elapsedSecondsRef = useRef(elapsedSeconds);
  const modeRef = useRef(mode);
  const workDurationRef = useRef(workDuration);
  const breakDurationRef = useRef(breakDuration);
  const titleRef = useRef(title);
  const selectedTaskIdRef = useRef(selectedTaskId);
  const sessionStartTimeRef = useRef(sessionStartTime);
  const ambientSoundRef = useRef(ambientSound);
  const isRunningRef = useRef(isRunning);
  const timerTypeRef = useRef(timerType);

  useEffect(() => { elapsedSecondsRef.current = elapsedSeconds; }, [elapsedSeconds]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { workDurationRef.current = workDuration; }, [workDuration]);
  useEffect(() => { breakDurationRef.current = breakDuration; }, [breakDuration]);
  useEffect(() => { titleRef.current = title; }, [title]);
  useEffect(() => { selectedTaskIdRef.current = selectedTaskId; }, [selectedTaskId]);
  useEffect(() => { sessionStartTimeRef.current = sessionStartTime; }, [sessionStartTime]);
  useEffect(() => { ambientSoundRef.current = ambientSound; }, [ambientSound]);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { timerTypeRef.current = timerType; }, [timerType]);

  // Helper to persist current timer session state
  const persistCurrentState = (overrides?: Partial<PersistentTimerSession>) => {
    const session: PersistentTimerSession = {
      mode: modeRef.current,
      isRunning: isRunningRef.current,
      startTime: sessionStartTimeRef.current ? sessionStartTimeRef.current.getTime() : null,
      accumulatedSeconds: accumulatedSecondsRef.current,
      targetMinutes: modeRef.current === 'work' ? workDurationRef.current : breakDurationRef.current,
      title: titleRef.current,
      selectedTaskId: selectedTaskIdRef.current,
      ambientSound: ambientSoundRef.current,
      timerType: timerTypeRef.current,
      lastUpdated: Date.now(),
      ...overrides,
    };
    savePersistentTimerSession(session);
  };

  // Multi-tab BroadcastChannel synchronization (User choice A4)
  useEffect(() => {
    const unsubscribe = subscribeTimerChannel((syncedSession) => {
      if (!syncedSession) {
        setIsRunning(false);
        setSessionStartTime(null);
        setElapsedSeconds(0);
        accumulatedSecondsRef.current = 0;
        setTimeLeft((modeRef.current === 'work' ? workDurationRef.current : breakDurationRef.current) * 60);
        return;
      }
      const state = calculateCurrentTimerState(syncedSession);
      if (state.isExpired) {
        setExpiredOfflineSession({ session: syncedSession, state });
        setIsRunning(false);
        return;
      }
      setMode(syncedSession.mode);
      setTitle(syncedSession.title);
      setSelectedTaskId(syncedSession.selectedTaskId);
      setAmbientSound(syncedSession.ambientSound);
      setTimerType(syncedSession.timerType);
      setIsRunning(syncedSession.isRunning);
      setElapsedSeconds(state.elapsedSeconds);
      setTimeLeft(state.timeLeft);
      accumulatedSecondsRef.current = syncedSession.accumulatedSeconds;
      setSessionStartTime(syncedSession.startTime ? new Date(syncedSession.startTime) : null);
    });
    return unsubscribe;
  }, []);

  // Autoplay recovery gesture listener (User choice A2)
  useEffect(() => {
    if (isAudioWaitingForGesture && ambientSound !== 'none') {
      const handleGesture = () => {
        startAmbientSound(ambientSound);
        setIsAudioWaitingForGesture(false);
      };
      window.addEventListener('click', handleGesture, { once: true });
      window.addEventListener('keydown', handleGesture, { once: true });
      return () => {
        window.removeEventListener('click', handleGesture);
        window.removeEventListener('keydown', handleGesture);
      };
    }
  }, [isAudioWaitingForGesture, ambientSound]);

  // Timer Tick Effect with Wall-clock verification (offline-proof)
  useEffect(() => {
    let interval: any = null;
    if (isRunning) {
      interval = setInterval(() => {
        const start = sessionStartTimeRef.current ? sessionStartTimeRef.current.getTime() : null;
        let actualElapsed = accumulatedSecondsRef.current;
        if (start) {
          actualElapsed += Math.max(0, Math.floor((Date.now() - start) / 1000));
        }

        setElapsedSeconds(actualElapsed);
        elapsedSecondsRef.current = actualElapsed;

        const targetSec = (modeRef.current === 'work' ? workDurationRef.current : breakDurationRef.current) * 60;
        if (timerType === 'countdown') {
          const remaining = Math.max(0, targetSec - actualElapsed);
          setTimeLeft(remaining);

          if (remaining <= 0) {
            setTimeout(() => {
              handleFinishSession(true);
            }, 0);
          }
        }

        // Keep persistent storage updated periodically
        persistCurrentState();
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isRunning, timerType, mode]);

  // Handle Play/Pause
  const handleTogglePlay = () => {
    if (!isRunning) {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        requestDesktopNotificationPermission();
      }
      const now = new Date();
      setSessionStartTime(now);
      setIsRunning(true);
      if (ambientSound !== 'none') {
        startAmbientSound(ambientSound);
      }
      persistCurrentState({
        isRunning: true,
        startTime: now.getTime(),
      });
    } else {
      setIsRunning(false);
      stopAmbientSound();
      const currentSegment = sessionStartTime ? Math.floor((Date.now() - sessionStartTime.getTime()) / 1000) : 0;
      const totalAccum = accumulatedSecondsRef.current + currentSegment;
      accumulatedSecondsRef.current = totalAccum;
      setSessionStartTime(null);
      persistCurrentState({
        isRunning: false,
        startTime: null,
        accumulatedSeconds: totalAccum,
      });
    }
  };

  // Handle Switch Mode (Work <-> Break)
  const handleSwitchMode = (newMode: TimerMode) => {
    if (newMode === mode) return;

    if (isRunning || elapsedSeconds > 0) {
      handleFinishSession(false);
      return;
    }

    setMode(newMode);
    const targetMin = newMode === 'work' ? workDuration : breakDuration;
    setTimeLeft(targetMin * 60);
    setElapsedSeconds(0);
    accumulatedSecondsRef.current = 0;
    setIsRunning(false);
    setSessionStartTime(null);

    persistCurrentState({
      mode: newMode,
      isRunning: false,
      startTime: null,
      accumulatedSeconds: 0,
      targetMinutes: targetMin,
    });
  };

  // Handle Offline Expired Session Confirmation (User choice A1)
  const handleConfirmExpiredSession = () => {
    if (!expiredOfflineSession) return;
    const { session, state } = expiredOfflineSession;
    const isWork = session.mode === 'work';
    const actualMinutes = Math.min(session.targetMinutes, state.expiredMinutes);
    const now = new Date();
    const startTime = session.startTime
      ? new Date(session.startTime)
      : new Date(now.getTime() - actualMinutes * 60 * 1000);

    const expEarned = isWork ? Math.round(actualMinutes * 1.5) + 50 : 0;
    const goldEarned = isWork ? Math.round(actualMinutes * 0.8) + 25 : 0;

    const entry: TimeLogEntry = {
      id: `timelog-${Date.now()}`,
      title: session.title.trim() || (isWork ? 'Фокус-работа' : 'Перерыв'),
      mode: session.mode,
      targetMinutes: session.targetMinutes,
      actualMinutes,
      startedAt: startTime.toISOString(),
      completedAt: now.toISOString(),
      taskId: session.selectedTaskId || undefined,
      expEarned,
      goldEarned,
    };
    onLogSession(entry);

    if (isWork) {
      playQuestCompleteSound();
      playCoinSound();
      triggerQuestConfetti();
      playBreakBellSound();
      sendDesktopNotification(
        '🧘 Время фокуса завершено!',
        'Сессия подтверждена и записана в календарь. Начинаем 20 минут активного отдыха.',
        'questflow-timer-alert'
      );

      const targetBreakSec = breakDurationRef.current * 60;
      setMode('break');
      setTimeLeft(targetBreakSec);
      setElapsedSeconds(0);
      accumulatedSecondsRef.current = 0;
      const breakStart = new Date();
      setSessionStartTime(breakStart);
      setIsRunning(true);
      if (ambientSoundRef.current !== 'none') {
        startAmbientSound(ambientSoundRef.current);
      }
      savePersistentTimerSession({
        mode: 'break',
        isRunning: true,
        startTime: breakStart.getTime(),
        accumulatedSeconds: 0,
        targetMinutes: breakDurationRef.current,
        title: session.title,
        selectedTaskId: session.selectedTaskId,
        ambientSound: ambientSoundRef.current,
        timerType: 'countdown',
        lastUpdated: Date.now(),
      });
    } else {
      playWorkReadySound();
      const targetWorkSec = workDurationRef.current * 60;
      setMode('work');
      setTimeLeft(targetWorkSec);
      setElapsedSeconds(0);
      accumulatedSecondsRef.current = 0;
      setSessionStartTime(null);
      setIsRunning(false);
      savePersistentTimerSession({
        mode: 'work',
        isRunning: false,
        startTime: null,
        accumulatedSeconds: 0,
        targetMinutes: workDurationRef.current,
        title: titleRef.current,
        selectedTaskId: selectedTaskIdRef.current,
        ambientSound: ambientSoundRef.current,
        timerType: 'countdown',
        lastUpdated: Date.now(),
      });
    }

    setExpiredOfflineSession(null);
  };

  const handleDismissExpiredSession = () => {
    clearPersistentTimerSession();
    setExpiredOfflineSession(null);
    setMode('work');
    setTimeLeft(workDurationRef.current * 60);
    setElapsedSeconds(0);
    accumulatedSecondsRef.current = 0;
    setSessionStartTime(null);
    setIsRunning(false);
  };

  // Finish and Log Session into Calendar with Auto-transition
  const handleFinishSession = (isNaturalCompletion: boolean) => {
    setIsRunning(false);
    stopAmbientSound();

    const currentMode = modeRef.current;
    const currentElapsed = elapsedSecondsRef.current;
    const actualMinutes = Math.max(1, Math.round(currentElapsed / 60));
    const now = new Date();
    const startTime = sessionStartTimeRef.current || new Date(now.getTime() - actualMinutes * 60 * 1000);

    const isWork = currentMode === 'work';

    if (isWork) {
      // ─── 1. Finishing Work (120m or early stop/cancel) ────────────────────────
      const sessionTitle = titleRef.current.trim() || 'Фокус-работа';

      // EXP & Gold calculation
      const expEarned = Math.round(actualMinutes * 1.5) + (isNaturalCompletion ? 50 : 0);
      const goldEarned = Math.round(actualMinutes * 0.8) + (isNaturalCompletion ? 25 : 0);

      // Only write to calendar if at least 15s elapsed
      if (currentElapsed >= 15) {
        const entry: TimeLogEntry = {
          id: `timelog-${Date.now()}`,
          title: sessionTitle,
          mode: 'work',
          targetMinutes: workDurationRef.current,
          actualMinutes,
          startedAt: startTime.toISOString(),
          completedAt: now.toISOString(),
          taskId: selectedTaskIdRef.current || undefined,
          expEarned,
          goldEarned,
        };
        onLogSession(entry);
      }

      if (isNaturalCompletion) {
        playQuestCompleteSound();
        playCoinSound();
        triggerQuestConfetti();
        sendDesktopNotification(
          '🧘 Время фокуса вышло!',
          'Отличная работа! Включаем 20 минут активного отдыха. Разомнитесь, выпейте воды.',
          'questflow-timer-alert'
        );
      } else {
        playCoinSound();
        sendDesktopNotification(
          '☕ Фокус завершен!',
          `Отработано ${actualMinutes} мин (+${expEarned} EXP, +${goldEarned}G). Включаем перерыв ${breakDurationRef.current} минут!`,
          'questflow-timer-alert'
        );
      }

      // Soothing Tibetan bell gong
      playBreakBellSound();

      // AUTOMATIC TRANSITION TO BREAK (20m) & AUTO-START
      const targetBreakSec = breakDurationRef.current * 60;
      setMode('break');
      setTimeLeft(targetBreakSec);
      setElapsedSeconds(0);
      accumulatedSecondsRef.current = 0;
      const breakStart = new Date();
      setSessionStartTime(breakStart);
      setIsRunning(true);
      if (ambientSoundRef.current !== 'none') {
        startAmbientSound(ambientSoundRef.current);
      }

      // Save break session to persistent storage
      savePersistentTimerSession({
        mode: 'break',
        isRunning: true,
        startTime: breakStart.getTime(),
        accumulatedSeconds: 0,
        targetMinutes: breakDurationRef.current,
        title: sessionTitle,
        selectedTaskId: selectedTaskIdRef.current,
        ambientSound: ambientSoundRef.current,
        timerType: 'countdown',
        lastUpdated: Date.now(),
      });
    } else {
      // ─── 2. Finishing Break (20m or early stop) ─────────────────────────────
      if (currentElapsed >= 15) {
        const entry: TimeLogEntry = {
          id: `timelog-${Date.now()}`,
          title: 'Перерыв и восстановление',
          mode: 'break',
          targetMinutes: breakDurationRef.current,
          actualMinutes,
          startedAt: startTime.toISOString(),
          completedAt: now.toISOString(),
          expEarned: 0,
          goldEarned: 0,
        };
        onLogSession(entry);
      }

      if (isNaturalCompletion) {
        playWorkReadySound();
        sendDesktopNotification(
          '⚡ Перерыв 20 минут завершен!',
          'Вы отлично перезагрузились. Готовы к новому 120-минутному блоку фокуса? Нажмите «Старт».',
          'questflow-timer-alert'
        );
      } else {
        playWorkReadySound();
        sendDesktopNotification(
          '⚡ Отдых завершен',
          'Возвращаемся к рабочему фокусу. Нажмите «Старт» когда будете готовы.',
          'questflow-timer-alert'
        );
      }

      // TRANSITION BACK TO WORK (120m) & WAIT FOR MANUAL START
      const targetWorkSec = workDurationRef.current * 60;
      setMode('work');
      setTimeLeft(targetWorkSec);
      setElapsedSeconds(0);
      accumulatedSecondsRef.current = 0;
      setSessionStartTime(null);
      setIsRunning(false);

      // Save ready work session to persistent storage
      savePersistentTimerSession({
        mode: 'work',
        isRunning: false,
        startTime: null,
        accumulatedSeconds: 0,
        targetMinutes: workDurationRef.current,
        title: titleRef.current,
        selectedTaskId: selectedTaskIdRef.current,
        ambientSound: ambientSoundRef.current,
        timerType: 'countdown',
        lastUpdated: Date.now(),
      });
    }
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
    <div className={`w-full border-b shadow-lg sticky top-0 z-30 transition-all ${
      mode === 'work' ? 'bg-[#111116] border-white/[0.08]' : 'bg-[#0c1410] border-emerald-500/25 shadow-emerald-950/20'
    }`}>
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
                persistCurrentState({ ambientSound: next });
                setIsAudioWaitingForGesture(false);
                if (isRunning) startAmbientSound(next);
                else stopAmbientSound();
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
              {ambientSound !== 'none' && isAudioWaitingForGesture && (
                <span className="text-[8px] bg-purple-500/30 text-purple-200 px-1.5 py-0.5 rounded-full animate-pulse border border-purple-500/40" title="Кликните в любом месте экрана для включения звука">
                  клик для звука
                </span>
              )}
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
                ? (mode === 'work' ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950' : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950')
                : 'bg-zinc-100 hover:bg-white text-zinc-950'
            }`}
            title={isRunning ? 'Пауза' : 'Запустить таймер'}
          >
            {isRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>

          {/* Action Button: Finish & Switch with Auto-Rest */}
          {(isRunning || elapsedSeconds > 0) && (
            <button
              onClick={() => handleFinishSession(false)}
              className={`px-2.5 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 text-xs active:scale-95 shadow-sm ${
                mode === 'work'
                  ? 'bg-emerald-950/50 border-emerald-500/40 hover:bg-emerald-900/70 text-emerald-300'
                  : 'bg-amber-950/50 border-amber-500/40 hover:bg-amber-900/70 text-amber-300'
              }`}
              title={
                mode === 'work'
                  ? 'Завершить фокус, записать время в календарь и начать 20 минут отдыха'
                  : 'Завершить отдых и перейти к работе (120м)'
              }
            >
              {mode === 'work' ? (
                <>
                  <Coffee className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px] font-bold">Отдых ({breakDuration}м)</span>
                </>
              ) : (
                <>
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[11px] font-bold">К фокусу</span>
                </>
              )}
            </button>
          )}

          {/* Google Calendar sync indicator */}
          {isCalendarConnected && (
            <div className="w-2 h-2 rounded-full bg-blue-500" title="Google Календарь подключен к таймеру" />
          )}
        </div>
      </div>

      {/* Offline Expired Session Confirmation Modal (User choice A1) */}
      {expiredOfflineSession && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none">
          <div className="w-full max-w-md bg-[#16161d] border border-amber-500/40 rounded-3xl p-6 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 mx-auto flex items-center justify-center text-3xl shadow-inner">
              ⏱️
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">
                Время сессии истекло, пока вкладка была закрыта
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                {expiredOfflineSession.session.mode === 'work' ? 'Фокус-работа' : 'Перерыв'}:{' '}
                <span className="text-amber-300 font-semibold">{expiredOfflineSession.session.title}</span>
              </p>
              <p className="text-xs text-zinc-300 mt-2 bg-zinc-900/80 p-2.5 rounded-xl border border-white/5 font-medium leading-relaxed">
                Пока вкладка была закрыта, прошло{' '}
                <span className="font-mono text-amber-300 font-bold">{expiredOfflineSession.state.expiredMinutes} мин</span>.
                Вы действительно работали это время?
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
              <button
                onClick={handleConfirmExpiredSession}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg active:scale-95 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>
                  {expiredOfflineSession.session.mode === 'work'
                    ? 'Да, записать и начать отдых (20м)'
                    : 'Да, записать сессию отдыха'}
                </span>
              </button>
              <button
                onClick={handleDismissExpiredSession}
                className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs transition-all active:scale-95 cursor-pointer"
              >
                Сбросить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
