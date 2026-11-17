import { useEffect, useState } from 'react';
import { TavernHub } from '../../components/TavernHub';
import { LifeAnalyticsHub } from '../../components/LifeAnalyticsHub';
import type { GameStats } from '@shared/types';
import { SubTabs } from '../SubTabs';
import type { TabType } from '../routes';
import type { SectionContext } from '../types';
import { ProgressOverview } from './Overview';
import { IncomePanel } from './IncomePanel';
import { applyGame } from './game';
import { todayStr } from '@shared/time';

// «Прогресс»: обзор (уровень, серия, графики, ачивки, правила), доход по каналам, магазин наград, финансы.
type View = 'overview' | 'income' | 'rewards' | 'finances';

function viewFor(tab: TabType): View {
  if (tab === 'finances') return 'finances';
  if (tab === 'tavern' || tab === 'team') return 'rewards';
  return 'overview';
}

export function ProgressSection({ ctx, tab }: { ctx: SectionContext; tab: TabType }) {
  const [view, setView] = useState<View>(viewFor(tab));
  useEffect(() => setView(viewFor(tab)), [tab]);
  const stats = ctx.stats as unknown as GameStats;

  return (
    <div className="max-w-7xl mx-auto py-2 px-2 sm:px-4 space-y-3 animate-fade-in">
      <SubTabs
        label="Прогресс"
        active={view}
        onChange={setView}
        items={[
          { id: 'overview', label: 'Обзор' },
          { id: 'income', label: 'Доход' },
          { id: 'rewards', label: 'Награды' },
          { id: 'finances', label: 'Финансы' },
        ]}
      />

      {view === 'overview' && <ProgressOverview stats={stats} />}

      {view === 'income' && <IncomePanel incomeTotal={Number(stats.incomeUsdTotal ?? 0)} />}

      {view === 'rewards' && (
        <TavernHub stats={ctx.stats} rewards={ctx.rewards} onBuyReward={ctx.onBuyReward} onAddReward={ctx.onAddReward} />
      )}

      {view === 'finances' && (
        <LifeAnalyticsHub
          view="finances"
          tasks={ctx.tasks}
          projects={ctx.projects}
          stats={ctx.stats}
          calendarConfig={ctx.calendarConfig}
          timeLogs={ctx.timeLogs}
          onUpdateStats={ctx.onUpdateStats}
          onAddNotification={ctx.onAddNotification}
          onSyncCalendar={ctx.onSyncCalendar}
          onOpenCalendarModal={ctx.onOpenCalendarModal}
          onOpenQuickAdd={() => ctx.onOpenQuickAdd()}
          onToggleTask={ctx.onToggleTask}
          onAddGoldReward={ctx.onAddGoldReward}
          // Заполненный день Big Data — награда по правилам, один раз за день
          onLogReward={() => applyGame({ kind: 'bigdata_fill', ref: todayStr() })}
        />
      )}
    </div>
  );
}
