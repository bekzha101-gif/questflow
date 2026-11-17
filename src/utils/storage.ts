import { NotificationItem, GoogleCalendarConfig } from '../types';
import { initialCalendarConfig } from '../data/initialData';

const KEYS = {
  NOTIFICATIONS: 'questflow_notifications_v1',
  CALENDAR_CONFIG: 'questflow_calendar_config_v1',
};

export function loadNotifications(): NotificationItem[] {
  try {
    const data = localStorage.getItem(KEYS.NOTIFICATIONS);
    return data ? JSON.parse(data) : [];
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
