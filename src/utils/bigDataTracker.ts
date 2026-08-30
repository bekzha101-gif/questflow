export type ActivityTag = 'Work' | 'Work+' | 'Tr' | 'Tr+' | 'Dr' | 'Dr+' | 'Soc' | 'Soc+' | 'NC' | 'NP' | 'ПП' | 'ПК' | 'Yr';

export interface DailyLogEntry {
  day: number;
  dayOfWeek: string;
  sleep: string; // e.g. "7ч 40м"
  sleepMinutes: number; // e.g. 460
  sleepQualityPercent?: number; // e.g. 88% from Sleep Cycle
  supplements: string; // e.g. "Кофеин 100 мг, Элеутерококк"
  score: number | null; // e.g. 6.8
  why: string; // e.g. "Хорошо поработал, закрыл все задачи"
  tags: ActivityTag[];
  dateStr: string;
  isAutoSynced?: boolean;
}

export interface BiometricsData {
  weightKg: number;
  waistCm: number;
  armsCm: number;
  calvesCm: number;
  thighsCm: number;
  bodyFatPercent?: number;
}

export interface HormoneData {
  testosteroneNmol: number;
  estradiolNgL: number;
  shbgNmol: number;
  lh: number;
  hematocrit: number;
  lastTestDate: string;
}

export interface SleepCycleSyncConfig {
  enabled: boolean;
  syncSource: 'apple_health' | 'google_health' | 'google_calendar' | 'webhook';
  lastSyncedAt?: string;
  webhookToken: string;
  autoCalculateScore: boolean;
}

export interface MonthlyBigDataState {
  monthName: string;
  year: number;
  days: DailyLogEntry[];
  biometrics: BiometricsData;
  hormones: HormoneData;
  observations: string;
  monthlySummary: string;
  sleepSync: SleepCycleSyncConfig;
}

