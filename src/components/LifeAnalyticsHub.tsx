import React, { useState } from 'react';
import { TaskItem, Project } from '../types';
import { LifeCalendarView } from './LifeCalendarView';
import { BigDataLifeTracker } from './BigDataLifeTracker';
import { CalendarTimeBlocking } from './CalendarTimeBlocking';
import { FinancesTracker } from './FinancesTracker';
import { 
  Hourglass, 
  Activity, 
  CalendarDays, 
  DollarSign, 
  Compass,
  TrendingUp,
  Sparkles
} from 'lucide-react';

interface LifeAnalyticsHubProps {
  tasks: TaskItem[];
  projects: Project[];
  calendarConfig: any;
  onSyncCalendar: () => void;
  onOpenCalendarModal: () => void;
  onOpenQuickAdd: () => void;
  onToggleTask: (taskId: string) => void;
  onAddGoldReward: (gold: number) => void;
  onLogReward: (exp: number, gold: number) => void;
}

export function LifeAnalyticsHub({
  tasks,
  projects,
  calendarConfig,
  onSyncCalendar,
  onOpenCalendarModal,
  onOpenQuickAdd,
  onToggleTask,
  onAddGoldReward,
  onLogReward,
}: LifeAnalyticsHubProps) {
  const [lifeTab, setLifeTab] = useState<'life_calendar' | 'bigdata' | 'time_blocking' | 'finances'>('life_calendar');

  return (
    <div className="space-y-4 max-w-7xl mx-auto py-2 px-2 sm:px-4 animate-fade-in select-none">
      
      {/* ─── Life OS Sub-Header & Switcher ─────────────────────────────────── */}
      <div className="bg-[#101014] border border-white/[0.07] rounded-2xl p-3 sm:p-4 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">Жизнь & Аналитика</h2>
            <p className="text-[11px] text-zinc-400 font-mono">Календарь Жизни на 80 лет, Big Data Трекер и Финансы</p>
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="flex items-center gap-1.5 bg-black/50 border border-white/10 rounded-xl p-1 text-xs flex-wrap">
          <button
            onClick={() => setLifeTab('life_calendar')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              lifeTab === 'life_calendar' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Hourglass className="w-3.5 h-3.5 text-rose-400" />
            <span>Календарь Жизни</span>
          </button>

          <button
            onClick={() => setLifeTab('bigdata')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              lifeTab === 'bigdata' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>Big Data Табличка</span>
          </button>

          <button
            onClick={() => setLifeTab('time_blocking')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              lifeTab === 'time_blocking' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5 text-indigo-400" />
            <span>Тайм-Блокинг</span>
          </button>

          <button
            onClick={() => setLifeTab('finances')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              lifeTab === 'finances' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span>Финансы</span>
          </button>
        </div>
      </div>

      {/* ─── Views ─────────────────────────────────────────────────────────── */}
      {lifeTab === 'life_calendar' && (
        <LifeCalendarView />
      )}

      {lifeTab === 'bigdata' && (
        <BigDataLifeTracker onLogReward={onLogReward} />
      )}

      {lifeTab === 'time_blocking' && (
        <CalendarTimeBlocking
          tasks={tasks}
          projects={projects}
          calendarConfig={calendarConfig}
          onSyncCalendar={onSyncCalendar}
          onOpenCalendarModal={onOpenCalendarModal}
          onOpenQuickAdd={onOpenQuickAdd}
          onToggleTask={onToggleTask}
        />
      )}

      {lifeTab === 'finances' && (
        <FinancesTracker onAddGoldReward={onAddGoldReward} />
      )}
    </div>
  );
}
