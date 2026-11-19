import type { SectionContext } from '../types';
import { MediaStudioHub } from '../../components/MediaStudioHub';

// «Каналы»: старая Медиа-Студия — Канбан Монтажа, Flow Shorts, Идеи, AI Сценарист.
// Каналы и видео хранятся в облаке (channels2/videos2), бот напоминает по ним как раньше.
export function ChannelsSection({ ctx }: { ctx: SectionContext }) {
  const toggleFocus = (taskId: string) => {
    const task = ctx.tasks.find((t) => t.id === taskId);
    if (task) ctx.onUpdateTask(taskId, { inFocusFlow: !task.inFocusFlow });
  };
  const snooze = (taskId: string, minutes: number) => {
    const task = ctx.tasks.find((t) => t.id === taskId);
    if (task) ctx.onUpdateTask(taskId, { durationMinutes: (task.durationMinutes || 25) + minutes });
  };
  return (
    <MediaStudioHub
      tasks={ctx.tasks}
      projects={ctx.projects}
      stats={ctx.stats}
      onToggleTask={ctx.onToggleTask}
      onToggleSubtask={ctx.onToggleSubtask}
      onSnoozeTask={snooze}
      onToggleFocus={toggleFocus}
      onAddTask={(task) => ctx.onAddTask(task)}
      onOpenAiDecompose={(title) => ctx.onOpenAiMaster(title)}
      onOpenAiMaster={() => ctx.onOpenAiMaster()}
    />
  );
}
