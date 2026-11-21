import { useEffect, useState } from 'react';
import { TodoistTaskList } from '../../components/TodoistTaskList';
import { ShoppingListView } from '../../components/ShoppingListView';
import { LifeAnalyticsHub } from '../../components/LifeAnalyticsHub';
import { SubTabs } from '../SubTabs';
import { goalsViewFor, type GoalsView, type TabType } from '../routes';
import { GoalsMonth } from './GoalsMonth';
import { GoalsArchive } from './GoalsArchive';
import { GoalsSomeday } from './GoalsSomeday';
import type { SectionContext } from '../types';

type View = GoalsView | 'goals' | 'someday' | 'archive';
// Цели месяца открываются по умолчанию; старый id «tasks» открывает вкладку задач
const initialView = (tab: TabType): View => (tab === 'tasks' || tab === 'shopping' || tab === 'calendar' ? goalsViewFor(tab) : 'goals');

// «Цели»: цели месяца · без срока · архив · задачи · покупки (на своей вкладке) · календарь.
export function GoalsSection({ ctx, tab }: { ctx: SectionContext; tab: TabType }) {
  const [view, setView] = useState<View>(initialView(tab));
  // Старая ссылка (например, «покупки») открывает свою вкладку, в том числе при переходе из палитры
  useEffect(() => setView(initialView(tab)), [tab]);

  return (
    <div className="max-w-7xl mx-auto py-2 px-2 sm:px-4 space-y-3 animate-fade-in">
      <SubTabs
        label="Цели"
        active={view}
        onChange={setView}
        items={[
          { id: 'goals', label: 'Цели месяца' },
          { id: 'someday', label: 'Без срока' },
          { id: 'archive', label: 'Архив' },
          { id: 'tasks', label: 'Задачи', badge: ctx.tasks.filter((t) => t.type === 'todo' && !t.completed).length },
          { id: 'shopping', label: 'Покупки', badge: ctx.shoppingCount },
          { id: 'calendar', label: 'Календарь' },
        ]}
      />

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
