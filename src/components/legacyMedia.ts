import type { Channel as CloudChannel, Video as CloudVideo, VideoStage } from '@shared/types';
import { normalizeVideo } from '@shared/channels';

// Старая «Медиа-Студия» (6 этапов, поля автора/оплаты/сценария) поверх облачных таблиц channels2/videos2.
// Лишние поля лежат в extra, этап для бота и расписания сводится к трём.

export type ProductionStage = 'scripting' | 'voiceover' | 'editing' | 'review' | 'scheduled' | 'published';

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
}

export interface Channel {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  color: string;
  description?: string;
}

const STAGES: ProductionStage[] = ['scripting', 'voiceover', 'editing', 'review', 'scheduled', 'published'];

const TO_CLOUD: Record<ProductionStage, VideoStage> = {
  scripting: 'editing',
  voiceover: 'editing',
  editing: 'editing',
  review: 'review',
  scheduled: 'review',
  published: 'published',
};

function isStage(v: unknown): v is ProductionStage {
  return typeof v === 'string' && (STAGES as string[]).includes(v);
}

export function videoFromCloud(raw: CloudVideo): VideoItem {
  const v = normalizeVideo(raw);
  const legacy = isStage(v.legacyStage) && TO_CLOUD[v.legacyStage] === v.stage ? v.legacyStage : null;
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
  if (stage !== 'editing') checklist.edit = true;
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
  };
}

export function channelToCloud(item: Channel, prev: CloudChannel | undefined): CloudChannel {
  const { description, ...rest } = item;
  return {
    status: 'active',
    cadencePerDay: 1,
    ...(prev ?? {}),
    ...rest,
    niche: description || undefined,
  };
}
