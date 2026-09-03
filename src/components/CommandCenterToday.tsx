import React, { useState } from 'react';
import { TaskItem, Project, UserStats } from '../types';
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Flame,
  Clock,
  CheckSquare,
  Sparkles,
  Timer
} from 'lucide-react';
import { PomodoroTimerWidget } from './PomodoroTimerWidget';

interface CommandCenterTodayProps {
  tasks: TaskItem[];
  projects: Project[];
  stats: UserStats;
  onToggleTask: (taskId: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onTriggerHabit: (taskId: string, direction: 'positive' | 'negative') => void;
  onToggleDaily: (taskId: string) => void;
  onAddTask: (task: Omit<TaskItem, 'id' | 'completed' | 'subtasks'>) => void;
  onDeleteTask?: (taskId: string) => void;
  onOpenQuickAdd: () => void;
  onOpenStudioTab?: () => void;
  onOpenLifeTab?: () => void;
}

export function CommandCenterToday({
  tasks,
  projects,
  stats,
  onToggleTask,
  onTriggerHabit,
  onToggleDaily,
  onAddTask,
  onDeleteTask,
}: CommandCenterTodayProps) {
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [isPriority, setIsPriority] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'tasks' | 'habits' | 'pomodoro'>('tasks');

  const now = new Date();
  const todayFormatted = now.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  // Capitalize first letter of day
  const formattedDate = todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1);

  // Filter Tasks for Today (Only to-do items)
  const todayTasks = tasks.filter((t) => t.type === 'todo');
  const activeTasks = todayTasks.filter((t) => !t.completed);
  const completedTasks = todayTasks.filter((t) => t.completed);

