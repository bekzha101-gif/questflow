import React, { useState } from 'react';
import { TaskItem, Project, UserStats, Reward, TimeLogEntry } from '../types';
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
  Star,
  Coins,
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
import {
  BLOCK_MINUTES,
  DAILY_BLOCK_GOAL,
  getFocusMinutesToday,
  formatFocusMinutes,
  loadMainTaskId,
  saveMainTaskId,
  loadPurpose,
  savePurpose,
} from '../utils/dayPlan';

interface CommandCenterTodayProps {
  tasks: TaskItem[];
  projects: Project[];
  stats: UserStats;
  rewards?: Reward[];
  timeLogs?: TimeLogEntry[];
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
  onOpenRewardsTab?: () => void;
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

// ─── Card (высота по содержимому, без внутренней прокрутки) ──────────────────
function Card({ title, count, badge, children }: {
  title: string;
  count?: number;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-[#0e0e13] border border-white/[0.07] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm font-semibold text-zinc-100 tracking-tight">{title}</h2>
          {count !== undefined && (
            <span className="text-[11px] font-mono text-zinc-500">{count}</span>
          )}
        </div>
        {badge}
      </div>
      <div className="p-2.5 space-y-2">{children}</div>
    </section>
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
  isMain = false,
  onToggleMain,
}: {
  task: TaskItem;
  isMain?: boolean;
  onToggleMain?: () => void;
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

          {/* Главная задача дня */}
          {onToggleMain && !task.completed && (
            <button
              type="button"
              onClick={onToggleMain}
              aria-pressed={isMain}
              className={`shrink-0 p-1 transition-colors tactile-btn ${
                isMain ? 'text-amber-400' : 'text-zinc-600 hover:text-amber-300'
              }`}
              title={isMain ? 'Убрать из главной задачи дня' : 'Сделать главной задачей дня'}
            >
              <Star className={`w-3.5 h-3.5 ${isMain ? 'fill-amber-400' : ''}`} />
            </button>
          )}

          {/* Edit */}
          {onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="hidden sm:block shrink-0 p-1 text-zinc-500 hover:text-zinc-200 transition-colors tactile-btn"
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
              className="hidden sm:block shrink-0 p-1 text-zinc-600 hover:text-rose-400 transition-colors tactile-btn"
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
  timeLogs = [],
  onToggleTask,
  onToggleSubtask,
  onTriggerHabit,
  onToggleDaily,
  onAddTask,
  onUpdateTask,
  onEditTask,
  onAddSubtask,
  onDeleteTask,
  onOpenHealthModal,
  onOpenLifeTab,
  onOpenShoppingTab,
  onOpenRewardsTab,
  onUpdateStats,
  onAwardRewards,
}: CommandCenterTodayProps) {
  const [todoFilter, setTodoFilter] = useState<TodoFilter>('active');
  const [routineKind, setRoutineKind] = useState<'habit' | 'daily'>('habit');
  const [mainTaskId, setMainTaskId] = useState<string | null>(loadMainTaskId);
  const [purpose, setPurpose] = useState<string>(loadPurpose);
  const [isEditingPurpose, setIsEditingPurpose] = useState(false);

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

  // Главная задача дня: одна задача, которой отдаётся первый блок фокуса
  const mainTask = allTodos.find((t) => t.id === mainTaskId) ?? null;
  // Главная задача показана в блоке «Фокус сегодня», в общем списке её не дублируем
  const shownTodos = todoFilter === 'active'
    ? activeTodos.filter((t) => t.id !== mainTask?.id || cycleInfo.isRecoveryDay)
    : completedTodayTodos;
  const handleToggleMain = (taskId: string) => {
    const next = mainTaskId === taskId ? null : taskId;
    setMainTaskId(next);
    saveMainTaskId(next);
  };

  // Блоки фокуса за сегодня: точки показывают завершённые блоки, а не минуты текущего
  const focusMinutes = getFocusMinutesToday(timeLogs);
  const fullBlocks = Math.floor(focusMinutes / BLOCK_MINUTES);
  const hasPartialBlock = focusMinutes % BLOCK_MINUTES > 0;

  const handleSavePurpose = (e: React.FormEvent) => {
    e.preventDefault();
    const text = purpose.trim();
    setPurpose(text);
    savePurpose(text);
    setIsEditingPurpose(false);
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  const displayDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
  const shortDate = now.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });

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

  const detoxMessage = 'Сегодня день отдыха. Уберите гаджеты и идите в баню!';

  return (
    <div className="flex flex-col h-full select-none overflow-y-auto">

      {/* ── Тонкая строка статуса: дата, день цикла, HP, уровень, золото ── */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-2 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="hidden sm:inline text-xs text-zinc-400 truncate">{displayDate}</span>
          <span className="sm:hidden text-xs text-zinc-400 truncate">{shortDate}</span>
          {cycleInfo.isRecoveryDay ? (
            <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40">
              День 8 · детокс
            </span>
          ) : (
            <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/[0.05] text-zinc-400 border border-white/[0.07]">
              День {cycleInfo.dayNumberInCycle} из 7
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0 text-xs">
          <button
            type="button"
            onClick={() => {
              if (onOpenHealthModal) onOpenHealthModal();
              else if (onOpenLifeTab) onOpenLifeTab();
            }}
            className="flex items-center gap-1 text-zinc-300 hover:text-white transition-colors tactile-btn"
            title="Открыть Центр Здоровья, Биоритмы и Будильники"
          >
            <Heart className="w-3.5 h-3.5 text-rose-500" />
            <span className="font-mono">{stats.hp}</span>
          </button>
          <span className="text-zinc-400">Ур. <span className="text-zinc-200 font-medium">{stats.level}</span></span>
          <button
            type="button"
            onClick={onOpenRewardsTab}
            disabled={!onOpenRewardsTab}
            className="flex items-center gap-1 text-zinc-300 hover:text-white transition-colors tactile-btn"
            title="Открыть награды"
          >
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono">{stats.gold}</span>
          </button>
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

      {/* ── Содержимое: слева фокус и задачи, справа привычки ─────────── */}
      <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-3 p-3 sm:p-4 items-start">

        <div className="lg:col-span-3 space-y-3 min-w-0">

          {/* ── Фокус сегодня: блоки, главная задача, «ради чего» ──────── */}
          {!cycleInfo.isRecoveryDay && (
            <section className="bg-[#0e0e13] border border-white/[0.07] rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-zinc-100 tracking-tight">Фокус сегодня</h2>
                <div
                  className="flex items-center gap-2"
                  role="img"
                  aria-label={`Блоков фокуса: ${fullBlocks} из ${DAILY_BLOCK_GOAL}`}
                >
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: Math.max(DAILY_BLOCK_GOAL, fullBlocks) }, (_, i) => (
                      <span
                        key={i}
                        className={`w-3 h-3 rounded-full border ${
                          i < fullBlocks
                            ? 'bg-emerald-400 border-emerald-400'
                            : i === fullBlocks && hasPartialBlock
                              ? 'bg-emerald-400/30 border-emerald-400/70'
                              : 'border-zinc-600'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-zinc-400">
                    {fullBlocks} из {DAILY_BLOCK_GOAL}
                    {focusMinutes > 0 && <span className="text-zinc-500"> · {formatFocusMinutes(focusMinutes)}</span>}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-[11px] text-zinc-500 mb-1.5">Главная задача дня</p>
                {mainTask ? (
                  <TaskRow
                    task={mainTask}
                    isMain
                    onToggleMain={() => handleToggleMain(mainTask.id)}
                    onToggle={() => onToggleTask(mainTask.id)}
                    onToggleSubtask={onToggleSubtask ? (stId) => onToggleSubtask(mainTask.id, stId) : undefined}
                    onAddSubtask={onAddSubtask ? (text) => onAddSubtask(mainTask.id, text) : undefined}
                    onUpdateTask={onUpdateTask ? (patch) => onUpdateTask(mainTask.id, patch) : undefined}
                    onEdit={onEditTask ? () => onEditTask(mainTask) : undefined}
                  />
                ) : (
                  <p className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-dashed border-white/[0.1] text-xs text-zinc-400">
                    <Star className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <span>Отметьте звездой задачу, которая сегодня важнее всего</span>
                  </p>
                )}
              </div>

              {isEditingPurpose ? (
                <form onSubmit={handleSavePurpose} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    autoFocus
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    onBlur={handleSavePurpose}
                    maxLength={140}
                    placeholder="Ради чего я работаю?"
                    className="flex-1 min-w-0 bg-[#15151d] border border-white/[0.08] focus:border-white/20 rounded-xl px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none"
                  />
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingPurpose(true)}
                  className="w-full flex items-center gap-1.5 text-left text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  title="Изменить"
                >
                  {purpose ? (
                    <span className="truncate">Ради чего: <span className="text-zinc-300">{purpose}</span></span>
                  ) : (
                    <span>Добавить, ради чего я работаю</span>
                  )}
                  <Pencil className="w-3 h-3 shrink-0" />
                </button>
              )}
            </section>
          )}

          {/* ── Задачи (со шагами и дедлайном) ─────────────────────────── */}
          <Card
            title="Задачи"
            count={activeTodos.length}
            badge={
              shoppingTasksCount > 0 && onOpenShoppingTab ? (
                <button
                  type="button"
                  onClick={onOpenShoppingTab}
                  className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors tactile-btn"
                  title="Открыть отдельный список покупок"
                >
                  <ShoppingBag className="w-3 h-3" />
                  <span>Покупки ({shoppingTasksCount})</span>
                </button>
              ) : undefined
            }
          >
            <AddInput
              placeholder="Добавить задачу..."
              onAdd={addTodo}
              disabled={cycleInfo.isRecoveryDay}
              disabledMessage={detoxMessage}
            />

            {/* Filter tabs (Segmented Control) */}
            <div className="flex items-center gap-1 bg-[#121218] p-0.5 rounded-xl border border-white/[0.06]">
              {(['active', 'completed'] as TodoFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setTodoFilter(f)}
                  className={`flex-1 py-1 rounded-lg text-[11px] font-medium transition-all tactile-btn ${
                    todoFilter === f
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {f === 'active' ? 'Активные' : `Выполнено (${completedTodayTodos.length})`}
                </button>
              ))}
            </div>

            {shownTodos.length === 0 ? (
              <p className="py-6 text-center text-xs text-zinc-500">
                {todoFilter === 'completed'
                  ? 'Сегодня ничего не завершено'
                  : activeTodos.length > 0 ? 'Других задач нет' : 'Все задачи выполнены'}
              </p>
            ) : (
              <div className="space-y-1.5">
                {shownTodos.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    isMain={task.id === mainTaskId}
                    onToggleMain={() => handleToggleMain(task.id)}
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
          </Card>
        </div>

        {/* ── Привычки и ежедневные в одной карточке ───────────────────── */}
        <div className="lg:col-span-2 min-w-0">
          <Card
            title="Привычки"
            count={habits.length + dailies.length}
            badge={
              dailies.length > 0 ? (
                <span className="text-[11px] font-mono text-zinc-500">
                  ежедневные {dailies.filter((d) => d.completed).length}/{dailies.length}
                </span>
              ) : undefined
            }
          >
            {habits.length === 0 && dailies.length === 0 && (
              <p className="py-4 text-center text-xs text-zinc-500">Привычек пока нет</p>
            )}

        {habits.map((habit) => (
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

            <button
              type="button"
              onClick={() => onEditTask?.(habit)}
              className="flex-1 min-w-0 text-left text-xs text-zinc-200 truncate"
              title="Открыть привычку"
            >
              {habit.title}
            </button>

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
                className="hidden sm:block shrink-0 p-1 text-zinc-500 hover:text-zinc-200 opacity-0 group-hover:opacity-100 transition-all tactile-btn"
                title="Редактировать привычку"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}

            {onDeleteTask && (
              <button
                type="button"
                onClick={() => onDeleteTask(habit.id)}
                className="hidden sm:block shrink-0 p-1 text-zinc-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all tactile-btn"
                title="Удалить привычку"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}

            {dailies.length > 0 && habits.length > 0 && (
              <p className="pt-1 text-[11px] text-zinc-500">Ежедневные</p>
            )}

            {dailies.map((daily) => (
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

            <button
              type="button"
              onClick={() => onEditTask?.(daily)}
              className={`flex-1 min-w-0 text-left text-xs truncate ${daily.completed ? 'line-through text-zinc-500' : 'text-zinc-200'}`}
              title="Открыть ежедневную"
            >
              {daily.title}
            </button>

            {(daily.streakCount ?? 0) > 0 && (
              <span className="shrink-0 flex items-center gap-0.5 text-[10px] font-mono text-orange-400 bg-orange-950/30 border border-orange-800/30 px-1.5 py-0.2 rounded-md">
                <Flame className="w-2.5 h-2.5" />{daily.streakCount}
              </span>
            )}

            {onEditTask && (
              <button
                type="button"
                onClick={() => onEditTask(daily)}
                className="hidden sm:block shrink-0 p-1 text-zinc-500 hover:text-zinc-200 opacity-0 group-hover:opacity-100 transition-all tactile-btn"
                title="Редактировать ежедневную"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}

            {onDeleteTask && (
              <button
                type="button"
                onClick={() => onDeleteTask(daily.id)}
                className="hidden sm:block shrink-0 p-1 text-zinc-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all tactile-btn"
                title="Удалить ежедневную"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
            ))}

            <div className="pt-1">
              <div className="flex items-center gap-1 mb-1.5 text-[11px]">
                {(['habit', 'daily'] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setRoutineKind(kind)}
                    aria-pressed={routineKind === kind}
                    className={`px-2 py-0.5 rounded-md transition-colors ${
                      routineKind === kind ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {kind === 'habit' ? 'Привычка' : 'Ежедневная'}
                  </button>
                ))}
              </div>
              <AddInput
                placeholder={routineKind === 'habit' ? 'Добавить привычку...' : 'Добавить ежедневную...'}
                onAdd={routineKind === 'habit' ? addHabit : addDaily}
                disabled={cycleInfo.isRecoveryDay}
                disabledMessage={detoxMessage}
              />
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}
