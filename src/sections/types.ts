import type { TaskItem, Project, UserStats, Reward, TimeLogEntry, NotificationItem, GoogleCalendarConfig } from '../types';
import type { TaskKind } from '../utils/taskFilters';

// Всё, что App отдаёт разделам. Раздел берёт из контекста нужное и живёт в своей папке src/sections/<id>/.
export interface SectionContext {
  /** Обычные задачи: покупок здесь нет (покупки только в shoppingTasks) */
  tasks: TaskItem[];
  shoppingTasks: TaskItem[];
  projects: Project[];
  stats: UserStats;
  rewards: Reward[];
  timeLogs: TimeLogEntry[];
  calendarConfig: GoogleCalendarConfig;
  shoppingCount: number;

  onToggleTask: (taskId: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onAddSubtask: (taskId: string, text: string) => void;
  onTriggerHabit: (taskId: string, direction: 'positive' | 'negative') => void;
  onToggleDaily: (taskId: string) => void;
  onAddTask: (task: Partial<TaskItem> & { title: string; kind?: TaskKind }) => void;
  onUpdateTask: (taskId: string, patch: Partial<TaskItem>) => void;
  onEditTask: (task: TaskItem) => void;
  onDeleteTask: (taskId: string) => void;
  onBuyReward: (reward: Reward) => boolean;
  onAddReward: (reward: Omit<Reward, 'id' | 'timesPurchased'>) => void;
  onUpdateStats: (patch: Partial<UserStats>) => void;
  onAddNotification: (n: NotificationItem) => void;
  onSyncCalendar: () => void;
  onOpenCalendarModal: () => void;
  /** Без аргумента — задача; 'shopping' — покупка */
  onOpenQuickAdd: (kind?: TaskKind) => void;
  onOpenHealthModal: () => void;
  /** AI-мастер квестов; goal — черновик цели (например, «разбить задачу») */
  onOpenAiMaster: (goal?: string) => void;
  onOpenTab: (tab: import('./routes').TabType) => void;
}
