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

const RUSSIAN_DAY_OF_WEEK = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

export function createEmptyBigDataMonth(monthName: string = 'Август', year: number = 2026): MonthlyBigDataState {
  const days: DailyLogEntry[] = [];
  for (let day = 1; day <= 31; day++) {
    const date = new Date(year, 7, day);
    const dayOfWeek = RUSSIAN_DAY_OF_WEEK[date.getDay()];
    const dateStr = `${year}-08-${String(day).padStart(2, '0')}`;
    days.push({
      day,
      dayOfWeek,
      sleep: '',
      sleepMinutes: 0,
      sleepQualityPercent: undefined,
      supplements: '',
      score: null,
      why: '',
      tags: [],
      dateStr,
      isAutoSynced: false,
    });
  }

  return {
    monthName,
    year,
    sleepSync: {
      enabled: false,
      syncSource: 'apple_health',
      lastSyncedAt: '—',
      webhookToken: 'sc_token_7f9a21e4',
      autoCalculateScore: true,
    },
    biometrics: {
      weightKg: 0,
      waistCm: 0,
      armsCm: 0,
      calvesCm: 0,
      thighsCm: 0,
      bodyFatPercent: 0,
    },
    hormones: {
      testosteroneNmol: 0,
      estradiolNgL: 0,
      shbgNmol: 0,
      lh: 0,
      hematocrit: 0,
      lastTestDate: '—',
    },
    observations: '',
    monthlySummary: '',
    days,
  };
}

export const initialBigDataMonth: MonthlyBigDataState = createEmptyBigDataMonth();

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
