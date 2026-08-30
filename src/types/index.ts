export type HeroClass = 'Warrior' | 'Mage' | 'Rogue' | 'Healer';

export interface UserStats {
  level: number;
  exp: number;
  maxExp: number;
  hp: number;
  maxHp: number;
  gold: number;
  streak: number;
  title: string;
  heroClass: HeroClass;
  avatarUrl: string;
  soundEnabled: boolean;
}

export type TaskType = 'habit' | 'daily' | 'todo';
export type Priority = 'p1' | 'p2' | 'p3' | 'p4';
export type Difficulty = 'trivial' | 'easy' | 'medium' | 'hard' | 'epic';
export type HabitDirection = 'positive' | 'negative' | 'both';

export interface SubTask {
  id: string;
  text: string;
  completed: boolean;
}

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  type: TaskType;
  priority: Priority;
  projectId: string;
  tags: string[];
  difficulty: Difficulty;
  expReward: number;
  goldReward: number;
  completed: boolean;
  completedAt?: string;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  durationMinutes?: number;
  recurrence?: 'none' | 'daily' | 'weekdays' | 'weekly' | 'custom';
  streakCount?: number;
  habitDirection?: HabitDirection;
  habitCounter?: number;
  subtasks: SubTask[];
  googleCalendarEventId?: string;
  inFocusFlow?: boolean; // Featured in ShortsFlow sprint
  stage?: 'backlog' | 'in_progress' | 'review' | 'done';
}

export interface Project {
  id: string;
  name: string;
  color: string;
  icon: string;
  isFavorite?: boolean;
}

export interface Reward {
  id: string;
  title: string;
  cost: number;
  type: 'real' | 'game';
  icon: string;
  description: string;
  timesPurchased: number;
  buffEffect?: string;
}

export interface Boss {
  id: string;
  name: string;
  title: string;
  currentHp: number;
  maxHp: number;
  avatar: string;
  color: string;
  rewardExp: number;
  rewardGold: number;
  expiresAt: string;
  status: 'active' | 'defeated';
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'reward' | 'damage' | 'reminder' | 'levelup' | 'sync';
  read: boolean;
}

export interface GoogleCalendarConfig {
  connected: boolean;
  autoSync: boolean;
  calendarName: string;
  lastSyncedAt?: string;
  apiKey?: string;
  clientId?: string;
}
