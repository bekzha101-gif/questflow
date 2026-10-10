import { TaskItem, TimeLogEntry } from '../types';

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime: string };
  end: { dateTime: string };
}

export function requestGoogleAccessToken(
  clientId: string
): Promise<{ accessToken: string; expiresIn: number }> {
  return new Promise((resolve, reject) => {
    const google = (window as any).google;
    if (!google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services SDK не загружен. Проверьте интернет-соединение.'));
      return;
    }

    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/calendar.events',
        callback: (response: any) => {
          if (response?.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }
          if (response?.access_token) {
            resolve({
              accessToken: response.access_token,
              expiresIn: response.expires_in ? parseInt(response.expires_in, 10) : 3600,
            });
          } else {
            reject(new Error('Токен доступа не получен'));
          }
        },
        error_callback: (err: any) => {
          reject(err);
        },
      });

      client.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      reject(err);
    }
  });
}

export async function createGoogleCalendarTimeLogEvent(
  entry: TimeLogEntry,
  accessToken: string
): Promise<string | null> {
  if (!accessToken) return null;

  try {
    const isWork = entry.mode === 'work';
    const summary = isWork
      ? `⚔️ [Фокус] ${entry.title || 'Работа'}`
      : `☕ [Отдых] ${entry.title || 'Перерыв'}`;

    const description = isWork
      ? `QuestFlow Фокус-сессия\nДлительность: ${entry.actualMinutes} мин (план: ${entry.targetMinutes} мин)\nНаграда: +${entry.expEarned || 0} EXP, +${entry.goldEarned || 0} Золота`
      : `QuestFlow Перерыв\nДлительность: ${entry.actualMinutes} мин`;

    const eventPayload = {
      summary,
      description,
      start: {
        dateTime: new Date(entry.startedAt).toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: new Date(entry.completedAt).toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      colorId: isWork ? '11' : '2', // Red for focus work, Sage/Green for break
    };

    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventPayload),
    });

    if (res.ok) {
      const data = await res.json();
      return data.id;
    }
  } catch (e) {
    console.error('Google Calendar time log creation error', e);
  }
  return null;
}

export async function createGoogleCalendarEvent(
  task: TaskItem,
  accessToken: string
): Promise<string | null> {
  if (!accessToken) return null;

  try {
    const today = new Date().toISOString().split('T')[0];
    const dateStr = task.dueDate || today;
    const timeStr = task.dueTime || '10:00';
    const startDateTime = new Date(`${dateStr}T${timeStr}:00`);
    const endDateTime = new Date(startDateTime.getTime() + (task.durationMinutes || 30) * 60 * 1000);

    const eventPayload = {
      summary: `⚔️ [${task.priority.toUpperCase()}] ${task.title}`,
      description: `QuestFlow RPG Квест\nНаграда: +${task.expReward} EXP, +${task.goldReward} Золота\nТеги: ${task.tags.join(', ')}`,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      colorId: task.priority === 'p1' ? '11' : task.priority === 'p2' ? '5' : '9', // Red/Yellow/Blue
    };

    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventPayload),
    });

    if (res.ok) {
      const data = await res.json();
      return data.id;
    }
  } catch (e) {
    console.error('Google Calendar event creation error', e);
  }
  return null;
}

export async function fetchGoogleCalendarEvents(
  accessToken: string
): Promise<GoogleCalendarEvent[]> {
  if (!accessToken) return [];

  try {
    const now = new Date();
    const minTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(minTime)}&maxResults=20&singleEvents=true&orderBy=startTime`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.ok) {
      const data = await res.json();
      return (data.items || []).map((item: any) => ({
        id: item.id,
        summary: item.summary || 'Событие Календаря',
        description: item.description,
        start: { dateTime: item.start?.dateTime || item.start?.date },
        end: { dateTime: item.end?.dateTime || item.end?.date },
      }));
    }
  } catch (e) {
    console.error('Google Calendar fetch error', e);
  }
  return [];
}
