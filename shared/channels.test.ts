import { describe, expect, it } from 'vitest';
import { canPublish, channelSchedule, channelTodo, effectiveStatus, lastPublishedDate, nextDueDates, normalizeVideo, remindersFor, toggleChannelFilter } from './channels';
import type { Channel, Video } from './types';

const ch = (over: Partial<Channel> = {}): Channel => ({
  id: 'c1',
  name: 'AKKDLASA',
  status: 'active',
  cadencePerDay: 1,
  ...over,
});
const vid = (over: Partial<Video> = {}): Video => ({
  id: 'v1',
  channelId: 'c1',
  title: 'Видео',
  stage: 'editing',
  checklist: { plan: false, title: false, thumbnail: false, edit: false, upload: false },
  ...over,
});
const TODAY = '2026-11-17';

describe('effectiveStatus', () => {
  it('пауза с датой в будущем остаётся паузой', () => {
    expect(effectiveStatus(ch({ status: 'paused', pausedUntil: '2026-11-19' }), TODAY)).toBe('paused');
  });
  it('пауза сама возвращается в «Веду» в день окончания и позже', () => {
    expect(effectiveStatus(ch({ status: 'paused', pausedUntil: '2026-11-17' }), TODAY)).toBe('active');
    expect(effectiveStatus(ch({ status: 'paused', pausedUntil: '2026-11-10' }), TODAY)).toBe('active');
  });
  it('заброшен и архив не меняются', () => {
    expect(effectiveStatus(ch({ status: 'abandoned' }), TODAY)).toBe('abandoned');
    expect(effectiveStatus(ch({ status: 'archived' }), TODAY)).toBe('archived');
  });
});

describe('nextDueDates', () => {
  it('1 в день: следующий день после последней публикации', () => {
    expect(nextDueDates(ch(), '2026-11-17', TODAY, 3)).toEqual(['2026-11-18', '2026-11-19', '2026-11-20']);
  });
  it('1 в день: вчерашняя публикация, сегодня снова срок', () => {
    expect(nextDueDates(ch(), '2026-11-16', TODAY, 2)).toEqual(['2026-11-17', '2026-11-18']);
  });
  it('2 в день: дни подряд, один день одна запись', () => {
    expect(nextDueDates(ch({ cadencePerDay: 2 }), '2026-11-16', TODAY, 2)).toEqual(['2026-11-17', '2026-11-18']);
  });
  it('1 раз в 2 дня: шаг 2 от последней публикации', () => {
    expect(nextDueDates(ch({ cadencePerDay: 0.5 }), '2026-11-16', TODAY, 3)).toEqual([
      '2026-11-18',
      '2026-11-20',
      '2026-11-22',
    ]);
  });
  it('1 раз в 2 дня: просрочено, срок сегодня', () => {
    expect(nextDueDates(ch({ cadencePerDay: 0.5 }), '2026-11-10', TODAY, 2)).toEqual(['2026-11-17', '2026-11-19']);
  });
  it('нет публикаций: срок сегодня', () => {
    expect(nextDueDates(ch({ cadencePerDay: 0.5 }), null, TODAY, 2)).toEqual(['2026-11-17', '2026-11-19']);
  });
  it('пауза: график с даты возвращения; заброшен и архив: пусто', () => {
    expect(nextDueDates(ch({ status: 'paused', pausedUntil: '2026-11-20' }), null, TODAY, 2)).toEqual([
      '2026-11-20',
      '2026-11-21',
    ]);
    expect(nextDueDates(ch({ status: 'abandoned' }), null, TODAY)).toEqual([]);
    expect(nextDueDates(ch({ status: 'archived' }), null, TODAY)).toEqual([]);
  });
});

