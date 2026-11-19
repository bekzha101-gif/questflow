import { describe, expect, it } from 'vitest';
import type { Video } from '@shared/types';
import { allTags, channelFromCloud, channelScope, channelToCloud, parseTags, videoFromCloud, videoToCloud } from './legacyMedia';

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
    expect(channelToCloud({ ...ch, id: 'c2' }, undefined)).toMatchObject({ status: 'active', cadencePerDay: 1 });
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
