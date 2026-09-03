import { UserStats, Project, TaskItem, Reward, Boss, GoogleCalendarConfig } from '../types';

export const initialStats: UserStats = {
  level: 1,
  exp: 0,
  maxExp: 100,
  hp: 100,
  maxHp: 100,
  gold: 0,
  streak: 0,
  title: 'Новичок',
  heroClass: 'Warrior',
  avatarUrl: '⚔️',
  soundEnabled: true,
};

export const initialProjects: Project[] = [
  { id: 'proj-inbox', name: 'Входящие', color: '#6366f1', icon: 'Inbox', isFavorite: true },
  { id: 'proj-work', name: 'Работа & Проекты', color: '#3b82f6', icon: 'Briefcase', isFavorite: true },
  { id: 'proj-life', name: 'Личное & Здоровье', color: '#10b981', icon: 'Sun', isFavorite: true },
];

// No pre-populated dummy tasks — the user adds only their own tasks!
export const initialTasks: TaskItem[] = [];

export const initialRewards: Reward[] = [
  {
    id: 'rew-1',
    title: '☕ Чашка хорошего кофе',
    cost: 30,
    type: 'real',
    description: 'Маленькая награда за продуктивный рабочий блок.',
    timesPurchased: 0,
    icon: 'Coffee',
  },
  {
    id: 'rew-2',
    title: '🎬 1 час отдыха без чувства вины',
    cost: 50,
    type: 'real',
    description: 'Заслуженный отдых или просмотр фильма.',
    timesPurchased: 0,
    icon: 'Film',
  },
  {
    id: 'rew-3',
    title: '🍕 Любимая доставка еды',
    cost: 120,
    type: 'real',
    description: 'Награда за закрытие всех запланированных задач недели.',
    timesPurchased: 0,
    icon: 'Pizza',
  },
];

export const initialBoss: Boss = {
  id: 'boss-procrastination-dragon',
  name: 'Дракон Прокрастинации',
  title: 'Пожиратель Времени & Фокуса',
  currentHp: 500,
  maxHp: 500,
  avatar: '🐉',
  color: '#f43f5e',
  rewardExp: 300,
  rewardGold: 150,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  status: 'active',
};

export const initialCalendarConfig: GoogleCalendarConfig = {
  connected: false,
  autoSync: true,
  calendarName: 'Основной',
};
