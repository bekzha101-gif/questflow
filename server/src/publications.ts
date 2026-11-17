// Напоминания о публикациях: берёт правило remindersFor из shared/channels.ts (таск 06)
// и данные каналов/видео из Supabase. Пока shared/channels.ts нет — напоминаний нет.
import type { Db } from './db';
import type { PublicationReminder } from './scheduler';
import { MAX_PUBLICATION_REMINDERS } from './scheduler';

type RemindersFor = (channels: unknown[], videos: unknown[], today: string, limit?: number) => unknown[];

/** Загружает shared/channels в рантайме: модуль появляется в волне 3 */
export function loadRemindersFor(): RemindersFor | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../shared/channels') as { remindersFor?: RemindersFor };
    return typeof mod.remindersFor === 'function' ? mod.remindersFor : null;
  } catch {
    return null;
  }
}

/** Приводит элемент remindersFor к { channelId, text } */
export function toReminder(item: unknown, i: number): PublicationReminder | null {
  if (typeof item === 'string') return { channelId: `r${i}`, text: item };
  if (!item || typeof item !== 'object') return null;
  const o = item as Record<string, unknown>;
  const text = [o.text, o.message, o.title].find((v) => typeof v === 'string') as string | undefined;
  if (!text) return null;
  const channel = o.channel as Record<string, unknown> | undefined;
  const channelId = String(o.channelId ?? channel?.id ?? `r${i}`);
  return { channelId, text };
}

export function createPublicationSource(db: Db, rule: RemindersFor | null, log: (m: string) => void) {
  let warned = false;
  return async (today: string): Promise<PublicationReminder[]> => {
    if (!rule) {
      if (!warned) log('shared/channels.remindersFor ещё нет — напоминания о публикациях выключены');
      warned = true;
      return [];
    }
    const [channels, videos] = await Promise.all([db.listChannels(), db.listVideos()]);
    return rule(channels, videos, today, MAX_PUBLICATION_REMINDERS)
      .map(toReminder)
      .filter((r): r is PublicationReminder => r !== null);
  };
}
