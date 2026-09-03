import React, { useState } from 'react';
import { TaskItem, Project, UserStats } from '../types';
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Flame,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

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

// Helper: get today's date string YYYY-MM-DD
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// Helper: check if a completedAt ISO string is from today
function isCompletedToday(completedAt?: string): boolean {
  if (!completedAt) return false;
  return completedAt.slice(0, 10) === todayStr();
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
  const [showCompleted, setShowCompleted] = useState(true);
  const [showHabits, setShowHabits] = useState(true);

  const now = new Date();
  const formattedDate = now.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const displayDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  // ── Todos ────────────────────────────────────────────────────────────────
  const allTodos = tasks.filter((t) => t.type === 'todo');
  const activeTasks = allTodos.filter((t) => !t.completed);
  // Only show tasks completed TODAY
  const completedToday = allTodos.filter((t) => t.completed && isCompletedToday(t.completedAt));

  // ── Habits & Dailies ─────────────────────────────────────────────────────
  const dailies = tasks.filter((t) => t.type === 'daily');
  const habits = tasks.filter((t) => t.type === 'habit');
  const allHabits = [...dailies, ...habits];

  // HP / EXP bars
  const hpPct = Math.round(Math.max(0, Math.min(100, (stats.hp / stats.maxHp) * 100)));
  const expPct = Math.round(Math.max(0, Math.min(100, (stats.exp / stats.maxExp) * 100)));

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTaskTitle.trim()) return;
    onAddTask({
      title: quickTaskTitle.trim(),
      type: 'todo',
      priority: isPriority ? 'p1' : 'p2',
      projectId: projects[0]?.id || 'proj-inbox',
      difficulty: isPriority ? 'hard' : 'medium',
      expReward: isPriority ? 50 : 35,
      goldReward: isPriority ? 30 : 20,
      tags: isPriority ? ['Срочно'] : [],
    });
    setQuickTaskTitle('');
    setIsPriority(false);
  };

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 sm:px-6 space-y-5 text-zinc-100">

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">
            {displayDate}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-0.5">
            Сегодня
          </h1>
        </div>

        {/* HP / EXP compact bars */}
        <div className="flex items-center gap-4 p-3 rounded-2xl bg-[#111115] border border-white/[0.05]">
          <div className="flex-1 space-y-1">
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
              <span>HP</span>
              <span>{stats.hp}/{stats.maxHp}</span>
            </div>
            <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-500/70 rounded-full transition-all duration-500"
                style={{ width: `${hpPct}%` }}
              />
            </div>
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
              <span>EXP</span>
              <span>{stats.exp}/{stats.maxExp}</span>
            </div>
            <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500/70 rounded-full transition-all duration-500"
                style={{ width: `${expPct}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs pl-2 border-l border-white/[0.06]">
            <span className="text-zinc-400">Ур. <strong className="text-white">{stats.level}</strong></span>
            <span className="text-amber-400 font-mono font-semibold">{stats.gold} 🪙</span>
          </div>
        </div>
      </div>

      {/* ── QUICK ADD ───────────────────────────────────────────────────── */}
      <form
        onSubmit={handleQuickAdd}
        className="flex items-center gap-2 bg-[#111115] border border-white/[0.08] focus-within:border-zinc-500/50 rounded-2xl p-2 transition-all"
      >
        <input
          type="text"
          placeholder="Добавить задачу на сегодня... (Enter)"
          value={quickTaskTitle}
          onChange={(e) => setQuickTaskTitle(e.target.value)}
          className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none"
          autoFocus
        />
        <button
          type="button"
          onClick={() => setIsPriority(!isPriority)}
          title="Пометить как срочную (P1)"
          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer shrink-0 ${
            isPriority
              ? 'bg-rose-950/70 border border-rose-700/50 text-rose-300'
              : 'bg-zinc-900 border border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {isPriority ? '⚡ Срочно' : 'Обычная'}
        </button>
        <button
          type="submit"
          disabled={!quickTaskTitle.trim()}
          className="flex items-center gap-1 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 disabled:opacity-25 text-zinc-950 font-semibold text-xs transition-all active:scale-95 cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Добавить
        </button>
      </form>

      {/* ── ACTIVE TASKS ────────────────────────────────────────────────── */}
      <section className="space-y-2">
        {activeTasks.length === 0 && completedToday.length === 0 && allHabits.length === 0 ? (
          /* Empty state: completely clean day */
          <div className="py-14 text-center rounded-3xl bg-[#0e0e12] border border-white/[0.04] space-y-3">
            <div className="text-3xl">✨</div>
            <p className="text-sm font-semibold text-zinc-300">День чист</p>
            <p className="text-xs text-zinc-500">
              Добавьте первую задачу, чтобы начать
            </p>
          </div>
        ) : (
          <>
            {activeTasks.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-600 border border-dashed border-white/[0.06] rounded-2xl">
                Все задачи на сегодня выполнены 🎉
              </div>
            ) : (
              <div className="space-y-1.5">
                {activeTasks.map((task) => (
                  <div
                    key={task.id}
                    className="group flex items-center gap-3 p-3.5 rounded-2xl bg-[#111115] hover:bg-[#15151b] border border-white/[0.05] hover:border-white/[0.10] transition-all"
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => onToggleTask(task.id)}
                      className="shrink-0 text-zinc-500 hover:text-emerald-400 transition-colors cursor-pointer active:scale-90"
                      title="Отметить выполненной"
                    >
                      <Circle className="w-4 h-4" />
                    </button>

                    {/* Title */}
                    <span className="flex-1 text-sm text-zinc-200 truncate">
                      {task.title}
                    </span>

                    {/* Priority badge */}
                    {task.priority === 'p1' && (
                      <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-800/40 text-rose-300">
                        P1
                      </span>
                    )}

                    {/* XP reward */}
                    <span className="shrink-0 text-[11px] font-mono text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      +{task.expReward} xp
                    </span>

                    {/* Delete */}
                    {onDeleteTask && (
                      <button
                        onClick={() => onDeleteTask(task.id)}
                        className="shrink-0 p-1 text-zinc-700 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                        title="Удалить"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* ── HABITS & DAILIES ────────────────────────────────────────────── */}
      {allHabits.length > 0 && (
        <section>
          <button
            onClick={() => setShowHabits(!showHabits)}
            className="w-full flex items-center justify-between py-2 text-xs font-semibold text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              Привычки
              <span className="font-mono text-[10px] bg-zinc-900 px-1.5 py-0.5 rounded-full">
                {allHabits.filter((h) => !h.completed).length} осталось
              </span>
            </span>
            {showHabits ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showHabits && (
            <div className="space-y-1.5 mt-1">
              {allHabits.map((item) => {
                const isDaily = item.type === 'daily';
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                      item.completed
                        ? 'bg-[#0e0e12] border-white/[0.03] opacity-60'
                        : 'bg-[#111115] border-white/[0.05] hover:border-white/[0.10]'
                    }`}
                  >
                    {/* Toggle (daily) or dot (habit) */}
                    {isDaily ? (
                      <button
                        onClick={() => onToggleDaily(item.id)}
                        className="shrink-0 cursor-pointer transition-colors text-zinc-500 hover:text-emerald-400 active:scale-90"
                      >
                        {item.completed
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          : <Circle className="w-4 h-4" />
                        }
                      </button>
                    ) : (
                      <span className="shrink-0 w-2 h-2 rounded-full bg-orange-400 ml-1" />
                    )}

                    {/* Title */}
                    <span className={`flex-1 text-sm truncate ${item.completed ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                      {item.title}
                    </span>

                    {/* Streak */}
                    {(item.streakCount ?? 0) > 0 && (
                      <span className="shrink-0 flex items-center gap-0.5 text-[11px] font-mono text-orange-400">
                        <Flame className="w-3 h-3" />
                        {item.streakCount}
                      </span>
                    )}

                    {/* Habit +/- buttons */}
                    {!isDaily && (
                      <div className="shrink-0 flex items-center gap-1">
                        <button
                          onClick={() => onTriggerHabit(item.id, 'positive')}
                          className="w-6 h-6 rounded-lg bg-zinc-800 hover:bg-emerald-900/60 text-zinc-300 hover:text-emerald-300 font-bold text-xs flex items-center justify-center transition-all cursor-pointer"
                        >
                          +
                        </button>
                        <button
                          onClick={() => onTriggerHabit(item.id, 'negative')}
                          className="w-6 h-6 rounded-lg bg-zinc-800 hover:bg-rose-900/60 text-zinc-300 hover:text-rose-300 font-bold text-xs flex items-center justify-center transition-all cursor-pointer"
                        >
                          −
                        </button>
                      </div>
                    )}

                    {/* Delete */}
                    {onDeleteTask && (
                      <button
                        onClick={() => onDeleteTask(item.id)}
                        className="shrink-0 p-1 text-zinc-700 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Удалить"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── COMPLETED TODAY ─────────────────────────────────────────────── */}
      {completedToday.length > 0 && (
        <section>
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="w-full flex items-center justify-between py-2 text-xs font-semibold text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Выполнено сегодня
              <span className="font-mono text-[10px] bg-zinc-900 px-1.5 py-0.5 rounded-full">
                {completedToday.length}
              </span>
            </span>
            {showCompleted ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showCompleted && (
            <div className="space-y-1 mt-1 opacity-60">
              {completedToday.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-[#0e0e12] border border-transparent hover:border-white/[0.04] transition-all"
                >
                  <button
                    onClick={() => onToggleTask(task.id)}
                    className="shrink-0 text-emerald-500 cursor-pointer active:scale-90"
                    title="Вернуть в список"
                  >
                    <CheckCircle2 className="w-4 h-4 fill-emerald-500/20" />
                  </button>

                  <span className="flex-1 text-sm text-zinc-500 line-through truncate">
                    {task.title}
                  </span>

                  {onDeleteTask && (
                    <button
                      onClick={() => onDeleteTask(task.id)}
                      className="shrink-0 p-1 text-zinc-700 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Удалить"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

    </div>
  );
}
