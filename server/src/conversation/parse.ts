// Разбор ответов вечернего разговора (текст или расшифровка голосового).
// Без AI: простые правила, которые легко проверить. Всё, что не разобралось, бот переспрашивает.

export interface Named {
  id: string;
  title: string;
}

/** Слова-единицы, по которым нельзя узнавать привычку («20 мин», «2 л») */
const UNIT_WORDS = new Set(['мин', 'минут', 'час', 'часа', 'часов', 'раз', 'шт', 'день', 'дня', 'дней']);
const NEGATIONS = new Set(['не', 'без', 'нет', 'ни']);

function normalize(text: string): string {
  return text.toLowerCase().replace(/ё/g, 'е');
}

function words(text: string): string[] {
  return normalize(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/** Похожие слова: общее начало ≥ 5 букв или отличаются только окончанием (вода/воду, омега/омегу) */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  const p = commonPrefix(a, b);
  if (p >= 5) return true;
  return p >= 3 && p >= Math.min(a.length, b.length) - 1;
}

/** Ключевые слова названия: буквенные, от 3 символов, без единиц измерения */
function keywords(title: string): string[] {
  return words(title).filter((w) => w.length >= 3 && /^\p{L}+$/u.test(w) && !UNIT_WORDS.has(w));
}

/**
 * Какие из пунктов (привычки, БАДы, каналы) названы в тексте.
 * «воду выпил, медитировал» → вода и медитация; «не медитировал» — не считается.
 */
export function matchNames<T extends Named>(text: string, items: T[]): T[] {
  const tokens = words(text);
  const positive = tokens.filter((_w, i) => !(i > 0 && NEGATIONS.has(tokens[i - 1])));
  return items.filter((item) => keywords(item.title).some((k) => positive.some((w) => sameWord(w, k))));
}

/** «7, потому что…» → {score: 7, why: 'потому что…'}; вне 1..10 или без числа — null */
export function parseScore(text: string): { score: number; why: string } | null {
  const m = text.match(/^\D*?(\d{1,3})(?:\s*(?:\/|из)\s*10)?/);
  if (!m) return null;
  const score = Number(m[1]);
  if (!(score >= 1 && score <= 10)) return null;
  const why = text
    .slice((m.index ?? 0) + m[0].length)
    .replace(/^[\s,.:;—–-]+/, '')
    .trim();
  return { score, why };
}

/** Сон текстом: «7ч 30м 85%», «6:45», «7.5 часов, качество 70» */
export function parseSleep(text: string): { sleepMin: number; quality?: number } | null {
  const t = normalize(text);
  let sleepMin: number | null = null;
  const hm = t.match(/(\d{1,2})\s*(?:ч|h|час\p{L}*|:)\s*(\d{1,2})\s*(?:м|m|мин)?/u);
  if (hm) sleepMin = Number(hm[1]) * 60 + Number(hm[2]);
  else {
    const h = t.match(/(\d{1,2}(?:[.,]\d+)?)\s*(?:ч|h|час)/u);
    if (h) sleepMin = Math.round(Number(h[1].replace(',', '.')) * 60);
  }
  if (sleepMin === null || sleepMin < 60 || sleepMin > 20 * 60) return null;
  const q = t.match(/(\d{1,3})\s*%/) ?? t.match(/качеств\p{L}*\s*(\d{1,3})/u);
  const quality = q ? Math.min(100, Number(q[1])) : undefined;
  return { sleepMin, quality };
}

/** Первое число в тексте как процент 0..100 */
export function parsePercent(text: string): number | null {
  const m = text.match(/(\d{1,3})/);
  if (!m) return null;
  return Math.min(100, Math.max(0, Number(m[1])));
}

/** Сумма: «$12,5» → 12.5; без числа — null */
export function parseMoney(text: string): number | null {
  const m = text.replace(/\s/g, '').match(/(\d+(?:[.,]\d+)?)/);
  return m ? Number(m[1].replace(',', '.')) : null;
}

/** Любое число (может быть дробным) */
export const parseNumber = parseMoney;

const NO_ANSWERS = new Set(['нет', 'не', 'ничего', 'никаких', 'никакие', 'не пил', 'пропустить', 'пропусти', 'пропуск', 'дальше', 'skip', 'no', '-', '0 нет']);

/** Ответ «нет / ничего / пропустить» целиком */
export function isNo(text: string): boolean {
  const t = normalize(text).replace(/[.!,]+$/g, '').trim();
  return NO_ANSWERS.has(t);
}

/** Список из текста: по строкам, а если строка одна — по запятым */
export function parseList(text: string): string[] {
  const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const parts = lines.length > 1 ? lines : text.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  return parts.map((s) => s.replace(/^\d+[.)]\s*/, '').trim()).filter(Boolean);
}
