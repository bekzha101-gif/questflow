import { UserStats, Project, TaskItem, Reward, Boss, GoogleCalendarConfig } from '../types';
import { todoistProjects, todoistTasks } from './todoistImportData';

export const initialStats: UserStats = {
  level: 4,
  exp: 83,
  maxExp: 100,
  hp: 100,
  maxHp: 100,
  gold: 427,
  streak: 1,
  title: 'Воин',
  heroClass: 'Warrior',
  avatarUrl: '⚔️',
  soundEnabled: true,
};

export const initialProjects: Project[] = [
  { id: 'proj-inbox', name: 'Входящие', color: '#6366f1', icon: 'Inbox', isFavorite: true },
  { id: 'proj-work', name: 'Работа & Проекты', color: '#3b82f6', icon: 'Briefcase', isFavorite: true },
  { id: 'proj-life', name: 'Личное & Здоровье', color: '#10b981', icon: 'Sun', isFavorite: true },
  ...todoistProjects,
];

export const initialTasks: TaskItem[] = [
  // 1. Привычки (Точно как в интерфейсе пользователя)
  {
    id: 'habit-water-thermos',
    title: '2 л. воды, теплой воды термос 500мгх4',
    type: 'habit',
    priority: 'p2',
    projectId: 'proj-life',
    difficulty: 'easy',
    expReward: 20,
    goldReward: 10,
    completed: false,
    tags: ['здоровье', 'вода'],
    habitDirection: 'both',
    habitCounter: 0,
    subtasks: [],
  },
  {
    id: 'habit-meditation',
    title: 'Медитация',
    type: 'habit',
    priority: 'p2',
    projectId: 'proj-life',
    difficulty: 'easy',
    expReward: 20,
    goldReward: 10,
    completed: false,
    tags: ['осознанность', 'здоровье'],
    habitDirection: 'both',
    habitCounter: 1,
    subtasks: [],
  },

  // 2. Активные задачи
  {
    id: 'task-notebook-ideas',
    title: 'Подчесать всю тетрадь, исправить и внедрить все идеи.',
    type: 'todo',
    priority: 'p2',
    projectId: 'proj-inbox',
    difficulty: 'medium',
    expReward: 35,
    goldReward: 20,
    completed: false,
    stage: 'in_progress',
    tags: ['фокус', 'тетрадь'],
    subtasks: [
      { id: 'st-tg', text: 'telegram', completed: true },
      { id: 'st-notes', text: 'телефон заметки', completed: false },
      { id: 'st-t1-full', text: '1 тетрадь фулл', completed: false },
      { id: 'st-t1-notfull', text: '1 тетрадь не фулл', completed: false },
      { id: 'st-gamification', text: 'геймификация задачи', completed: true },
    ],
  },

  // 3. Список покупок (13 элементов из Todoist)
  ...todoistTasks,
];

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
