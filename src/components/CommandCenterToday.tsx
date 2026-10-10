import React, { useState } from 'react';
import { TaskItem, Project, UserStats, Reward } from '../types';
import { isShoppingTask } from '../utils/taskFilters';
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Flame,
  ShoppingBag,
  Minus,
  ChevronDown,
  ChevronRight,
  Calendar,
  AlertCircle,
  Pencil,
  Heart,
  X,
  Check,
  Sparkles,
} from 'lucide-react';
import { playQuestCompleteSound, playCoinSound } from '../utils/sound';
import { triggerQuestConfetti } from '../utils/confetti';
import { 
  loadRecoveryCycleConfig, 
  getDayCycleInfo, 
  loadCompletedRecoveryActivities, 
  saveCompletedRecoveryActivities, 
  RecoveryActivity 
} from '../utils/recoveryCycle';

interface CommandCenterTodayProps {
  tasks: TaskItem[];
  projects: Project[];
  stats: UserStats;
  rewards?: Reward[];
  onToggleTask: (taskId: string) => void;
  onToggleSubtask?: (taskId: string, subtaskId: string) => void;
  onTriggerHabit: (taskId: string, direction: 'positive' | 'negative') => void;
  onToggleDaily: (taskId: string) => void;
  onAddTask: (task: Omit<TaskItem, 'id' | 'completed' | 'subtasks'>) => void;
  onUpdateTask?: (taskId: string, patch: Partial<TaskItem>) => void;
  onEditTask?: (task: TaskItem) => void;
  onAddSubtask?: (taskId: string, text: string) => void;
  onDeleteTask?: (taskId: string) => void;
  onBuyReward?: (reward: Reward) => boolean;
  onOpenQuickAdd: () => void;
  onOpenHealthModal?: () => void;
  onOpenStudioTab?: () => void;
  onOpenLifeTab?: () => void;
  onOpenShoppingTab?: () => void;
  onUpdateStats?: (newStats: Partial<UserStats>) => void;
  onAwardRewards?: (exp: number, gold: number, hp?: number) => void;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function isCompletedToday(completedAt?: string): boolean {
  if (!completedAt) return false;
  return completedAt.slice(0, 10) === todayStr();
}

function isOverdue(dueDate?: string): boolean {
  if (!dueDate) return false;
  return dueDate < todayStr();
}

function formatDueDate(dueDate: string): string {
  const today = todayStr();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  if (dueDate === today) return 'Сегодня';
  if (dueDate === tomorrowStr) return 'Завтра';

  return new Date(dueDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

type TodoFilter = 'active' | 'completed';

// ─── Column wrapper (Linear / Raycast Style) ──────────────────────────────────
function Column({ title, count, badge, children }: {
  title: string;
  count?: number;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col bg-[#0e0e13] border border-white/[0.07] hover:border-white/[0.1] rounded-2xl overflow-hidden transition-colors shadow-sm">
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.06] bg-[#121218] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-200 tracking-tight">{title}</span>
          {count !== undefined && (
            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-400">
              {count}
            </span>
          )}
        </div>
        {badge && (
          <div className="text-[10px] font-medium text-zinc-400">
            {badge}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2 min-h-0">
        {children}
      </div>
    </div>
  );
}

// ─── Mini add input (Linear style clean bar) ──────────────────────────────────
function AddInput({ 
  placeholder, 
  onAdd, 
  disabled = false, 
  disabledMessage 
}: { 
  placeholder: string; 
  onAdd: (v: string) => void;
  disabled?: boolean;
  disabledMessage?: string;
}) {
  const [val, setVal] = useState('');

  if (disabled) {
    return (
      <div className="flex items-center gap-2 mb-2 p-2 rounded-xl bg-rose-950/20 border border-rose-500/25 text-[11px] text-rose-300 font-semibold select-none shadow-xs">
        <X className="w-3.5 h-3.5 text-rose-400 shrink-0" />
        <span className="truncate">{disabledMessage || 'Добавление задач заблокировано'}</span>
      </div>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!val.trim()) return;
    onAdd(val.trim());
    setVal('');
  };
  return (
    <form onSubmit={submit} className="flex items-center gap-1.5 mb-1.5">
      <input
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-[#15151d] border border-white/[0.08] focus:border-white/20 rounded-xl px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none transition-colors"
      />
      <button
        type="submit"
        disabled={!val.trim()}
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-xl bg-white/[0.08] hover:bg-white/[0.14] disabled:opacity-25 text-zinc-200 transition-all tactile-btn"
        title="Добавить"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </form>
  );
}

// ─── Task row with expandable detail panel (Linear Style) ─────────────────────
function TaskRow({
  task,
  onToggle,
  onToggleSubtask,
  onAddSubtask,
  onUpdateTask,
  onEdit,
  onDelete,
}: {
  task: TaskItem;
  onToggle: () => void;
  onToggleSubtask?: (subtaskId: string) => void;
  onAddSubtask?: (text: string) => void;
  onUpdateTask?: (patch: Partial<TaskItem>) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [newStep, setNewStep] = useState('');

  const subtasks = task.subtasks ?? [];
  const doneCount = subtasks.filter((s) => s.completed).length;
  const progress = subtasks.length > 0 ? Math.round((doneCount / subtasks.length) * 100) : 0;
  const overdue = isOverdue(task.dueDate) && !task.completed;

  const handleAddStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStep.trim() || !onAddSubtask) return;
    onAddSubtask(newStep.trim());
    setNewStep('');
  };

  return (
    <div className={`rounded-xl border transition-all overflow-hidden ${
      task.completed
        ? 'bg-[#0d0d12] border-white/[0.03] opacity-55'
        : overdue
          ? 'bg-[#181014] border-rose-900/40 hover:border-rose-700/50'
          : 'bg-[#14141a] hover:bg-[#181822] border-white/[0.06] hover:border-white/[0.14]'
    }`}>

      {/* ── Main task row ─────────────────────────────────────────── */}
      <div className="flex items-center gap-0 overflow-hidden">
        {/* Priority stripe */}
        <div className={`w-1 self-stretch shrink-0 rounded-r my-1 ${
          task.priority === 'p1' ? 'bg-rose-500' :
          task.priority === 'p2' ? 'bg-amber-500/80' :
          task.priority === 'p3' ? 'bg-blue-500/60' :
          'bg-zinc-700'
        }`} />

        <div className="flex items-center gap-2 flex-1 min-w-0 py-2 pl-2 pr-2.5">
          {/* Checkbox */}
          <button
            type="button"
            onClick={onToggle}
            className={`shrink-0 tactile-btn p-0.5 ${
              task.completed ? 'text-emerald-400' : 'text-zinc-500 hover:text-emerald-400'
            }`}
            title={task.completed ? 'Отметить невыполненной' : 'Завершить задачу'}
          >
            {task.completed
              ? <CheckCircle2 className="w-4 h-4 fill-emerald-500/20" />
              : <Circle className="w-4 h-4" />
            }
          </button>

          {/* Title — click to expand */}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex-1 text-left flex items-center gap-1.5 min-w-0 group/title cursor-pointer"
          >
            <span className={`text-xs truncate transition-colors ${
              task.completed ? 'line-through text-zinc-500' : 'text-zinc-200 group-hover/title:text-white'
            }`}>
              {task.title}
            </span>

            {subtasks.length > 0 && (
              <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/[0.06] text-zinc-400 font-medium">
                {doneCount}/{subtasks.length}
              </span>
            )}

            {expanded
              ? <ChevronDown className="w-3 h-3 text-zinc-400 shrink-0" />
              : <ChevronRight className="w-3 h-3 text-zinc-500 shrink-0 opacity-0 group-hover/title:opacity-100 transition-opacity" />
            }
          </button>

          {/* Due date badge */}
          {task.dueDate && !task.completed && (
            <span className={`shrink-0 flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md border ${
              overdue
                ? 'text-rose-400 bg-rose-950/40 border-rose-800/40'
                : task.dueDate === todayStr()
                  ? 'text-amber-300 bg-amber-950/40 border-amber-800/30'
                  : 'text-zinc-400 bg-white/[0.04] border-white/5'
            }`}>
              {overdue && <AlertCircle className="w-2.5 h-2.5" />}
              {formatDueDate(task.dueDate)}
            </span>
          )}

          {/* Edit */}
          {onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="shrink-0 p-1 text-zinc-500 hover:text-zinc-200 transition-colors tactile-btn"
              title="Редактировать задачу, чек-лист и дедлайн"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}

          {/* Delete */}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="shrink-0 p-1 text-zinc-600 hover:text-rose-400 transition-colors tactile-btn"
              title="Удалить"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar (collapsed, only if subtasks exist) */}
      {subtasks.length > 0 && !expanded && (
        <div className="h-1 bg-black/40 mx-2.5 mb-1.5 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500/70 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* ── Expanded detail panel (Linear Style) ───────────────────── */}
      {expanded && (
        <div className="border-t border-white/[0.06] px-3.5 py-2.5 space-y-2.5 bg-[#111116]">

          {/* ── Deadline & Priority Row ───────────────────────────── */}
          <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
            
            {/* Deadline */}
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-zinc-400" />
              <input
                type="date"
                value={task.dueDate ?? ''}
                min={todayStr()}
                onChange={(e) => onUpdateTask?.({ dueDate: e.target.value || undefined })}
                className="bg-[#181822] border border-white/[0.08] focus:border-white/20 rounded-lg px-2 py-1 text-xs text-zinc-200 focus:outline-none transition-colors cursor-pointer [color-scheme:dark]"
              />
              {task.dueDate && (
                <button
                  type="button"
                  onClick={() => onUpdateTask?.({ dueDate: undefined })}
                  className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors tactile-btn"
                  title="Убрать дедлайн"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Priority Selector */}
            <div className="flex items-center gap-1">
              {(['p1', 'p2', 'p3'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onUpdateTask?.({ priority: p })}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all tactile-btn ${
                    task.priority === p
                      ? p === 'p1' ? 'bg-rose-950/70 border border-rose-700/60 text-rose-300'
                        : p === 'p2' ? 'bg-amber-950/70 border border-amber-700/60 text-amber-300'
                        : 'bg-blue-950/70 border border-blue-700/60 text-blue-300'
                      : 'bg-[#181822] border border-white/[0.05] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {p === 'p1' ? 'Срочно' : p === 'p2' ? 'Обычно' : 'Низкий'}
                </button>
              ))}
            </div>
          </div>

          {/* ── Subtask checklist ─────────────────────────────────── */}
          <div className="space-y-1 pt-1">
            {/* Progress bar */}
            {subtasks.length > 0 && (
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex-1 h-1 bg-black/40 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-zinc-400 shrink-0">{doneCount}/{subtasks.length}</span>
              </div>
            )}

            {/* Subtask items */}
            {subtasks.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => onToggleSubtask?.(sub.id)}
                className={`w-full flex items-center gap-2 px-2 py-1 rounded-lg text-left transition-all tactile-btn ${
                  sub.completed
                    ? 'bg-emerald-950/15 text-zinc-500'
                    : 'hover:bg-white/[0.04] text-zinc-300'
                }`}
              >
                <div className={`shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${
                  sub.completed
                    ? 'bg-emerald-500/30 border-emerald-500/60'
                    : 'border-zinc-600'
                }`}>
                  {sub.completed && (
                    <Check className="w-2.5 h-2.5 text-emerald-400 stroke-[3]" />
                  )}
                </div>
                <span className={`text-xs flex-1 ${sub.completed ? 'line-through text-zinc-500' : 'text-zinc-300'}`}>
                  {sub.text}
                </span>
              </button>
            ))}

            {/* Add new step */}
            {onAddSubtask && (
              <form onSubmit={handleAddStep} className="flex items-center gap-1.5 pt-1">
                <input
                  type="text"
                  value={newStep}
                  onChange={(e) => setNewStep(e.target.value)}
                  placeholder="+ Добавить шаг..."
                  className="flex-1 min-w-0 bg-[#16161f] border border-dashed border-white/[0.08] focus:border-white/20 rounded-lg px-2.5 py-1 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none transition-colors"
                />
                {newStep.trim() && (
                  <button
                    type="submit"
                    className="shrink-0 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs transition-colors tactile-btn"
                  >
                    ОК
                  </button>
                )}
              </form>
            )}
          </div>

          {/* Open full editor button */}
          {onEdit && (
            <div className="pt-1.5 border-t border-white/[0.05] flex justify-end">
              <button
                type="button"
                onClick={onEdit}
                className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 text-[11px] font-medium transition-colors tactile-btn"
              >
                <Pencil className="w-3 h-3" />
                <span>Полный редактор</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function CommandCenterToday({
  tasks,
  projects,
  stats,
  rewards = [],
  onToggleTask,
  onToggleSubtask,
  onTriggerHabit,
  onToggleDaily,
  onAddTask,
  onUpdateTask,
  onEditTask,
  onAddSubtask,
  onDeleteTask,
  onBuyReward,
  onOpenHealthModal,
  onOpenLifeTab,
  onOpenShoppingTab,
  onUpdateStats,
  onAwardRewards,
}: CommandCenterTodayProps) {
  const [todoFilter, setTodoFilter] = useState<TodoFilter>('active');
  const [boughtId, setBoughtId] = useState<string | null>(null);

  // Recovery cycle status (7 work days + 1 recovery day)
  const recoveryConfig = loadRecoveryCycleConfig();
  const currentToday = todayStr();
  const cycleInfo = getDayCycleInfo(currentToday, recoveryConfig);
  const [completedActivitiesMap, setCompletedActivitiesMap] = useState<Record<string, string[]>>(loadCompletedRecoveryActivities);

  const todayCompletedActs = completedActivitiesMap[currentToday] || [];

  const handleToggleTodayActivity = (act: RecoveryActivity) => {
    const isDone = todayCompletedActs.includes(act.id);
    const updated = isDone 
      ? todayCompletedActs.filter((id) => id !== act.id)
      : [...todayCompletedActs, act.id];

    const nextMap = { ...completedActivitiesMap, [currentToday]: updated };
    setCompletedActivitiesMap(nextMap);
    saveCompletedRecoveryActivities(nextMap);

    if (!isDone) {
      playQuestCompleteSound();
      playCoinSound();
      triggerQuestConfetti();
      if (onAwardRewards) {
        onAwardRewards(act.expReward, act.goldReward, act.hpReward);
      } else if (onUpdateStats) {
        onUpdateStats({ hp: Math.min(stats.maxHp, stats.hp + act.hpReward) });
      }
    }
  };

  const habits = tasks.filter((t) => t.type === 'habit');
  const dailies = tasks.filter((t) => t.type === 'daily');

  // Shopping tasks are isolated in the Shopping List and never mixed with daily goals/tasks
  const shoppingTasksCount = tasks.filter((t) => isShoppingTask(t) && !t.completed).length;
  const allTodos = tasks.filter((t) => t.type === 'todo' && !isShoppingTask(t));
  const activeTodos = allTodos.filter((t) => !t.completed);
  const completedTodayTodos = allTodos.filter((t) => t.completed && isCompletedToday(t.completedAt));
  const shownTodos = todoFilter === 'active' ? activeTodos : completedTodayTodos;

  const now = new Date();
  const dateStr = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  const displayDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  const addHabit = (title: string) => onAddTask({
    title, type: 'habit', priority: 'p2',
    projectId: projects[0]?.id || 'proj-inbox',
    difficulty: 'easy', expReward: 20, goldReward: 10,
    tags: [], habitDirection: 'both', habitCounter: 0,
  });

  const addDaily = (title: string) => onAddTask({
    title, type: 'daily', priority: 'p2',
    projectId: projects[0]?.id || 'proj-inbox',
    difficulty: 'easy', expReward: 25, goldReward: 15,
    streakCount: 0, tags: [],
  });

  const addTodo = (title: string) => onAddTask({
    title, type: 'todo', priority: 'p2',
    projectId: projects[0]?.id || 'proj-inbox',
    difficulty: 'medium', expReward: 35, goldReward: 20, tags: [],
  });

  const handleBuy = (reward: Reward) => {
    if (!onBuyReward) return;
    const ok = onBuyReward(reward);
    if (ok) {
      setBoughtId(reward.id);
      setTimeout(() => setBoughtId(null), 1200);
    }
  };

  return (
    <div className="flex flex-col h-full select-none overflow-y-auto">

      {/* ── Top Bar (Minimalist Linear Style) ─────────────────────────── */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 border-b border-white/[0.06] bg-[#09090c] shrink-0">
        <div>
          <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">{displayDate}</p>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-semibold text-zinc-100 tracking-tight leading-tight">
              Сегодня
            </h1>
            {cycleInfo.isRecoveryDay ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/25 text-rose-300 border border-rose-500/40 animate-pulse">
                🧖‍♂️ День 8: Детокс
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                🟢 Спринт (День {cycleInfo.dayNumberInCycle}/7)
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Health HP pill */}
          <button
            type="button"
            onClick={() => {
              if (onOpenHealthModal) onOpenHealthModal();
              else if (onOpenLifeTab) onOpenLifeTab();
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#111116] hover:bg-rose-950/40 border border-white/[0.07] hover:border-rose-500/40 transition-all tactile-btn group"
            title="Открыть Центр Здоровья, Биоритмы и Будильники"
          >
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500/20 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] text-rose-400 font-mono font-bold">HP</span>
            <div className="w-14 sm:w-18 h-1.5 bg-zinc-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.round((stats.hp / Math.max(1, stats.maxHp)) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-zinc-300 group-hover:text-white font-semibold">
              {stats.hp}
            </span>
          </button>

          {/* EXP Mini Bar */}
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#111116] border border-white/[0.07]">
            <span className="text-[10px] text-indigo-400 font-mono font-medium">EXP</span>
            <div className="w-16 h-1.5 bg-zinc-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500/80 rounded-full transition-all duration-500"
                style={{ width: `${Math.round((stats.exp / Math.max(1, stats.maxExp)) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-zinc-400">{stats.exp}</span>
          </div>

          {/* Level & Gold */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#111116] border border-white/[0.07]">
            <span className="text-xs text-zinc-300">Ур. <strong className="text-white">{stats.level}</strong></span>
            <span className="text-zinc-600">·</span>
            <span className="text-amber-400 font-mono text-xs font-semibold">{stats.gold} 🪙</span>
          </div>
        </div>
      </div>

      {/* ── 24h Advance Notice Banner ─────────────────────────────────── */}
      {cycleInfo.isTomorrowRecovery && !cycleInfo.isRecoveryDay && (
        <div className="mx-3 sm:mx-6 mt-3 bg-gradient-to-r from-amber-950/40 via-[#19130c] to-amber-950/40 border border-amber-500/40 rounded-2xl p-3 sm:p-4 shadow-lg flex items-start gap-3 select-none">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 shrink-0 text-lg">
            🧖‍♂️
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-bold text-amber-200">
                Напоминание за 24 часа: Завтра День Активного Восстановления!
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                День 7/7 завершается
              </span>
            </div>
            <p className="text-xs text-amber-300/80 mt-1 leading-relaxed">
              Завтра 8-й день: полный цифровой детокс без интернета и гаджетов. Завершите срочные цифровые задачи, предупредите коллег и запланируйте бассейн с сауной, прогулку в парке и медитацию.
            </p>
          </div>
        </div>
      )}

      {/* ── Day 8 Recovery Detox Hero Banner ──────────────────────────── */}
      {cycleInfo.isRecoveryDay && (
        <div className="mx-3 sm:mx-6 mt-3 bg-gradient-to-r from-rose-950/60 via-[#1c0d12] to-rose-950/60 border border-rose-500/50 rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden select-none">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3 border-b border-rose-500/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/25 border border-rose-500/50 flex items-center justify-center text-xl shadow">
                🧖‍♂️
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-base font-bold text-rose-100 tracking-tight">
                    ДЕНЬ АКТИВНОГО ВОССТАНОВЛЕНИЯ (ЦИФРОВОЙ ДЕТОКС)
                  </h2>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-500/30 text-rose-200 border border-rose-500/40">
                    ДЕНЬ 8 ИЗ 8
                  </span>
                </div>
                <p className="text-xs text-rose-300/90 mt-0.5">
                  Сегодня день без интернета и гаджетов. Закройте ноутбук, отложите смартфон. Только тепло сауны, вода бассейна, природа и медитация.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-300">
                Выполнено: {todayCompletedActs.length}/{recoveryConfig.activities.length}
              </span>
            </div>
          </div>

          {/* Ritual Checklist */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-3">
            {recoveryConfig.activities.map((act) => {
              const isDone = todayCompletedActs.includes(act.id);
              return (
                <button
                  key={act.id}
                  onClick={() => handleToggleTodayActivity(act)}
                  className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all tactile-btn ${
                    isDone
                      ? 'bg-rose-900/40 border-rose-500/50 text-rose-200'
                      : 'bg-[#151014] hover:bg-[#1c141a] border-white/5 text-zinc-300 hover:border-white/15'
                  }`}
                >
                  <div className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                    isDone ? 'bg-rose-500 border-rose-400 text-white' : 'border-zinc-600'
                  }`}>
                    {isDone && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <span>{act.icon}</span>
                      <span className={isDone ? 'line-through text-rose-300/80' : 'text-zinc-200'}>
                        {act.title}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-2">{act.description}</p>
                    <div className="mt-1.5 flex items-center gap-2 text-[10px] font-mono">
                      <span className="text-amber-400 font-semibold">+{act.expReward} EXP</span>
                      <span className="text-rose-400 font-semibold">+{act.hpReward} HP</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {todayCompletedActs.length === recoveryConfig.activities.length && (
            <div className="mt-3 p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs font-semibold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span>🏆 Все практики закрыты! Получен трофей «Мастер перезагрузки» и полное восстановление HP (+100 HP, +150 EXP, +50 золота)!</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 4-Column Bento Grid ─────────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 p-3 sm:p-4 overflow-hidden min-h-0">

        {/* ── COL 1: HABITS ───────────────────────────────────────────── */}
        <Column title="Привычки" count={habits.length}>
          <AddInput 
            placeholder="Добавить привычку..." 
            onAdd={addHabit} 
            disabled={cycleInfo.isRecoveryDay}
            disabledMessage="Сегодня день отдыха. Уберите гаджеты и идите в баню!"
          />
          {habits.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs text-zinc-500">Нет привычек</p>
              <p className="text-[10px] text-zinc-600 mt-1">Нажмите + чтобы добавить</p>
            </div>
          ) : (
            habits.map((habit) => (
              <div
                key={habit.id}
                className="group flex items-center gap-2 px-2.5 py-2 rounded-xl bg-[#14141a] hover:bg-[#181822] border border-white/[0.06] hover:border-white/[0.12] transition-all"
              >
                <button
                  type="button"
                  onClick={() => onTriggerHabit(habit.id, 'positive')}
                  className="shrink-0 w-6 h-6 rounded-lg bg-emerald-950/60 hover:bg-emerald-800/80 text-emerald-300 border border-emerald-700/40 flex items-center justify-center transition-all tactile-btn"
                  title="Выполнить привычку (+EXP, +Золото)"
                >
                  <Plus className="w-3 h-3" />
                </button>

                <span className="flex-1 text-xs text-zinc-200 truncate">{habit.title}</span>

                {(habit.habitCounter ?? 0) > 0 && (
                  <span className="shrink-0 text-[10px] font-mono text-zinc-400 px-1 rounded bg-black/40">
                    ×{habit.habitCounter}
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => onTriggerHabit(habit.id, 'negative')}
                  className="shrink-0 w-6 h-6 rounded-lg bg-rose-950/60 hover:bg-rose-800/80 text-rose-300 border border-rose-700/40 flex items-center justify-center transition-all tactile-btn"
                  title="Срыв привычки (-HP)"
                >
                  <Minus className="w-3 h-3" />
                </button>

                {onEditTask && (
                  <button
                    type="button"
                    onClick={() => onEditTask(habit)}
                    className="shrink-0 p-1 text-zinc-500 hover:text-zinc-200 opacity-0 group-hover:opacity-100 transition-all tactile-btn"
                    title="Редактировать привычку"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}

                {onDeleteTask && (
                  <button
                    type="button"
                    onClick={() => onDeleteTask(habit.id)}
                    className="shrink-0 p-1 text-zinc-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all tactile-btn"
                    title="Удалить привычку"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))
          )}
        </Column>

        {/* ── COL 2: DAILIES ──────────────────────────────────────────── */}
        <Column
          title="Ежедневные"
          count={dailies.filter((d) => !d.completed).length}
          badge={
            <span className="text-[10px] font-mono text-zinc-400 bg-white/[0.05] px-2 py-0.5 rounded-full">
              {dailies.filter((d) => d.completed).length}/{dailies.length}
            </span>
          }
        >
          <AddInput 
            placeholder="Добавить ежедневную..." 
            onAdd={addDaily} 
            disabled={cycleInfo.isRecoveryDay}
            disabledMessage="Сегодня день отдыха. Уберите гаджеты и идите в баню!"
          />
          {dailies.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs text-zinc-500">Нет ежедневных задач</p>
            </div>
          ) : (
            dailies.map((daily) => (
              <div
                key={daily.id}
                className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-xl border transition-all ${
                  daily.completed
                    ? 'bg-[#0d0d12] border-white/[0.03] opacity-55'
                    : 'bg-[#14141a] hover:bg-[#181822] border-white/[0.06] hover:border-white/[0.12]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onToggleDaily(daily.id)}
                  className={`shrink-0 tactile-btn p-0.5 ${
                    daily.completed ? 'text-emerald-400' : 'text-zinc-500 hover:text-emerald-400'
                  }`}
                  title={daily.completed ? 'Отметить невыполненной' : 'Выполнить сегодня'}
                >
                  {daily.completed
                    ? <CheckCircle2 className="w-4 h-4 fill-emerald-500/20" />
                    : <Circle className="w-4 h-4" />
                  }
                </button>

                <span className={`flex-1 text-xs truncate ${daily.completed ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                  {daily.title}
                </span>

                {(daily.streakCount ?? 0) > 0 && (
                  <span className="shrink-0 flex items-center gap-0.5 text-[10px] font-mono text-orange-400 bg-orange-950/30 border border-orange-800/30 px-1.5 py-0.2 rounded-md">
                    <Flame className="w-2.5 h-2.5" />{daily.streakCount}
                  </span>
                )}

                {onEditTask && (
                  <button
                    type="button"
                    onClick={() => onEditTask(daily)}
                    className="shrink-0 p-1 text-zinc-500 hover:text-zinc-200 opacity-0 group-hover:opacity-100 transition-all tactile-btn"
                    title="Редактировать ежедневную"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}

                {onDeleteTask && (
                  <button
                    type="button"
                    onClick={() => onDeleteTask(daily.id)}
                    className="shrink-0 p-1 text-zinc-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all tactile-btn"
                    title="Удалить ежедневную"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))
          )}
        </Column>

        {/* ── COL 3: TO-DO's (with subtasks + deadline) ───────────────── */}
        <Column 
          title="Задачи" 
          count={activeTodos.length}
          badge={
            shoppingTasksCount > 0 && onOpenShoppingTab ? (
              <button
                type="button"
                onClick={onOpenShoppingTab}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/25 text-[10px] font-medium transition-all tactile-btn"
                title="Открыть отдельный список покупок"
              >
                <ShoppingBag className="w-2.5 h-2.5 text-amber-400" />
                <span>Покупки ({shoppingTasksCount})</span>
              </button>
            ) : undefined
          }
        >
          <AddInput 
            placeholder="Добавить задачу..." 
            onAdd={addTodo} 
            disabled={cycleInfo.isRecoveryDay}
            disabledMessage="Сегодня день отдыха. Уберите гаджеты и идите в баню!"
          />

          {/* Filter tabs (Segmented Control) */}
          <div className="flex items-center gap-1 mb-2 bg-[#121218] p-0.5 rounded-xl border border-white/[0.06]">
            {(['active', 'completed'] as TodoFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setTodoFilter(f)}
                className={`flex-1 py-1 rounded-lg text-[10px] font-semibold transition-all tactile-btn ${
                  todoFilter === f
                    ? 'bg-zinc-800 text-white shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {f === 'active' ? 'Активные' : `Выполнено (${completedTodayTodos.length})`}
              </button>
            ))}
          </div>

          {shownTodos.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs text-zinc-500">
                {todoFilter === 'active' ? 'Все задачи выполнены' : 'Сегодня ничего не завершено'}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {shownTodos.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onToggle={() => onToggleTask(task.id)}
                  onToggleSubtask={onToggleSubtask ? (stId) => onToggleSubtask(task.id, stId) : undefined}
                  onAddSubtask={onAddSubtask ? (text) => onAddSubtask(task.id, text) : undefined}
                  onUpdateTask={onUpdateTask ? (patch) => onUpdateTask(task.id, patch) : undefined}
                  onEdit={onEditTask ? () => onEditTask(task) : undefined}
                  onDelete={onDeleteTask ? () => onDeleteTask(task.id) : undefined}
                />
              ))}
            </div>
          )}
        </Column>

        {/* ── COL 4: REWARDS ──────────────────────────────────────────── */}
        <Column
          title="Награды"
          badge={
            <span className="text-[10px] font-mono text-amber-400">
              {stats.gold} 🪙
            </span>
          }
        >
          <div className="flex items-center gap-1.5 mb-1.5 p-2 rounded-xl bg-[#14141a] border border-white/[0.05]">
            <ShoppingBag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[11px] text-zinc-300">Награждай себя за закрытые квесты</span>
          </div>

          {rewards.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs text-zinc-500">Нет наград</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {rewards.map((reward) => {
                const canAfford = stats.gold >= reward.cost;
                const justBought = boughtId === reward.id;

                return (
                  <button
                    key={reward.id}
                    type="button"
                    onClick={() => handleBuy(reward)}
                    disabled={!canAfford || !onBuyReward}
                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-center transition-all tactile-btn disabled:cursor-not-allowed ${
                      justBought
                        ? 'bg-emerald-950/40 border-emerald-600/40'
                        : canAfford
                          ? 'bg-[#14141a] hover:bg-[#181822] border-white/[0.06] hover:border-white/[0.14]'
                          : 'bg-[#0e0e13] border-white/[0.03] opacity-40'
                    }`}
                    title={reward.description}
                  >
                    <span className="text-lg leading-none">{reward.icon}</span>
                    <span className="text-[10px] text-zinc-200 font-medium leading-tight line-clamp-2">
                      {reward.title}
                    </span>
                    <span className={`text-[10px] font-mono font-bold ${
                      justBought ? 'text-emerald-300' : canAfford ? 'text-amber-400' : 'text-zinc-500'
                    }`}>
                      {justBought ? '✓ куплено' : `${reward.cost} 🪙`}
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
