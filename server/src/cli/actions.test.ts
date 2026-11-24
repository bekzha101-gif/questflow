import { describe, expect, it } from 'vitest';
import { applyActions, describeActions, validateActions, type Ctx } from './actions';
import { remindersOf } from './qf';
import { createMemoryStore, emptyData } from '../conversation/testing';
import type { Channel, Task, Video } from '../../../shared/types';

const NOW = new Date('2026-11-24T10:00:00Z'); // 16:00 по Бишкеку

const ch = (id: string, over: Partial<Channel> = {}): Channel => ({ id, name: id.toUpperCase(), status: 'active', cadencePerDay: 1, color: '#ef4444', ...over });
const vid = (id: string, channelId: string, over: Partial<Video> = {}): Video => ({ id, channelId, title: `Видео ${id}`, stage: 'editing', ...over });

function setup() {
  const data = emptyData({
    channels: [ch('woluer'), ch('greatonn')],
    videos: [vid('v1', 'woluer'), vid('v2', 'greatonn', { stage: 'review', legacyStage: 'review' })],
    goals: [{ id: 'g1', month: '2026-11', title: '30 видео', kind: 'numeric', target: 30, current: 5, status: 'active' }],
    tasks: [
      { id: 'h1', title: 'Медитация', type: 'habit' } as Task,
      { id: 't1', title: 'Сделать план', type: 'todo' } as Task,
    ],
  });
  const store = createMemoryStore(data);
  const ctx: Ctx = { channels: data.channels, videos: data.videos, tasks: data.tasks, goalIds: ['g1'], goalTitles: { g1: '30 видео' } };
  return { data, store, ctx };
}

describe('qf apply: проверка действий', () => {
  it('отбрасывает всё при неизвестном id и понятно пишет ошибку', () => {
    const { ctx } = setup();
    const r = validateActions([{ type: 'move_video', videoId: 'nope', stage: 'review' }, { type: 'fly' }], ctx);
    expect(r.errors).toEqual(['#1 move_video: нет видео nope', '#2 fly: неизвестное действие']);
  });

  it('принимает {"actions": [...]} и проверяет даты и цвета', () => {
    const { ctx } = setup();
    const r = validateActions(
      {
        actions: [
          { type: 'set_publish_date', videoId: 'v1', publishDate: '28.11' },
          { type: 'update_channel', channelId: 'woluer', color: 'red' },
        ],
      },
      ctx,
    );
    expect(r.errors).toHaveLength(2);
  });

  it('описывает действия по-русски', () => {
    const { ctx } = setup();
    const { actions } = validateActions(
      [
        { type: 'update_channel', channelId: 'greatonn', status: 'abandoned' },
        { type: 'add_video', channelId: 'woluer', title: 'USA vs China', publishDate: '2026-11-28', urgent: true },
        { type: 'update_goal', goalId: 'g1', add: 2 },
      ],
      ctx,
    );
    expect(describeActions(actions, ctx)).toEqual([
      'канал GREATONN: статус Забросил',
      'новое видео «USA vs China» на WOLUER → Монтаж, выход 28.11, СРОЧНО',
      'цель «30 видео»: +2',
    ]);
  });
});