describe('channelTodo', () => {
  it('нет видео в работе: шаг «контент-план», срок сегодня', () => {
    expect(channelTodo(ch(), [], TODAY)).toMatchObject({ step: 'plan', dueDate: TODAY, urgency: 'today' });
  });
  it('шаг это первый неотмеченный пункт чек-листа', () => {
    const v = vid({ checklist: { plan: true, title: true, thumbnail: false, edit: false, upload: false } });
    const t = channelTodo(ch(), [v], TODAY);
    expect(t.step).toBe('thumbnail');
    expect(t.videoId).toBe('v1');
  });
  it('опубликовали сегодня: срок завтра, срочность «скоро» (монтаж заранее)', () => {
    const done = vid({ id: 'p', stage: 'published', publishedAt: TODAY });
    expect(channelTodo(ch(), [done], TODAY)).toMatchObject({ step: 'plan', dueDate: '2026-11-18', urgency: 'soon' });
  });
  it('2 в день: одна из двух опубликована сегодня, срок всё ещё сегодня', () => {
    const done = vid({ id: 'p', stage: 'published', publishedAt: TODAY });
    expect(channelTodo(ch({ cadencePerDay: 2 }), [done], TODAY).dueDate).toBe(TODAY);
  });
  it('просрочено: последняя публикация 3 дня назад при частоте 1 в день', () => {
    const done = vid({ id: 'p', stage: 'published', publishedAt: '2026-11-14' });
    expect(channelTodo(ch(), [done], TODAY)).toMatchObject({ dueDate: '2026-11-15', urgency: 'overdue' });
  });
  it('все пункты отмечены: «опубликовать»', () => {
    const v = vid({ checklist: { plan: true, title: true, thumbnail: true, edit: true, upload: true } });
    expect(channelTodo(ch(), [v], TODAY).step).toBe('publish');
  });
  it('видео другого канала не учитываются; пауза и архив без срочности', () => {
    expect(channelTodo(ch(), [vid({ channelId: 'zzz' })], TODAY).step).toBe('plan');
    expect(channelTodo(ch({ status: 'paused', pausedUntil: '2026-11-19' }), [], TODAY)).toMatchObject({
      step: 'paused',
      urgency: 'none',
      dueDate: '2026-11-19',
    });
    expect(channelTodo(ch({ status: 'archived' }), [], TODAY)).toMatchObject({ step: 'none', urgency: 'none' });
  });
  it('монтаж 3–5 часов: напоминать за 2 дня', () => {
    const done = vid({ id: 'p', stage: 'published', publishedAt: '2026-11-17' });
    const c = ch({ cadencePerDay: 0.5, editHoursMin: 3, editHoursMax: 5 });
    expect(channelTodo(c, [done], TODAY)).toMatchObject({ dueDate: '2026-11-19', urgency: 'soon' });
    expect(channelTodo(ch({ cadencePerDay: 0.5 }), [done], TODAY).urgency).toBe('later');
  });
});

describe('последняя публикация из карточки канала (без видео в базе)', () => {
  it('1 в день, выложено сегодня: следующее видео завтра', () => {
    const c = ch({ lastPublished: TODAY });
    expect(lastPublishedDate(c, [])).toBe(TODAY);
    expect(nextDueDates(c, lastPublishedDate(c, []), TODAY, 1)).toEqual(['2026-11-18']);
    expect(channelTodo(c, [], TODAY)).toMatchObject({ dueDate: '2026-11-18', urgency: 'soon' });
  });
  it('раз в 2 дня, выложено вчера: следующее видео завтра', () => {
    const c = ch({ cadencePerDay: 0.5, lastPublished: '2026-11-16' });
    expect(nextDueDates(c, lastPublishedDate(c, []), TODAY, 1)).toEqual(['2026-11-18']);
    expect(channelTodo(c, [], TODAY).dueDate).toBe('2026-11-18');
  });
  it('видео опубликовано позже даты из карточки — считается по видео', () => {
    const c = ch({ lastPublished: '2026-11-10' });
    const done = vid({ id: 'p', stage: 'published', publishedAt: '2026-11-16' });
    expect(lastPublishedDate(c, [done])).toBe('2026-11-16');
    expect(channelTodo(c, [done], TODAY).dueDate).toBe('2026-11-17');
  });
});

describe('2 видео в день: одна публикация сегодня не закрывает день', () => {
  it('выложено 1 из 2 — расписание начинается с сегодня', () => {
    const c = ch({ cadencePerDay: 2 });
    const one = vid({ id: 'p1', stage: 'published', publishedAt: TODAY });
    expect(channelSchedule(c, [one], TODAY, 2)).toEqual([TODAY, '2026-11-18']);
    expect(channelTodo(c, [one], TODAY).dueDate).toBe(TODAY);
  });
  it('выложено 2 из 2 — следующее видео завтра', () => {
    const c = ch({ cadencePerDay: 2 });
    const two = [vid({ id: 'p1', stage: 'published', publishedAt: TODAY }), vid({ id: 'p2', stage: 'published', publishedAt: TODAY })];
    expect(channelSchedule(c, two, TODAY, 1)).toEqual(['2026-11-18']);
  });
});

