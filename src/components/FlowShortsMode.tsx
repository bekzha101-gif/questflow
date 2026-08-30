import React, { useState, useEffect, useRef } from 'react';
import { TaskItem, Project, UserStats, Priority } from '../types';
import { 
  CheckCircle2, 
  Play, 
  Pause, 
  RotateCcw, 
  ChevronUp, 
  ChevronDown, 
  Clock, 
  Tag, 
  Sparkles, 
  Flame, 
  Coins, 
  Wand2, 
  ListChecks,
  Plus,
  Zap,
  Volume2
} from 'lucide-react';
import { playQuestCompleteSound, playCoinSound, playTickSound } from '../utils/sound';
import { triggerQuestConfetti } from '../utils/confetti';

interface FlowShortsModeProps {
  tasks: TaskItem[];
  projects: Project[];
  stats: UserStats;
  onCompleteTask: (taskId: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onSnoozeTask: (taskId: string, minutes: number) => void;
  onOpenAiDecompose: (taskTitle: string) => void;
  onToggleFocus: (taskId: string) => void;
}

export const FlowShortsMode: React.FC<FlowShortsModeProps> = ({
  tasks,
  projects,
  stats,
  onCompleteTask,
  onToggleSubtask,
  onSnoozeTask,
  onOpenAiDecompose,
  onToggleFocus,
}) => {
  // Focus Tasks
  const focusTasks = tasks.filter((t) => !t.completed && (t.inFocusFlow || t.priority === 'p1'));
  const activeTaskList = focusTasks.length > 0 ? focusTasks : tasks.filter((t) => !t.completed);

  const [currentIndex, setCurrentIndex] = useState(0);

  // Safe index
  const safeIndex = Math.min(currentIndex, Math.max(0, activeTaskList.length - 1));
  const currentTask = activeTaskList[safeIndex];

  // Pomodoro Focus Timer State
  const [timerSeconds, setTimerSeconds] = useState<number>(() => (currentTask?.durationMinutes || 25) * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Sync timer when changing tasks
  useEffect(() => {
    if (currentTask) {
      setTimerSeconds((currentTask.durationMinutes || 25) * 60);
      setIsTimerRunning(false);
    }
  }, [currentTask?.id]);

  // Timer Tick
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            if (stats.soundEnabled) playQuestCompleteSound();
            return 0;
          }
          if (stats.soundEnabled && prev % 60 === 0) {
            playTickSound();
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds, stats.soundEnabled]);

  // Touch Swipe for Mobile (TikTok/Shorts style)
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaY = touchStartY.current - touchEndY;

