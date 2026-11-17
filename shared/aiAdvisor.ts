// AI-советник по здоровью и жизни: запрос с сайта и ответ домашнего сервера через одну строку kv.
// Сайт пишет запрос (status = requested), сервер раз в ~30 с забирает его (processing), зовёт Claude
// по данным месяца и пишет ответ (done) или ошибку (error); ответ дублируется в Telegram.
// Сети на сайте нет: связь только через Supabase (kv), AI-ключей в браузере нет.

/** Ключ строки в таблице kv */
export const AI_ADVISOR_KEY = 'ai_advisor';

export type AiAdvisorStatus = 'requested' | 'processing' | 'done' | 'error';

export interface AiAdvisorAnswer {
  /** id запроса, на который это ответ */
  requestId: string;
  /** Когда готов (ISO) */
  at: string;
  /** Вопрос пользователя, если был */
  question?: string;
  summary: string;
  /** Ответ на вопрос пользователя */
  answer?: string;
  good: string[];
  better: string[];
  boost: string[];
  source: 'cli' | 'api';
}

/** value строки kv `ai_advisor` */
export interface AiAdvisorState {
  /** id текущего запроса (сайт) */
  id: string;
  status: AiAdvisorStatus;
  /** Необязательный вопрос пользователя */
  question?: string;
  /** Когда нажата кнопка (ISO) */
  requestedAt: string;
  /** Когда сервер взял запрос (ISO) */
  startedAt?: string;
  /** Когда сервер закончил (ISO) */
  finishedAt?: string;
  /** Понятный текст ошибки по-русски (status = error) */
  error?: string;
  /** Последний готовый ответ — остаётся и при новом запросе, пока не придёт следующий */
  last?: AiAdvisorAnswer;
}

/** Сервер не взял запрос за это время — компьютер с ботом, скорее всего, выключен */
export const ADVISOR_PICKUP_TIMEOUT_MS = 3 * 60_000;
/** Анализ дольше этого — считаем прерванным (claude -p ждёт до 4 мин, плюс запасной API) */
export const ADVISOR_PROCESS_TIMEOUT_MS = 10 * 60_000;
/** Предел длины вопроса */
export const ADVISOR_QUESTION_MAX = 500;

export const ADVISOR_TEXT = {
  offline: 'Компьютер с ботом не отвечает: запрос никто не взял за 3 минуты. Проверьте, что компьютер включён и бот запущен.',
  stuck: 'Анализ прервался: компьютер с ботом не закончил за 10 минут. Нажмите ещё раз.',
  noAi: 'Claude сейчас недоступен (нет ответа от claude -p и нет запасного ключа API, или исчерпан лимит). Попробуйте позже.',
};

function ms(iso: string | undefined): number {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : NaN;
}

/** Похоже ли значение на состояние советника */
export function isAdvisorState(v: unknown): v is AiAdvisorState {
  const s = v as AiAdvisorState | null;
  return !!s && typeof s === 'object' && typeof s.id === 'string' && typeof s.status === 'string' && typeof s.requestedAt === 'string';
}

/** Новый запрос: прошлый ответ сохраняется в last */
export function newAdvisorRequest(prev: AiAdvisorState | null, question: string, now: Date, id?: string): AiAdvisorState {
  const q = question.trim().slice(0, ADVISOR_QUESTION_MAX);
  return {
    id: id ?? `adv-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
    status: 'requested',
    ...(q ? { question: q } : {}),
    requestedAt: now.toISOString(),
    ...(prev?.last ? { last: prev.last } : {}),
  };
}

export type AdvisorView =
  | { kind: 'idle' }
  | { kind: 'waiting' }
  | { kind: 'processing' }
  | { kind: 'done' }
  | { kind: 'error'; message: string }
  /** Сервер не отвечает (запрос висит) — можно отправить заново */
  | { kind: 'offline'; message: string };

/** Что показать на сайте: статус с учётом «компьютер не отвечает» */
export function advisorView(state: AiAdvisorState | null, now: Date): AdvisorView {
  if (!state) return { kind: 'idle' };
  const t = now.getTime();
  if (state.status === 'requested') {
    const at = ms(state.requestedAt);
    return Number.isFinite(at) && t - at > ADVISOR_PICKUP_TIMEOUT_MS ? { kind: 'offline', message: ADVISOR_TEXT.offline } : { kind: 'waiting' };
  }
  if (state.status === 'processing') {
    const at = ms(state.startedAt ?? state.requestedAt);
    return Number.isFinite(at) && t - at > ADVISOR_PROCESS_TIMEOUT_MS ? { kind: 'offline', message: ADVISOR_TEXT.stuck } : { kind: 'processing' };
  }
  if (state.status === 'error') return { kind: 'error', message: state.error || 'Неизвестная ошибка' };
  return { kind: 'done' };
}

/** Можно ли нажать кнопку снова (нет запроса в работе) */
export function canRequestAdvisor(view: AdvisorView): boolean {
  return view.kind !== 'waiting' && view.kind !== 'processing';
}

/** Текст ответа для Telegram */
export function formatAdvisorAnswer(a: AiAdvisorAnswer): string {
  const block = (title: string, items: string[]) => (items.length ? `${title}\n${items.map((s) => `- ${s}`).join('\n')}` : '');
  return [
    'Claude — советник по здоровью и жизни (анализ месяца)',
    a.question ? `Вопрос: ${a.question}` : '',
    a.answer ? `Ответ: ${a.answer}` : '',
    a.summary ? `Итог: ${a.summary}` : '',
    block('Что помогает:', a.good),
    block('Что мешает:', a.better),
    block('Что сделать:', a.boost),
  ]
    .filter(Boolean)
    .join('\n\n');
}
