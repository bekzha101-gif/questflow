import { useEffect, useState } from 'react';
import { TodoistTaskList } from '../../components/TodoistTaskList';
import { ShoppingListView } from '../../components/ShoppingListView';
import { LifeAnalyticsHub } from '../../components/LifeAnalyticsHub';
import { SubTabs } from '../SubTabs';
import { goalsViewFor, type GoalsView, type TabType } from '../routes';
import { GoalsMonth } from './GoalsMonth';
import { GoalsArchive } from './GoalsArchive';
import { GoalsSomeday } from './GoalsSomeday';
import { TodaySection } from '../today';
import type { SectionContext } from '../types';

type View = GoalsView | 'goals' | 'someday' | 'archive';
// «Сегодня» открывается по умолчанию (и при открытии сайта); старые id «tasks», «shopping», «calendar» открывают свою вкладку
const initialView = (tab: TabType): View => goalsViewFor(tab);

// «Цели»: сегодня · цели месяца · без срока · архив · задачи · покупки (на своей вкладке) · календарь.
export function GoalsSection({ ctx, tab }: { ctx: SectionContext; tab: TabType }) {
  const [view, setView] = useState<View>(initialView(tab));
  // Старая ссылка (например, «покупки») открывает свою вкладку, в том числе при переходе из палитры
  useEffect(() => setView(initialView(tab)), [tab]);

  const tabs = (
    <SubTabs
      label="Цели"
      active={view}
      onChange={setView}
      items={[
        { id: 'today', label: 'Сегодня' },
        { id: 'goals', label: 'Цели месяца' },
        { id: 'someday', label: 'Без срока' },
        { id: 'archive', label: 'Архив' },
        { id: 'tasks', label: 'Задачи', badge: ctx.tasks.filter((t) => t.type === 'todo' && !t.completed).length },
        { id: 'shopping', label: 'Покупки', badge: ctx.shoppingCount },
        { id: 'calendar', label: 'Календарь' },
      ]}
    />
  );

  // «Сегодня» — прежний экран из 4 колонок во всю ширину (раскладка не меняется, CLAUDE.md п.16)
  if (view === 'today') {
    return (
      <div className="flex flex-col h-full min-h-0 animate-fade-in">
        <div className="px-2 sm:px-4 pt-2">{tabs}</div>
        <div className="flex-1 min-h-0">
          <TodaySection ctx={ctx} />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-2 px-2 sm:px-4 space-y-3 animate-fade-in">
      {tabs}

      {view === 'goals' && <GoalsMonth />}
      {view === 'someday' && <GoalsSomeday onMovedToMonth={() => setView('goals')} />}
      {view === 'archive' && <GoalsArchive onSetGoal={() => setView('goals')} />}

      {view === 'tasks' && (
        <TodoistTaskList
          tasks={ctx.tasks}
          projects={ctx.projects}
          stats={ctx.stats}
          onToggleTask={ctx.onToggleTask}
          onToggleSubtask={ctx.onToggleSubtask}
          onAddSubtask={ctx.onAddSubtask}
          onDeleteTask={ctx.onDeleteTask}
          onEditTask={ctx.onEditTask}
          onOpenQuickAdd={() => ctx.onOpenQuickAdd()}
        />
      )}

      {view === 'shopping' && (
        <ShoppingListView
          tasks={ctx.shoppingTasks}
          projects={ctx.projects}
          stats={ctx.stats}
          onToggleTask={ctx.onToggleTask}
          onToggleSubtask={ctx.onToggleSubtask}
          onAddSubtask={ctx.onAddSubtask}
          onDeleteTask={ctx.onDeleteTask}
          onEditTask={ctx.onEditTask}
          onOpenQuickAdd={ctx.onOpenQuickAdd}
        />
      )}

      {view === 'calendar' && (
        <LifeAnalyticsHub
          view="calendar"
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
      )}
    </div>
  );
}