    if (deltaY > 50) {
      // Swipe Up -> Next
      handleNext();
    } else if (deltaY < -50) {
      // Swipe Down -> Prev
      handlePrev();
    }
    touchStartY.current = null;
  };

  const handleNext = () => {
    if (safeIndex < activeTaskList.length - 1) {
      setCurrentIndex(safeIndex + 1);
      if ('vibrate' in navigator) navigator.vibrate(15);
    }
  };

  const handlePrev = () => {
    if (safeIndex > 0) {
      setCurrentIndex(safeIndex - 1);
      if ('vibrate' in navigator) navigator.vibrate(15);
    }
  };

  // Keyboard navigation (Up/Down/Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsTimerRunning((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [safeIndex, activeTaskList.length]);

  const handleFinishQuest = () => {
    if (!currentTask) return;
    if ('vibrate' in navigator) navigator.vibrate([40, 60, 80]);
    if (stats.soundEnabled) {
      playQuestCompleteSound();
      playCoinSound();
    }
    triggerQuestConfetti();
    onCompleteTask(currentTask.id);
  };

  if (!currentTask) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
        <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center text-2xl mb-4 text-zinc-300">
          ✓
        </div>
        <h2 className="text-xl font-bold text-zinc-100 mb-2">Все задачи фокуса выполнены</h2>
        <p className="text-xs text-zinc-500 max-w-sm mb-6">
          Отличная работа. Вы можете добавить новые задачи через ⌘K или выбрать квесты из списка.
        </p>
      </div>
    );
  }

  const project = projects.find((p) => p.id === currentTask.projectId);
  const totalDuration = (currentTask.durationMinutes || 25) * 60;
  const timeProgressPercent = Math.max(0, Math.min(100, (1 - timerSeconds / totalDuration) * 100));

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = currentTask.subtasks.length > 0
    ? (currentTask.subtasks.filter((s) => s.completed).length / currentTask.subtasks.length) * 100
    : 0;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="relative flex flex-col items-center justify-center min-h-[82vh] max-w-xl mx-auto px-4 py-4 select-none"
    >
      {/* Vertical Navigation Side Controls (Desktop) */}
      <div className="hidden lg:flex flex-col gap-2 absolute -right-16 top-1/2 -translate-y-1/2">
        <button
          onClick={handlePrev}
          disabled={safeIndex === 0}
          className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-white disabled:opacity-30 transition-all"
          title="Предыдущий квест (↑)"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
        <div className="text-center font-mono text-[11px] text-zinc-500 py-1">
          {safeIndex + 1}/{activeTaskList.length}
        </div>
        <button
          onClick={handleNext}
          disabled={safeIndex === activeTaskList.length - 1}
          className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-white disabled:opacity-30 transition-all"
          title="Следующий квест (↓)"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>

      {/* Main Focus Card (Sleek Obsidian Minimalist) */}
      <div className="w-full bg-[#111115] border border-white/10 rounded-3xl p-5 sm:p-7 shadow-2xl relative overflow-hidden flex flex-col justify-between">
        
        {/* Card Header Info */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            {project && (
              <span className="text-[11px] font-semibold text-zinc-300 px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/10 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
                <span>{project.name}</span>
              </span>
            )}
            <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
              {currentTask.priority.toUpperCase()}
            </span>
          </div>

          <button
            onClick={() => onOpenAiDecompose(currentTask.title)}
            className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 transition-colors"
            title="Разбить задачу с AI"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>AI Декомпозиция</span>
          </button>
        </div>

        {/* Task Title */}
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-100 leading-snug tracking-tight">
            {currentTask.title}
          </h1>
          {currentTask.description && (
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
              {currentTask.description}
            </p>
          )}

          {/* Tags */}
          {currentTask.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {currentTask.tags.map((t) => (
                <span key={t} className="text-[10px] text-zinc-400 bg-zinc-900 border border-white/5 px-2 py-0.5 rounded-md font-mono">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Minimalist Pomodoro Focus Timer */}
        <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-4 sm:p-5 mb-5 text-center">
          <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1 flex items-center justify-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            <span>Таймер Фокуса</span>
          </div>

          <div className="text-3xl sm:text-4xl font-black font-mono text-zinc-100 tracking-tight my-2">
            {formatTimer(timerSeconds)}
          </div>

          {/* Minimalist Progress Line */}
          <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden my-3">
            <div
              className="h-full bg-zinc-300 transition-all duration-300"
              style={{ width: `${timeProgressPercent}%` }}
            />
          </div>

          {/* Timer Controls */}
          <div className="flex items-center justify-center gap-2 mt-3">
            <button
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs shadow transition-all active:scale-95"
            >
              {isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isTimerRunning ? 'Пауза' : 'Старт (Space)'}</span>
            </button>

            <button
              onClick={() => {
                setIsTimerRunning(false);
                setTimerSeconds((currentTask.durationMinutes || 25) * 60);
              }}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
              title="Сбросить таймер"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Subtasks Checklist */}
        {currentTask.subtasks.length > 0 && (
          <div className="mb-5 bg-zinc-900/40 border border-white/5 rounded-2xl p-4">
            <div className="flex justify-between items-center text-xs text-zinc-300 mb-2.5 font-medium">
              <span className="flex items-center gap-1.5">
                <ListChecks className="w-4 h-4 text-zinc-400" /> Шаги выполнения
              </span>
              <span className="tabular-nums text-[11px] text-zinc-500 font-mono">
                {currentTask.subtasks.filter((s) => s.completed).length} / {currentTask.subtasks.length}
              </span>
            </div>

            <div className="space-y-1.5">
              {currentTask.subtasks.map((st) => (
                <div
                  key={st.id}
                  onClick={() => {
                    onToggleSubtask(currentTask.id, st.id);
                    if ('vibrate' in navigator) navigator.vibrate(10);
                  }}
                  className={`flex items-center gap-2.5 p-2 rounded-xl cursor-pointer transition-all text-xs ${
                    st.completed ? 'text-zinc-500 line-through' : 'text-zinc-200 hover:bg-zinc-800/60'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                    st.completed ? 'bg-zinc-200 border-zinc-200 text-zinc-950' : 'border-zinc-600'
                  }`}>
                    {st.completed && <CheckCircle2 className="w-3 h-3" />}
                  </div>
                  <span className="truncate">{st.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reward Badges */}
        <div className="grid grid-cols-2 gap-2.5 py-2.5 border-t border-b border-white/5 mb-5 text-center text-xs">
          <div className="p-2 rounded-xl bg-zinc-900/60 border border-white/5">
            <p className="text-[10px] text-zinc-500 uppercase font-semibold">Опыт</p>
            <p className="font-bold text-zinc-200 text-xs mt-0.5">+{currentTask.expReward} EXP</p>
          </div>
          <div className="p-2 rounded-xl bg-zinc-900/60 border border-white/5">
            <p className="text-[10px] text-zinc-500 uppercase font-semibold">Золото</p>
            <p className="font-bold text-zinc-200 text-xs mt-0.5">+{currentTask.goldReward} 🪙</p>
          </div>
        </div>

        {/* Main Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={handleFinishQuest}
            className="w-full py-3.5 rounded-2xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-sm shadow transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
            <span>Завершить задачу</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onSnoozeTask(currentTask.id, 15)}
              className="py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Отложить на 15м
            </button>
            <button
              onClick={handleNext}
              className="py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Следующая задача
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
