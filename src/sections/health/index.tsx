import { LifeAnalyticsHub } from '../../components/LifeAnalyticsHub';
import { healthViewFor, type TabType } from '../routes';
import type { SectionContext } from '../types';

// «Здоровье»: био-здоровье и Big Data (вкладки внутри LifeAnalyticsHub). Дневник Big Data по макету делает таск 05.
export function HealthSection({ ctx, tab }: { ctx: SectionContext; tab: TabType }) {
  return (
    <LifeAnalyticsHub
      key={tab}
      view="health"
      initialHealthTab={healthViewFor(tab)}
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
    />
  );
}
