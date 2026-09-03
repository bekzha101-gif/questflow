import { 
  FoodLogEntry, 
  SleepCycleEntry, 
  HealthDailyProtocol, 
  RecoveryLogEntry, 
  DamageIncident, 
  HealthAlarmConfig, 
  HealthAiReport 
} from '../types/health';

const KEYS = {
  DAILY_PREFIX: 'questflow_health_daily_',
  FOOD: 'questflow_health_food_v1',
  SLEEP: 'questflow_health_sleep_v1',
  DAMAGE: 'questflow_health_damage_v1',
  RECOVERY: 'questflow_health_recovery_v1',
  ALARMS: 'questflow_health_alarms_v1',
  AI_REPORT: 'questflow_health_ai_report_v1',
};

export function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

export function getCurrentTimeString(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export const DEFAULT_HEALTH_ALARMS: HealthAlarmConfig[] = [
  {
    id: 'alarm-meditation',
    title: '🧘 Будильник на медитацию',
    time: '17:15',
    enabled: true,
    type: 'meditation',
    soundEnabled: true,
    repeatDaily: true,
  },
  {
    id: 'alarm-walk',
    title: '🚶 Прогулка на свежем воздухе',
    time: '21:00',
    enabled: true,
    type: 'walk',
    soundEnabled: true,
    repeatDaily: true,
  },
  {
    id: 'alarm-gadgets',
    title: '📵 Отключение телефона и гаджетов (за 1ч до сна)',
    time: '22:00',
    enabled: true,
    type: 'gadgets_off',
    soundEnabled: true,
    repeatDaily: true,
  },
  {
    id: 'alarm-sleep',
    title: '😴 Отбой (сон 8-9 часов)',
    time: '23:00',
    enabled: true,
    type: 'sleep',
    soundEnabled: true,
    repeatDaily: true,
  },
];

export function getDefaultDailyProtocol(date = getTodayDateString()): HealthDailyProtocol {
  return {
    date,
    waterGlasses: 0,
    waterTargetReached: false,
    phoneOff1Hour: false,
    gadgetsFullOff: false,
    walkBeforeSleep: false,
    meditationAlarmTime: '17:15',
    meditationDone: false,
    meditationMissed: false,
    sleepHours: 8,
    penaltiesApplied: {},
  };
}

// ─── Storage Operations ──────────────────────────────────────────────────────

export function loadDailyProtocol(date = getTodayDateString()): HealthDailyProtocol {
  try {
    const raw = localStorage.getItem(`${KEYS.DAILY_PREFIX}${date}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading daily health protocol', e);
  }
  return getDefaultDailyProtocol(date);
}

export function saveDailyProtocol(protocol: HealthDailyProtocol) {
  try {
    localStorage.setItem(`${KEYS.DAILY_PREFIX}${protocol.date}`, JSON.stringify(protocol));
  } catch (e) {
    console.error('Error saving daily health protocol', e);
  }
}

export function loadFoodLogs(): FoodLogEntry[] {
  try {
    const raw = localStorage.getItem(KEYS.FOOD);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading food logs', e);
  }
  return [];
}

export function saveFoodLogs(logs: FoodLogEntry[]) {
  try {
    localStorage.setItem(KEYS.FOOD, JSON.stringify(logs));
  } catch (e) {
    console.error('Error saving food logs', e);
  }
}

export function loadSleepLogs(): SleepCycleEntry[] {
  try {
    const raw = localStorage.getItem(KEYS.SLEEP);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading sleep logs', e);
  }
  return [];
}

export function saveSleepLogs(logs: SleepCycleEntry[]) {
  try {
    localStorage.setItem(KEYS.SLEEP, JSON.stringify(logs));
  } catch (e) {
    console.error('Error saving sleep logs', e);
  }
}

export function loadDamageIncidents(): DamageIncident[] {
  try {
    const raw = localStorage.getItem(KEYS.DAMAGE);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading damage incidents', e);
  }
  return [];
}

export function saveDamageIncidents(incidents: DamageIncident[]) {
  try {
    localStorage.setItem(KEYS.DAMAGE, JSON.stringify(incidents));
  } catch (e) {
    console.error('Error saving damage incidents', e);
  }
}

export function loadRecoveryLogs(): RecoveryLogEntry[] {
  try {
    const raw = localStorage.getItem(KEYS.RECOVERY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading recovery logs', e);
  }
  return [];
}

export function saveRecoveryLogs(logs: RecoveryLogEntry[]) {
  try {
    localStorage.setItem(KEYS.RECOVERY, JSON.stringify(logs));
  } catch (e) {
    console.error('Error saving recovery logs', e);
  }
}

export function loadHealthAlarms(): HealthAlarmConfig[] {
  try {
    const raw = localStorage.getItem(KEYS.ALARMS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading health alarms', e);
  }
  return DEFAULT_HEALTH_ALARMS;
}

export function saveHealthAlarms(alarms: HealthAlarmConfig[]) {
  try {
    localStorage.setItem(KEYS.ALARMS, JSON.stringify(alarms));
  } catch (e) {
    console.error('Error saving health alarms', e);
  }
}

export function loadSavedAiReport(): HealthAiReport | null {
  try {
    const raw = localStorage.getItem(KEYS.AI_REPORT);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading AI report', e);
  }
  return null;
}

export function saveAiReport(report: HealthAiReport) {
  try {
    localStorage.setItem(KEYS.AI_REPORT, JSON.stringify(report));
  } catch (e) {
    console.error('Error saving AI report', e);
  }
}

// ─── Web Audio Alarm Chime & Sound Synthesizer ───────────────────────────────

export function playHealthAlarmSound(type: 'meditation' | 'alert' | 'heal') {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === 'meditation') {
      // Tibetan Singing Bowl / Zen Bell Sound
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(432, ctx.currentTime); // 432 Hz healing tone
      osc.frequency.exponentialRampToValueAtTime(216, ctx.currentTime + 3.0);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3.0);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 3.0);
    } else if (type === 'alert') {
      // Gentle warning ping
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.setValueAtTime(240, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } else if (type === 'heal') {
      // Pleasant harmonic chime
      const now = ctx.currentTime;
      [528, 660, 792].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);
        gain.gain.setValueAtTime(0.2, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 1.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 1.2);
      });
    }
  } catch (err) {
    console.warn('Audio playback error', err);
  }
}

// ─── Automated Alarm Scanner ─────────────────────────────────────────────────

export interface AlarmScanResult {
  isMeditationTime: boolean;
  isMeditationMissed: boolean;
  isBedtimeSoon: boolean;
  isGadgetsOffTime: boolean;
  activeAlarmText?: string;
}

export function scanHealthAlarms(
  protocol: HealthDailyProtocol,
  alarms = DEFAULT_HEALTH_ALARMS
): AlarmScanResult {
  const currentTime = getCurrentTimeString();
  const [currH, currM] = currentTime.split(':').map(Number);
  const currentMinutes = currH * 60 + currM;

  let isMeditationTime = false;
  let isMeditationMissed = false;
  let isBedtimeSoon = false;
  let isGadgetsOffTime = false;
  let activeAlarmText: string | undefined;

  const medAlarm = alarms.find((a) => a.type === 'meditation' && a.enabled) || { time: '17:15' };
  const [medH, medM] = medAlarm.time.split(':').map(Number);
  const medMinutes = medH * 60 + medM;

  // Between med time and med time + 15 mins
  if (!protocol.meditationDone && currentMinutes >= medMinutes && currentMinutes <= medMinutes + 15) {
    isMeditationTime = true;
    activeAlarmText = `🧘 Время медитации (${medAlarm.time})! Сделайте 10-15 минутную практику`;
  }

  // If passed med time + 20 mins and not done, mark as missed!
  if (!protocol.meditationDone && currentMinutes > medMinutes + 20) {
    isMeditationMissed = true;
  }

  // Gadgets off alarm
  const gadgetAlarm = alarms.find((a) => a.type === 'gadgets_off' && a.enabled) || { time: '22:00' };
  const [gH, gM] = gadgetAlarm.time.split(':').map(Number);
  const gadgetMinutes = gH * 60 + gM;
  if (!protocol.gadgetsFullOff && currentMinutes >= gadgetMinutes && currentMinutes <= gadgetMinutes + 60) {
    isGadgetsOffTime = true;
    if (!activeAlarmText) activeAlarmText = '📵 Пора отключить телефон и гаджеты за 1 час до сна!';
  }

  // Bedtime alarm
  const sleepAlarm = alarms.find((a) => a.type === 'sleep' && a.enabled) || { time: '23:00' };
  const [sH, sM] = sleepAlarm.time.split(':').map(Number);
  const sleepMinutes = sH * 60 + sM;
  if (currentMinutes >= sleepMinutes - 30 && currentMinutes <= sleepMinutes) {
    isBedtimeSoon = true;
    if (!activeAlarmText) activeAlarmText = '😴 Готовьтесь ко сну. Идеал для здоровья — 8-9 часов глубокого сна';
  }

  return {
    isMeditationTime,
    isMeditationMissed,
    isBedtimeSoon,
    isGadgetsOffTime,
    activeAlarmText,
  };
}

// ─── AI Health Correlations & Long-Term Advisor ──────────────────────────────

export function generateHealthAiReport(
  protocol: HealthDailyProtocol,
  foodLogs: FoodLogEntry[],
  sleepLogs: SleepCycleEntry[],
  damages: DamageIncident[],
  recoveries: RecoveryLogEntry[]
): HealthAiReport {
  // 1. Calculate health score
  const totalHpLost = damages.reduce((acc, d) => acc + d.hpLost, 0);
  const totalHpRecovered = recoveries.reduce((acc, r) => acc + r.hpGained, 0);

  // Avg sleep
  const avgSleep = sleepLogs.length > 0 
    ? sleepLogs.reduce((acc, s) => acc + s.totalHours, 0) / sleepLogs.length 
    : 7.8;

  // Water compliance
  const waterRate = protocol.waterGlasses >= 8 ? 100 : Math.round((protocol.waterGlasses / 8) * 100);

  // Base score
  let score = 85;
  if (avgSleep < 7) score -= 15;
  if (waterRate < 70) score -= 10;
  if (protocol.meditationMissed) score -= 10;
  if (!protocol.gadgetsFullOff) score -= 10;
  score = Math.max(20, Math.min(100, score));

  // 2. Discover Correlations
  const correlations = [];

  // Correlation: Late eating vs Sleep
  const lateMeals = foodLogs.filter((f) => {
    const h = Number(f.time.split(':')[0]);
    return h >= 21;
  });

  if (lateMeals.length > 0) {
    correlations.push({
      title: 'Ужин после 21:00 и глубина сна',
      description: `Зафиксировано ${lateMeals.length} поздних приёмов пищи. Поздний ужин смещает фазу глубокого сна (REM) на 45 минут, повышая утреннюю утомляемость и риск пропуска медитации 17:15.`,
      impact: 'negative' as const,
    });
  } else {
    correlations.push({
      title: 'Чистое окно перед сном (без тяжелой еды)',
      description: 'Отсутствие поздних приемов пищи стабилизирует выработку соматотропина и мелатонина ночью, ускоряя регенерацию клеток.',
      impact: 'positive' as const,
    });
  }

  // Correlation: Phone 1h before sleep
  if (!protocol.phoneOff1Hour) {
    correlations.push({
      title: 'Синий спектр экранов за 1 час до сна',
      description: 'Использование телефона перед сном блокирует естественный синтез мелатонина, сокращая общее время восстановительного сна на 1.2–1.8 часа.',
      impact: 'negative' as const,
    });
  } else {
    correlations.push({
      title: 'Цифровой детокс за 1 час до сна',
      description: 'Выключение смартфона нормализует циркадные ритмы и защищает нервную систему от кортизоловых скачков.',
      impact: 'positive' as const,
    });
  }

  // Correlation: 2 Liters Water
  if (protocol.waterGlasses >= 8) {
    correlations.push({
      title: 'Гидратация 2.0+ литра в день',
      description: 'Полноценный питьевой режим поддерживает вязкость крови в норме, снижая нагрузку на сердечно-сосудистую систему при умственном труде.',
      impact: 'positive' as const,
    });
  } else {
    correlations.push({
      title: 'Дефицит жидкости (< 2 л)',
      description: `Выпито ${protocol.waterGlasses * 250} мл из 2000 мл. Дегидратация даже на 2% снижает когнитивные способности мозга на 15% и провоцирует головную боль.`,
      impact: 'negative' as const,
    });
  }

  // Critical Risks
  const criticalRisks: string[] = [];
  if (totalHpLost > totalHpRecovered + 20) {
    criticalRisks.push('Общий баланс здоровья отрицательный: урон превышает активное восстановление. Требуется день детокса или сауна.');
  }
  if (avgSleep < 7) {
    criticalRisks.push('Хронический недосып (< 7 часов): снижает нейропластичность и истощает запасы дофамина.');
  }
  if (protocol.meditationMissed) {
    criticalRisks.push('Пропущен будильник осознанности (17:15): стресс накапливается без вечерней разгрузки.');
  }

  // Future Advice (Weeks, Months, Years)
  const futureAdvice = [
    {
      period: 'Ближайшие недели' as const,
      recommendation: 'Закрепить правило «21:30 без экранов» и 8 стаканов чистой воды. Выделить 1 день на неделе под активное восстановление (баня / выезд за город без телефона).',
    },
    {
      period: '3-6 месяцев' as const,
      recommendation: 'Сформировать устойчивый биоритм: 8.5 часов сна с отбоем до 23:00. При постоянной гидратации и медитации в 17:15 ваш персональный HP удержится на отметке 95+ единиц.',
    },
    {
      period: '1-3 года' as const,
      recommendation: 'Накопительный эффект: регулярные 3-дневные цифровые детоксы раз в квартал и нулевое использование гаджетов перед сном сохранят высокий митохондриальный потенциал, четкую память и замедлят биологическое старение организма на 3–5 лет.',
    },
  ];

  const report: HealthAiReport = {
    generatedAt: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
    overallHealthScore: score,
    resourceArchiveSummary: `Зафиксировано ${damages.length} инцидентов урона (-${totalHpLost} HP) и ${recoveries.length} сессий активного восстановления (+${totalHpRecovered} HP). Средний сон: ${avgSleep.toFixed(1)} ч.`,
    correlations,
    criticalRisks,
    futureAdvice,
  };

  saveAiReport(report);
  return report;
}
