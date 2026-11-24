import { describe, expect, it } from 'vitest';
import type { Video } from '@shared/types';
import { allTags, channelFromCloud, channelScope, channelToCloud, parseTags, sortChannelsByStatus, urgentFirst, videoFromCloud, videoToCloud } from './legacyMedia';

const cloud = (over: Partial<Video> = {}): Video => ({ id: 'v1', channelId: 'c1', title: 'T', stage: 'editing', ...over });

describe('legacyMedia', () => {
  it('«Обложка и заголовок» хранится, в облаке — монтаж готов', () => {
    const item = { ...videoFromCloud(cloud()), stage: 'cover' as const, pricePerVideo: 40 };
    const out = videoToCloud(item, cloud(), '2026-11-19');
    expect(out.stage).toBe('editing');
    expect(out.legacyStage).toBe('cover');
    expect(out.checklist?.edit).toBe(true);
    expect(out.pricePerVideo).toBe(40);
    expect(videoFromCloud(out).stage).toBe('cover');
  });

  it('убранные этапы: Сценарий/Озвучка — Монтаж, Запланировано — Проверка', () => {
    expect(videoFromCloud(cloud({ stage: 'editing', legacyStage: 'voiceover' })).stage).toBe('editing');
    expect(videoFromCloud(cloud({ stage: 'review', legacyStage: 'scheduled' })).stage).toBe('review');
  });

  it('«Загружено» — опубликовано, дата и чек-лист для бота', () => {
    const item = { ...videoFromCloud(cloud()), isUploaded: true, stage: 'published' as const };
    const out = videoToCloud(item, cloud(), '2026-11-19');
    expect(out.stage).toBe('published');
    expect(out.publishedAt).toBe('2026-11-19');
    expect(out.checklist?.upload).toBe(true);
  });

  it('новый этап важнее устаревшего legacyStage', () => {
    expect(videoFromCloud(cloud({ stage: 'published', legacyStage: 'scripting' })).stage).toBe('published');
  });

  it('канал: описание — ниша, статус и частота не теряются', () => {
    const prev = { id: 'c1', name: 'A', status: 'paused' as const, cadencePerDay: 2, niche: 'old' };
    const ch = { ...channelFromCloud(prev), description: 'new', handle: '@a' };
    const out = channelToCloud(ch, prev);
    expect(out).toMatchObject({ status: 'paused', cadencePerDay: 2, niche: 'new', handle: '@a' });
    expect(channelToCloud({ ...ch, id: 'c2', status: 'active' }, undefined)).toMatchObject({ status: 'active', cadencePerDay: 1 });
  });
});

describe('теги и выбор каналов', () => {
  const ch = (id: string, tags: string[]) => ({ ...channelFromCloud({ id, name: id, status: 'active', cadencePerDay: 1 }), tags });
  const list = [ch('a', ['военка', 'США']), ch('b', ['Военка']), ch('c', [])];

  it('теги из строки: запятые, решётки, без повторов', () => {
    expect(parseTags(' шортсы, #военка,, Военка ; США ')).toEqual(['шортсы', 'военка', 'США']);
  });
  it('все теги каналов', () => {
    expect(allTags(list)).toEqual(['военка', 'США']);
  });
  it('выбор: все, один канал, тег, пропавший канал', () => {
    expect(channelScope(list, 'all')).toBeNull();
    expect(channelScope(list, 'b')).toEqual(['b']);
    expect(channelScope(list, 'tag:ВОЕНКА')).toEqual(['a', 'b']);
    expect(channelScope(list, 'gone')).toBeNull();
    expect(channelScope(list, 'tag:нет-такого')).toBeNull();
  });
  it('теги и цвет сохраняются в облако', () => {
    const c = { ...ch('a', ['x']), color: '#ef4444' };
    expect(channelToCloud(c, undefined)).toMatchObject({ tags: ['x'], color: '#ef4444' });
  });
});

describe('статусы каналов и «срочно»', () => {
  it('статус из облака, неизвестный — Веду; порядок веду → запущу → пауза → забросил', () => {
    const mk = (id: string, status: string) => channelFromCloud({ id, name: id, status: status as never, cadencePerDay: 1 });
    const list = [mk('x', 'abandoned'), mk('a', 'active'), mk('p', 'paused'), mk('n', 'planned'), mk('q', 'weird')];
    expect(list.map((c) => c.status)).toEqual(['abandoned', 'active', 'paused', 'planned', 'active']);
    expect(sortChannelsByStatus(list).map((c) => c.id)).toEqual(['a', 'q', 'n', 'p', 'x']);
  });

  it('срочные видео первыми; у выложенного срочность снимается', () => {
    expect(urgentFirst([{ id: 1 }, { id: 2, urgent: true }, { id: 3 }]).map((v) => v.id)).toEqual([2, 1, 3]);
    const v = videoFromCloud({ id: 'v', channelId: 'c', title: 't', stage: 'editing', urgent: true });
    expect(v.urgent).toBe(true);
    const out = videoToCloud({ ...v, isUploaded: true }, { id: 'v', channelId: 'c', title: 't', stage: 'editing', urgent: true }, '2026-11-24');
    expect(out.urgent).toBeUndefined();
  });
});
