import { TaskItem } from '../types';

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime: string };
  end: { dateTime: string };
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
