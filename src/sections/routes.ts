// Маршруты сайта: 4 раздела (экран «Сегодня» с 20.11.2026 — вкладка внутри «Целей») и сведение старых id (палитра, ссылки, закладки) к новым.
// Чистые функции без React — на них стоят тесты.

export const SECTION_IDS = ['goals', 'channels', 'health', 'progress'] as const;

// Раздел приложения
export type SectionType = (typeof SECTION_IDS)[number];

// Старые id вкладок: открывают соответствующий новый раздел
export type LegacyTabId =
  | 'today'
  | 'quests'
  | 'tasks'
  | 'habits'
  | 'calendar'
  | 'shopping'
  | 'studio'
  | 'production'
  | 'team'
  | 'life'
  | 'bigdata'
  | 'tavern'
  | 'finances';

export type TabType = SectionType | LegacyTabId;

const LEGACY_TO_SECTION: Record<LegacyTabId, SectionType> = {
  today: 'goals',
  quests: 'goals',
  tasks: 'goals',
  habits: 'goals',
  calendar: 'goals',
  shopping: 'goals',
  studio: 'channels',
  production: 'channels',
  life: 'health',
  bigdata: 'health',
  tavern: 'progress',
  team: 'progress',
  finances: 'progress',
};

function isSection(id: string): id is SectionType {
  return (SECTION_IDS as readonly string[]).includes(id);
}

/** Раздел, к которому относится вкладка (старые id сводятся к новым) */
export function getSection(tab: TabType): SectionType {
  if (isSection(tab)) return tab;
  return LEGACY_TO_SECTION[tab] ?? 'goals';
}

/** Любая строка (из ссылки, закладки) → вкладка. Неизвестное, в том числе удалённые Shorts/Идеи/AI, открывает «Сегодня» */
export function resolveTab(id: string | null | undefined): TabType {
  if (!id) return 'today';
  if (isSection(id)) return id;
  return id in LEGACY_TO_SECTION ? (id as LegacyTabId) : 'today';
}

export type GoalsView = 'today' | 'tasks' | 'shopping' | 'calendar';
export type HealthView = 'health' | 'bigdata';
export type ProgressView = 'rewards' | 'finances';

/** Вкладка внутри «Целей», которую открывает id */
export function goalsViewFor(tab: TabType): GoalsView {
  if (tab === 'shopping') return 'shopping';
  if (tab === 'calendar') return 'calendar';
  if (tab === 'tasks') return 'tasks';
  return 'today';
}

export function healthViewFor(tab: TabType): HealthView {
  return tab === 'bigdata' ? 'bigdata' : 'health';
}

export function progressViewFor(tab: TabType): ProgressView {
  return tab === 'finances' ? 'finances' : 'rewards';
}
