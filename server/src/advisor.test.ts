import { describe, expect, it, vi } from 'vitest';
import { createAdvisor, healthPayload } from './advisor';
import type { Ai, AiKind, AiResult } from './ai';
import { buildPrompt, parseAiText } from './ai';
import { createMemoryStore, emptyData, type MemoryData } from './conversation/testing';
import { ADVISOR_TEXT, AI_ADVISOR_KEY, type AiAdvisorState } from '../../shared/aiAdvisor';

const NOW = new Date('2026-11-17T10:00:00Z');

const RESULT: AiResult = {
  source: 'cli',
  summary: 'Сон держится около 7 ч.',
  answer: 'Магний помогает: в дни с ним оценка выше на 1.',
  good: ['Сон 7 ч'],
  better: ['Гаджеты после 23:00'],
  boost: ['Прогулка перед сном'],
  facts: [],
  steps: [],
};

function setup(over: Partial<MemoryData> = {}, ai?: Ai['analyze']) {
  const data = emptyData(over);
  const store = createMemoryStore(data);
  const calls: { kind: AiKind; payload: unknown }[] = [];
  const analyze = ai ?? (async () => RESULT);
  const sent: string[] = [];
  const logs: string[] = [];
  const advisor = createAdvisor({
    store,
    ai: {
      analyze: async (kind, payload) => {
        calls.push({ kind, payload });
        return analyze(kind, payload);
      },
    },
    send: async (t) => (sent.push(t), true),
    now: () => NOW,
    log: (m) => logs.push(m),
  });
  const state = () => data.kv[AI_ADVISOR_KEY] as AiAdvisorState;
  return { data, advisor, calls, sent, logs, state };
}

const request = (over: Partial<AiAdvisorState> = {}): AiAdvisorState => ({
  id: 'adv-1',
  status: 'requested',
  question: 'Помогает ли магний?',
  requestedAt: '2026-11-17T09:59:00Z',
  ...over,
});

