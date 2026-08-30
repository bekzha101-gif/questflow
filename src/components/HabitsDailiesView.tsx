import React, { useState } from 'react';
import { TaskItem, Project, UserStats } from '../types';
import { 
  Plus, 
  Minus, 
  Flame, 
  RotateCcw, 
  CheckCircle2, 
  Circle
} from 'lucide-react';
import { playQuestCompleteSound, playCoinSound } from '../utils/sound';
import { triggerQuestConfetti } from '../utils/confetti';

interface HabitsDailiesViewProps {
  tasks: TaskItem[];
  projects: Project[];
  stats: UserStats;
  onTriggerHabit: (taskId: string, direction: 'positive' | 'negative') => void;
  onToggleDaily: (taskId: string) => void;
  onResetDailies: () => void;
  onOpenQuickAdd: () => void;
}

export const HabitsDailiesView: React.FC<HabitsDailiesViewProps> = ({
  tasks,
  projects,
  stats,
  onTriggerHabit,
  onToggleDaily,
  onResetDailies,
  onOpenQuickAdd,
}) => {
  const [activeTab, setActiveTab] = useState<'habits' | 'dailies'>('habits');

  const habits = tasks.filter((t) => t.type === 'habit');
  const dailies = tasks.filter((t) => t.type === 'daily');

  const handleHabitClick = (taskId: string, dir: 'positive' | 'negative') => {
    if (dir === 'positive') {
      if (stats.soundEnabled) {
        playQuestCompleteSound();
        playCoinSound();
      }
      triggerQuestConfetti();
    }
    onTriggerHabit(taskId, dir);
  };

  const handleDailyClick = (task: TaskItem) => {
    if (!task.completed) {
      if (stats.soundEnabled) {
        playQuestCompleteSound();
        playCoinSound();
      }
      triggerQuestConfetti();
    }
    onToggleDaily(task.id);
  };

  return (
    <div className="max-w-4xl mx-auto py-5 px-3 sm:px-6 space-y-5">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#111115] border border-white/[0.08] rounded-3xl p-4 sm:p-5">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
            <span>Привычки & Ежедневные Квесты</span>
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Формируйте дисциплину через регулярные действия
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {activeTab === 'dailies' && (
            <button
              onClick={onResetDailies}
              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs font-medium text-zinc-300 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Ресет дэйликов</span>
            </button>
          )}

          <button
            onClick={onOpenQuickAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs shadow transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Добавить</span>
          </button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-1.5 border-b border-white/5 pb-2.5">
        <button
          onClick={() => setActiveTab('habits')}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            activeTab === 'habits'
              ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Привычки ({habits.length})
        </button>
        <button
          onClick={() => setActiveTab('dailies')}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            activeTab === 'dailies'
              ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Дэйлики ({dailies.length})
        </button>
      </div>

      {/* List Content */}
      <div className="space-y-2.5">
        {activeTab === 'habits' ? (
          habits.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-12">Нет добавленных привычек</p>
          ) : (
            habits.map((habit) => (
              <div
                key={habit.id}
                className="bg-[#111115] hover:bg-[#15151a] border border-white/[0.08] rounded-2xl p-3.5 flex items-center justify-between gap-3 transition-all"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-xs text-zinc-200 truncate">
                    {habit.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-500 font-mono">
                    <span>+{habit.expReward} EXP</span>
                    <span>+{habit.goldReward}g</span>
                    {habit.streakCount ? <span>• стрик: {habit.streakCount}</span> : null}
                  </div>
                </div>

                {/* +/- Buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleHabitClick(habit.id, 'positive')}
                    className="w-8 h-8 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold flex items-center justify-center text-sm transition-colors active:scale-95"
                    title="Выполнено (+EXP/Gold)"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleHabitClick(habit.id, 'negative')}
                    className="w-8 h-8 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/5 text-zinc-500 hover:text-zinc-300 font-bold flex items-center justify-center text-sm transition-colors active:scale-95"
                    title="Срыв (-HP)"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )
        ) : (
          dailies.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-12">Нет ежедневных квестов</p>
          ) : (
            dailies.map((daily) => (
              <div
                key={daily.id}
                onClick={() => handleDailyClick(daily)}
                className={`border rounded-2xl p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-all ${
                  daily.completed
                    ? 'bg-zinc-900/30 border-white/5 opacity-50'
                    : 'bg-[#111115] hover:bg-[#15151a] border-white/[0.08]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {daily.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-zinc-400 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-zinc-600 shrink-0" />
                  )}
                  <div className="truncate">
                    <p className={`font-semibold text-xs ${daily.completed ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                      {daily.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-500 font-mono">
                      {daily.dueTime && <span>🕒 {daily.dueTime}</span>}
                      <span>+{daily.expReward} EXP</span>
                      <span>+{daily.goldReward}g</span>
                    </div>
                  </div>
                </div>

                {daily.streakCount !== undefined && (
                  <div className="flex items-center gap-1 text-[11px] font-mono text-zinc-400 shrink-0">
                    <Flame className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{daily.streakCount}</span>
                  </div>
                )}
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
};
