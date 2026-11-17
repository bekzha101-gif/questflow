import React from 'react';
import { CommandCenterToday } from '../../components/CommandCenterToday';
import type { SectionContext } from '../types';
import { FocusStrip } from './FocusStrip';
import { DaySummaryCard } from './DaySummaryCard';

// «Сегодня»: строка «главная задача · таймер · часы фокуса», «Итог дня» и прежние 4 колонки
// Привычки · Ежедневные · Задачи · Награды (раскладка не меняется, CLAUDE.md п.16).
export function TodaySection({ ctx }: { ctx: SectionContext }) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <FocusStrip tasks={ctx.tasks} timeLogs={ctx.timeLogs} />
      <DaySummaryCard />
      <div className="flex-1 min-h-0">
        <CommandCenterToday
          tasks={ctx.tasks}
          projects={ctx.projects}
          stats={ctx.stats}
          rewards={ctx.rewards}
          shoppingCount={ctx.shoppingCount}
          onToggleTask={ctx.onToggleTask}
          onToggleSubtask={ctx.onToggleSubtask}
          onTriggerHabit={ctx.onTriggerHabit}
          onToggleDaily={ctx.onToggleDaily}
          onAddTask={ctx.onAddTask}
          onUpdateTask={ctx.onUpdateTask}
          onEditTask={ctx.onEditTask}
          onDeleteTask={ctx.onDeleteTask}
          onAddSubtask={ctx.onAddSubtask}
          onBuyReward={ctx.onBuyReward}
          onOpenQuickAdd={() => ctx.onOpenQuickAdd()}
          onOpenHealthModal={ctx.onOpenHealthModal}
          onOpenStudioTab={() => ctx.onOpenTab('channels')}
          onOpenLifeTab={() => ctx.onOpenTab('health')}
          onOpenShoppingTab={() => ctx.onOpenTab('shopping')}
          onUpdateStats={ctx.onUpdateStats}
          onAwardRewards={ctx.onAwardRewards}
        />
      </div>
    </div>
  );
}
