// AI-советник на сайте: запрос и ответ лежат в kv `ai_advisor` (формат — shared/aiAdvisor.ts).
// Сайт только пишет запрос через хранилище; анализ делает домашний компьютер через Claude.
import { useEffect, useState } from 'react';
import { store as defaultStore, useRecord, type Store } from '../../store';
import {
  AI_ADVISOR_KEY,
  advisorView,
  isAdvisorState,
  newAdvisorRequest,
  type AdvisorPeriod,
  type AdvisorView,
  type AiAdvisorState,
} from '@shared/aiAdvisor';

interface KvRow<T> {
  key: string;
  value: T;
}

export function readAdvisor(s: Store = defaultStore): AiAdvisorState | null {
  const v = s.get<KvRow<unknown>>('kv', AI_ADVISOR_KEY)?.value;
  return isAdvisorState(v) ? v : null;
}

/** Записать новый запрос (прошлый ответ остаётся в last) */
export function requestAdvisor(
  question: string,
  now: Date = new Date(),
  s: Store = defaultStore,
  period: AdvisorPeriod = 'month',
): AiAdvisorState {
  const next = newAdvisorRequest(readAdvisor(s), question, now, undefined, period);
  s.upsert('kv', { key: AI_ADVISOR_KEY, value: next });
  return next;
}

/** Состояние советника + статус с учётом «компьютер не отвечает» (пересчёт раз в 10 с) */
export function useAiAdvisor(): {
  state: AiAdvisorState | null;
  view: AdvisorView;
  request: (question: string, period?: AdvisorPeriod) => void;
} {
  const { value } = useRecord<KvRow<unknown>>('kv', AI_ADVISOR_KEY);
  const state = isAdvisorState(value?.value) ? value.value : null;
  const [now, setNow] = useState(() => Date.now());
  const pending = state?.status === 'requested' || state?.status === 'processing';
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, [pending]);
  return { state, view: advisorView(state, new Date(now)), request: (q, period = 'month') => void requestAdvisor(q, new Date(), defaultStore, period) };
}
