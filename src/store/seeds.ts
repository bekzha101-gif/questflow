// Стартовые данные из брифинга (2026-11-17, раунды 3–6). Создаются один раз и помечены seed: true.
// Правило проекта: данные пользователя — единственный источник правды. Поэтому:
//  - цели, каналы, настройки Big Data сеются только в пустые таблицы (удалённые строки тоже считаются);
//  - награды сеются, только если ни одной награды из сидов ещё не было (удалённую не возвращаем);
//  - при подключённом облаке сначала дочитываем его; не прочитали — не сеем (повтор при следующем входе).
// Метка времени сидов старше любых правок: облако и правки пользователя всегда выигрывают.
import type { Store } from './core';
import { store as defaultStore } from './index';
import type { BigDataConfig, Channel, Goal, Reward } from '@shared/types';
import { SINGLE_KEY } from './tables';

export const SEED_TS = '2000-01-01T00:00:01.000Z';

const SEED_MONTH = '2026-11';

export const SEED_GOALS: Goal[] = [
  { id: 'seed-goal-2026-11-channels', month: SEED_MONTH, title: 'Запустить 40 YouTube-каналов и качественно их автоматизировать', kind: 'numeric', target: 40, unit: 'каналов', current: 0, status: 'active', seed: true },
  { id: 'seed-goal-2026-11-niche-tool', month: SEED_MONTH, title: 'Настроить инструмент глубокого анализа любой ниши по ссылке', kind: 'percent', target: 100, unit: '%', current: 0, status: 'active', seed: true },
  { id: 'seed-goal-2026-11-gamification', month: SEED_MONTH, title: 'Настроить всю систему геймификации', kind: 'percent', target: 100, unit: '%', current: 0, status: 'active', seed: true },
  { id: 'seed-goal-2026-11-clone', month: SEED_MONTH, title: 'Автоклонирование любого канала: видео как у него и автовыкладка на YouTube с описанием и обложкой', kind: 'percent', target: 100, unit: '%', current: 0, status: 'active', seed: true },
  { id: 'seed-goal-2026-11-trends', month: SEED_MONTH, title: 'Автопоиск хайп-новостей и трендов, чтобы заходить в эти ниши', kind: 'percent', target: 100, unit: '%', current: 0, status: 'active', seed: true },
  { id: 'seed-goal-2026-11-notes', month: SEED_MONTH, title: 'Разобрать заметки в телефоне, тетрадь и Telegram и применить идеи оттуда', kind: 'percent', target: 100, unit: '%', current: 0, status: 'active', seed: true },
];

export const SEED_CHANNELS: Channel[] = [
  { id: 'seed-ch-akkdlasa', name: 'AKKDLASA', niche: 'Шахматы', status: 'active', cadencePerDay: 1, editHoursMin: 2, editHoursMax: 3, color: '#10b981', seed: true },
  { id: 'seed-ch-beatiful-man', name: 'BEATIFUL MAN', niche: 'Выборы США, демократы — хайп-ниша', status: 'active', cadencePerDay: 2, editHoursMin: 3, editHoursMax: 5, color: '#8b5cf6', seed: true },
  { id: 'seed-ch-agent-code', name: 'AGENT CODE', niche: 'Трамп и его покупки: недвижимость, вещи, что с ними случилось', status: 'active', cadencePerDay: 1, color: '#f59e0b', seed: true },
  { id: 'seed-ch-army-analitics', name: 'ARMY ANALITICS', niche: 'Как работает вооружение: танки и т.п.', status: 'active', cadencePerDay: 0.5, color: '#f43f5e', seed: true },
  { id: 'seed-ch-trihgok', name: 'TRIHGOK', niche: 'Звёздные войны: разбор по частям', status: 'active', cadencePerDay: 0.5, color: '#38bdf8', seed: true },
];

