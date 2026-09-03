export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type FoodFeeling = 'high_energy' | 'normal' | 'heavy' | 'sleepy' | 'bloated';

export interface FoodLogEntry {
  id: string;
  timestamp: string; // ISO string
  date: string;      // YYYY-MM-DD
  time: string;      // HH:mm
  mealType: MealType;
  food: string;
  feeling: FoodFeeling;
  notes?: string;
}

export type SleepQuality = 'deep_restful' | 'average' | 'restless' | 'insomnia';

export interface SleepCycleEntry {
  id: string;
  date: string;        // YYYY-MM-DD
  bedTime: string;     // HH:mm
  wakeTime: string;    // HH:mm
  totalHours: number;  // e.g. 8.5
  quality: SleepQuality;
  deepSleepPercent?: number; // e.g. 24%
  score: number;       // 0-100
  notes?: string;
}

export interface HealthDailyProtocol {
  date: string;               // YYYY-MM-DD
  waterGlasses: number;       // Target: 8 glasses (250ml each = 2L)
  waterTargetReached: boolean;
  phoneOff1Hour: boolean;     // Убрать телефон за 1 час до сна
  gadgetsFullOff: boolean;    // Полное отключение гаджетов
  walkBeforeSleep: boolean;   // Прогулка за 1 час перед сном
  meditationAlarmTime: string;// Default "17:15"
  meditationDone: boolean;
  meditationMissed: boolean;
  sleepHours: number;
  penaltiesApplied: {
    water?: boolean;
    phoneOff?: boolean;
    gadgetsOff?: boolean;
    meditation?: boolean;
    walk?: boolean;
    sleep?: boolean;
  };
}

export type RecoveryType = 
  | 'digital_detox' 
  | 'banya_sauna' 
  | 'nature_walk' 
  | 'deep_sleep' 
  | 'breathwork';

export interface RecoveryLogEntry {
  id: string;
  timestamp: string;
  date: string;
  type: RecoveryType;
  title: string;
  hpGained: number;
  notes?: string;
}

export type DamageType = 
  | 'water' 
  | 'phone_gadgets' 
  | 'meditation_missed' 
  | 'sleep_deprived' 
  | 'walk_missed';

export interface DamageIncident {
  id: string;
  timestamp: string;
  date: string;
  reason: string;
  hpLost: number;
  type: DamageType;
}

export interface HealthAlarmConfig {
  id: string;
  title: string;
  time: string; // HH:mm
  enabled: boolean;
  type: 'meditation' | 'water' | 'walk' | 'gadgets_off' | 'sleep';
  soundEnabled: boolean;
  repeatDaily: boolean;
}

export interface HealthAiReport {
  generatedAt: string;
  overallHealthScore: number; // 0 - 100
  resourceArchiveSummary: string;
  correlations: {
    title: string;
    description: string;
    impact: 'positive' | 'negative' | 'neutral';
  }[];
  criticalRisks: string[];
  futureAdvice: {
    period: 'Ближайшие недели' | '3-6 месяцев' | '1-3 года';
    recommendation: string;
  }[];
}