export const initialBigDataMonth: MonthlyBigDataState = {
  monthName: 'Август',
  year: 2026,
  sleepSync: {
    enabled: true,
    syncSource: 'apple_health',
    lastSyncedAt: 'Сегодня, 07:45',
    webhookToken: 'sc_token_7f9a21e4',
    autoCalculateScore: true,
  },
  biometrics: {
    weightKg: 84.5,
    waistCm: 82,
    armsCm: 41,
    calvesCm: 40,
    thighsCm: 62,
    bodyFatPercent: 14.5,
  },
  hormones: {
    testosteroneNmol: 28.5,
    estradiolNgL: 22.0,
    shbgNmol: 31.0,
    lh: 5.2,
    hematocrit: 49.0,
    lastTestDate: '2026-08-15',
  },
  observations: `• Принимаю элеутерококк с утра — даёт ровный тонус без резких скачков кортизола.
• Сон от 7.5 часов напрямую коррелирует с оценкой дня выше 7.0 и наличием драйва (Dr).
• Продуктивные дни (Work+) лучше всего заходят после 25-минутных спринтов в фокус-режиме Shorts.
• Дни без срывов (NC + NP) дают ощущение чистого дофамина и уверенности.`,
  monthlySummary: `Отличный месяц! Выровнял режим сна (средний сон 7ч 25м), закрыл план по контенту для каналов, средняя оценка дня 6.9/10. Набрал сухую массу при стабильном уровне талии.`,
  days: [
    { day: 1, dayOfWeek: 'пн', sleep: '7ч 00м', sleepMinutes: 420, sleepQualityPercent: 82, supplements: 'Кофеин 100 мг, Элеутерококк', score: 6.2, why: 'Старт недели, легкий вход', tags: ['Tr', 'NC'], dateStr: '2026-08-01', isAutoSynced: true },
    { day: 2, dayOfWeek: 'вт', sleep: '7ч 40м', sleepMinutes: 460, sleepQualityPercent: 88, supplements: 'Зеленый чай, тирозин 350 мг', score: 6.7, why: 'Хороший фокус на монтаже', tags: ['Work', 'NC', 'ПП'], dateStr: '2026-08-02', isAutoSynced: true },
    { day: 3, dayOfWeek: 'ср', sleep: '6ч 30м', sleepMinutes: 390, sleepQualityPercent: 74, supplements: 'Нанотропил 100 мг, L-тирозин', score: 6.8, why: 'Много задач, но закрыл всё в срок', tags: ['Work', 'Dr', 'Soc', 'NC'], dateStr: '2026-08-03', isAutoSynced: true },
    { day: 4, dayOfWeek: 'чт', sleep: '7ч 50м', sleepMinutes: 470, sleepQualityPercent: 91, supplements: 'Витаминный комплекс, зеленый чай', score: 7.2, why: 'Отличная тренировка и мощный контент-план', tags: ['Work', 'Tr', 'Dr', 'Soc+', 'NC', 'NP'], dateStr: '2026-08-04', isAutoSynced: true },
    { day: 5, dayOfWeek: 'пт', sleep: '9ч 10м', sleepMinutes: 550, sleepQualityPercent: 95, supplements: 'Без добавок (день отдыха)', score: 6.0, why: 'Отоспался, восстановил силы', tags: ['Tr', 'NC', 'NP'], dateStr: '2026-08-05', isAutoSynced: true },
    { day: 6, dayOfWeek: 'сб', sleep: '7ч 00м', sleepMinutes: 420, sleepQualityPercent: 84, supplements: 'Кофе, ноотроп', score: 7.4, why: 'Запустили новое видео на канал', tags: ['Work+', 'Dr+', 'Soc', 'NC'], dateStr: '2026-08-06', isAutoSynced: true },
    { day: 7, dayOfWeek: 'вс', sleep: '5ч 20м', sleepMinutes: 320, sleepQualityPercent: 62, supplements: 'Кофе, элеутерококк', score: 5.9, why: 'Недосып, но держался бодро', tags: ['Soc', 'NC'], dateStr: '2026-08-07', isAutoSynced: true },
    { day: 8, dayOfWeek: 'пн', sleep: '6ч 50м', sleepMinutes: 410, sleepQualityPercent: 79, supplements: 'Магний, аминокислоты', score: 7.0, why: 'Четкое выполнение плана недели', tags: ['Work', 'Tr', 'Dr', 'Soc', 'NC', 'NP'], dateStr: '2026-08-08', isAutoSynced: true },
    { day: 9, dayOfWeek: 'вт', sleep: '5ч 15м', sleepMinutes: 315, sleepQualityPercent: 59, supplements: 'Элеутерококк, гуарана', score: 5.6, why: 'Ранний подъем, высокая нагрузка', tags: ['Work', 'Tr', 'NC'], dateStr: '2026-08-09', isAutoSynced: true },
    { day: 10, dayOfWeek: 'ср', sleep: '7ч 30м', sleepMinutes: 450, sleepQualityPercent: 86, supplements: 'Зеленый чай, B-комплекс', score: 6.9, why: 'Сбалансированный продуктивный день', tags: ['Work', 'NC', 'ПП'], dateStr: '2026-08-10', isAutoSynced: true },
    { day: 11, dayOfWeek: 'чт', sleep: '7ч 15м', sleepMinutes: 435, sleepQualityPercent: 85, supplements: 'Кофеин, L-теанин', score: 7.1, why: 'Отличный поток генерации идей', tags: ['Work', 'Dr', 'NC', 'NP'], dateStr: '2026-08-11', isAutoSynced: true },
    { day: 12, dayOfWeek: 'пт', sleep: '8ч 00м', sleepMinutes: 480, sleepQualityPercent: 93, supplements: 'Элеутерококк', score: 7.5, why: 'Силовая тренировка + монтаж', tags: ['Work', 'Tr+', 'Dr', 'NC', 'NP'], dateStr: '2026-08-12', isAutoSynced: true },
    { day: 13, dayOfWeek: 'сб', sleep: '7ч 45м', sleepMinutes: 465, sleepQualityPercent: 89, supplements: 'Витамин D3, Омега-3', score: 6.8, why: 'Отдых и встречи с друзьями', tags: ['Tr', 'Soc+', 'NC'], dateStr: '2026-08-13', isAutoSynced: true },
    { day: 14, dayOfWeek: 'вс', sleep: '8ч 10м', sleepMinutes: 490, sleepQualityPercent: 94, supplements: 'Зеленый чай', score: 7.3, why: 'Планирование недели, полный релакс', tags: ['Soc+', 'NC', 'NP', 'ПП'], dateStr: '2026-08-14', isAutoSynced: true },
    { day: 15, dayOfWeek: 'пн', sleep: '7ч 20м', sleepMinutes: 440, sleepQualityPercent: 87, supplements: 'Кофе, элеутерококк', score: 6.7, why: 'Ударный рабочий день', tags: ['Work', 'NC'], dateStr: '2026-08-15', isAutoSynced: true },
    { day: 16, dayOfWeek: 'вт', sleep: '6ч 40м', sleepMinutes: 400, sleepQualityPercent: 78, supplements: 'Тирозин 350 мг', score: 6.5, why: 'Хороший темп работы', tags: ['Dr', 'NC', 'NP'], dateStr: '2026-08-16', isAutoSynced: true },
    { day: 17, dayOfWeek: 'ср', sleep: '7ч 30м', sleepMinutes: 450, sleepQualityPercent: 88, supplements: 'Нанотропил, зеленый чай', score: 7.0, why: 'Тренировка на отлично', tags: ['Work', 'Tr', 'Dr', 'NC', 'NP'], dateStr: '2026-08-17', isAutoSynced: true },
    { day: 18, dayOfWeek: 'чт', sleep: '6ч 50м', sleepMinutes: 410, sleepQualityPercent: 81, supplements: 'Кофе, витамины', score: 6.4, why: 'Разбор аналитики видео', tags: ['Work', 'NC'], dateStr: '2026-08-18', isAutoSynced: true },
    { day: 19, dayOfWeek: 'пт', sleep: '7ч 10м', sleepMinutes: 430, sleepQualityPercent: 84, supplements: 'Элеутерококк', score: 6.6, why: 'Сдали 2 видео на рендеринг', tags: ['Work', 'Tr', 'NC', 'NP'], dateStr: '2026-08-19', isAutoSynced: true },
    { day: 20, dayOfWeek: 'сб', sleep: '8ч 00м', sleepMinutes: 480, sleepQualityPercent: 92, supplements: 'Омега-3, Магний', score: 7.2, why: 'Активный отдых, спорт', tags: ['Tr', 'Dr', 'Soc', 'NC'], dateStr: '2026-08-20', isAutoSynced: true },
    { day: 21, dayOfWeek: 'вс', sleep: '7ч 30м', sleepMinutes: 450, sleepQualityPercent: 88, supplements: 'Кофе, ноотроп', score: 7.0, why: 'Подготовка к новой неделе', tags: ['Soc+', 'NC', 'NP'], dateStr: '2026-08-21', isAutoSynced: true },
    { day: 22, dayOfWeek: 'пн', sleep: '7ч 15м', sleepMinutes: 435, sleepQualityPercent: 85, supplements: 'Элеутерококк, чай', score: 6.8, why: 'Фокус на главных задачах', tags: ['Work', 'NC', 'ПП'], dateStr: '2026-08-22', isAutoSynced: true },
    { day: 23, dayOfWeek: 'вт', sleep: '7ч 00м', sleepMinutes: 420, sleepQualityPercent: 83, supplements: 'Тирозин', score: 6.5, why: 'Обычный рабочий день', tags: ['Work', 'NC'], dateStr: '2026-08-23', isAutoSynced: true },
    { day: 24, dayOfWeek: 'ср', sleep: '6ч 45м', sleepMinutes: 405, sleepQualityPercent: 79, supplements: 'Кофеин 100 мг', score: 6.9, why: 'Тренировка + монтаж', tags: ['Work', 'Tr', 'NC', 'NP'], dateStr: '2026-08-24', isAutoSynced: true },
    { day: 25, dayOfWeek: 'чт', sleep: '7ч 20м', sleepMinutes: 440, sleepQualityPercent: 86, supplements: 'Элеутерококк', score: 7.0, why: 'Высокая концентрация', tags: ['Work', 'Tr', 'Dr', 'NC'], dateStr: '2026-08-25', isAutoSynced: true },
    { day: 26, dayOfWeek: 'пт', sleep: '6ч 30м', sleepMinutes: 390, sleepQualityPercent: 75, supplements: 'Элеутерококк', score: 6.3, why: 'Конец рабочей недели', tags: ['Work', 'NC'], dateStr: '2026-08-26', isAutoSynced: true },
    { day: 27, dayOfWeek: 'сб', sleep: '8ч 30м', sleepMinutes: 510, sleepQualityPercent: 96, supplements: 'Без добавок', score: 7.5, why: 'Прекрасный день на природе', tags: ['Tr', 'Dr', 'Soc+', 'NC', 'NP'], dateStr: '2026-08-27', isAutoSynced: true },
    { day: 28, dayOfWeek: 'вс', sleep: '7ч 40м', sleepMinutes: 460, sleepQualityPercent: 90, supplements: 'Элеутерококк', score: 7.2, why: 'Спорт, чтение, стратегический план', tags: ['Tr', 'Soc', 'NC', 'NP'], dateStr: '2026-08-28', isAutoSynced: true },
    { day: 29, dayOfWeek: 'пн', sleep: '7ч 25м', sleepMinutes: 445, sleepQualityPercent: 88, supplements: 'Кофе, адаптоген', score: 7.0, why: 'Сегодня: разработка фичей и контент', tags: ['Work+', 'Dr', 'NC', 'NP'], dateStr: '2026-08-29', isAutoSynced: true },
    { day: 30, dayOfWeek: 'вт', sleep: '', sleepMinutes: 0, supplements: 'Элеутерококк', score: null, why: '', tags: ['Work', 'Tr', 'NC'], dateStr: '2026-08-30' },
    { day: 31, dayOfWeek: 'ср', sleep: '', sleepMinutes: 0, supplements: 'Элеутерококк', score: null, why: '', tags: ['NC'], dateStr: '2026-08-31' },
  ],
};

