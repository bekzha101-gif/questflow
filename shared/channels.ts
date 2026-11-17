// Расписание публикаций каналов: чистые правила для сайта и сервера (без React, без DOM).
// Сервер подгружает remindersFor в рантайме (server/src/publications.ts), поэтому
// здесь только строгий TS и время параметром (today = YYYY-MM-DD по Бишкеку из shared/time).
import { addDays } from './time';
import type { Channel, ChannelStatus, Video, VideoChecklist, VideoStage } from './types';

export type ChecklistKey = keyof VideoChecklist;

/** Пункты чек-листа видео в порядке работы: видео = план + заголовок + превью + монтаж + выкладка */
export const CHECKLIST_ITEMS: { key: ChecklistKey; label: string; todo: string }[] = [
  { key: 'plan', label: 'Контент-план', todo: 'Составить контент-план' },
  { key: 'title', label: 'Заголовок', todo: 'Подобрать заголовок' },
  { key: 'thumbnail', label: 'Превью', todo: 'Сделать превью' },
  { key: 'edit', label: 'Монтаж', todo: 'Смонтировать видео' },
  { key: 'upload', label: 'Выкладка', todo: 'Выложить видео' },
];

export const VIDEO_STAGES: { id: VideoStage; label: string }[] = [
  { id: 'editing', label: 'Монтаж' },
  { id: 'review', label: 'Проверка' },
  { id: 'published', label: 'Опубликовано' },
];

export const CADENCES: { value: number; label: string }[] = [
  { value: 2, label: '2 в день' },
  { value: 1, label: '1 в день' },
  { value: 0.5, label: '1 раз в 2 дня' },
];

export type TodoStep = ChecklistKey | 'publish' | 'paused' | 'none';
export type Urgency = 'overdue' | 'today' | 'soon' | 'later' | 'none';

export interface ChannelTodo {
  step: TodoStep;
  /** Что делать сейчас, по-русски */
  label: string;
  /** Ближайший срок публикации; null, если канал не ведётся */
  dueDate: string | null;
  urgency: Urgency;
  /** Видео, с которым связан шаг */
  videoId?: string;
}

export interface Reminder {
  channelId: string;
  text: string;
}

export function cadenceLabel(cadencePerDay: number): string {
  const known = CADENCES.find((c) => c.value === cadencePerDay);
  if (known) return known.label;
  return cadencePerDay > 0 ? `${cadencePerDay} в день` : 'без графика';
}

// ─── Статус ──────────────────────────────────────────────────────────────────

/** Пауза с датой сама возвращается в «Веду» в день окончания */
export function effectiveStatus(channel: Channel, today: string): ChannelStatus {
  if (channel.status === 'paused' && channel.pausedUntil && channel.pausedUntil <= today) return 'active';
  return channel.status;
}

// ─── Видео ───────────────────────────────────────────────────────────────────

const EMPTY_CHECKLIST: VideoChecklist = { plan: false, title: false, thumbnail: false, edit: false, upload: false };

/** Старые этапы сводятся к трём: Сценарий/Озвучка → Монтаж, Запланировано → Проверка */
export function normalizeStage(stage: string | undefined): VideoStage {
  if (stage === 'review' || stage === 'scheduled') return 'review';
  if (stage === 'published') return 'published';
  return 'editing';
}

export function normalizeVideo(video: Video): Video {
  return {
    ...video,
    stage: normalizeStage(video.stage as string),
    checklist: { ...EMPTY_CHECKLIST, ...(video.checklist ?? {}) },
  };
}

export function canPublish(checklist: VideoChecklist | undefined): boolean {
  return !!checklist && CHECKLIST_ITEMS.every((i) => checklist[i.key] === true);
}

// ─── Расписание ──────────────────────────────────────────────────────────────

