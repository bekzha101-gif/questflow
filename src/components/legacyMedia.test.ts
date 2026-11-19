import { describe, expect, it } from 'vitest';
import type { Video } from '@shared/types';
import { channelFromCloud, channelToCloud, videoFromCloud, videoToCloud } from './legacyMedia';

const cloud = (over: Partial<Video> = {}): Video => ({ id: 'v1', channelId: 'c1', title: 'T', stage: 'editing', ...over });

describe('legacyMedia', () => {
  it('старый этап сохраняется, в облаке — один из трёх', () => {
    const item = { ...videoFromCloud(cloud()), stage: 'voiceover' as const, pricePerVideo: 40 };
    const out = videoToCloud(item, cloud(), '2026-11-19');
    expect(out.stage).toBe('editing');
    expect(out.legacyStage).toBe('voiceover');
    expect(out.pricePerVideo).toBe(40);
    expect(videoFromCloud(out).stage).toBe('voiceover');
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