export function calculateMonthlyStats(state: MonthlyBigDataState) {
  const scoredDays = state.days.filter((d) => d.score !== null);
  const avgScore = scoredDays.length > 0 
    ? (scoredDays.reduce((acc, d) => acc + (d.score || 0), 0) / scoredDays.length).toFixed(2)
    : '0.00';

  const daysWithSleep = state.days.filter((d) => d.sleepMinutes > 0);
  const avgSleepMinutes = daysWithSleep.length > 0
    ? Math.round(daysWithSleep.reduce((acc, d) => acc + d.sleepMinutes, 0) / daysWithSleep.length)
    : 0;

  const avgSleepHoursStr = `${Math.floor(avgSleepMinutes / 60)}ч ${avgSleepMinutes % 60}м`;

  // Tag counts
  const tagCounts: Record<string, number> = {};
  state.days.forEach((d) => {
    d.tags.forEach((t) => {
      const baseTag = t.replace('+', '');
      tagCounts[baseTag] = (tagCounts[baseTag] || 0) + 1;
    });
  });

  // Correlation: Sleep >= 7h20m (440m) vs Score
  const highSleepHours = state.days.filter((d) => d.sleepMinutes >= 440 && d.score !== null);
  const lowSleepHours = state.days.filter((d) => d.sleepMinutes < 440 && d.score !== null && d.sleepMinutes > 0);

  const avgHighSleepScore = highSleepHours.length > 0
    ? (highSleepHours.reduce((acc, d) => acc + (d.score || 0), 0) / highSleepHours.length).toFixed(2)
    : '0.00';

  const avgLowSleepScore = lowSleepHours.length > 0
    ? (lowSleepHours.reduce((acc, d) => acc + (d.score || 0), 0) / lowSleepHours.length).toFixed(2)
    : '0.00';

  // Dopamine Detox Consistency (NC + NP)
  const ncDays = state.days.filter((d) => d.tags.includes('NC')).length;
  const npDays = state.days.filter((d) => d.tags.includes('NP')).length;

  return {
    avgScore,
    avgSleepHoursStr,
    workDays: tagCounts['Work'] || 0,
    trainingDays: tagCounts['Tr'] || 0,
    driveDays: tagCounts['Dr'] || 0,
    socialDays: tagCounts['Soc'] || 0,
    ncDays,
    npDays,
    avgHighSleepScore,
    avgLowSleepScore,
    scoredDaysCount: scoredDays.length,
    totalDays: state.days.length,
  };
}
