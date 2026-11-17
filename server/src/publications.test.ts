import { describe, expect, it } from 'vitest';
import { createPublicationSource } from './publications';
import type { Db } from './db';

const db = { listChannels: async () => [{ id: 'c1' }], listVideos: async () => [] } as unknown as Db;

describe('напоминания о публикациях из shared/channels.remindersFor', () => {
  it('передаёт лимит 3 и приводит элементы к { channelId, text }', async () => {
    let gotLimit: number | undefined;
    const source = createPublicationSource(
      db,
      (_c, _v, _t, limit) => {
        gotLimit = limit;
        return [{ channel: { id: 'c1' }, text: 'Завтра видео на AKKDLASA — запусти монтаж сегодня.' }, { bad: 1 }];
      },
      () => {},
    );
    expect(await source('2026-11-17')).toEqual([{ channelId: 'c1', text: 'Завтра видео на AKKDLASA — запусти монтаж сегодня.' }]);
    expect(gotLimit).toBe(3);
  });

  it('правила ещё нет — пустой список и одно предупреждение в лог', async () => {
    const logs: string[] = [];
    const source = createPublicationSource(db, null, (m) => logs.push(m));
    expect(await source('2026-11-17')).toEqual([]);
    expect(await source('2026-11-18')).toEqual([]);
    expect(logs).toHaveLength(1);
  });
});
