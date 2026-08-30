import React, { useState } from 'react';
import { TaskItem, Project, UserStats, Reward } from '../types';
import { TodoistTaskList } from './TodoistTaskList';
import { HabitsDailiesView } from './HabitsDailiesView';
import { HeroTavern } from './HeroTavern';
import { 
  CheckSquare, 
  Flame, 
  ShoppingBag, 
  LayoutGrid, 
  Plus, 
  Coins, 
  Heart, 
  Sparkles,
  Zap
} from 'lucide-react';

interface QuestsHubProps {
  tasks: TaskItem[];
  projects: Project[];
  stats: UserStats;
  rewards: Reward[];
  onToggleTask: (taskId: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onAddSubtask: (taskId: string, title: string) => void;
  onToggleFocus: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onTriggerHabit: (taskId: string, direction: 'positive' | 'negative') => void;
  onToggleDaily: (taskId: string) => void;
  onResetDailies: () => void;
  onUpdateStats: (newStats: Partial<UserStats>) => void;
  onBuyReward: (reward: Reward) => boolean;
  onAddReward: (reward: Omit<Reward, 'id' | 'timesPurchased'>) => void;
  onOpenQuickAdd: () => void;
}

export function QuestsHub({
  tasks,
  projects,
  stats,
  rewards,
  onToggleTask,
  onToggleSubtask,
  onAddSubtask,
  onToggleFocus,
  onDeleteTask,
  onTriggerHabit,
  onToggleDaily,
  onResetDailies,
  onUpdateStats,
  onBuyReward,
  onAddReward,
  onOpenQuickAdd,
}: QuestsHubProps) {
  const [hubTab, setHubTab] = useState<'tasks' | 'habits' | 'tavern' | 'overview'>('tasks');

  // Counts
  const activeTasksCount = tasks.filter((t) => t.type === 'todo' && !t.completed).length;
  const habitsCount = tasks.filter((t) => t.type === 'habit').length;
  const uncompletedDailiesCount = tasks.filter((t) => t.type === 'daily' && !t.completed).length;

  return (
    <div className="space-y-4 max-w-7xl mx-auto py-2 px-2 sm:px-4 animate-fade-in select-none">
      
      {/* ─── Hub Header with Hero Summary & Quick Tab Switcher ─────────────── */}
      <div className="bg-[#101014] border border-white/[0.07] rounded-2xl p-3 sm:p-4 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        
        {/* Left: Hero status mini pill */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-lg shrink-0">
            {stats.heroClass === 'Warrior' ? '⚔️' : stats.heroClass === 'Mage' ? '🧙‍♂️' : stats.heroClass === 'Rogue' ? '🗡️' : '🌿'}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-white tracking-tight">Квесты, Привычки & Награды</h2>
              <span className="text-[10px] font-mono text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded-md border border-purple-800/40">
                Ур. {stats.level} {stats.heroClass}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-400 mt-0.5">
              <span className="flex items-center gap-1 text-amber-400 font-bold">
                <Coins className="w-3 h-3" /> {stats.gold} 🪙
              </span>
              <span className="flex items-center gap-1 text-rose-400 font-bold">
                <Heart className="w-3 h-3" /> {stats.hp}/{stats.maxHp} HP
              </span>
              <span className="flex items-center gap-1 text-orange-400 font-bold">
                <Flame className="w-3 h-3" /> {stats.streak} дн стрик
              </span>
            </div>
          </div>
        </div>

        {/* Right: Sub-Tabs & Quick Add */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end flex-wrap">
          <div className="flex items-center gap-1 bg-black/50 border border-white/10 rounded-xl p-1 text-xs">
            <button
              onClick={() => setHubTab('tasks')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                hubTab === 'tasks' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Задачи</span>
              {activeTasksCount > 0 && (
                <span className="text-[9px] font-mono px-1 rounded bg-zinc-700 text-zinc-300">
                  {activeTasksCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setHubTab('habits')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                hubTab === 'habits' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span>Привычки</span>
              {uncompletedDailiesCount > 0 && (
                <span className="text-[9px] font-mono px-1 rounded bg-orange-950 text-orange-300 border border-orange-800/40">
                  {uncompletedDailiesCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setHubTab('tavern')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                hubTab === 'tavern' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
              <span>Награды</span>
              <span className="text-[9px] font-mono px-1 rounded bg-amber-950 text-amber-300 border border-amber-800/40">
                {rewards.length}
              </span>
            </button>

            <button
              onClick={() => setHubTab('overview')}
              className={`hidden lg:flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                hubTab === 'overview' ? 'bg-purple-900/60 text-purple-200 border border-purple-700/50 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Обзор 3-в-1 на одном экране"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>3-в-1</span>
            </button>
          </div>

          <button
            onClick={onOpenQuickAdd}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs shadow transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Добавить</span>
          </button>
        </div>
      </div>

      {/* ─── Main Content Views ────────────────────────────────────────────── */}
      {hubTab === 'tasks' && (
        <TodoistTaskList
          tasks={tasks}
          projects={projects}
          stats={stats}
          onToggleTask={onToggleTask}
          onToggleSubtask={onToggleSubtask}
          onAddSubtask={onAddSubtask}
          onToggleFocus={onToggleFocus}
          onDeleteTask={onDeleteTask}
          onOpenQuickAdd={onOpenQuickAdd}
        />
      )}

      {hubTab === 'habits' && (
        <HabitsDailiesView
          tasks={tasks}
          projects={projects}
          stats={stats}
          onTriggerHabit={onTriggerHabit}
          onToggleDaily={onToggleDaily}
          onResetDailies={onResetDailies}
          onOpenQuickAdd={onOpenQuickAdd}
        />
      )}

      {hubTab === 'tavern' && (
        <HeroTavern
          stats={stats}
          rewards={rewards}
          onUpdateStats={onUpdateStats}
          onBuyReward={onBuyReward}
          onAddReward={onAddReward}
        />
      )}

      {/* ─── SUB-MODE: Unified 3-in-1 Dashboard ───────────────────────────── */}
      {hubTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Column 1: Tasks */}
          <div className="space-y-3 bg-[#0d0d11] border border-white/5 rounded-3xl p-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4 text-purple-400" /> Задачи ({activeTasksCount})
              </span>
              <button
                onClick={() => setHubTab('tasks')}
                className="text-[10px] text-purple-400 hover:underline cursor-pointer"
              >
                Открыть полноэкранно →
              </button>
            </div>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {tasks.filter((t) => t.type === 'todo').slice(0, 8).map((t) => (
                <div
                  key={t.id}
                  onClick={() => onToggleTask(t.id)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2 text-xs ${
                    t.completed ? 'bg-zinc-900/40 text-zinc-500 border-transparent line-through' : 'bg-zinc-900/90 text-zinc-200 border-white/5 hover:border-white/20'
                  }`}
                >
                  <span className="truncate flex-1 font-medium">{t.title}</span>
                  <span className="text-[9px] font-mono text-purple-300">+{t.expReward}xp</span>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: Habits & Dailies */}
          <div className="space-y-3 bg-[#0d0d11] border border-white/5 rounded-3xl p-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-orange-400" /> Привычки & Дейлики
              </span>
              <button
                onClick={() => setHubTab('habits')}
                className="text-[10px] text-orange-400 hover:underline cursor-pointer"
              >
                Открыть полноэкранно →
              </button>
            </div>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {tasks.filter((t) => t.type === 'daily' || t.type === 'habit').slice(0, 8).map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded-2xl bg-zinc-900/90 border border-white/5 flex items-center justify-between gap-2 text-xs"
                >
                  <span className={`truncate flex-1 font-medium ${t.completed ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                    {t.title}
                  </span>
                  {t.type === 'daily' ? (
                    <button
                      onClick={() => onToggleDaily(t.id)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                        t.completed ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {t.completed ? '✓ Сделано' : 'Выполнить'}
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onTriggerHabit(t.id, 'positive')}
                        className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 text-[10px] font-bold cursor-pointer"
                      >
                        +
                      </button>
                      <button
                        onClick={() => onTriggerHabit(t.id, 'negative')}
                        className="px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 text-[10px] font-bold cursor-pointer"
                      >
                        -
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Column 3: Rewards & Tavern */}
          <div className="space-y-3 bg-[#0d0d11] border border-white/5 rounded-3xl p-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-amber-400" /> Награды ({stats.gold} 🪙)
              </span>
              <button
                onClick={() => setHubTab('tavern')}
                className="text-[10px] text-amber-400 hover:underline cursor-pointer"
              >
                В Таверну →
              </button>
            </div>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {rewards.slice(0, 6).map((r) => (
                <div
                  key={r.id}
                  className="p-3 rounded-2xl bg-zinc-900/90 border border-white/5 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="truncate">
                    <span className="font-medium text-zinc-200 block truncate">{r.title}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">{r.cost} 🪙</span>
                  </div>
                  <button
                    onClick={() => onBuyReward(r)}
                    disabled={stats.gold < r.cost}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-30 text-black font-bold text-[10px] shrink-0 cursor-pointer"
                  >
                    Купить
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
