import { TaskItem } from '../types';

export function generateIcsFeed(tasks: TaskItem[]): string {
  const events = tasks
    .filter((t) => !t.completed && (t.dueDate || t.dueTime))
    .map((t) => {
      const now = new Date();
      const dateStr = t.dueDate || now.toISOString().split('T')[0];
      const timeStr = t.dueTime || '09:00';
      const startDateTime = new Date(`${dateStr}T${timeStr}:00`);
      const endDateTime = new Date(startDateTime.getTime() + (t.durationMinutes || 30) * 60 * 1000);

      const formatIcsDate = (d: Date) => {
        return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      };

      return [
        'BEGIN:VEVENT',
        `UID:${t.id}@questflow.app`,
        `DTSTAMP:${formatIcsDate(now)}`,
        `DTSTART:${formatIcsDate(startDateTime)}`,
        `DTEND:${formatIcsDate(endDateTime)}`,
        `SUMMARY:⚔️ [${t.priority.toUpperCase()}] ${t.title}`,
        `DESCRIPTION:Награда: +${t.expReward} EXP, +${t.goldReward} Gold\\nСложность: ${t.difficulty}\\nТеги: ${t.tags.join(', ')}`,
        'STATUS:CONFIRMED',
        'END:VEVENT',
      ].join('\r\n');
    });

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//QuestFlow//Gamified Productivity//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:QuestFlow Tasks & Quests',
    'X-WR-TIMEZONE:UTC',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadIcsFile(tasks: TaskItem[]) {
  const icsData = generateIcsFeed(tasks);
  const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.setAttribute('download', 'questflow_calendar.ics');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
