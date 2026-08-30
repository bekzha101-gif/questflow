import { Difficulty, Priority, TaskType } from '../types';

export interface ParsedTaskInput {
  title: string;
  type: TaskType;
  priority: Priority;
  tags: string[];
  dueDate?: string;
  dueTime?: string;
  durationMinutes?: number;
  difficulty: Difficulty;
  expReward: number;
  goldReward: number;
}

export function parseNaturalLanguageTask(input: string): ParsedTaskInput {
  let text = input.trim();
  let priority: Priority = 'p3';
  let type: TaskType = 'todo';
  const tags: string[] = [];
  let dueDate: string | undefined = undefined;
  let dueTime: string | undefined = undefined;
  let durationMinutes: number | undefined = undefined;

  // 1. Priority parsing (p1, p2, p3, p4 or !1, !2, !3, !4)
  const priorityMatch = text.match(/\b(?:p|!)([1-4])\b/i);
  if (priorityMatch) {
    const pNum = priorityMatch[1];
    priority = `p${pNum}` as Priority;
    text = text.replace(priorityMatch[0], '');
  }

  // 2. Type parsing (!habit, !daily, !todo or /habit, /daily)
  if (/\b(?:!habit|\/habit|привычка)\b/i.test(text)) {
    type = 'habit';
    text = text.replace(/\b(?:!habit|\/habit|привычка)\b/gi, '');
  } else if (/\b(?:!daily|\/daily|ежедневка|каждый день)\b/i.test(text)) {
    type = 'daily';
    text = text.replace(/\b(?:!daily|\/daily|ежедневка|каждый день)\b/gi, '');
  }

  // 3. Tags parsing (#tag or @tag)
  const tagMatches = text.match(/([#@][\p{L}\p{N}_-]+)/gu);
  if (tagMatches) {
    tagMatches.forEach((tag) => {
      tags.push(tag.replace(/^[#@]/, '').toLowerCase());
      text = text.replace(tag, '');
    });
  }

  // 4. Time parsing (в 14:00, 14:00, at 3pm, at 15:30)
  const timeMatch = text.match(/\b(?:в|at\s+)?(\d{1,2}):(\d{2})\b/i);
  if (timeMatch) {
    const hours = timeMatch[1].padStart(2, '0');
    const mins = timeMatch[2];
    dueTime = `${hours}:${mins}`;
    text = text.replace(timeMatch[0], '');
  }

  // 5. Duration parsing (30m, 45мин, 1h, 1час)
  const durationMatch = text.match(/\b(\d+)\s*(?:m|min|мин|минут)\b/i);
  if (durationMatch) {
    durationMinutes = parseInt(durationMatch[1], 10);
    text = text.replace(durationMatch[0], '');
  }
  const hourMatch = text.match(/\b(\d+)\s*(?:h|hr|час|часа|часов)\b/i);
  if (hourMatch) {
    durationMinutes = parseInt(hourMatch[1], 10) * 60;
    text = text.replace(hourMatch[0], '');
  }

  // 6. Date parsing (сегодня, завтра, послезавтра, today, tomorrow)
  const today = new Date();
  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  if (/\b(?:сегодня|today)\b/i.test(text)) {
    dueDate = formatDate(today);
    text = text.replace(/\b(?:сегодня|today)\b/gi, '');
  } else if (/\b(?:завтра|tomorrow)\b/i.test(text)) {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    dueDate = formatDate(tomorrow);
    text = text.replace(/\b(?:завтра|tomorrow)\b/gi, '');
  } else if (/\b(?:послезавтра)\b/i.test(text)) {
    const dayAfter = new Date(today);
    dayAfter.setDate(today.getDate() + 2);
    dueDate = formatDate(dayAfter);
    text = text.replace(/\b(?:послезавтра)\b/gi, '');
  }

  // Calculate difficulty & rewards based on priority & duration
  let difficulty: Difficulty = 'medium';
  let expReward = 40;
  let goldReward = 25;

  if (priority === 'p1') {
    difficulty = (durationMinutes && durationMinutes >= 45) ? 'epic' : 'hard';
    expReward = difficulty === 'epic' ? 120 : 80;
    goldReward = difficulty === 'epic' ? 75 : 50;
  } else if (priority === 'p2') {
    difficulty = 'medium';
    expReward = 50;
    goldReward = 30;
  } else if (priority === 'p3') {
    difficulty = 'easy';
    expReward = 30;
    goldReward = 18;
  } else {
    difficulty = 'trivial';
    expReward = 15;
    goldReward = 8;
  }

  // Clean title
  const cleanTitle = text.replace(/\s+/g, ' ').trim() || 'Новая задача';

  return {
    title: cleanTitle,
    type,
    priority,
    tags,
    dueDate,
    dueTime,
    durationMinutes: durationMinutes || 25,
    difficulty,
    expReward,
    goldReward,
  };
}