  // Habits & Dailies
  const dailies = tasks.filter((t) => t.type === 'daily');
  const habits = tasks.filter((t) => t.type === 'habit');
  const allHabitsAndDailies = [...dailies, ...habits];

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTaskTitle.trim()) return;

    if (activeSubTab === 'habits') {
      onAddTask({
        title: quickTaskTitle.trim(),
        type: 'daily',
        priority: 'p2',
        projectId: projects[0]?.id || 'proj-inbox',
        difficulty: 'easy',
        expReward: 25,
        goldReward: 15,
        streakCount: 0,
        tags: ['Привычка'],
      });
    } else {
      onAddTask({
        title: quickTaskTitle.trim(),
        type: 'todo',
        priority: isPriority ? 'p1' : 'p2',
        projectId: projects[0]?.id || 'proj-inbox',
        difficulty: isPriority ? 'hard' : 'medium',
        expReward: isPriority ? 50 : 35,
        goldReward: isPriority ? 30 : 20,
        tags: isPriority ? ['Срочно P1'] : ['Сегодня'],
      });
    }

    setQuickTaskTitle('');
    setIsPriority(false);
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 space-y-6 animate-fade-in text-zinc-100">
      
      {/* ─── Header: Calm & Minimalist ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-white/[0.06]">
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider font-mono">
            {formattedDate}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-0.5">
            Сегодня
          </h1>
        </div>

        {/* Status Pill */}
        <div className="flex items-center gap-3">
          {stats.streak > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-950/40 border border-orange-800/30 text-xs font-medium text-orange-300">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span>{stats.streak} дн. подряд</span>
            </div>
          )}

          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-white/[0.08] text-xs font-medium text-zinc-300">
            <span>Ур. {stats.level}</span>
            <span className="text-zinc-600">•</span>
            <span className="text-amber-400 font-mono">{stats.gold} 🪙</span>
          </div>
        </div>
      </div>

      {/* ─── Segmented Tabs (Clean & Intuitive) ─────────────────────────────────── */}
      <div className="flex items-center gap-2 bg-[#121216] p-1 rounded-2xl border border-white/[0.06] w-fit">
        <button
          onClick={() => setActiveSubTab('tasks')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            activeSubTab === 'tasks'
              ? 'bg-zinc-800 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span>Задачи</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-zinc-900 text-zinc-400">
            {activeTasks.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('habits')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            activeSubTab === 'habits'
              ? 'bg-zinc-800 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Flame className="w-3.5 h-3.5 text-orange-400" />
          <span>Привычки</span>
          {allHabitsAndDailies.length > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-zinc-900 text-zinc-400">
              {allHabitsAndDailies.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('pomodoro')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            activeSubTab === 'pomodoro'
              ? 'bg-zinc-800 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Timer className="w-3.5 h-3.5 text-emerald-400" />
          <span>Таймер фокуса</span>
        </button>
      </div>

      {/* ─── Primary Quick Add Input ────────────────────────────────────────── */}
      {activeSubTab !== 'pomodoro' && (
        <form
          onSubmit={handleQuickAddSubmit}
          className="bg-[#121216] border border-white/[0.08] focus-within:border-zinc-500/60 rounded-2xl p-2 sm:p-2.5 flex items-center gap-2 transition-all shadow-md"
        >
          <input
            type="text"
            placeholder={
              activeSubTab === 'habits'
                ? 'Новая ежедневная привычка... (Нажмите Enter)'
                : 'Что нужно сделать сегодня? (Нажмите Enter)'
            }
            value={quickTaskTitle}
            onChange={(e) => setQuickTaskTitle(e.target.value)}
            className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none"
            autoFocus
          />

          {activeSubTab === 'tasks' && (
            <button
              type="button"
              onClick={() => setIsPriority(!isPriority)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                isPriority
                  ? 'bg-rose-950/80 border border-rose-700/60 text-rose-300'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-500 border border-white/[0.04]'
              }`}
              title="Сделать задачу приоритетом дня (P1)"
            >
              {isPriority ? '⚡ P1 Срочно' : 'Обычная'}
            </button>
          )}

          <button
            type="submit"
            disabled={!quickTaskTitle.trim()}
            className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 disabled:opacity-30 disabled:hover:bg-white text-zinc-950 font-semibold text-xs transition-all active:scale-95 cursor-pointer shrink-0 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Добавить</span>
          </button>
        </form>
      )}

      {/* ─── 1. SubTab: TASKS ─────────────────────────────────────────────────── */}
      {activeSubTab === 'tasks' && (
        <div className="space-y-4">
          
          {/* Active Tasks */}
          <div className="space-y-2">
            {activeTasks.length === 0 && completedTasks.length === 0 ? (
              <div className="py-16 text-center rounded-3xl bg-[#101014] border border-white/[0.04] space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/[0.08] flex items-center justify-center text-xl mx-auto">
                  ✨
                </div>
                <h3 className="text-sm font-semibold text-zinc-300">На сегодня всё чисто</h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  Добавьте вашу первую задачу в поле выше, чтобы начать день.
                </p>
              </div>
            ) : (
              activeTasks.map((task) => (
                <div
                  key={task.id}
                  className="group bg-[#121216] hover:bg-[#16161c] border border-white/[0.06] hover:border-white/[0.12] rounded-2xl p-3.5 flex items-center justify-between gap-3 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <button
                      onClick={() => onToggleTask(task.id)}
                      className="text-zinc-500 hover:text-emerald-400 transition-transform active:scale-90 cursor-pointer shrink-0"
                      title="Завершить задачу"
                    >
                      <Circle className="w-4 h-4" />
                    </button>

                    <span className="text-sm text-zinc-200 truncate font-normal">
                      {task.title}
                    </span>

                    {task.priority === 'p1' && (
                      <span className="px-2 py-0.5 rounded-md bg-rose-950/60 border border-rose-800/40 text-rose-300 text-[10px] font-bold shrink-0">
                        P1
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-mono text-zinc-500">
                      +{task.expReward} XP
                    </span>

                    {onDeleteTask && (
                      <button
                        onClick={() => onDeleteTask(task.id)}
                        className="p-1.5 rounded-lg text-zinc-600 hover:text-rose-400 hover:bg-rose-950/30 transition-all cursor-pointer"
                        title="Удалить задачу"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Completed Tasks Accordion */}
          {completedTasks.length > 0 && (
            <div className="pt-4 border-t border-white/[0.04] space-y-2">
              <p className="text-xs font-mono text-zinc-500 px-1">
                Завершено ({completedTasks.length})
              </p>

              <div className="space-y-1.5 opacity-60">
                {completedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-[#0e0e12] border border-transparent hover:border-white/[0.04] rounded-2xl p-3 flex items-center justify-between gap-3 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <button
                        onClick={() => onToggleTask(task.id)}
                        className="text-emerald-400 transition-transform active:scale-90 cursor-pointer shrink-0"
                        title="Вернуть задачу"
                      >
                        <CheckCircle2 className="w-4 h-4 fill-emerald-500/20" />
                      </button>

                      <span className="text-sm text-zinc-400 line-through truncate">
                        {task.title}
                      </span>
                    </div>

                    {onDeleteTask && (
                      <button
                        onClick={() => onDeleteTask(task.id)}
                        className="p-1 text-zinc-600 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Удалить"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ─── 2. SubTab: HABITS ─────────────────────────────────────────────────── */}
      {activeSubTab === 'habits' && (
        <div className="space-y-2">
          {allHabitsAndDailies.length === 0 ? (
            <div className="py-16 text-center rounded-3xl bg-[#101014] border border-white/[0.04] space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/[0.08] flex items-center justify-center text-xl mx-auto">
                🔥
              </div>
              <h3 className="text-sm font-semibold text-zinc-300">Список привычек пуст</h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Добавьте регулярные привычки (например: «Выпить стакан воды» или «Зарядка 15 мин»).
              </p>
            </div>
          ) : (
            allHabitsAndDailies.map((item) => {
              const isDaily = item.type === 'daily';
              return (
                <div
                  key={item.id}
                  className={`bg-[#121216] border rounded-2xl p-3.5 flex items-center justify-between gap-3 transition-all ${
                    item.completed ? 'border-emerald-800/30 bg-emerald-950/10' : 'border-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {isDaily ? (
                      <button
                        onClick={() => onToggleDaily(item.id)}
                        className="text-zinc-500 hover:text-emerald-400 transition-transform active:scale-90 cursor-pointer shrink-0"
                      >
                        {item.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Circle className="w-4 h-4" />
                        )}
                      </button>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                    )}

                    <span className={`text-sm text-zinc-200 truncate ${item.completed ? 'line-through opacity-60' : ''}`}>
                      {item.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.streakCount !== undefined && item.streakCount > 0 && (
                      <span className="text-xs font-mono text-orange-400 flex items-center gap-0.5">
                        <Flame className="w-3 h-3" /> {item.streakCount}
                      </span>
                    )}

                    {!isDaily && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onTriggerHabit(item.id, 'positive')}
                          className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-emerald-950 text-zinc-300 hover:text-emerald-300 font-bold text-xs flex items-center justify-center transition-all cursor-pointer"
                        >
                          +
                        </button>
                        <button
                          onClick={() => onTriggerHabit(item.id, 'negative')}
                          className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-rose-950 text-zinc-300 hover:text-rose-300 font-bold text-xs flex items-center justify-center transition-all cursor-pointer"
                        >
                          -
                        </button>
                      </div>
                    )}

                    {onDeleteTask && (
                      <button
                        onClick={() => onDeleteTask(item.id)}
                        className="p-1.5 text-zinc-600 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Удалить"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ─── 3. SubTab: POMODORO ──────────────────────────────────────────────── */}
      {activeSubTab === 'pomodoro' && (
        <div className="bg-[#121216] border border-white/[0.06] rounded-3xl p-6 shadow-xl max-w-lg mx-auto">
          <div className="flex items-center gap-2 pb-4 mb-4 border-b border-white/[0.06] text-xs font-semibold text-zinc-400">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>Фокус-Спринт 25 минут</span>
          </div>
          <PomodoroTimerWidget />
        </div>
      )}

    </div>
  );
}
