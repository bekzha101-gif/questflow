import { UserStats, GoogleCalendarConfig } from '../types';

// Стартовые статы для новой пустой базы. Статы пользователя из облака их всегда перекрывают.
// Выдуманные задачи, проекты, награды и босс отсюда убраны: данные пользователя — единственный источник правды.
export const initialStats: UserStats = {
  level: 1,
  exp: 0,
  maxExp: 100,
  hp: 100,
  maxHp: 100,
  gold: 0,
  streak: 0,
  title: 'Воин',
  heroClass: 'Warrior',
  avatarUrl: '⚔️',
  soundEnabled: true,
};

export const initialCalendarConfig: GoogleCalendarConfig = {
  connected: false,
  autoSync: true,
  calendarName: 'Основной',
};
