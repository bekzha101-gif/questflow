import { describe, expect, it } from 'vitest';
import { Store } from '../../store/core';
import { FakeCloud, MemoryStorage } from '../../store/testing';
import { readAdvisor, requestAdvisor } from './aiAdvisor';
import {
  ADVISOR_TEXT,
  AI_ADVISOR_KEY,
  advisorView,
  canRequestAdvisor,
  formatAdvisorAnswer,
  newAdvisorRequest,
  type AiAdvisorState,
} from '@shared/aiAdvisor';

const NOW = new Date('2026-11-17T10:00:00Z');
const plus = (min: number) => new Date(NOW.getTime() + min * 60_000);
const last = { requestId: 'adv-0', at: '2026-11-10T00:00:00Z', summary: 'старый', good: ['a'], better: [], boost: ['b'], source: 'cli' as const };

describe('AI-советник: запрос с сайта', () => {
  it('кнопка пишет запрос в kv ai_advisor (requested, время, вопрос), прошлый ответ сохраняется', async () => {
    const cloud = new FakeCloud();
    const s = new Store({ storage: new MemoryStorage(), isOnline: () => true, flushDelayMs: -1 });
    await s.connect(cloud.factory);
    s.upsert('kv', { key: AI_ADVISOR_KEY, value: { id: 'adv-0', status: 'done', requestedAt: '2026-11-10T00:00:00Z', last } });

    const req = requestAdvisor('  Помогает ли магний?  ', NOW, s);
    expect(req.status).toBe('requested');
    expect(req.question).toBe('Помогает ли магний?');
    expect(req.requestedAt).toBe(NOW.toISOString());
    expect(req.id).not.toBe('adv-0');
    expect(readAdvisor(s)?.last).toEqual(last);

    await s.flush();
    const row = cloud.rows('kv').find((r) => r.key === AI_ADVISOR_KEY);
    expect((row?.value as AiAdvisorState | undefined)?.status).toBe('requested');
  });

  it('пустой вопрос не пишется', () => {
    expect(newAdvisorRequest(null, '   ', NOW, 'x')).toEqual({ id: 'x', status: 'requested', requestedAt: NOW.toISOString() });
  });
});

describe('AI-советник: статус на сайте', () => {
  const req = newAdvisorRequest(null, '', NOW, 'x');

  it('ждёт, затем «компьютер не отвечает» через 3 минуты', () => {
    expect(advisorView(null, NOW).kind).toBe('idle');
    expect(advisorView(req, plus(2)).kind).toBe('waiting');
    expect(advisorView(req, plus(4))).toEqual({ kind: 'offline', message: ADVISOR_TEXT.offline });
    expect(ADVISOR_TEXT.offline).toContain('Компьютер с ботом не отвечает');
  });

  it('анализирует до 10 минут, потом — прервался', () => {
    const p: AiAdvisorState = { ...req, status: 'processing', startedAt: plus(1).toISOString() };
    expect(advisorView(p, plus(8)).kind).toBe('processing');
    expect(advisorView(p, plus(12)).kind).toBe('offline');
  });

  it('готово и ошибка; кнопка заблокирована только пока запрос в работе', () => {
    expect(advisorView({ ...req, status: 'done' }, NOW).kind).toBe('done');
    expect(advisorView({ ...req, status: 'error', error: 'Claude недоступен' }, NOW)).toEqual({ kind: 'error', message: 'Claude недоступен' });
    expect(canRequestAdvisor({ kind: 'waiting' })).toBe(false);
    expect(canRequestAdvisor({ kind: 'processing' })).toBe(false);
    expect(canRequestAdvisor({ kind: 'offline', message: '' })).toBe(true);
    expect(canRequestAdvisor({ kind: 'done' })).toBe(true);
  });

  it('текст для Telegram', () => {
    const t = formatAdvisorAnswer({ ...last, question: 'Как сон?', answer: 'Норм' });
    expect(t).toContain('Вопрос: Как сон?');
    expect(t).toContain('Ответ: Норм');
    expect(t).toContain('- b');
  });
});
