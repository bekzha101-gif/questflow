import React, { useState } from 'react';
import { TaskItem, Project, UserStats } from '../types';
import { 
  CheckCircle2, 
  Circle, 
  Flame, 
  Plus, 
  Sparkles, 
  Zap, 
  Calendar, 
  Clock, 
  Compass, 
  Coins, 
  Heart, 
  ArrowRight,
  TrendingUp,
  Target,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Trophy,
  Coffee
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
  onOpenQuickAdd: () => void;
  onOpenStudioTab?: () => void;
  onOpenLifeTab?: () => void;
}

export function CommandCenterToday({
  tasks,
  projects,
  stats,
  onToggleTask,
  onToggleSubtask,
  onTriggerHabit,
  onToggleDaily,
  onAddTask,
  onOpenQuickAdd,
  onOpenStudioTab,
  onOpenLifeTab,
}: CommandCenterTodayProps) {
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || 'inbox');

  const now = new Date();
  const todayStr = now.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  // Filter Tasks for Today
  const todayTasks = tasks.filter((t) => {
    if (t.type !== 'todo') return false;
    if (t.priority === 'p1' && !t.completed) return true;
    if (t.dueDate) {
      const taskDate = new Date(t.dueDate);
      return (
        taskDate.getDate() === now.getDate() &&
        taskDate.getMonth() === now.getMonth() &&
        taskDate.getFullYear() === now.getFullYear()
      );
    }
    return !t.completed;
  }).slice(0, 8);

  const completedTodayTasksCount = tasks.filter(
    (t) => t.type === 'todo' && t.completed
  ).length;

  // Filter Habits & Dailies
  const dailies = tasks.filter((t) => t.type === 'daily');
  const habits = tasks.filter((t) => t.type === 'habit');
  const completedDailiesCount = dailies.filter((d) => d.completed).length;
  const totalDailiesCount = dailies.length;
  const dailiesProgress = totalDailiesCount > 0 ? Math.round((completedDailiesCount / totalDailiesCount) * 100) : 100;

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTaskTitle.trim()) return;

    onAddTask({
      title: quickTaskTitle.trim(),
      type: 'todo',
      priority: 'p1',
      projectId: selectedProjectId,
      difficulty: 'medium',
      expReward: 35,
      goldReward: 20,
      tags: ['Фокус Дня'],
    });

    setQuickTaskTitle('');
  };

  return (
    <div className="max-w-7xl mx-auto py-3 px-3 sm:px-6 space-y-6 animate-fade-in select-none text-zinc-200">
      
      {/* ─── 1. Minimalist Morning Briefing Header ─────────────────────────── */}
      <div className="bg-[#101014] border border-white/[0.06] rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
              <span>{todayStr}</span>
              <span>•</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-orange-400" /> {stats.streak} дней подряд
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
              Командный Центр • Ваш Фокус на Сегодня
            </h1>
            <p className="text-xs text-zinc-400 mt-1 max-w-xl">
              Только самое важное: 3 ключевые задачи, привычки и таймер потока. Никакого визуального шума.
            </p>
          </div>

          {/* Hero RPG Status Pill */}
          <div className="flex items-center gap-3 bg-black/40 border border-white/10 rounded-2xl p-2.5 px-3.5 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-base">
              {stats.heroClass === 'Warrior' ? '⚔️' : stats.heroClass === 'Mage' ? '🧙‍♂️' : stats.heroClass === 'Rogue' ? '🗡️' : '🌿'}
            </div>
            <div className="space-y-0.5 font-mono text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">Ур. {stats.level} {stats.heroClass}</span>
                <span className="text-[10px] text-amber-400 font-bold">{stats.gold} 🪙</span>
              </div>
              <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                  style={{ width: `${Math.min(100, (stats.exp / stats.maxExp) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2. Core 3-Pillar Workspace Grid ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* ─── Pillar A: Top Tasks for Today (Col span 7) ──────────────────── */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#101014] border border-white/[0.06] rounded-3xl p-5 shadow-xl space-y-4">
            
            {/* Column Header */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/[0.04]">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-400" />
                <h2 className="text-sm font-bold text-white">Главные Задачи на Сегодня</h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-950/60 text-purple-300 border border-purple-800/40">
                  {todayTasks.filter(t => !t.completed).length} активных
                </span>
              </div>

              <button
                onClick={onOpenQuickAdd}
                className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Все задачи</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Inline Quick Task Input */}
            <form onSubmit={handleQuickAddSubmit} className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Добавить задачу на сегодня... (Нажмите Enter)"
                  value={quickTaskTitle}
                  onChange={(e) => setQuickTaskTitle(e.target.value)}
                  className="w-full bg-[#181820] border border-white/[0.08] focus:border-purple-500/60 rounded-2xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none transition-all shadow-inner"
                />
              </div>
              <button
                type="submit"
                className="px-3.5 py-2.5 rounded-2xl bg-white text-zinc-950 font-bold text-xs hover:bg-zinc-200 active:scale-95 transition-all shadow cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>

            {/* Task List Items */}
            <div className="space-y-2 pt-1">
              {todayTasks.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-black/20 border border-white/[0.02] space-y-2">
                  <span className="text-2xl">🎉</span>
                  <p className="text-xs text-zinc-400 font-medium">Все главные задачи на сегодня выполнены!</p>
                  <p className="text-[11px] text-zinc-600">Добавьте новую задачу сверху или отдохните.</p>
                </div>
              ) : (
                todayTasks.map((task) => {
                  const project = projects.find((p) => p.id === task.projectId);
                  return (
                    <div
                      key={task.id}
                      className={`group p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
                        task.completed
                          ? 'bg-black/30 border-transparent opacity-50'
                          : 'bg-[#14141a] hover:bg-[#181822] border-white/[0.05] hover:border-purple-500/30 shadow-md'
                      }`}
                    >
                      {/* Complete Checkbox */}
                      <button
                        onClick={() => onToggleTask(task.id)}
                        className={`mt-0.5 transition-transform active:scale-90 cursor-pointer ${
                          task.completed ? 'text-emerald-400' : 'text-zinc-500 hover:text-purple-400'
                        }`}
                      >
                        {task.completed ? (
                          <CheckCircle2 className="w-4 h-4 fill-emerald-500/20" />
                        ) : (
                          <Circle className="w-4 h-4" />
                        )}
                      </button>

                      {/* Title & Tags */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-xs font-semibold block truncate ${
                              task.completed ? 'line-through text-zinc-500' : 'text-zinc-100'
                            }`}
                          >
                            {task.title}
                          </span>

                          <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px]">
                            {task.priority === 'p1' && (
                              <span className="px-1.5 py-0.2 rounded bg-rose-950/60 text-rose-300 border border-rose-800/40 font-bold">
                                P1 Срочно
                              </span>
                            )}
                            <span className="text-purple-300 bg-purple-950/50 px-1.5 py-0.2 rounded border border-purple-800/30">
                              +{task.expReward} XP
                            </span>
                            <span className="text-amber-400 bg-amber-950/50 px-1.5 py-0.2 rounded border border-amber-800/30">
                              +{task.goldReward} 🪙
                            </span>
                          </div>
                        </div>

                        {/* Project / Tag Sub-bar */}
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                          {project && (
                            <span className="flex items-center gap-1 text-zinc-400">
                              <span>{project.icon}</span> {project.name}
                            </span>
                          )}
                          {task.subtasks?.length > 0 && (
                            <span>
                              {task.subtasks.filter((st) => st.completed).length}/{task.subtasks.length} подзадач
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Daily Motivational Life Pill */}
          <div 
            onClick={onOpenLifeTab}
            className="p-4 rounded-3xl bg-gradient-to-r from-emerald-950/30 via-[#101014] to-rose-950/30 border border-emerald-500/20 hover:border-emerald-500/40 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-lg"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">⏳</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">Календарь Жизни • 18 лет</span>
                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.2 rounded-md border border-emerald-700/40">
                    🟢 100% Пик Энергии
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Осталось ~315 недель абсолютного золотого пика до 25 лет. Каждый час сегодня дает x10 отдачу.
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-emerald-400 shrink-0" />
          </div>
        </div>

        {/* ─── Pillar B: Habits, Dailies & Focus Sprint (Col span 5) ───────── */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Habits & Dailies Card */}
          <div className="bg-[#101014] border border-white/[0.06] rounded-3xl p-5 shadow-xl space-y-4">
            
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-400" />
                <h2 className="text-sm font-bold text-white">Привычки & Дейлики</h2>
              </div>
              <span className="text-xs font-mono text-orange-300 font-bold">
                {completedDailiesCount}/{totalDailiesCount} ({dailiesProgress}%)
              </span>
            </div>

            {/* Dailies Progress Bar */}
            <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${dailiesProgress}%` }}
              />
            </div>

            {/* Dailies List */}
            <div className="space-y-2">
              {dailies.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-4">Нет активных дейликов</p>
              ) : (
                dailies.map((daily) => (
                  <div
                    key={daily.id}
                    onClick={() => onToggleDaily(daily.id)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                      daily.completed
                        ? 'bg-emerald-950/20 border-emerald-800/30 text-emerald-300'
                        : 'bg-[#14141a] hover:bg-[#181822] border-white/[0.05] text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {daily.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-zinc-500 shrink-0" />
                      )}
                      <span className={`text-xs font-medium truncate ${daily.completed ? 'line-through opacity-70' : ''}`}>
                        {daily.title}
                      </span>
                    </div>

                    <span className="text-[10px] font-mono text-orange-400 font-bold shrink-0 flex items-center gap-0.5">
                      <Flame className="w-3 h-3" /> {daily.streakCount || 0}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Habits Plus/Minus Tracker */}
            {habits.length > 0 && (
              <div className="pt-2 border-t border-white/[0.04] space-y-2">
                <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider block">
                  Быстрый трекер привычек
                </span>
                <div className="space-y-1.5">
                  {habits.slice(0, 3).map((h) => (
                    <div
                      key={h.id}
                      className="p-2.5 rounded-xl bg-black/40 border border-white/[0.03] flex items-center justify-between gap-2"
                    >
                      <span className="text-xs text-zinc-300 truncate">{h.title}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onTriggerHabit(h.id, 'positive')}
                          className="w-6 h-6 rounded-lg bg-emerald-950 text-emerald-300 hover:bg-emerald-900 border border-emerald-700/50 text-xs font-bold flex items-center justify-center transition-all cursor-pointer"
                        >
                          +
                        </button>
                        <button
                          onClick={() => onTriggerHabit(h.id, 'negative')}
                          className="w-6 h-6 rounded-lg bg-rose-950 text-rose-300 hover:bg-rose-900 border border-rose-700/50 text-xs font-bold flex items-center justify-center transition-all cursor-pointer"
                        >
                          -
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Focus Sprint Pomodoro Widget Card */}
          <div className="bg-[#101014] border border-white/[0.06] rounded-3xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-400" /> Фокус-Спринт (Помодоро)
              </span>
              <span className="text-[10px] font-mono text-zinc-500">25 мин + Альфа-волны</span>
            </div>

            <PomodoroTimerWidget />
          </div>

        </div>
      </div>
    </div>
  );
}
