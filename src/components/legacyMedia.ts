import type { Channel as CloudChannel, ChannelStatus, Video as CloudVideo, VideoStage } from '@shared/types';
import { isChannelStatus, normalizeVideo } from '@shared/channels';

// Старая «Медиа-Студия» (6 этапов, поля автора/оплаты/сценария) поверх облачных таблиц channels2/videos2.
// Лишние поля лежат в extra, этап для бота и расписания сводится к трём.

// Этапы: Монтаж → Обложка и заголовок → Проверка → Выкладка
export type ProductionStage = 'editing' | 'cover' | 'review' | 'published';

export const PRODUCTION_STAGES: { id: ProductionStage; label: string }[] = [
  { id: 'editing', label: 'Монтаж' },
  { id: 'cover', label: 'Обложка и заголовок' },
  { id: 'review', label: 'Проверка' },
  { id: 'published', label: 'Выкладка' },
];

export interface VideoItem {
  id: string;
  title: string;
  channelId: string;
  stage: ProductionStage;
  isUploaded: boolean;
  assignedMemberName?: string;
  assignedMemberRole?: string;
  publishDate?: string;
  publishTime?: string;
  pricePerVideo?: number;
  scriptSnippet?: string;
  referenceUrl?: string;
  aspectRatio?: '9:16' | '16:9';
  expReward: number;
  goldReward: number;
  /** «Срочно» — ставит владелец голосом через Claude или на сайте */
  urgent?: boolean;
}

export interface Channel {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  color: string;
  description?: string;
  tags: string[];
  /** Веду / Запущу / Пауза / Забросил */
  status: ChannelStatus;
}

const TO_CLOUD: Record<ProductionStage, VideoStage> = {
  editing: 'editing',
  cover: 'editing',
  review: 'review',
  published: 'published',
};

// Убранные этапы: Сценарий и Озвучка — это Монтаж, Запланировано — Проверка
const OLD_STAGE: Record<string, ProductionStage> = {
  scripting: 'editing',
  voiceover: 'editing',
  scheduled: 'review',
};

function toStage(v: unknown): ProductionStage | null {
  if (typeof v !== 'string') return null;
  if (v in TO_CLOUD) return v as ProductionStage;
  return OLD_STAGE[v] ?? null;
}

export function videoFromCloud(raw: CloudVideo): VideoItem {
  const v = normalizeVideo(raw);
  const legacyStage = toStage(v.legacyStage);
  const legacy = legacyStage && TO_CLOUD[legacyStage] === v.stage ? legacyStage : null;
  const stage: ProductionStage = legacy ?? v.stage;
  const str = (k: string) => (typeof v[k] === 'string' ? (v[k] as string) : undefined);
  const num = (k: string, d?: number) => (typeof v[k] === 'number' ? (v[k] as number) : d);
  return {
    id: v.id,
    title: v.title,
    channelId: v.channelId,
    stage,
    isUploaded: typeof v.isUploaded === 'boolean' ? v.isUploaded : v.stage === 'published',
    assignedMemberName: str('assignedMemberName'),
    assignedMemberRole: str('assignedMemberRole'),
    publishDate: v.publishDate,
    publishTime: str('publishTime'),
    pricePerVideo: num('pricePerVideo'),
    scriptSnippet: str('scriptSnippet'),
    referenceUrl: str('referenceUrl'),
    aspectRatio: v.aspectRatio === '16:9' ? '16:9' : '9:16',
    expReward: num('expReward', 75)!,
    goldReward: num('goldReward', 50)!,
    ...(v.urgent === true && v.stage !== 'published' ? { urgent: true } : {}),
  };
}

/** prev — запись в облаке (чтобы не потерять чек-лист и дату публикации) */
export function videoToCloud(item: VideoItem, prev: CloudVideo | undefined, today: string): CloudVideo {
  const stage: VideoStage = item.isUploaded ? 'published' : TO_CLOUD[item.stage];
  const base = prev ? normalizeVideo(prev) : undefined;
  const checklist = {
    plan: false,
    title: false,
    thumbnail: false,
    edit: false,
    upload: false,
    ...(base?.checklist ?? {}),
  };
  if (item.stage !== 'editing') checklist.edit = true;
  if (stage !== 'editing') {
    checklist.title = true;
    checklist.thumbnail = true;
  }
  if (stage === 'published') checklist.upload = true;
  const { stage: legacyStage, ...rest } = item;
  const out: CloudVideo = {
    ...(base ?? {}),
    ...rest,
    stage,
    legacyStage,
    checklist,
  };
  if (stage === 'published') out.publishedAt = base?.publishedAt ?? today;
  else delete out.publishedAt;
  if (!item.urgent || stage === 'published') delete out.urgent;
  return out;
}

export function channelFromCloud(c: CloudChannel): Channel {
  const avatar = typeof c.avatar === 'string' && c.avatar.trim() ? c.avatar : c.name.trim().charAt(0).toUpperCase() || '🎬';
  return {
    id: c.id,
    name: c.name,
    handle: typeof c.handle === 'string' ? c.handle : '@',
    avatar,
    color: c.color ?? '#71717a',
    description: c.niche,
    tags: Array.isArray(c.tags) ? c.tags.filter((t): t is string => typeof t === 'string') : [],
    status: isChannelStatus(c.status) ? c.status : 'active',
  };
}

export function channelToCloud(item: Channel, prev: CloudChannel | undefined): CloudChannel {
  const { description, ...rest } = item;
  return {
    cadencePerDay: 1,
    ...(prev ?? {}),
    ...rest,
    niche: description || undefined,
  };
}

// ─── Цвета, теги и выбор каналов ─────────────────────────────────────────────

export const CHANNEL_COLORS = ['#71717a', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

/** «шортсы, военка,  #США» → ['шортсы', 'военка', 'США'] без повторов */
export function parseTags(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/[,;\n]/)) {
    const tag = raw.trim().replace(/^#+/, '').trim();
    if (tag && !out.some((t) => t.toLowerCase() === tag.toLowerCase())) out.push(tag);
  }
  return out;
}

export function allTags(channels: Channel[]): string[] {
  return parseTags(channels.flatMap((c) => c.tags).join(','));
}

/**
 * Выбор в меню: 'all', id канала или 'tag:<тег>'.
 * Возвращает id каналов в выборе; null — все каналы (и когда тег или канал пропал).
 */
export function channelScope(channels: Channel[], selected: string): string[] | null {
  if (selected.startsWith('tag:')) {
    const tag = selected.slice(4).toLowerCase();
    const ids = channels.filter((c) => c.tags.some((t) => t.toLowerCase() === tag)).map((c) => c.id);
    // Тега больше нет ни у одного канала — показываем все
    return ids.length ? ids : null;
  }
  if (selected !== 'all' && channels.some((c) => c.id === selected)) return [selected];
  return null;
}

/** Порядок каналов в списке: веду → запущу → пауза → забросил → архив */
const STATUS_ORDER: Record<ChannelStatus, number> = { active: 0, planned: 1, paused: 2, abandoned: 3, archived: 4 };

export function sortChannelsByStatus<T extends { status: ChannelStatus }>(list: T[]): T[] {
  return list
    .map((c, i) => ({ c, i }))
    .sort((a, b) => STATUS_ORDER[a.c.status] - STATUS_ORDER[b.c.status] || a.i - b.i)
    .map((x) => x.c);
}

/** Срочные видео — первыми, остальной порядок не меняется */
export function urgentFirst<T extends { urgent?: boolean }>(list: T[]): T[] {
  return [...list.filter((v) => v.urgent), ...list.filter((v) => !v.urgent)];
}