function parseUtc(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Целых дней от a до b (b позже — положительное) */
function diffDays(a: string, b: string): number {
  return Math.round((parseUtc(b) - parseUtc(a)) / 86_400_000);
}

function slotsPerDay(channel: Channel): number {
  return channel.cadencePerDay >= 1 ? Math.ceil(channel.cadencePerDay) : 1;
}

/** Шаг между публикациями в днях: 2 в день и 1 в день — 1, раз в 2 дня — 2 */
function intervalDays(channel: Channel): number {
  return channel.cadencePerDay >= 1 || channel.cadencePerDay <= 0 ? 1 : Math.max(1, Math.round(1 / channel.cadencePerDay));
}

/** За сколько дней начинать монтаж: долгий монтаж (больше 3 часов) — за 2 дня, иначе за 1 */
export function leadDays(channel: Channel): number {
  return (channel.editHoursMax ?? 0) > 3 ? 2 : 1;
}

function dayOf(stamp: string | undefined): string | null {
  return stamp ? stamp.slice(0, 10) : null;
}

/** Срок следующего видео без «подтягивания» к сегодня: если он раньше сегодня, видео просрочено */
function rawNextDue(channel: Channel, last: string | null, today: string, publishedToday: number): string {
  if (!last) return today;
  if (channel.cadencePerDay >= 1) {
    if (last === today) return publishedToday >= slotsPerDay(channel) ? addDays(today, 1) : today;
    return addDays(last, 1);
  }
  return addDays(last, intervalDays(channel));
}

/**
 * Ближайшие даты публикаций (по одной на день; для 2 в день — день с двумя видео).
 * Заброшенный и архивный канал — пусто; канал на паузе — с даты возвращения.
 * Если сегодня уже опубликовано, считаем, что все видео дня готовы.
 */
export function nextDueDates(channel: Channel, lastPublished: string | null, today: string, count = 7): string[] {
  const status = effectiveStatus(channel, today);
  if (status === 'abandoned' || status === 'archived') return [];
  const raw = rawNextDue(channel, lastPublished, today, slotsPerDay(channel));
  let start = raw < today ? today : raw;
  if (status === 'paused' && channel.pausedUntil && channel.pausedUntil > start) start = channel.pausedUntil;
  const step = intervalDays(channel);
  const dates: string[] = [];
  for (let i = 0; i < count; i++) dates.push(addDays(start, i * step));
  return dates;
}

/** Последняя публикация канала по видео (YYYY-MM-DD) или null */
export function lastPublishedOf(channelId: string, videos: Video[]): string | null {
  let last: string | null = null;
  for (const v of videos) {
    if (v.channelId !== channelId || normalizeStage(v.stage as string) !== 'published') continue;
    const day = dayOf(v.publishedAt);
    if (day && (!last || day > last)) last = day;
  }
  return last;
}

/** Дата последней публикации, записанная в карточке канала (extra.lastPublished), если видео в базе нет */
function cardLastPublished(channel: Channel): string | null {
  const v = channel.lastPublished;
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;
}

/** Последняя публикация канала: по видео или по дате из карточки — что позже */
export function lastPublishedDate(channel: Channel, videos: Video[]): string | null {
  const byVideos = lastPublishedOf(channel.id, videos);
  const byCard = cardLastPublished(channel);
  if (!byCard) return byVideos;
  return !byVideos || byCard > byVideos ? byCard : byVideos;
}

function publishedOn(channelId: string, videos: Video[], day: string): number {
  return videos.filter(
    (v) => v.channelId === channelId && normalizeStage(v.stage as string) === 'published' && dayOf(v.publishedAt) === day,
  ).length;
}

/** Первое видео канала в работе (не опубликованное), раньше срок — раньше очередь */
function videoInWork(channelId: string, videos: Video[]): Video | null {
  const queue = videos
    .filter((v) => v.channelId === channelId && normalizeStage(v.stage as string) !== 'published')
    .map(normalizeVideo);
  queue.sort((a, b) => (a.publishDate ?? '9999').localeCompare(b.publishDate ?? '9999'));
  return queue[0] ?? null;
}

function urgencyFor(channel: Channel, dueDate: string, today: string): Urgency {
  const days = diffDays(today, dueDate);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  return days <= leadDays(channel) ? 'soon' : 'later';
}

/** Что делать по каналу сейчас и к какому сроку */
export function channelTodo(channel: Channel, videos: Video[], today: string): ChannelTodo {
  const status = effectiveStatus(channel, today);
  if (status === 'paused') {
    return {
      step: 'paused',
      label: `Пауза до ${channel.pausedUntil ?? '—'}`,
      dueDate: channel.pausedUntil ?? null,
      urgency: 'none',
    };
  }
  if (status !== 'active') {
    return { step: 'none', label: status === 'abandoned' ? 'Канал заброшен' : 'Канал в архиве', dueDate: null, urgency: 'none' };
  }

  const last = lastPublishedDate(channel, videos);
  const current = videoInWork(channel.id, videos);
  // Дата из карточки «сегодня выложено» означает: видео дня готовы (сколько именно — неизвестно)
  const publishedToday = cardLastPublished(channel) === today ? slotsPerDay(channel) : publishedOn(channel.id, videos, today);
  const scheduled = rawNextDue(channel, last, today, publishedToday);
  const dueDate = current?.publishDate ?? scheduled;
  const urgency = urgencyFor(channel, dueDate, today);

  if (!current) {
    return { step: 'plan', label: 'Начать новое видео: контент-план', dueDate, urgency };
  }
  const next = CHECKLIST_ITEMS.find((i) => !current.checklist?.[i.key]);
  if (!next) {
    return { step: 'publish', label: 'Отметить видео опубликованным', dueDate, urgency, videoId: current.id };
  }
  return { step: next.key, label: next.todo, dueDate, urgency, videoId: current.id };
}

const URGENCY_ORDER: Record<Urgency, number> = { overdue: 0, today: 1, soon: 2, later: 3, none: 4 };
const EDIT_STEPS: TodoStep[] = ['plan', 'title', 'thumbnail', 'edit'];

function reminderText(channel: Channel, todo: ChannelTodo, today: string): string | null {
  const name = channel.name;
  if (todo.urgency === 'overdue') return `видео на ${name} просрочено — ${todo.label.toLowerCase()}`;
  if (todo.urgency === 'today') return `сегодня видео на ${name} — ${todo.label.toLowerCase()}`;
  if (todo.urgency !== 'soon' || !todo.dueDate || todo.step === 'publish') return null;
  const days = diffDays(today, todo.dueDate);
  if (!EDIT_STEPS.includes(todo.step)) return `${days === 1 ? 'завтра' : `через ${days} дня`} видео на ${name} — осталось выложить`;
  return days === 1
    ? `завтра видео на ${name} — запусти монтаж сегодня`
    : `через ${days} дня видео на ${name} — начни монтаж`;
}

/**
 * Напоминания о публикациях (для бота): сначала просроченные, потом сегодняшние, потом те,
 * где пора начинать монтаж. Не больше limit (по умолчанию 3 в день).
 */
export function remindersFor(channels: Channel[], videos: Video[], today: string, limit = 3): Reminder[] {
  const items: { channelId: string; text: string; urgency: Urgency; dueDate: string }[] = [];
  for (const channel of channels) {
    const todo = channelTodo(channel, videos, today);
    if (!todo.dueDate) continue;
    const text = reminderText(channel, todo, today);
    if (text) items.push({ channelId: channel.id, text, urgency: todo.urgency, dueDate: todo.dueDate });
  }
  items.sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency] || a.dueDate.localeCompare(b.dueDate));
  return items.slice(0, Math.max(0, limit)).map(({ channelId, text }) => ({ channelId, text }));
}