describe('remindersFor', () => {
  const pub = (channelId: string, publishedAt: string): Video =>
    vid({ id: `p-${channelId}`, channelId, stage: 'published', publishedAt });

  it('текст «завтра видео на X — запусти монтаж сегодня»', () => {
    expect(remindersFor([ch()], [pub('c1', TODAY)], TODAY)).toEqual([
      { channelId: 'c1', text: 'завтра видео на AKKDLASA — запусти монтаж сегодня' },
    ]);
  });
  it('не больше 3 по умолчанию и не больше limit', () => {
    const channels = ['a', 'b', 'c', 'd', 'e'].map((id) => ch({ id, name: id.toUpperCase() }));
    expect(remindersFor(channels, [], TODAY)).toHaveLength(3);
    expect(remindersFor(channels, [], TODAY, 2)).toHaveLength(2);
  });
  it('сначала просроченные, потом сегодняшние, потом завтрашние', () => {
    const channels = [
      ch({ id: 'soon', name: 'SOON' }),
      ch({ id: 'late', name: 'LATE' }),
      ch({ id: 'now', name: 'NOW' }),
    ];
    const videos = [pub('soon', TODAY), pub('late', '2026-11-14')];
    expect(remindersFor(channels, videos, TODAY).map((r) => r.channelId)).toEqual(['late', 'now', 'soon']);
  });
  it('пауза, заброшенные, архив и далёкий срок молчат', () => {
    const channels = [
      ch({ id: 'p', status: 'paused', pausedUntil: '2026-11-30' }),
      ch({ id: 'a', status: 'abandoned' }),
      ch({ id: 'r', status: 'archived' }),
      ch({ id: 'far', cadencePerDay: 0.5 }),
    ];
    expect(remindersFor(channels, [pub('far', TODAY)], TODAY)).toEqual([]);
  });
});

describe('видео: этапы и чек-лист', () => {
  it('старые «Сценарий/Озвучка» уходят в «Монтаж», «Запланировано» в «Проверку»', () => {
    const stageOf = (stage: string) => normalizeVideo({ ...vid(), stage } as unknown as Video).stage;
    expect(stageOf('scripting')).toBe('editing');
    expect(stageOf('voiceover')).toBe('editing');
    expect(stageOf('scheduled')).toBe('review');
    expect(stageOf('review')).toBe('review');
    expect(stageOf('published')).toBe('published');
  });
  it('видео без чек-листа получает пустой, видео не теряется', () => {
    const n = normalizeVideo({ id: 'x', channelId: 'c1', title: 'T', stage: 'editing' });
    expect(n.checklist).toEqual({ plan: false, title: false, thumbnail: false, edit: false, upload: false });
    expect(n.title).toBe('T');
  });
  it('«Опубликовано» доступно только когда отмечены все 5 пунктов', () => {
    expect(canPublish(undefined)).toBe(false);
    expect(canPublish({ plan: true, title: true, thumbnail: true, edit: true, upload: false })).toBe(false);
    expect(canPublish({ plan: true, title: true, thumbnail: true, edit: true, upload: true })).toBe(true);
  });
});

describe('toggleChannelFilter', () => {
  const all = ['a', 'b', 'c'];
  it('первый клик из «Все» оставляет один канал', () => {
    expect(toggleChannelFilter([], 'b', all)).toEqual(['b']);
  });
  it('второй канал добавляется, повторный клик убирает', () => {
    expect(toggleChannelFilter(['b'], 'c', all)).toEqual(['b', 'c']);
    expect(toggleChannelFilter(['b', 'c'], 'b', all)).toEqual(['c']);
    expect(toggleChannelFilter(['c'], 'c', all)).toEqual([]);
  });
  it('удалённые каналы выпадают из фильтра', () => {
    expect(toggleChannelFilter(['x', 'a'], 'b', all)).toEqual(['a', 'b']);
  });
});
