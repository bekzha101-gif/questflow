import { UserStats, TaskItem, Project, Reward, Boss, NotificationItem, GoogleCalendarConfig } from '../types';
import { initialStats, initialTasks, initialProjects, initialRewards, initialBoss, initialCalendarConfig } from '../data/initialData';

const KEYS = {
  STATS: 'questflow_stats_v1',
  TASKS: 'questflow_tasks_v1',
  PROJECTS: 'questflow_projects_v1',
  REWARDS: 'questflow_rewards_v1',
  BOSS: 'questflow_boss_v1',
  NOTIFICATIONS: 'questflow_notifications_v1',
  CALENDAR_CONFIG: 'questflow_calendar_config_v1',
};

export function loadStats(): UserStats {
  try {
    const data = localStorage.getItem(KEYS.STATS);
    return data ? JSON.parse(data) : initialStats;
  } catch {
    return initialStats;
  }
}

export function saveStats(stats: UserStats) {
  try {
    localStorage.setItem(KEYS.STATS, JSON.stringify(stats));
  } catch (e) {
    console.error('Failed to save stats', e);
  }
}

const DUMMY_TASK_IDS = new Set([
  'habit-1', 'habit-2', 'habit-3',
  'daily-1', 'daily-2', 'daily-3',
  'todo-1', 'todo-2', 'todo-3'
]);

export function loadTasks(): TaskItem[] {
  try {
    const data = localStorage.getItem(KEYS.TASKS);
    if (!data) return initialTasks;
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return initialTasks;
    // Strip out all unwanted sample/dummy tasks
    const cleaned = parsed.filter((t: TaskItem) => !DUMMY_TASK_IDS.has(t.id));
    return cleaned.length > 0 ? cleaned : initialTasks;
  } catch {
    return initialTasks;
  }
}

export function saveTasks(tasks: TaskItem[]) {
  try {
    localStorage.setItem(KEYS.TASKS, JSON.stringify(tasks));
  } catch (e) {
    console.error('Failed to save tasks', e);
  }
}

export function loadProjects(): Project[] {
  try {
    const data = localStorage.getItem(KEYS.PROJECTS);
    return data ? JSON.parse(data) : initialProjects;
  } catch {
    return initialProjects;
  }
}

export function saveProjects(projects: Project[]) {
  try {
    localStorage.setItem(KEYS.PROJECTS, JSON.stringify(projects));
  } catch (e) {
    console.error('Failed to save projects', e);
  }
}

export function loadRewards(): Reward[] {
  try {
    const data = localStorage.getItem(KEYS.REWARDS);
    return data ? JSON.parse(data) : initialRewards;
  } catch {
    return initialRewards;
  }
}

export function saveRewards(rewards: Reward[]) {
  try {
    localStorage.setItem(KEYS.REWARDS, JSON.stringify(rewards));
  } catch (e) {
    console.error('Failed to save rewards', e);
  }
}

export function loadBoss(): Boss {
  try {
    const data = localStorage.getItem(KEYS.BOSS);
    return data ? JSON.parse(data) : initialBoss;
  } catch {
    return initialBoss;
  }
}

export function saveBoss(boss: Boss) {
  try {
    localStorage.setItem(KEYS.BOSS, JSON.stringify(boss));
  } catch (e) {
    console.error('Failed to save boss', e);
  }
}

export function loadNotifications(): NotificationItem[] {
  try {
    const data = localStorage.getItem(KEYS.NOTIFICATIONS);
    return data ? JSON.parse(data) : [
      {
        id: 'notif-1',
        title: '⚔️ Рейд на Босса активен',
        message: 'Пожиратель Времени теряет здоровье за каждую закрытую задачу P1/P2!',
        time: '18:00',
        type: 'reminder',
        read: false,
      },
      {
        id: 'notif-2',
        title: '🔥 Стрик 5 дней!',
        message: 'Вы держите дисциплину 5 дней подряд. Получен бонус +25 Золота!',
        time: '09:00',
        type: 'reward',
        read: true,
      }
    ];
  } catch {
    return [];
  }
}

export function saveNotifications(notifs: NotificationItem[]) {
  try {
    localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(notifs));
  } catch (e) {
    console.error('Failed to save notifications', e);
  }
}

export function loadCalendarConfig(): GoogleCalendarConfig {
  try {
    const data = localStorage.getItem(KEYS.CALENDAR_CONFIG);
    return data ? JSON.parse(data) : initialCalendarConfig;
  } catch {
    return initialCalendarConfig;
  }
}

export function saveCalendarConfig(config: GoogleCalendarConfig) {
  try {
    localStorage.setItem(KEYS.CALENDAR_CONFIG, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save calendar config', e);
  }
}
