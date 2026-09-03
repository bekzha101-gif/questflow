import React, { useState } from 'react';
import { TaskItem, Project, UserStats, Reward } from '../types';
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Flame,
  ShoppingBag,
  Minus,
} from 'lucide-react';

interface CommandCenterTodayProps {
  tasks: TaskItem[];
  projects: Project[];
  stats: UserStats;
  rewards?: Reward[];
  onToggleTask: (taskId: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onTriggerHabit: (taskId: string, direction: 'positive' | 'negative') => void;
  onToggleDaily: (taskId: string) => void;
  onAddTask: (task: Omit<TaskItem, 'id' | 'completed' | 'subtasks'>) => void;
  onDeleteTask?: (taskId: string) => void;
  onBuyReward?: (reward: Reward) => boolean;
  onOpenQuickAdd: () => void;
  onOpenStudioTab?: () => void;
  onOpenLifeTab?: () => void;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function isCompletedToday(completedAt?: string): boolean {
  if (!completedAt) return false;
  return completedAt.slice(0, 10) === todayStr();
}

type TodoFilter = 'active' | 'completed';

// ─── Column wrapper ───────────────────────────────────────────────────────────
function Column({ title, count, badge, children }: {
  title: string;
  count?: number;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col bg-[#0f0f13] border border-white/[0.06] rounded-2xl overflow-hidden min-h-0">
      {/* Column header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-[#111115]">
        <span className="text-sm font-semibold text-zinc-100">{title}</span>
        {count !== undefined && (
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
            {count}
          </span>
        )}
        {badge && (
          <span className="ml-auto text-[10px] font-medium text-zinc-500">{badge}</span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {children}
      </div>
    </div>
  );
}

// ─── Mini add input ───────────────────────────────────────────────────────────
function AddInput({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  const [val, setVal] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!val.trim()) return;
    onAdd(val.trim());
    setVal('');
  };
  return (
    <form onSubmit={submit} className="flex items-center gap-1.5 mb-1">
      <input
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-[#1a1a20] border border-white/[0.07] focus:border-zinc-500/50 rounded-xl px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none transition-colors"
      />
      <button
        type="submit"
        disabled={!val.trim()}
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-zinc-300 transition-colors cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </form>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function CommandCenterToday({
  tasks,
  projects,
  stats,
  rewards = [],
  onToggleTask,
  onTriggerHabit,
  onToggleDaily,
  onAddTask,
  onDeleteTask,
  onBuyReward,
}: CommandCenterTodayProps) {
  const [todoFilter, setTodoFilter] = useState<TodoFilter>('active');
  const [boughtId, setBoughtId] = useState<string | null>(null);

  // ── Data ──────────────────────────────────────────────────────────────────
  const habits = tasks.filter((t) => t.type === 'habit');
  const dailies = tasks.filter((t) => t.type === 'daily');
  const allTodos = tasks.filter((t) => t.type === 'todo');
  const activeTodos = allTodos.filter((t) => !t.completed);
  const completedTodayTodos = allTodos.filter((t) => t.completed && isCompletedToday(t.completedAt));
  const shownTodos = todoFilter === 'active' ? activeTodos : completedTodayTodos;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const addHabit = (title: string) => {
    onAddTask({
      title,
      type: 'habit',
      priority: 'p2',
      projectId: projects[0]?.id || 'proj-inbox',
      difficulty: 'easy',
      expReward: 20,
      goldReward: 10,
      tags: [],
      habitDirection: 'both',
      habitCounter: 0,
    });
  };

  const addDaily = (title: string) => {
    onAddTask({
      title,
      type: 'daily',
      priority: 'p2',
      projectId: projects[0]?.id || 'proj-inbox',
      difficulty: 'easy',
      expReward: 25,
      goldReward: 15,
      streakCount: 0,
      tags: [],
    });
  };

  const addTodo = (title: string) => {
    onAddTask({
      title,
      type: 'todo',
      priority: 'p2',
      projectId: projects[0]?.id || 'proj-inbox',
      difficulty: 'medium',
      expReward: 35,
      goldReward: 20,
      tags: [],
    });
  };

  const handleBuy = (reward: Reward) => {
    if (!onBuyReward) return;
    const ok = onBuyReward(reward);
    if (ok) {
      setBoughtId(reward.id);
      setTimeout(() => setBoughtId(null), 1200);
    }
  };

  // ── Date display ──────────────────────────────────────────────────────────
  const now = new Date();
  const dateStr = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  const displayDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">

      {/* ── Top bar: date + stats ──────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/[0.05] bg-[#09090b]">
        <div>
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">{displayDate}</p>
          <h1 className="text-lg font-bold text-white leading-tight">Сегодня</h1>
        </div>

        {/* HP / EXP / Gold compact row */}
        <div className="flex items-center gap-4">
          {/* HP bar */}
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-[10px] text-rose-400 font-mono w-5">HP</span>
            <div className="w-24 h-1.5 bg-zinc-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-500/80 rounded-full transition-all duration-500"
                style={{ width: `${Math.round((stats.hp / stats.maxHp) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-zinc-500">{stats.hp}</span>
          </div>

          {/* EXP bar */}
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-[10px] text-indigo-400 font-mono w-8">EXP</span>
            <div className="w-24 h-1.5 bg-zinc-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500/80 rounded-full transition-all duration-500"
                style={{ width: `${Math.round((stats.exp / stats.maxExp) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-zinc-500">{stats.exp}</span>
          </div>

          {/* Level + Gold */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#111115] border border-white/[0.05]">
            <span className="text-xs text-zinc-400">Ур. <strong className="text-white">{stats.level}</strong></span>
            <span className="text-zinc-600">·</span>
            <span className="text-amber-400 font-mono text-xs font-semibold">{stats.gold} 🪙</span>
          </div>
        </div>
      </div>

      {/* ── 4-Column Grid ─────────────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 p-4 sm:p-5 overflow-hidden min-h-0">

        {/* ── COL 1: HABITS ─────────────────────────────────────────── */}
        <Column title="Привычки" count={habits.length}>
          <AddInput placeholder="Добавить привычку..." onAdd={addHabit} />

          {habits.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs text-zinc-600">Нет привычек</p>
              <p className="text-[10px] text-zinc-700 mt-1">Нажмите + чтобы добавить</p>
            </div>
          ) : (
            habits.map((habit) => (
              <div
                key={habit.id}
                className="group flex items-center gap-2 px-2.5 py-2 rounded-xl bg-[#16161c] hover:bg-[#1c1c24] border border-white/[0.04] hover:border-white/[0.08] transition-all"
              >
                {/* Positive button */}
                <button
                  onClick={() => onTriggerHabit(habit.id, 'positive')}
                  className="shrink-0 w-6 h-6 rounded-lg bg-emerald-900/60 hover:bg-emerald-800/80 text-emerald-300 font-bold text-xs flex items-center justify-center transition-all cursor-pointer active:scale-90"
                  title="+1"
                >
                  <Plus className="w-3 h-3" />
                </button>

                {/* Title */}
                <span className="flex-1 text-xs text-zinc-300 truncate">{habit.title}</span>

                {/* Counter */}
                {(habit.habitCounter ?? 0) > 0 && (
                  <span className="shrink-0 text-[10px] font-mono text-zinc-600">
                    ×{habit.habitCounter}
                  </span>
                )}

                {/* Negative button */}
                <button
                  onClick={() => onTriggerHabit(habit.id, 'negative')}
                  className="shrink-0 w-6 h-6 rounded-lg bg-rose-900/60 hover:bg-rose-800/80 text-rose-300 font-bold text-xs flex items-center justify-center transition-all cursor-pointer active:scale-90"
                  title="−1"
                >
                  <Minus className="w-3 h-3" />
                </button>

                {/* Delete on hover */}
                {onDeleteTask && (
                  <button
                    onClick={() => onDeleteTask(habit.id)}
                    className="shrink-0 p-1 text-zinc-700 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                    title="Удалить"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))
          )}
        </Column>

        {/* ── COL 2: DAILIES ──────────────────────────────────────────── */}
        <Column title="Ежедневные" count={dailies.filter((d) => !d.completed).length} badge={`${dailies.filter((d) => d.completed).length}/${dailies.length} ✓`}>
          <AddInput placeholder="Добавить ежедневную..." onAdd={addDaily} />

          {dailies.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs text-zinc-600">Нет ежедневных задач</p>
              <p className="text-[10px] text-zinc-700 mt-1">Нажмите + чтобы добавить</p>
            </div>
          ) : (
            dailies.map((daily) => (
              <div
                key={daily.id}
                className={`group flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl border transition-all ${
                  daily.completed
                    ? 'bg-[#0e0e12] border-white/[0.03] opacity-50'
                    : 'bg-[#16161c] hover:bg-[#1c1c24] border-white/[0.04] hover:border-white/[0.09]'
                }`}
              >
                {/* Checkbox */}
                <button
                  onClick={() => onToggleDaily(daily.id)}
                  className={`shrink-0 cursor-pointer active:scale-90 transition-all ${
                    daily.completed ? 'text-emerald-400' : 'text-zinc-600 hover:text-emerald-400'
                  }`}
                >
                  {daily.completed
                    ? <CheckCircle2 className="w-4 h-4 fill-emerald-500/20" />
                    : <Circle className="w-4 h-4" />
                  }
                </button>

                {/* Title */}
                <span className={`flex-1 text-xs truncate ${daily.completed ? 'line-through text-zinc-600' : 'text-zinc-300'}`}>
                  {daily.title}
                </span>

                {/* Streak */}
                {(daily.streakCount ?? 0) > 0 && (
                  <span className="shrink-0 flex items-center gap-0.5 text-[10px] font-mono text-orange-400">
                    <Flame className="w-2.5 h-2.5" />
                    {daily.streakCount}
                  </span>
                )}

                {/* Delete on hover */}
                {onDeleteTask && (
                  <button
                    onClick={() => onDeleteTask(daily.id)}
                    className="shrink-0 p-1 text-zinc-700 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                    title="Удалить"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))
          )}
        </Column>

        {/* ── COL 3: TO-DO's ──────────────────────────────────────────── */}
        <Column title="Задачи" count={activeTodos.length}>
          <AddInput placeholder="Добавить задачу..." onAdd={addTodo} />

          {/* Filter tabs */}
          <div className="flex items-center gap-1 mb-1">
            {(['active', 'completed'] as TodoFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setTodoFilter(f)}
                className={`flex-1 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                  todoFilter === f
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
                {f === 'active' ? 'Активные' : `Выполнено (${completedTodayTodos.length})`}
              </button>
            ))}
          </div>

          {shownTodos.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs text-zinc-600">
                {todoFilter === 'active' ? 'Нет задач 🎉' : 'Сегодня ничего не выполнено'}
              </p>
            </div>
          ) : (
            shownTodos.map((task) => (
              <div
                key={task.id}
                className={`group flex items-center gap-2.5 rounded-xl border transition-all overflow-hidden ${
                  task.completed
                    ? 'bg-[#0e0e12] border-white/[0.03] opacity-55'
                    : 'bg-[#16161c] hover:bg-[#1c1c24] border-white/[0.04] hover:border-white/[0.09]'
                }`}
              >
                {/* Priority color stripe */}
                <div className={`w-0.5 self-stretch shrink-0 ${
                  task.priority === 'p1' ? 'bg-rose-500' :
                  task.priority === 'p2' ? 'bg-amber-500/60' :
                  'bg-zinc-700'
                }`} />

                <div className="flex items-center gap-2.5 flex-1 min-w-0 py-2.5 pr-2.5">
                  {/* Checkbox */}
                  <button
                    onClick={() => onToggleTask(task.id)}
                    className={`shrink-0 cursor-pointer active:scale-90 transition-all ${
                      task.completed ? 'text-emerald-400' : 'text-zinc-600 hover:text-emerald-400'
                    }`}
                  >
                    {task.completed
                      ? <CheckCircle2 className="w-4 h-4 fill-emerald-500/20" />
                      : <Circle className="w-4 h-4" />
                    }
                  </button>

                  {/* Title */}
                  <span className={`flex-1 text-xs truncate ${task.completed ? 'line-through text-zinc-600' : 'text-zinc-300'}`}>
                    {task.title}
                  </span>

                  {/* XP */}
                  <span className="shrink-0 text-[10px] font-mono text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity">
                    +{task.expReward}xp
                  </span>

                  {/* Delete on hover */}
                  {onDeleteTask && (
                    <button
                      onClick={() => onDeleteTask(task.id)}
                      className="shrink-0 p-1 text-zinc-700 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      title="Удалить"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </Column>

        {/* ── COL 4: REWARDS ──────────────────────────────────────────── */}
        <Column title="Награды" badge={`🪙 ${stats.gold}`}>
          <div className="flex items-center gap-1.5 mb-1 p-2 rounded-xl bg-[#16161c] border border-white/[0.04]">
            <ShoppingBag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[11px] text-zinc-400">Трать золото на награды</span>
          </div>

          {rewards.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs text-zinc-600">Нет наград в магазине</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {rewards.map((reward) => {
                const canAfford = stats.gold >= reward.cost;
                const justBought = boughtId === reward.id;
                return (
                  <button
                    key={reward.id}
                    onClick={() => handleBuy(reward)}
                    disabled={!canAfford || !onBuyReward}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all cursor-pointer active:scale-95 disabled:cursor-not-allowed ${
                      justBought
                        ? 'bg-emerald-950/40 border-emerald-700/40'
                        : canAfford
                          ? 'bg-[#16161c] hover:bg-[#1e1e28] border-white/[0.06] hover:border-amber-700/30'
                          : 'bg-[#111115] border-white/[0.03] opacity-40'
                    }`}
                    title={reward.description}
                  >
                    <span className="text-xl leading-none">{reward.icon}</span>
                    <span className="text-[10px] text-zinc-300 font-medium leading-tight line-clamp-2">
                      {reward.title}
                    </span>
                    <span className={`text-[10px] font-mono font-bold ${
                      justBought ? 'text-emerald-400' : canAfford ? 'text-amber-400' : 'text-zinc-600'
                    }`}>
                      {justBought ? '✓ куплено' : `🪙 ${reward.cost}`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </Column>

      </div>
    </div>
  );
}
