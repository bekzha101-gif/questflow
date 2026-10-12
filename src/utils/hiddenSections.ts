import { useSyncExternalStore } from 'react';

// Разделы, которые можно спрятать переключателем на экране «Ещё».
// Скрытие только убирает раздел из интерфейса: данные и код остаются.
export type HideableSection = 'studio' | 'finances' | 'life_calendar' | 'ai';

export const HIDEABLE_SECTIONS: { id: HideableSection; label: string; description: string }[] = [
  { id: 'studio', label: 'Медиа', description: 'Канбан видео, каналы, идеи' },
  { id: 'finances', label: 'Финансы', description: 'Учёт доходов и расходов' },
  { id: 'life_calendar', label: 'Календарь жизни', description: 'Сетка на 80 лет внутри «Календаря»' },
  { id: 'ai', label: 'AI-помощники', description: 'AI-генератор квестов, AI-отчёты и AI-анализ' },
];

const STORAGE_KEY = 'questflow_hidden_sections_v1';

// По умолчанию скрыто всё из списка: так выбрал пользователь (12.10.2026)
const DEFAULT_HIDDEN: HideableSection[] = ['studio', 'finances', 'life_calendar', 'ai'];

let cache: HideableSection[] | null = null;
const listeners = new Set<() => void>();

function read(): HideableSection[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    cache = Array.isArray(parsed) ? parsed : DEFAULT_HIDDEN;
  } catch {
    cache = DEFAULT_HIDDEN;
  }
  return cache;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setSectionHidden(section: HideableSection, hidden: boolean): void {
  const current = read();
  cache = hidden
    ? current.includes(section) ? current : [...current, section]
    : current.filter((s) => s !== section);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error('Failed to save hidden sections:', e);
  }
  listeners.forEach((listener) => listener());
}

// Список скрытых разделов; компонент перерисуется, когда список меняется
export function useHiddenSections(): HideableSection[] {
  return useSyncExternalStore(subscribe, read);
}
