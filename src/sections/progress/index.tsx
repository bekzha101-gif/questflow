import { useEffect, useState } from 'react';
import { TavernHub } from '../../components/TavernHub';
import { LifeAnalyticsHub } from '../../components/LifeAnalyticsHub';
import { SubTabs } from '../SubTabs';
import { progressViewFor, type ProgressView, type TabType } from '../routes';
import type { SectionContext } from '../types';

// «Прогресс»: награды и финансы. Графики и достижения добавит таск 07 в эту же папку.
export function ProgressSection({ ctx, tab }: { ctx: SectionContext; tab: TabType }) {
  const [view, setView] = useState<ProgressView>(progressViewFor(tab));
  useEffect(() => setView(progressViewFor(tab)), [tab]);

  return (
    <div className="max-w-7xl mx-auto py-2 px-2 sm:px-4 space-y-3 animate-fade-in">
      <SubTabs
        label="Прогресс"
        active={view}
        onChange={setView}
        items={[
          { id: 'rewards', label: 'Награды' },
          { id: 'finances', label: 'Финансы' },
        ]}
      />

      {view === 'rewards' && (
        <TavernHub
          stats={ctx.stats}
          rewards={ctx.rewards}
          onUpdateStats={ctx.onUpdateStats}
          onBuyReward={ctx.onBuyReward}
          onAddReward={ctx.onAddReward}
        />
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
          onLogReward={(exp, gold) => ctx.onAwardRewards(exp, gold)}
        />
      )}
    </div>
  );
}