export const SEED_CHANNEL_TASKS = [
  {
    id: 'seed-task-agent-code-thumbnails',
    title: 'AGENT CODE: сменить текст на 2 превью прошлых видео (риск страйка)',
    type: 'todo',
    kind: 'task',
    priority: 'p1',
    tags: ['AGENT CODE'],
    difficulty: 'medium',
    completed: false,
    subtasks: [],
    channelId: 'seed-ch-agent-code',
    seed: true,
  },
];

export const SEED_BIGDATA_CONFIG: BigDataConfig = {
  spheres: [
    { id: 'work', label: 'Work', description: 'Поработал нормально' },
    { id: 'work-plus', label: 'Work+', description: 'Сделал много дел качественно и быстро' },
    { id: 'tr', label: 'Tr', description: 'Потренировался' },
    { id: 'tr-plus', label: 'Tr+', description: 'Очень хорошо потренировался: выносливость, мышцы забил' },
    { id: 'soc', label: 'Soc', description: 'Общался с людьми' },
    { id: 'soc-plus', label: 'Soc+', description: 'Плотный нетворкинг: много общения, новые связи, обмен контактами' },
  ],
  criteria: [],
  supplements: [
    { id: 'erinamax', name: 'Erinamax', dose: '4 таб.' },
    { id: 'tiger-milk', name: 'Tiger Milk', dose: '8 таб.' },
  ],
  seed: true,
};

// Цены в золоте — стартовые (решение исполнителя, по спецификации правятся в магазине)
export const SEED_REWARDS: Reward[] = [
  { id: 'seed-rew-shawarma', title: 'Шаурма', cost: 60, type: 'real', icon: 'Sandwich', tier: 'small', timesPurchased: 0, seed: true },
  { id: 'seed-rew-pizza', title: 'Пицца', cost: 120, type: 'real', icon: 'Pizza', tier: 'small', timesPurchased: 0, seed: true },
  { id: 'seed-rew-chalap', title: 'Чалап', cost: 30, type: 'real', icon: 'CupSoda', tier: 'small', timesPurchased: 0, seed: true },
  { id: 'seed-rew-juice', title: 'Натуральный сок', cost: 40, type: 'real', icon: 'GlassWater', tier: 'small', timesPurchased: 0, seed: true },
  { id: 'seed-rew-bleach', title: 'Серия «Блича»', cost: 50, type: 'real', icon: 'Tv', tier: 'small', timesPurchased: 0, seed: true },
  { id: 'seed-rew-dr-stone', title: 'Серия «Доктора Стоуна»', cost: 50, type: 'real', icon: 'Tv', tier: 'small', timesPurchased: 0, seed: true },
  { id: 'seed-rew-mountains', title: 'Поездка в горы и купание в ледяной реке', cost: 1500, type: 'real', icon: 'Mountain', tier: 'big', timesPurchased: 0, seed: true },
  { id: 'seed-rew-ski', title: '2–3 дня горнолыжки на Иссык-Куле', cost: 5000, type: 'real', icon: 'MountainSnow', tier: 'big', timesPurchased: 0, seed: true },
];

/** Создать стартовые данные один раз. Пустота таблиц проверяется после загрузки облака. */
export async function ensureSeeds(storeArg?: Store): Promise<void> {
  const store = storeArg ?? defaultStore;
  if (store.isConnected && !(await store.whenReady())) return;

  const opts = { updatedAt: SEED_TS };

  if (!store.hasAnyRow('goals')) {
    for (const g of SEED_GOALS) store.upsert('goals', g, opts);
  }

  if (!store.hasAnyRow('channels2')) {
    for (const c of SEED_CHANNELS) store.upsert('channels2', c, opts);
    for (const t of SEED_CHANNEL_TASKS) if (!store.hasKey('tasks2', t.id)) store.upsert('tasks2', t, opts);
  }

  if (!store.hasKey('bigdata_config', SINGLE_KEY)) {
    store.upsert('bigdata_config', SEED_BIGDATA_CONFIG, opts);
  }

  if (!SEED_REWARDS.some((r) => store.hasKey('rewards2', r.id))) {
    for (const r of SEED_REWARDS) store.upsert('rewards2', r, opts);
  }
}
