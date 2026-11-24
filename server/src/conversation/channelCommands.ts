// Команды для раздела «Каналы» в любое время (не только в вечернем разговоре).
// Текст или расшифровка голосового → Claude разбирает в список действий → бот показывает,
// что поменяет, и ждёт кнопку «Сделать». Подтверждение нужно: Whisper иногда ошибается.
// Ожидающая команда лежит в kv `channel_cmd:pending`, кнопки — `cc:yes:<id>` / `cc:no:<id>`.
import type { Channel, Video, VideoStage } from '../../../shared/types';
import { todayStr } from '../../../shared/time';
import { applyGame } from './game';
import type { ConversationStore } from './store';
import type { Keyboard } from './types';

// Этапы как на сайте (src/components/legacyMedia.ts): точный этап — в legacyStage, для бота — три
export type CmdStage = 'editing' | 'cover' | 'review' | 'published';
const STAGE_LABEL: Record<CmdStage, string> = { editing: 'Монтаж', cover: 'Обложка и заголовок', review: 'Проверка', published: 'Выкладка' };
const TO_CLOUD: Record<CmdStage, VideoStage> = { editing: 'editing', cover: 'editing', review: 'review', published: 'published' };
const isStage = (v: unknown): v is CmdStage => typeof v === 'string' && v in STAGE_LABEL;

export type ChannelAction =
  | { type: 'add_video'; channelId: string; title: string; stage: CmdStage; publishDate?: string }
  | { type: 'move_video'; videoId: string; stage: CmdStage }
  | { type: 'rename_video'; videoId: string; title: string }
  | { type: 'set_publish_date'; videoId: string; publishDate: string }
  | { type: 'add_channel'; name: string; description?: string };

export interface PendingCommand {
  id: string;
  createdAt: string;
  actions: ChannelAction[];
}

export const PENDING_KEY = 'channel_cmd:pending';
/** Неподтверждённая команда живёт час */
const PENDING_TTL_MS = 60 * 60_000;