describe('AI-советник (kv ai_advisor)', () => {
  it('запроса нет — ничего не делает', async () => {
    const t = setup();
    expect(await t.advisor.tick()).toBe('none');
    expect(t.calls).toHaveLength(0);
  });

  it('обрабатывает запрос: Claude kind advisor, ответ в kv (done) и в Telegram', async () => {
    const t = setup({
      kv: {
        [AI_ADVISOR_KEY]: request(),
        health_sleep: [{ id: 's1', date: '2026-11-16', totalHours: 7 }, { id: 's0', date: '2026-09-01', totalHours: 5 }],
        'health_daily:2026-11-16': { waterGlasses: 6 },
      },
      food: [{ id: 'f1', timestamp: '', date: '2026-11-16', time: '13:00', mealType: 'lunch', food: 'плов', feeling: 'heavy' }],
    });
    expect(await t.advisor.tick()).toBe('done');
    expect(t.calls).toHaveLength(1);
    expect(t.calls[0].kind).toBe('advisor');
    const p = t.calls[0].payload as { question: string; kind: string; health: { sleepLogs: unknown[]; food: unknown[]; dailyProtocols: { date: string }[] } };
    expect(p.question).toBe('Помогает ли магний?');
    expect(p.kind).toBe('month');
    expect(p.health.sleepLogs).toHaveLength(1); // старше 30 дней — отброшено
    expect(p.health.food).toHaveLength(1);
    expect(p.health.dailyProtocols).toEqual([{ waterGlasses: 6, date: '2026-11-16' }]);

    const s = t.state();
    expect(s.status).toBe('done');
    expect(s.startedAt).toBe(NOW.toISOString());
    expect(s.last?.requestId).toBe('adv-1');
    expect(s.last?.answer).toContain('Магний');
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0]).toContain('Вопрос: Помогает ли магний?');
    expect(t.sent[0]).toContain('Прогулка перед сном');
  });

  it('до вызова Claude ставит processing; второй опрос тот же запрос не берёт', async () => {
    let release!: (r: AiResult) => void;
    const t = setup({ kv: { [AI_ADVISOR_KEY]: request() } }, () => new Promise<AiResult>((res) => (release = res)));
    const first = t.advisor.tick();
    await vi.waitFor(() => expect(t.calls).toHaveLength(1));
    expect(t.state().status).toBe('processing');
    expect(await t.advisor.tick()).toBe('busy'); // тот же процесс
    release(RESULT);
    expect(await first).toBe('done');

    // Другой процесс (перезапуск) видит processing и тоже не берёт
    const t2 = setup({ kv: { [AI_ADVISOR_KEY]: request({ status: 'processing', startedAt: '2026-11-17T09:59:30Z' }) } });
    expect(await t2.advisor.tick()).toBe('none');
    expect(t2.calls).toHaveLength(0);
    // Готовый ответ тоже не берётся второй раз
    expect(await t.advisor.tick()).toBe('none');
    expect(t.calls).toHaveLength(1);
    expect(t.sent).toHaveLength(1);
  });

  it('Claude недоступен — status error с понятным текстом, в Telegram ничего', async () => {
    const t = setup({ kv: { [AI_ADVISOR_KEY]: request() } }, async () => null);
    expect(await t.advisor.tick()).toBe('error');
    expect(t.state().status).toBe('error');
    expect(t.state().error).toBe(ADVISOR_TEXT.noAi);
    expect(t.sent).toHaveLength(0);
    expect(t.logs.join('\n')).toContain('Claude не ответил');
  });

  it('исключение при анализе — status error с текстом ошибки', async () => {
    const t = setup({ kv: { [AI_ADVISOR_KEY]: request() } }, async () => {
      throw new Error('сеть упала');
    });
    expect(await t.advisor.tick()).toBe('error');
    expect(t.state().error).toContain('сеть упала');
  });

  it('прошлый ответ сохраняется при ошибке нового запроса', async () => {
    const last = { requestId: 'adv-0', at: '2026-11-10T00:00:00Z', summary: 'старый', good: [], better: [], boost: [], source: 'cli' as const };
    const t = setup({ kv: { [AI_ADVISOR_KEY]: request({ last }) } }, async () => null);
    await t.advisor.tick();
    expect(t.state().last).toEqual(last);
  });

  it('пока шёл анализ, сайт прислал новый запрос — его статус не перетирается', async () => {
    let t!: ReturnType<typeof setup>;
    t = setup({ kv: { [AI_ADVISOR_KEY]: request() } }, async () => {
      t.data.kv[AI_ADVISOR_KEY] = request({ id: 'adv-2', question: 'новый' });
      return RESULT;
    });
    await t.advisor.tick();
    expect(t.state().id).toBe('adv-2');
    expect(t.state().status).toBe('requested');
    expect(t.state().last?.requestId).toBe('adv-1');
  });

  it('висит в processing дольше 10 мин — закрывается ошибкой, без повторного вызова', async () => {
    const t = setup({ kv: { [AI_ADVISOR_KEY]: request({ status: 'processing', startedAt: '2026-11-17T09:40:00Z' }) } });
    expect(await t.advisor.tick()).toBe('stale');
    expect(t.state().status).toBe('error');
    expect(t.state().error).toBe(ADVISOR_TEXT.stuck);
    expect(t.calls).toHaveLength(0);
  });

  it('healthPayload берёт legacy-ключ, если нового нет', async () => {
    const store = createMemoryStore(emptyData({ kv: { 'legacy:questflow_health_damage_v1': [{ id: 'd', date: '2026-11-15', hpLost: 10 }] } }));
    const h = await healthPayload(store, '2026-11-17');
    expect(h.damages).toHaveLength(1);
    expect(h.recoveries).toEqual([]);
  });
});

describe('ai.ts: kind advisor', () => {
  it('промпт с вопросом и без', () => {
    expect(buildPrompt('advisor', { question: 'Как сон?' })).toContain('Вопрос пользователя: «Как сон?»');
    expect(buildPrompt('advisor', {})).toContain('Вопроса нет');
    expect(buildPrompt('advisor', {})).toContain('не врач');
  });

  it('разбор ответа с полем answer', () => {
    const r = parseAiText('advisor', '{"summary":"s","answer":"a","good":["g"],"better":[],"boost":[],"facts":[],"steps":[{"goalId":"x","title":"y"}]}');
    expect(r?.answer).toBe('a');
    expect(r?.steps).toEqual([]);
  });
});
