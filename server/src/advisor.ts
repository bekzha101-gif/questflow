// AI-советник по здоровью и жизни (кнопки «Анализ дня / недели / месяца» на сайте).
// Сайт пишет запрос в kv `ai_advisor` (status = requested); сервер раз в ~30 с забирает его:
// сначала status = processing (повторно не берётся), затем Claude по данным месяца (тот же срез,
// что у анализа месяца, + раздел здоровья), ответ — в kv (done), его показывает сайт. Ошибка — status = error.
import type { Ai } from './ai';
import { addDays, todayStr } from '../../shared/time';
import {
  ADVISOR_PROCESS_TIMEOUT_MS,
  ADVISOR_TEXT,
  AI_ADVISOR_KEY,
  isAdvisorState,
  type AdvisorPeriod,
  type AiAdvisorAnswer,
  type AiAdvisorState,
} from '../../shared/aiAdvisor';
import { buildPayload } from './conversation/context';
import type { ConversationStore } from './conversation/store';

export interface AdvisorDeps {
  store: ConversationStore;
  ai: Ai;
  now?: () => Date;
  log?(message: string): void;
}

export type AdvisorOutcome = 'none' | 'busy' | 'done' | 'error' | 'stale';

export interface Advisor {
  /** Проверить kv и обработать запрос, если он есть. Звать раз в ~30 с. */
  tick(): Promise<AdvisorOutcome>;
}

/** Опрос kv раз в 30 с */
export const ADVISOR_POLL_MS = 30_000;

// Ключи раздела «Здоровье» на сайте (src/utils/healthTracker.ts); legacy — перенесённые старые ключи
const HEALTH_KV = {
  sleep: ['health_sleep', 'legacy:questflow_health_sleep_v1'],
  damage: ['health_damage', 'legacy:questflow_health_damage_v1'],
  recovery: ['health_recovery', 'legacy:questflow_health_recovery_v1'],
  dailyPrefix: 'health_daily:',
};

type Dated = { date?: unknown };
const inRange = (from: string, to: string) => (x: Dated) => typeof x?.date === 'string' && x.date >= from && x.date <= to;

async function kvList(store: ConversationStore, keys: string[]): Promise<Dated[]> {
  for (const k of keys) {
    const v = await store.getKv<unknown>(k);
    if (Array.isArray(v)) return v as Dated[];
  }
  return [];
}

/** Раздел здоровья за 30 дней: сон Sleep Cycle, протоколы дня, урон и восстановление HP, еда */
export async function healthPayload(store: ConversationStore, today: string) {
  const from = addDays(today, -29);
  const dates = Array.from({ length: 30 }, (_, i) => addDays(from, i));
  const [sleep, damage, recovery, food, daily] = await Promise.all([
    kvList(store, HEALTH_KV.sleep),
    kvList(store, HEALTH_KV.damage),
    kvList(store, HEALTH_KV.recovery),
    store.listHealthFood(from, today),
    Promise.all(dates.map((d) => store.getKv<Record<string, unknown>>(HEALTH_KV.dailyPrefix + d))),
  ]);
  const keep = inRange(from, today);
  return {
    sleepLogs: sleep.filter(keep),
    damages: damage.filter(keep),
    recoveries: recovery.filter(keep),
    food: food.map((f) => ({ date: f.date, time: f.time, mealType: f.mealType, food: f.food, feeling: f.feeling, notes: f.notes })),
    dailyProtocols: daily
      .map((p, i) => (p && typeof p === 'object' ? { ...p, date: dates[i] } : null))
      .filter((p): p is Record<string, unknown> & { date: string } => p !== null),
  };
}

export function createAdvisor(deps: AdvisorDeps): Advisor {
  const nowOf = () => (deps.now ? deps.now() : new Date());
  const log = deps.log ?? (() => {});
  let busy = false;

  const read = async (): Promise<AiAdvisorState | null> => {
    const v = await deps.store.getKv<unknown>(AI_ADVISOR_KEY);
    return isAdvisorState(v) ? v : null;
  };
  const write = (s: AiAdvisorState) => deps.store.setKv(AI_ADVISOR_KEY, JSON.parse(JSON.stringify(s)));

  /** Итог запроса: если сайт уже прислал новый запрос, его статус не трогаем, обновляем только last */
  async function finish(reqId: string, patch: Partial<AiAdvisorState>) {
    const cur = await read();
    if (cur && cur.id !== reqId) {
      if (patch.last) await write({ ...cur, last: patch.last });
      return;
    }
    const base = cur ?? ({ id: reqId, requestedAt: nowOf().toISOString() } as AiAdvisorState);
    const next: AiAdvisorState = { ...base, ...patch, finishedAt: nowOf().toISOString() } as AiAdvisorState;
    if (next.status === 'done') delete next.error;
    await write(next);
  }

  async function run(): Promise<AdvisorOutcome> {
    const state = await read();
    if (!state) return 'none';
    const now = nowOf();

    if (state.status === 'processing') {
      // Сервер перезапускался посреди анализа — честно закрываем запрос, а не берём его второй раз
      const at = Date.parse(state.startedAt ?? state.requestedAt);
      if (Number.isFinite(at) && now.getTime() - at > ADVISOR_PROCESS_TIMEOUT_MS) {
        await write({ ...state, status: 'error', error: ADVISOR_TEXT.stuck, finishedAt: now.toISOString() });
        log('AI-советник: анализ прервался (висел в processing), запрос закрыт с ошибкой');
        return 'stale';
      }
      return 'none';
    }
    if (state.status !== 'requested') return 'none';

    // Сначала processing — следующий опрос этот запрос уже не возьмёт
    await write({ ...state, status: 'processing', startedAt: now.toISOString() });
    log(`AI-советник: взят запрос ${state.id}${state.question ? ' (с вопросом)' : ''}`);

    try {
      const today = todayStr(now);
      const period: AdvisorPeriod = state.period === 'day' || state.period === 'week' ? state.period : 'month';
      const payload = {
        ...(await buildPayload(deps.store, period, today)),
        period,
        health: await healthPayload(deps.store, today),
        question: state.question ?? '',
      };
      const r = await deps.ai.analyze('advisor', payload);
      if (!r) {
        await finish(state.id, { status: 'error', error: ADVISOR_TEXT.noAi });
        log('AI-советник: Claude не ответил (claude -p и запасной API недоступны)');
        return 'error';
      }
      const answer: AiAdvisorAnswer = {
        requestId: state.id,
        at: nowOf().toISOString(),
        ...(state.question ? { question: state.question } : {}),
        period,
        summary: r.summary,
        ...(r.answer ? { answer: r.answer } : {}),
        good: r.good,
        better: r.better,
        boost: r.boost,
        source: r.source,
      };
      await finish(state.id, { status: 'done', last: answer });
      log(`AI-советник: ответ готов (${r.source})`);
      return 'done';
    } catch (e) {
      const msg = (e as Error).message;
      log(`AI-советник: ошибка: ${msg}`);
      await finish(state.id, { status: 'error', error: `Ошибка на домашнем компьютере: ${msg.slice(0, 200)}` }).catch((e2) =>
        log(`AI-советник: не удалось записать ошибку: ${(e2 as Error).message}`),
      );
      return 'error';
    }
  }

  return {
    async tick() {
      if (busy) return 'busy';
      busy = true;
      try {
        return await run();
      } finally {
        busy = false;
      }
    },
  };
}
