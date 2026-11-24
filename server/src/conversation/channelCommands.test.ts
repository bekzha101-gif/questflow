import { describe, expect, it } from 'vitest';
import type { Channel, Video } from '../../../shared/types';
import { createMemoryStore, emptyData } from './testing';
import { CMD_TEXT, PENDING_KEY, confirmChannelCommand, parseChannelActions, proposeChannelCommand, type CommandDeps } from './channelCommands';
import type { Keyboard } from './types';

const now = new Date('2026-11-23T14:00:00+06:00');
const channels: Channel[] = [
  { id: 'c1', name: 'TRIHGOK', status: 'active', cadencePerDay: 1 },
  { id: 'c2', name: 'WOLUER', status: 'active', cadencePerDay: 1 },
];
const videos: Video[] = [{ id: 'v1', channelId: 'c1', title: 'Танки США', stage: 'editing', legacyStage: 'editing' }];

function setup(answer: string | null) {
  const data = emptyData({ channels: structuredClone(channels), videos: structuredClone(videos) });
  const sent: { text: string; keyboard?: Keyboard }[] = [];
  const deps: CommandDeps = {
    store: createMemoryStore(data),
    send: async (text, keyboard) => {
      sent.push({ text, keyboard });
      return true;
    },
    complete: async () => answer,
  };
  return { data, sent, deps };
}

describe('parseChannelActions', () => {
  it('оставляет только действия с настоящими id и этапами', () => {
    const out = parseChannelActions(
      '```json\n{"actions":[{"type":"move_video","videoId":"v1","stage":"review"},{"type":"move_video","videoId":"nope","stage":"review"},{"type":"add_video","channelId":"c2","title":"Иран","stage":"x"},{"type":"add_channel","name":"trihgok"}]}\n```',
      channels,
      videos,
    );
    expect(out).toEqual([
      { type: 'move_video', videoId: 'v1', stage: 'review' },
      { type: 'add_video', channelId: 'c2', title: 'Иран', stage: 'editing' },
    ]);
  });

  it('мусор → пусто', () => {
    expect(parseChannelActions('не знаю', channels, videos)).toEqual([]);
  });
});

describe('команда каналов', () => {
  it('спрашивает подтверждение и выполняет по кнопке', async () => {
    const w = setup('{"actions":[{"type":"move_video","videoId":"v1","stage":"published"},{"type":"add_video","channelId":"c2","title":"Иран","stage":"cover"}]}');
    expect(await proposeChannelCommand(w.deps, 'танки выложил, на WOLUER добавь Иран в обложку', now)).toBe(true);
    const ask = w.sent.at(-1)!;
    expect(ask.text).toContain('«Танки США» (TRIHGOK) → Выкладка');
    expect(ask.text).toContain('новое видео «Иран» на WOLUER → Обложка и заголовок');
    expect(w.data.videos.find((v) => v.id === 'v1')!.stage).toBe('editing'); // до кнопки ничего не меняется

    await confirmChannelCommand(w.deps, ask.keyboard![0][0].data, now);
    const v1 = w.data.videos.find((v) => v.id === 'v1')!;
    expect(v1).toMatchObject({ stage: 'published', legacyStage: 'published', isUploaded: true, publishedAt: '2026-11-23' });
    const added = w.data.videos.find((v) => v.title === 'Иран')!;
    expect(added).toMatchObject({ channelId: 'c2', stage: 'editing', legacyStage: 'cover' });
    expect(w.data.events.filter((e) => e.kind === 'video_published')).toHaveLength(1);
    expect(w.sent.at(-1)!.text).toMatch(/^Готово/);
    expect(w.data.kv[PENDING_KEY]).toBeNull();
  });

  it('отмена ничего не меняет, повторная кнопка — устарела', async () => {
    const w = setup('{"actions":[{"type":"rename_video","videoId":"v1","title":"Абрамс"}]}');
    await proposeChannelCommand(w.deps, 'переименуй танки в Абрамс', now);
    const [yes, no] = w.sent.at(-1)!.keyboard![0];
    await confirmChannelCommand(w.deps, no.data, now);
    expect(w.sent.at(-1)!.text).toBe(CMD_TEXT.cancelled);
    await confirmChannelCommand(w.deps, yes.data, now);
    expect(w.sent.at(-1)!.text).toBe(CMD_TEXT.expired);
    expect(w.data.videos[0].title).toBe('Танки США');
  });

  it('не про каналы — подсказка; Claude недоступен — честно говорит', async () => {
    const a = setup('{"actions":[]}');
    await proposeChannelCommand(a.deps, 'привет', now);
    expect(a.sent.at(-1)!.text).toBe(CMD_TEXT.notUnderstood);
    const b = setup(null);
    await proposeChannelCommand(b.deps, 'добавь видео', now);
    expect(b.sent.at(-1)!.text).toBe(CMD_TEXT.aiDown);
  });

  it('без Claude — не команда', async () => {
    const w = setup('{}');
    expect(await proposeChannelCommand({ ...w.deps, complete: undefined }, 'x', now)).toBe(false);
    expect(w.sent).toHaveLength(0);
  });
});