describe('qf apply: запись', () => {
  it('смена статуса ставит цвет статуса, пауза без даты снимается', async () => {
    const { data, store, ctx } = setup();
    data.channels[1].pausedUntil = '2026-12-01';
    const { actions } = validateActions([{ type: 'update_channel', channelId: 'greatonn', status: 'abandoned', transformer: 'homediscover' }], ctx);
    await applyActions(store, actions, NOW);
    const c = data.channels.find((x) => x.id === 'greatonn')!;
    expect(c.status).toBe('abandoned');
    expect(c.color).toBe('#71717a');
    expect(c.pausedUntil).toBeUndefined();
    expect(c.transformer).toBe('homediscover');
  });

  it('выкладка: чек-лист, дата публикации, срочность снята, награда один раз', async () => {
    const { data, store, ctx } = setup();
    data.videos[0].urgent = true;
    const { actions } = validateActions([{ type: 'move_video', videoId: 'v1', stage: 'published' }], ctx);
    await applyActions(store, actions, NOW);
    await applyActions(store, actions, NOW);
    const v = data.videos[0];
    expect(v.stage).toBe('published');
    expect(v.legacyStage).toBe('published');
    expect(v.publishedAt).toBe('2026-11-24');
    expect(v.urgent).toBeUndefined();
    expect(v.checklist).toEqual({ plan: false, title: true, thumbnail: true, edit: true, upload: true });
    expect(data.events.filter((e) => e.kind === 'video_published')).toHaveLength(1);
  });

  it('обложка: в облаке этап editing, точный этап в legacyStage', async () => {
    const { data, store, ctx } = setup();
    const { actions } = validateActions([{ type: 'move_video', videoId: 'v1', stage: 'cover' }], ctx);
    await applyActions(store, actions, NOW);
    expect(data.videos[0]).toMatchObject({ stage: 'editing', legacyStage: 'cover', checklist: { edit: true, title: false } });
  });

  it('удаление видео и канала', async () => {
    const { data, store, ctx } = setup();
    const { actions } = validateActions([{ type: 'delete_video', videoId: 'v2' }, { type: 'delete_channel', channelId: 'greatonn' }], ctx);
    await applyActions(store, actions, NOW);
    expect(data.videos.map((v) => v.id)).toEqual(['v1']);
    expect(data.channels.map((c) => c.id)).toEqual(['woluer']);
  });

  it('вечер: день, привычки, цель, план на завтра, итог', async () => {
    const { data, store, ctx } = setup();
    const { actions, errors } = validateActions(
      [
        { type: 'patch_day', date: '2026-11-24', patch: { sleepMin: 450, score: 7, why: 'выспался' } },
        { type: 'mark_habits', date: '2026-11-24', taskIds: ['h1'] },
        { type: 'update_goal', goalId: 'g1', add: 2 },
        { type: 'set_plan', date: '2026-11-25', mainTask: 'Монтаж WOLUER' },
        { type: 'add_goal_step', goalId: 'g1', weekIndex: 3, title: '7 видео за неделю' },
        { type: 'finish_report', date: '2026-11-24' },
      ],
      ctx,
    );
    expect(errors).toEqual([]);
    await applyActions(store, actions, NOW);
    expect(data.days['2026-11-24']).toMatchObject({ sleepMin: 450, score: 7, habitsDone: 1, habitsTotal: 1, reportStatus: 'done' });
    expect(data.goals[0].current).toBe(7);
    expect(data.kv['plan:2026-11-25']).toMatchObject({ mainTask: 'Монтаж WOLUER' });
    expect(data.steps).toHaveLength(1);
    expect(data.events.some((e) => e.kind === 'bigdata_fill')).toBe(true);
  });
});

describe('напоминания о публикациях', () => {
  it('просрочено, сегодня, завтра, срочно и каналы без плана', () => {
    const channels = [ch('a'), ch('b'), ch('c', { status: 'abandoned' })];
    const videos = [
      vid('old', 'a', { publishDate: '2026-11-20' }),
      vid('today', 'a', { publishDate: '2026-11-24', urgent: true }),
      vid('tmr', 'a', { publishDate: '2026-11-25' }),
      vid('done', 'b', { stage: 'published', publishDate: '2026-11-24' }),
    ];
    const r = remindersOf(channels, videos, '2026-11-24');
    expect(r.overdue.map((v) => v.id)).toEqual(['old']);
    expect(r.publishToday.map((v) => v.id)).toEqual(['today']);
    expect(r.publishTomorrow.map((v) => v.id)).toEqual(['tmr']);
    expect(r.urgent.map((v) => v.id)).toEqual(['today']);
    expect(r.noPlan).toEqual(['B']);
  });
});
