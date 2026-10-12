import React, { useState } from 'react';
import { TaskItem, Project, UserStats, NotificationItem, TimeLogEntry } from '../types';
import { BigDataLifeTracker } from './BigDataLifeTracker';
import { CalendarTimeBlocking } from './CalendarTimeBlocking';
import { FinancesTracker } from './FinancesTracker';
import { HealthBioTracker } from './HealthBioTracker';

type HealthTab = 'health' | 'bigdata';

interface LifeAnalyticsHubProps {
  // Какой раздел показывать: у каждого своя вкладка в навигации
  view: 'health' | 'calendar' | 'finances';
  initialHealthTab?: HealthTab;
  tasks: TaskItem[];
  projects: Project[];
  stats: UserStats;
  calendarConfig: any;
  timeLogs?: TimeLogEntry[];
  onUpdateStats: (newStats: Partial<UserStats>) => void;
  onAddNotification?: (notif: NotificationItem) => void;
  onSyncCalendar: () => void;
  onOpenCalendarModal: () => void;
  onOpenQuickAdd: () => void;
  onToggleTask: (taskId: string) => void;
  onAddGoldReward: (gold: number) => void;
  onLogReward: (exp: number, gold: number) => void;
}

const HEALTH_TABS: { id: HealthTab; label: string }[] = [
  { id: 'health', label: 'Био-здоровье' },
  { id: 'bigdata', label: 'Big Data' },
];

export function LifeAnalyticsHub({
  view,
  initialHealthTab = 'health',
  tasks,
  projects,
  stats,
  calendarConfig,
  timeLogs = [],
  onUpdateStats,
  onAddNotification,
  onSyncCalendar,
  onOpenCalendarModal,
  onOpenQuickAdd,
  onToggleTask,
  onAddGoldReward,
  onLogReward,
}: LifeAnalyticsHubProps) {
  const [healthTab, setHealthTab] = useState<HealthTab>(initialHealthTab);

  return (
    <div className="space-y-3 max-w-7xl mx-auto py-3 px-2 sm:px-4 animate-fade-in select-none">
      {view === 'health' && (
        <>
          <div className="inline-flex items-center gap-1 bg-zinc-900 border border-white/10 rounded-xl p-0.5 text-xs">
            {HEALTH_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setHealthTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  healthTab === tab.id ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {healthTab === 'health' && (
            <HealthBioTracker
              stats={stats}
              onUpdateStats={onUpdateStats}
              onAddNotification={onAddNotification}
            />
          )}

          {healthTab === 'bigdata' && <BigDataLifeTracker onLogReward={onLogReward} />}
        </>
      )}

      {view === 'calendar' && (
        <CalendarTimeBlocking
          tasks={tasks}
          projects={projects}
          calendarConfig={calendarConfig}
          timeLogs={timeLogs}
          onSyncCalendar={onSyncCalendar}
          onOpenCalendarModal={onOpenCalendarModal}
          onOpenQuickAdd={onOpenQuickAdd}
          onToggleTask={onToggleTask}
          onUpdateStats={onUpdateStats}
          onAwardRewards={(exp, gold, hp) => {
            onLogReward(exp, gold);
            if (hp) onUpdateStats({ hp: Math.min(stats.maxHp, stats.hp + hp) });
          }}
        />
      )}

      {view === 'finances' && <FinancesTracker onAddGoldReward={onAddGoldReward} />}
    </div>
  );
}