export const CMD_TEXT = {
  thinking: 'Разбираю, что поменять в «Каналах»…',
  confirm: (lines: string[]) => `Сделать в «Каналах»:\n${lines.map((l) => `• ${l}`).join('\n')}`,
  done: (lines: string[]) => `Готово:\n${lines.map((l) => `• ${l}`).join('\n')}`,
  cancelled: 'Отменил, ничего не менял.',
  expired: 'Эта команда уже устарела. Скажи или напиши её ещё раз.',
  notUnderstood:
    'Не понял, что поменять в «Каналах». Скажи, например: «добавь видео „Танки США“ на канал TRIHGOK в монтаж» или «видео про Иран перенеси в проверку». Вечерний разговор — в 21:00 или по слову «вечер».',
  aiDown: 'Claude сейчас недоступен, не смог разобрать. Попробуй позже или поменяй на сайте.',
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Задание для Claude: только JSON со списком действий по реальным id каналов и видео */
export function buildChannelPrompt(text: string, channels: Channel[], videos: Video[], today: string): string {
  const chs = channels.map((c) => ({ id: c.id, name: c.name, ...(typeof c.handle === 'string' ? { handle: c.handle } : {}) }));
  const vids = videos.map((v) => ({
    id: v.id,
    channelId: v.channelId,
    title: v.title,
    stage: isStage(v.legacyStage) ? v.legacyStage : v.stage,
    ...(v.publishDate ? { publishDate: v.publishDate } : {}),
  }));
  return [
    'Ты разбираешь команду владельца QuestFlow для раздела «Каналы» (YouTube-каналы и канбан видео).',
    'Команда пришла текстом или расшифровкой голосового (в названиях возможны ошибки распознавания — ищи самое похожее).',
    `Сегодня ${today}. Этапы видео: editing = Монтаж, cover = Обложка и заголовок, review = Проверка, published = Выкладка (выложено).`,
    'Действия:',
    '- {"type":"add_video","channelId":"<id канала>","title":"<название>","stage":"<этап, по умолчанию editing>","publishDate":"YYYY-MM-DD или нет поля"}',
    '- {"type":"move_video","videoId":"<id видео>","stage":"<этап>"} — перенести видео; «выложил/опубликовал» = published',
    '- {"type":"rename_video","videoId":"<id>","title":"<новое название>"}',
    '- {"type":"set_publish_date","videoId":"<id>","publishDate":"YYYY-MM-DD"}',
    '- {"type":"add_channel","name":"<название>","description":"<о чём канал или нет поля>"}',
    'Используй только id из данных ниже. Если канал или видео не найти уверенно — не выдумывай действие.',
    'Если команда не про каналы и видео — верни пустой список.',
    'Ответь ТОЛЬКО JSON без пояснений: {"actions": [...]}',
    '',
    `КАНАЛЫ: ${JSON.stringify(chs)}`,
    `ВИДЕО: ${JSON.stringify(vids)}`,
    '',
    `КОМАНДА: «${text}»`,
  ].join('\n');
}

function extractJson(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const v = JSON.parse(body.slice(start, end + 1));
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Ответ Claude → проверенные действия (только существующие каналы/видео, известные этапы) */
export function parseChannelActions(text: string, channels: Channel[], videos: Video[]): ChannelAction[] {
  const j = extractJson(text);
  if (!j || !Array.isArray(j.actions)) return [];
  const chIds = new Set(channels.map((c) => c.id));
  const vIds = new Set(videos.map((v) => v.id));
  const out: ChannelAction[] = [];
  for (const raw of j.actions as Record<string, unknown>[]) {
    if (!raw || typeof raw !== 'object') continue;
    const type = raw.type;
    if (type === 'add_video') {
      const channelId = str(raw.channelId);
      const title = str(raw.title);
      if (!chIds.has(channelId) || !title) continue;
      const date = str(raw.publishDate);
      out.push({ type, channelId, title, stage: isStage(raw.stage) ? raw.stage : 'editing', ...(DATE_RE.test(date) ? { publishDate: date } : {}) });
    } else if (type === 'move_video') {
      const videoId = str(raw.videoId);
      if (vIds.has(videoId) && isStage(raw.stage)) out.push({ type, videoId, stage: raw.stage });
    } else if (type === 'rename_video') {
      const videoId = str(raw.videoId);
      const title = str(raw.title);
      if (vIds.has(videoId) && title) out.push({ type, videoId, title });
    } else if (type === 'set_publish_date') {
      const videoId = str(raw.videoId);
      const publishDate = str(raw.publishDate);
      if (vIds.has(videoId) && DATE_RE.test(publishDate)) out.push({ type, videoId, publishDate });
    } else if (type === 'add_channel') {
      const name = str(raw.name);
      const description = str(raw.description);
      if (name && !channels.some((c) => c.name.trim().toLowerCase() === name.toLowerCase())) out.push({ type, name, ...(description ? { description } : {}) });
    }
  }
  return out;
}

const dmy = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;

/** Человеческое описание действий (для подтверждения и итога) */
export function describeActions(actions: ChannelAction[], channels: Channel[], videos: Video[]): string[] {
  const chName = (id: string) => channels.find((c) => c.id === id)?.name ?? '?';
  const video = (id: string) => videos.find((v) => v.id === id);
  return actions.map((a) => {
    switch (a.type) {
      case 'add_video':
        return `новое видео «${a.title}» на ${chName(a.channelId)} → ${STAGE_LABEL[a.stage]}${a.publishDate ? `, выход ${dmy(a.publishDate)}` : ''}`;
      case 'move_video': {
        const v = video(a.videoId);
        return `«${v?.title ?? '?'}» (${chName(v?.channelId ?? '')}) → ${STAGE_LABEL[a.stage]}`;
      }
      case 'rename_video':
        return `«${video(a.videoId)?.title ?? '?'}» → новое название «${a.title}»`;
      case 'set_publish_date':
        return `«${video(a.videoId)?.title ?? '?'}» → дата выхода ${dmy(a.publishDate)}`;
      case 'add_channel':
        return `новый канал «${a.name}»${a.description ? ` (${a.description})` : ''}`;
    }
  });
}

/** Видео с новым этапом: чек-лист и дата выкладки — как на сайте (videoToCloud) */
function withStage(v: Video, stage: CmdStage, today: string): Video {
  const cloud = TO_CLOUD[stage];
  const checklist = { plan: false, title: false, thumbnail: false, edit: false, upload: false, ...(v.checklist ?? {}) };
  if (stage !== 'editing') checklist.edit = true;
  if (cloud !== 'editing') {
    checklist.title = true;
    checklist.thumbnail = true;
  }
  if (cloud === 'published') checklist.upload = true;
  const out: Video = { ...v, stage: cloud, legacyStage: stage, isUploaded: cloud === 'published', checklist };
  if (cloud === 'published') out.publishedAt = v.publishedAt ?? today;
  else delete out.publishedAt;
  return out;
}

/** Выполнить действия; награда за выкладку — один раз на видео, как на сайте */
export async function applyChannelActions(store: ConversationStore, actions: ChannelAction[], now: Date): Promise<void> {
  const today = todayStr(now);
  let n = 0;
  for (const a of actions) {
    n += 1;
    if (a.type === 'add_channel') {
      await store.saveChannel({ id: `ch-${now.getTime()}-${n}`, name: a.name, status: 'active', cadencePerDay: 1, ...(a.description ? { niche: a.description } : {}) });
      continue;
    }
    if (a.type === 'add_video') {
      const base: Video = { id: `vid-${now.getTime()}-${n}`, channelId: a.channelId, title: a.title, stage: 'editing', ...(a.publishDate ? { publishDate: a.publishDate } : {}) };
      const v = withStage(base, a.stage, today);
      await store.saveVideo(v);
      if (v.stage === 'published') await applyGame(store, { kind: 'video_published', ref: v.id }, now);
      continue;
    }
    const v = (await store.listVideos()).find((x) => x.id === a.videoId);
    if (!v) continue;
    if (a.type === 'rename_video') await store.saveVideo({ ...v, title: a.title });
    else if (a.type === 'set_publish_date') await store.saveVideo({ ...v, publishDate: a.publishDate });
    else {
      const next = withStage(v, a.stage, today);
      await store.saveVideo(next);
      if (next.stage === 'published' && v.stage !== 'published') await applyGame(store, { kind: 'video_published', ref: v.id }, now);
    }
  }
}

export interface CommandDeps {
  store: ConversationStore;
  send(text: string, keyboard?: Keyboard): Promise<boolean>;
  /** Claude: задание → текст ответа; null — недоступен */
  complete?(prompt: string): Promise<string | null>;
  log?(message: string): void;
}

/** Разобрать команду и спросить подтверждение. false — это не команда для «Каналов» (или Claude нет). */
export async function proposeChannelCommand(deps: CommandDeps, text: string, now: Date): Promise<boolean> {
  if (!deps.complete) return false;
  await deps.send(CMD_TEXT.thinking);
  const [channels, videos] = await Promise.all([deps.store.listChannels(), deps.store.listVideos()]);
  const answer = await deps.complete(buildChannelPrompt(text, channels, videos, todayStr(now))).catch(() => null);
  if (answer === null) {
    await deps.send(CMD_TEXT.aiDown);
    return true;
  }
  const actions = parseChannelActions(answer, channels, videos);
  if (!actions.length) {
    await deps.send(CMD_TEXT.notUnderstood);
    return true;
  }
  const pending: PendingCommand = { id: now.getTime().toString(36), createdAt: now.toISOString(), actions };
  await deps.store.setKv(PENDING_KEY, pending);
  await deps.send(CMD_TEXT.confirm(describeActions(actions, channels, videos)), [
    [
      { text: '✅ Сделать', data: `cc:yes:${pending.id}` },
      { text: 'Отмена', data: `cc:no:${pending.id}` },
    ],
  ]);
  return true;
}

/** Кнопка «Сделать» / «Отмена» под командой */
export async function confirmChannelCommand(deps: CommandDeps, data: string, now: Date): Promise<void> {
  const m = data.match(/^cc:(yes|no):(.+)$/);
  if (!m) return;
  const pending = await deps.store.getKv<PendingCommand>(PENDING_KEY);
  const fresh = pending && pending.id === m[2] && now.getTime() - Date.parse(pending.createdAt) <= PENDING_TTL_MS;
  if (!fresh) {
    await deps.send(CMD_TEXT.expired);
    return;
  }
  await deps.store.setKv(PENDING_KEY, null);
  if (m[1] === 'no') {
    await deps.send(CMD_TEXT.cancelled);
    return;
  }
  const [channels, videos] = await Promise.all([deps.store.listChannels(), deps.store.listVideos()]);
  const lines = describeActions(pending.actions, channels, videos);
  await applyChannelActions(deps.store, pending.actions, now);
  deps.log?.(`Каналы: команда выполнена (${pending.actions.length} действ.)`);
  await deps.send(CMD_TEXT.done(lines));
}
