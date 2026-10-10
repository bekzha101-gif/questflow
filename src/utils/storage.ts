import { UserStats, TaskItem, Project, Reward, Boss, NotificationItem, GoogleCalendarConfig } from '../types';
import { initialStats, initialTasks, initialProjects, initialRewards, initialBoss, initialCalendarConfig } from '../data/initialData';
import { todoistProjects, todoistTasks } from '../data/todoistImportData';

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
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object') {
        // If stats were reset to level 1 and 0 gold by guest mode, restore real level 4 stats from image 1
        if (parsed.level === 1 && parsed.gold === 0 && parsed.exp === 0) {
          saveStats(initialStats);
          return initialStats;
        }
        return parsed;
      }
    }
    saveStats(initialStats);
    return initialStats;
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

const ZOMBIE_IDS = new Set([
  'habit-visualization',
  'habit-walk-floor',
  'habit-review-day',
  'daily-digital-detox',
  'todo-cadrol',
  'todo-wisdom-20-videos',
  'todo-investor-20-videos',
  'todo-base44-app',
  'todo-base-youtube-system',
  'todo-n8n-nexlev',
  'todo-autograbber',
  'todo-record-video-voice',
  'todo-tg-shop',
  'todo-recovery-calendar',
  'todo-base44-habitica',
  'todo-base444-gcal',
  'todo-ad-cutters',
  'todo-descript-upload',
  'habit-1', 'habit-2', 'habit-3',
  'daily-1', 'daily-2', 'daily-3',
  'todo-1', 'todo-2', 'todo-3'
]);

export function loadTasks(): TaskItem[] {
  try {
    const data = localStorage.getItem(KEYS.TASKS);
    if (!data) {
      saveTasks(initialTasks);
      return initialTasks;
    }
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      saveTasks(initialTasks);
      return initialTasks;
    }

    // Filter out unwanted legacy/zombie tasks from past test memory
    const cleaned = parsed.filter((t: TaskItem) => !ZOMBIE_IDS.has(t.id));

    // Remove legacy imported tasks from non-shopping projects (ideas, automation, youtube) that user deleted
    const validTasks = cleaned.filter((t: TaskItem) => {
      if (
        t.projectId === '6h5FPv7XH99pQRH3' || 
        t.projectId === '6h5GFmFgmm9g4f9w' || 
        t.projectId === '6h645qv3RfM99G8h'
      ) {
        return false;
      }
      return true;
    });

    // Ensure the main active task from image 1 is present if missing
    const hasActiveTodo = validTasks.some(t => t.type === 'todo' && t.projectId !== '6h5FPgJ74x5g685w');
    if (!hasActiveTodo) {
      const activeTodo = initialTasks.find(t => t.id === 'task-notebook-ideas');
      if (activeTodo) {
        validTasks.push(activeTodo);
      }
    }

    // Ensure habits from image 1 are present if missing
    const hasHabits = validTasks.some(t => t.type === 'habit');
    if (!hasHabits) {
      const defaultHabits = initialTasks.filter(t => t.type === 'habit');
      validTasks.push(...defaultHabits);
    }

    if (validTasks.length !== parsed.length) {
      saveTasks(validTasks);
    }

    return validTasks;
  } catch (e) {
    console.error('Failed to load tasks', e);
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
    let projects: Project[] = data ? JSON.parse(data) : initialProjects;
    if (!Array.isArray(projects) || projects.length === 0) {
      projects = [...initialProjects];
    }

    // Seamless auto-merge Todoist projects if not already present
    let modified = false;
    for (const tp of todoistProjects) {
      if (!projects.some((p) => p.id === tp.id)) {
        projects.push(tp);
        modified = true;
      }
    }
    if (modified) {
      saveProjects(projects);
    }
    return projects;
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
