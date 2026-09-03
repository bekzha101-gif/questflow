import React, { useState, useEffect } from 'react';
import { UserStats, NotificationItem } from '../types';
import { 
  FoodLogEntry, 
  SleepCycleEntry, 
  HealthDailyProtocol, 
  RecoveryLogEntry, 
  DamageIncident, 
  HealthAlarmConfig, 
  HealthAiReport,
  MealType,
  FoodFeeling
} from '../types/health';
import { 
  loadDailyProtocol, 
  saveDailyProtocol,
  loadFoodLogs, 
  saveFoodLogs, 
  loadSleepLogs, 
  saveSleepLogs, 
  loadDamageIncidents, 
  saveDamageIncidents, 
  loadRecoveryLogs, 
  saveRecoveryLogs,
  loadHealthAlarms,
  saveHealthAlarms,
  loadSavedAiReport,
  playHealthAlarmSound,
  scanHealthAlarms,
  generateHealthAiReport,
  getTodayDateString,
  getCurrentTimeString
} from '../utils/healthTracker';
import { 
  Heart, 
  Droplet, 
  Smartphone, 
  Bell, 
  Moon, 
  Footprints, 
  Utensils, 
  Sparkles, 
  ShieldAlert, 
  Plus, 
  CheckCircle2, 
  Clock, 
  Volume2, 
  RotateCcw, 
  TrendingUp, 
  AlertTriangle,
  History,
  Trash2,
  Calendar,
  Zap,
  Info
} from 'lucide-react';

interface HealthBioTrackerProps {
  stats: UserStats;
  onUpdateStats: (newStats: Partial<UserStats>) => void;
  onAddNotification?: (notif: NotificationItem) => void;
}

export function HealthBioTracker({
  stats,
  onUpdateStats,
  onAddNotification
}: HealthBioTrackerProps) {
  const today = getTodayDateString();

  // State
  const [protocol, setProtocol] = useState<HealthDailyProtocol>(() => loadDailyProtocol(today));
  const [foodLogs, setFoodLogs] = useState<FoodLogEntry[]>(loadFoodLogs);
  const [sleepLogs, setSleepLogs] = useState<SleepCycleEntry[]>(loadSleepLogs);
  const [damages, setDamages] = useState<DamageIncident[]>(loadDamageIncidents);
  const [recoveries, setRecoveries] = useState<RecoveryLogEntry[]>(loadRecoveryLogs);
  const [alarms, setAlarms] = useState<HealthAlarmConfig[]>(loadHealthAlarms);
  const [aiReport, setAiReport] = useState<HealthAiReport | null>(loadSavedAiReport);

  const [activeTab, setActiveTab] = useState<'today' | 'food' | 'sleep' | 'recovery' | 'alarms' | 'ai_report' | 'archive'>('today');

  // Food Form State
  const [foodTime, setFoodTime] = useState(getCurrentTimeString());
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [foodDesc, setFoodDesc] = useState('');
  const [feeling, setFeeling] = useState<FoodFeeling>('high_energy');

  // Sleep Form State
  const [bedTime, setBedTime] = useState('23:00');
  const [wakeTime, setWakeTime] = useState('07:30');
  const [sleepQuality, setSleepQuality] = useState<'deep_restful' | 'average' | 'restless'>('deep_restful');

  // Alarm scanner status
  const [scanStatus, setScanStatus] = useState(() => scanHealthAlarms(protocol, alarms));

  // Auto-scan timer every minute
  useEffect(() => {
    const timer = setInterval(() => {
      const result = scanHealthAlarms(protocol, alarms);
      setScanStatus(result);

      // If meditation time triggered right now
      if (result.isMeditationTime && !protocol.meditationDone) {
        playHealthAlarmSound('meditation');
      }
    }, 30000);

    return () => clearInterval(timer);
  }, [protocol, alarms]);

  // Persist protocol
  const updateProtocol = (patch: Partial<HealthDailyProtocol>) => {
    const updated = { ...protocol, ...patch };
    setProtocol(updated);
    saveDailyProtocol(updated);
  };

  // Water click (+1 glass = 250ml)
  const handleWaterClick = (index: number) => {
    const newGlasses = index + 1;
    const targetReached = newGlasses >= 8;
    updateProtocol({
      waterGlasses: newGlasses,
      waterTargetReached: targetReached
    });
    playHealthAlarmSound('heal');
  };

  // Meditation Complete
  const handleCompleteMeditation = () => {
    updateProtocol({
      meditationDone: true,
      meditationMissed: false
    });
    playHealthAlarmSound('meditation');

    if (onAddNotification) {
      onAddNotification({
        id: `med-${Date.now()}`,
        title: '🧘 Медитация выполнена!',
        message: 'Сессия осознанности зачтена. Здоровье защищено от штрафа.',
        time: getCurrentTimeString(),
        type: 'reward',
        read: false,
      });
    }
  };

  // Add Food Entry
  const handleAddFood = (e: React.FormEvent) => {
    e.preventDefault();
    if (!foodDesc.trim()) return;

    const entry: FoodLogEntry = {
      id: `food-${Date.now()}`,
      timestamp: new Date().toISOString(),
      date: today,
      time: foodTime,
      mealType,
      food: foodDesc.trim(),
      feeling,
    };

    const next = [entry, ...foodLogs];
    setFoodLogs(next);
    saveFoodLogs(next);
    setFoodDesc('');
  };

  const handleDeleteFood = (id: string) => {
    const next = foodLogs.filter(f => f.id !== id);
    setFoodLogs(next);
    saveFoodLogs(next);
  };

  // Add Sleep Entry
  const handleSaveSleep = (e: React.FormEvent) => {
    e.preventDefault();
    const [bH, bM] = bedTime.split(':').map(Number);
    const [wH, wM] = wakeTime.split(':').map(Number);

    let diffMinutes = (wH * 60 + wM) - (bH * 60 + bM);
    if (diffMinutes < 0) diffMinutes += 24 * 60; // crossed midnight

    const hours = Math.round((diffMinutes / 60) * 10) / 10;
    const score = hours >= 8 && hours <= 9 ? 95 : hours >= 7 ? 80 : 50;

    const entry: SleepCycleEntry = {
      id: `sleep-${Date.now()}`,
      date: today,
      bedTime,
      wakeTime,
      totalHours: hours,
      quality: sleepQuality,
      score,
    };

    const next = [entry, ...sleepLogs];
    setSleepLogs(next);
    saveSleepLogs(next);
    updateProtocol({ sleepHours: hours });

    // Check penalty for sleep < 7 hours
    if (hours < 7.0 && !protocol.penaltiesApplied.sleep) {
      applyDamage(10, 'sleep_deprived', `Недосып: сон ${hours} ч (меньше нормы 8-9 ч)`);
      updateProtocol({
        penaltiesApplied: { ...protocol.penaltiesApplied, sleep: true }
      });
    }
  };

  // Damage Application (-HP)
  const applyDamage = (amount: number, type: DamageIncident['type'], reason: string) => {
    const newHp = Math.max(0, stats.hp - amount);
    onUpdateStats({ hp: newHp });

    const incident: DamageIncident = {
      id: `dmg-${Date.now()}`,
      timestamp: new Date().toISOString(),
      date: today,
      reason,
      hpLost: amount,
      type,
    };

    const next = [incident, ...damages];
    setDamages(next);
    saveDamageIncidents(next);
    playHealthAlarmSound('alert');

    if (onAddNotification) {
      onAddNotification({
        id: `dmg-notif-${Date.now()}`,
        title: `💔 Здоровье снижено (-${amount} HP)`,
        message: reason,
        time: getCurrentTimeString(),
        type: 'damage',
        read: false,
      });
    }
  };

  // Active Recovery (+HP)
  const handleActiveRecovery = (type: RecoveryLogEntry['type'], title: string, hpGained: number) => {
    const newHp = Math.min(stats.maxHp, stats.hp + hpGained);
    onUpdateStats({ hp: newHp });

    const recovery: RecoveryLogEntry = {
      id: `rec-${Date.now()}`,
      timestamp: new Date().toISOString(),
      date: today,
      type,
      title,
      hpGained,
    };

    const next = [recovery, ...recoveries];
    setRecoveries(next);
    saveRecoveryLogs(next);
    playHealthAlarmSound('heal');

    if (onAddNotification) {
      onAddNotification({
        id: `rec-notif-${Date.now()}`,
        title: `✨ Активное восстановление (+${hpGained} HP)`,
        message: `${title}. Текущее здоровье: ${newHp}/${stats.maxHp} HP`,
        time: getCurrentTimeString(),
        type: 'reward',
        read: false,
      });
    }
  };

  // Run End-of-Day Check & Calculate Penalties
  const handleRunHealthAudit = () => {
    const penalties = { ...protocol.penaltiesApplied };
    let totalDmg = 0;

    // 1. Water check (< 8 glasses)
    if (protocol.waterGlasses < 8 && !penalties.water) {
      applyDamage(10, 'water', `Не выпито 2 литра воды (выпито ${protocol.waterGlasses}/8 стаканов)`);
      penalties.water = true;
      totalDmg += 10;
    }

    // 2. Phone 1h before sleep
    if (!protocol.phoneOff1Hour && !penalties.phoneOff) {
      applyDamage(10, 'phone_gadgets', 'Не убран телефон за 1 час до сна');
      penalties.phoneOff = true;
      totalDmg += 10;
    }

    // 3. Gadgets full off
    if (!protocol.gadgetsFullOff && !penalties.gadgetsOff) {
      applyDamage(10, 'phone_gadgets', 'Гаджеты не были полностью отключены перед сном');
      penalties.gadgetsOff = true;
      totalDmg += 10;
    }

    // 4. Meditation 17:15
    if (!protocol.meditationDone && !penalties.meditation) {
      applyDamage(10, 'meditation_missed', 'Пропущен будильник на медитацию в 17:15');
      penalties.meditation = true;
      totalDmg += 10;
    }

    // 5. Walk before sleep
    if (!protocol.walkBeforeSleep && !penalties.walk) {
      applyDamage(10, 'walk_missed', 'Не выполнена прогулка за 1 час до сна');
      penalties.walk = true;
      totalDmg += 10;
    }

    updateProtocol({ penaltiesApplied: penalties });

    if (totalDmg === 0) {
      playHealthAlarmSound('heal');
      alert('🌟 Отличная работа! Все параметры здоровья за сегодня соблюдены, штрафов нет!');
    }
  };

  // Generate AI Health Report
  const handleGenerateAiReport = () => {
    const report = generateHealthAiReport(protocol, foodLogs, sleepLogs, damages, recoveries);
    setAiReport(report);
    setActiveTab('ai_report');
  };

  // Health Status String
  const hpPercent = Math.round((stats.hp / stats.maxHp) * 100);
  const healthStatus = 
    hpPercent >= 90 ? { text: 'Идеальное состояние', color: 'text-emerald-400', border: 'border-emerald-500/30' } :
    hpPercent >= 60 ? { text: 'Стабильный уровень', color: 'text-amber-400', border: 'border-amber-500/30' } :
    hpPercent >= 30 ? { text: 'Истощение ресурса', color: 'text-orange-400', border: 'border-orange-500/30' } :
    { text: 'КРИТИЧЕСКИЙ УРОН', color: 'text-rose-500', border: 'border-rose-500/50' };

  return (
    <div className="space-y-5 max-w-5xl mx-auto py-2 select-none text-zinc-100">
      
      {/* ── Top Hero: Hardcore Health Resource Bar ────────────────────────────── */}
      <div className="bg-[#101014] border border-white/[0.08] rounded-3xl p-5 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-80 h-32 bg-rose-500/5 blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-950/40 border border-rose-500/30 flex items-center justify-center text-2xl shrink-0 shadow-lg">
              ❤️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Статистика Здоровья & Биоритмы
                </h2>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-zinc-900 border ${healthStatus.border} ${healthStatus.color}`}>
                  {healthStatus.text}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5 max-w-xl">
                Здоровье <strong>не восстанавливается автоматически</strong> со временем. Восстановление только через активные протоколы (детокс, баня, природа).
              </p>
            </div>
          </div>

          {/* Large HP Counter */}
          <div className="flex items-baseline gap-1.5 shrink-0 bg-[#16161c] px-4 py-2 rounded-2xl border border-white/[0.06]">
            <span className="text-2xl font-bold font-mono text-white">{stats.hp}</span>
            <span className="text-xs text-zinc-500 font-mono">/ {stats.maxHp} HP</span>
          </div>
        </div>

        {/* Dynamic HP Progress Bar */}
        <div className="mt-4 space-y-1.5">
          <div className="h-2.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-white/[0.05]">
            <div 
              className="h-full bg-gradient-to-r from-rose-600 via-rose-500 to-emerald-400 rounded-full transition-all duration-700"
              style={{ width: `${hpPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
            <span>Урон от пропусков: -10 HP за каждый пункт</span>
            <span>{hpPercent}% запаса жизненной силы</span>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center gap-1.5 mt-5 pt-3 border-t border-white/[0.06] overflow-x-auto text-xs">
          {[
            { id: 'today', label: 'Сегодняшний протокол', icon: Zap },
            { id: 'recovery', label: 'Активное восстановление', icon: RotateCcw },
            { id: 'food', label: 'Дневник питания', icon: Utensils },
            { id: 'sleep', label: 'Сон (Sleep Cycle)', icon: Moon },
            { id: 'alarms', label: 'Будильники & Таймеры', icon: Bell },
            { id: 'ai_report', label: '🤖 ИИ-Отчет & Будущее', icon: Sparkles },
            { id: 'archive', label: 'Архив ресурсов', icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer whitespace-nowrap ${
                  active 
                    ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm' 
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-rose-400' : 'text-zinc-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Active Alarm Banner (if triggered) ────────────────────────────────── */}
      {scanStatus.activeAlarmText && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-3.5 flex items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-2.5">
            <Bell className="w-5 h-5 text-amber-400 shrink-0" />
            <span className="text-xs text-amber-200 font-medium">
              {scanStatus.activeAlarmText}
            </span>
          </div>
          {scanStatus.isMeditationTime && !protocol.meditationDone && (
            <button
              onClick={handleCompleteMeditation}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shrink-0 cursor-pointer shadow-md"
            >
              ✓ Выполнил медитацию
            </button>
          )}
        </div>
      )}

      {/* ── 1. TODAY PROTOCOL ─────────────────────────────────────────────────── */}
      {activeTab === 'today' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            
            {/* 1. Water 2 Liters Card */}
            <div className="bg-[#111115] border border-white/[0.06] rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Droplet className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">2.0 литра чистой воды</h3>
                    <p className="text-[10px] text-zinc-500">8 стаканов по 250 мл • Иначе -10 HP</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-cyan-400">
                  {protocol.waterGlasses * 250} / 2000 мл
                </span>
              </div>

              {/* 8 Glass Interactive Buttons */}
              <div className="grid grid-cols-8 gap-1.5 pt-1">
                {Array.from({ length: 8 }).map((_, idx) => {
                  const filled = idx < protocol.waterGlasses;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleWaterClick(idx)}
                      className={`h-10 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold font-mono transition-all cursor-pointer ${
                        filled 
                          ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20' 
                          : 'bg-[#181820] border border-white/[0.05] text-zinc-600 hover:border-cyan-500/40'
                      }`}
                      title={`Стакан ${idx + 1} (250мл)`}
                    >
                      <span>💧</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-zinc-400">
                {protocol.waterGlasses >= 8 ? (
                  <span className="text-emerald-400 font-medium">✓ Норма гидратации (2.0L) выполнена!</span>
                ) : (
                  <span>Осталось выпить {8 - protocol.waterGlasses} стакана(ов) до конца дня</span>
                )}
              </p>
            </div>

            {/* 2. Meditation Alarm 17:15 Card */}
            <div className="bg-[#111115] border border-white/[0.06] rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-950/40 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">Будильник на медитацию (17:15)</h3>
                    <p className="text-[10px] text-zinc-500">Пропуск времени медитации = -10 HP</p>
                  </div>
                </div>
                <button
                  onClick={() => playHealthAlarmSound('meditation')}
                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white"
                  title="Тест колокола 432 Гц"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-[#16161c] border border-white/[0.04]">
                <div className="space-y-0.5">
                  <span className="text-xs text-zinc-300">
                    Статус: {protocol.meditationDone ? (
                      <strong className="text-emerald-400">✓ Завершена</strong>
                    ) : scanStatus.isMeditationMissed ? (
                      <strong className="text-rose-400">⚠ Пропущен будильник</strong>
                    ) : (
                      <strong className="text-amber-400">Ожидание 17:15</strong>
                    )}
                  </span>
                  <p className="text-[10px] text-zinc-500 font-mono">Таймер установлен на 17:15 каждый день</p>
                </div>

                {!protocol.meditationDone ? (
                  <button
                    onClick={handleCompleteMeditation}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-all cursor-pointer"
                  >
                    ✓ Выполнил
                  </button>
                ) : (
                  <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Зачтено
                  </span>
                )}
              </div>
            </div>

            {/* 3. Phone & Gadgets Full Off Card */}
            <div className="bg-[#111115] border border-white/[0.06] rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-950/40 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">Убрать телефон за 1 час до сна</h3>
                  <p className="text-[10px] text-zinc-500">Фулл отключение гаджетов • Иначе -10 HP</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#16161c] border border-white/[0.04] cursor-pointer">
                  <span className="text-xs text-zinc-300">Телефон убран в другую комнату за 1ч</span>
                  <input
                    type="checkbox"
                    checked={protocol.phoneOff1Hour}
                    onChange={(e) => updateProtocol({ phoneOff1Hour: e.target.checked })}
                    className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#16161c] border border-white/[0.04] cursor-pointer">
                  <span className="text-xs text-zinc-300">Полное отключение ноутбука и гаджетов</span>
                  <input
                    type="checkbox"
                    checked={protocol.gadgetsFullOff}
                    onChange={(e) => updateProtocol({ gadgetsFullOff: e.target.checked })}
                    className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* 4. Evening Walk Card */}
            <div className="bg-[#111115] border border-white/[0.06] rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Footprints className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">Прогулка за 1 час перед сном</h3>
                  <p className="text-[10px] text-zinc-500">Свежий воздух, нормализация пульса • Иначе -10 HP</p>
                </div>
              </div>

              <label className="flex items-center justify-between p-3 rounded-xl bg-[#16161c] border border-white/[0.04] cursor-pointer">
                <div className="space-y-0.5">
                  <span className="text-xs text-zinc-200 font-medium">Спокойная прогулка 20-30 минут</span>
                  <p className="text-[10px] text-zinc-500">Без спешки и без прослушивания токсичного контента</p>
                </div>
                <input
                  type="checkbox"
                  checked={protocol.walkBeforeSleep}
                  onChange={(e) => updateProtocol({ walkBeforeSleep: e.target.checked })}
                  className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                />
              </label>
            </div>

          </div>

          {/* End-of-Day Audit Button */}
          <div className="bg-[#101014] border border-white/[0.08] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-white">Проверка соблюдения био-протокола</h4>
              <p className="text-[11px] text-zinc-400">
                Автоматически оценивает день и списывает по -10 HP за каждый нарушенный пункт.
              </p>
            </div>
            <button
              onClick={handleRunHealthAudit}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all active:scale-95 cursor-pointer shadow-md"
            >
              Проверить и рассчитать HP за день
            </button>
          </div>
        </div>
      )}

      {/* ── 2. ACTIVE RECOVERY (HARDCORE) ─────────────────────────────────────── */}
      {activeTab === 'recovery' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 text-xs text-indigo-200">
            <p className="font-semibold text-white mb-1">Правило Невосстановимого Здоровья</p>
            HP не лечится «само по себе» от безделья. Здоровье восстанавливается исключительно глубокими восстановительными протоколами: баня, выезд на природу, длительный цифровой детокс.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                type: 'banya_sauna' as const,
                title: '🧖‍♂️ Баня / Сауна / Термы',
                desc: 'Глубокий термогенез, вывод токсинов, расслабление фасций',
                hp: 20,
              },
              {
                type: 'nature_walk' as const,
                title: '🌲 Выезд на природу (2+ часа)',
                desc: 'Лес, горы, парк без телефона. Повышение вариабельности ритма сердца (HRV)',
                hp: 15,
              },
              {
                type: 'digital_detox' as const,
                title: '📵 3 дня без информации и соцсетей',
                desc: 'Полный дофаминовый детокс. Восстановление рецепторов внимания',
                hp: 30,
              },
              {
                type: 'deep_sleep' as const,
                title: '😴 Качественный сон 8-9 часов',
                desc: 'Глубокая фаза сна более 20%, пробуждение без будильника',
                hp: 15,
              },
              {
                type: 'breathwork' as const,
                title: '🧘 Дыхательные практики 20+ мин',
                desc: 'Вим Хоф, коробка 4-4-4-4 или пранаяма для баланса вагуса',
                hp: 10,
              },
            ].map((rec) => (
              <div
                key={rec.type}
                className="bg-[#111115] border border-white/[0.06] rounded-2xl p-4 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white">{rec.title}</h4>
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md">
                      +{rec.hp} HP
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">{rec.desc}</p>
                </div>

                <button
                  onClick={() => {
                    if (window.confirm(`Активировать протокол «${rec.title}» и восстановить +${rec.hp} HP?`)) {
                      handleActiveRecovery(rec.type, rec.title, rec.hp);
                    }
                  }}
                  className="w-full py-2 rounded-xl bg-zinc-800 hover:bg-emerald-900/60 text-zinc-200 hover:text-emerald-300 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Зачесть восстановление (+{rec.hp} HP)
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 3. FOOD JOURNAL ("что кушал когда кушал") ─────────────────────────── */}
      {activeTab === 'food' && (
        <div className="space-y-4">
          {/* Add Food Form */}
          <form onSubmit={handleAddFood} className="bg-[#111115] border border-white/[0.06] rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <Utensils className="w-4 h-4 text-amber-400" />
              Добавить приём пищи в базу данных
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-zinc-500 uppercase block mb-1">Время</label>
                <input
                  type="time"
                  value={foodTime}
                  onChange={(e) => setFoodTime(e.target.value)}
                  className="w-full bg-[#181820] border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 uppercase block mb-1">Тип приёма</label>
                <select
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value as MealType)}
                  className="w-full bg-[#181820] border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="breakfast">🍳 Завтрак</option>
                  <option value="lunch">🍲 Обед</option>
                  <option value="dinner">🥗 Ужин</option>
                  <option value="snack">🍎 Перекус</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 uppercase block mb-1">Самочувствие</label>
                <select
                  value={feeling}
                  onChange={(e) => setFeeling(e.target.value as FoodFeeling)}
                  className="w-full bg-[#181820] border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="high_energy">⚡ Легкость & Энергия</option>
                  <option value="normal">👌 Нормально</option>
                  <option value="heavy">🛑 Тяжесть</option>
                  <option value="sleepy">😴 Сонливость</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] text-zinc-500 uppercase block mb-1">Что кушал (состав блюд)</label>
              <input
                type="text"
                value={foodDesc}
                onChange={(e) => setFoodDesc(e.target.value)}
                placeholder="Например: Гречка с куриной грудкой, огурцы, оливковое масло, вода"
                className="w-full bg-[#181820] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={!foodDesc.trim()}
              className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 disabled:opacity-30 text-zinc-950 font-bold text-xs cursor-pointer transition-all"
            >
              + Записать в дневник
            </button>
          </form>

          {/* Food Logs List */}
          <div className="space-y-2">
            <h4 className="text-xs font-mono text-zinc-500 px-1">История питания ({foodLogs.length})</h4>
            {foodLogs.length === 0 ? (
              <p className="text-xs text-zinc-600 text-center py-6">Записей питания пока нет</p>
            ) : (
              foodLogs.slice(0, 15).map((log) => (
                <div
                  key={log.id}
                  className="bg-[#111115] border border-white/[0.05] rounded-xl p-3 flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                      <span className="font-mono text-zinc-500">{log.time}</span>
                      <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-[10px] text-zinc-300">
                        {log.mealType === 'breakfast' ? 'Завтрак' : log.mealType === 'lunch' ? 'Обед' : log.mealType === 'dinner' ? 'Ужин' : 'Перекус'}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">{log.date}</span>
                    </div>
                    <p className="text-xs text-zinc-300 truncate">{log.food}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 border border-white/5 text-zinc-400">
                      {log.feeling === 'high_energy' ? '⚡ Энергия' : log.feeling === 'heavy' ? '🛑 Тяжесть' : log.feeling === 'sleepy' ? '😴 Клонит в сон' : 'Ок'}
                    </span>
                    <button
                      onClick={() => handleDeleteFood(log.id)}
                      className="p-1 text-zinc-600 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── 4. SLEEP CYCLE TRACKER ("8-9 часов сна") ──────────────────────────── */}
      {activeTab === 'sleep' && (
        <div className="space-y-4">
          <form onSubmit={handleSaveSleep} className="bg-[#111115] border border-white/[0.06] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <Moon className="w-4 h-4 text-indigo-400" />
                Трекер сна Sleep Cycle (Идеал: 8-9 часов)
              </h3>
              <span className="text-[10px] font-mono text-zinc-500">Сон &lt; 7ч = -10 HP</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-zinc-500 uppercase block mb-1">Время отбоя (заснул)</label>
                <input
                  type="time"
                  value={bedTime}
                  onChange={(e) => setBedTime(e.target.value)}
                  className="w-full bg-[#181820] border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 uppercase block mb-1">Время пробуждения</label>
                <input
                  type="time"
                  value={wakeTime}
                  onChange={(e) => setWakeTime(e.target.value)}
                  className="w-full bg-[#181820] border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 uppercase block mb-1">Оценка качества сна</label>
                <select
                  value={sleepQuality}
                  onChange={(e) => setSleepQuality(e.target.value as any)}
                  className="w-full bg-[#181820] border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="deep_restful">😴 Глубокий, бодрый (90%+)</option>
                  <option value="average">👌 Обычный сон</option>
                  <option value="restless">⚡ Беспокойный, прерывистый</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer transition-all"
            >
              Зафиксировать сон за прошлую ночь
            </button>
          </form>

          {/* Sleep History */}
          <div className="space-y-2">
            <h4 className="text-xs font-mono text-zinc-500 px-1">Журнал сна</h4>
            {sleepLogs.length === 0 ? (
              <p className="text-xs text-zinc-600 text-center py-6">Записей сна пока нет</p>
            ) : (
              sleepLogs.slice(0, 10).map((log) => (
                <div
                  key={log.id}
                  className="bg-[#111115] border border-white/[0.05] rounded-xl p-3 flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                      <span>{log.date}</span>
                      <span className="font-mono text-zinc-400">{log.bedTime} → {log.wakeTime}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Продолжительность: <strong className={log.totalHours >= 8 ? 'text-emerald-400' : log.totalHours < 7 ? 'text-rose-400' : 'text-amber-400'}>{log.totalHours} ч</strong>
                    </p>
                  </div>

                  <span className={`text-[10px] font-mono px-2.5 py-1 rounded-full ${
                    log.score >= 85 ? 'bg-emerald-950/60 text-emerald-300' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {log.score}/100 балл сна
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── 5. ALARMS & TIMERS ────────────────────────────────────────────────── */}
      {activeTab === 'alarms' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-[#111115] border border-white/[0.06] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-white">Автонапоминалка и Будильники</h3>
                <p className="text-[11px] text-zinc-400">Сканируют время в фоновом режиме со звуковым сигналом</p>
              </div>
              <button
                onClick={() => {
                  if ('Notification' in window) {
                    Notification.requestPermission().then((res) => {
                      alert(`Статус системных уведомлений: ${res}`);
                    });
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200"
              >
                Включить Web-Push
              </button>
            </div>

            <div className="space-y-2">
              {alarms.map((alarm, idx) => (
                <div
                  key={alarm.id}
                  className="p-3 rounded-xl bg-[#16161c] border border-white/[0.04] flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="time"
                      value={alarm.time}
                      onChange={(e) => {
                        const next = [...alarms];
                        next[idx].time = e.target.value;
                        setAlarms(next);
                        saveHealthAlarms(next);
                      }}
                      className="bg-black/50 border border-white/10 rounded-lg px-2 py-1 text-xs font-mono text-white focus:outline-none"
                    />
                    <span className="text-xs text-zinc-200 font-medium">{alarm.title}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => playHealthAlarmSound(alarm.type === 'meditation' ? 'meditation' : 'alert')}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-white"
                      title="Тест звука"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="checkbox"
                      checked={alarm.enabled}
                      onChange={(e) => {
                        const next = [...alarms];
                        next[idx].enabled = e.target.checked;
                        setAlarms(next);
                        saveHealthAlarms(next);
                      }}
                      className="w-4 h-4 rounded accent-purple-500 cursor-pointer"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 6. AI REPORT & FUTURE ADVICE ──────────────────────────────────────── */}
      {activeTab === 'ai_report' && (
        <div className="space-y-4">
          <div className="bg-[#111115] border border-purple-500/30 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">ИИ-Отчёт Взаимосвязей & Советы в Будущее</h3>
                  <p className="text-[11px] text-zinc-400">
                    Нейросетевой анализ корреляций между едой, сном, будильниками и уровнем здоровья
                  </p>
                </div>
              </div>
              <button
                onClick={handleGenerateAiReport}
                className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs cursor-pointer transition-all shadow-md"
              >
                🔄 Обновить анализ
              </button>
            </div>

            {!aiReport ? (
              <div className="py-10 text-center space-y-3">
                <p className="text-xs text-zinc-500">Нажмите кнопку выше, чтобы сгенерировать ИИ-отчет</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary */}
                <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/20 text-xs text-purple-200">
                  <span className="font-semibold text-white block mb-1">Сводка ресурса:</span>
                  {aiReport.resourceArchiveSummary}
                </div>

                {/* Correlations Grid */}
                <div className="space-y-2">
                  <h4 className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Выявленные взаимосвязи</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {aiReport.correlations.map((corr, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border ${
                          corr.impact === 'positive' 
                            ? 'bg-emerald-950/20 border-emerald-500/20' 
                            : 'bg-rose-950/20 border-rose-500/20'
                        }`}
                      >
                        <span className={`text-xs font-bold block mb-1 ${
                          corr.impact === 'positive' ? 'text-emerald-300' : 'text-rose-300'
                        }`}>
                          {corr.title}
                        </span>
                        <p className="text-[11px] text-zinc-300 leading-relaxed">{corr.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Long-term advice */}
                <div className="space-y-2 pt-2 border-t border-white/[0.06]">
                  <h4 className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
                    Персональные советы на годы и месяцы вперед
                  </h4>
                  <div className="space-y-2">
                    {aiReport.futureAdvice.map((adv, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-[#16161c] border border-white/[0.04]">
                        <span className="text-[10px] font-mono uppercase font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded">
                          {adv.period}
                        </span>
                        <p className="text-xs text-zinc-200 mt-1.5 leading-relaxed">{adv.recommendation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 7. ARCHIVE & DAMAGE LOG ───────────────────────────────────────────── */}
      {activeTab === 'archive' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Damage Incidents */}
            <div className="bg-[#111115] border border-white/[0.06] rounded-2xl p-4 space-y-2">
              <h4 className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Журнал урона по здоровью (-HP)
              </h4>
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                {damages.length === 0 ? (
                  <p className="text-xs text-zinc-600 text-center py-4">Урона не зафиксировано 🎉</p>
                ) : (
                  damages.map((dmg) => (
                    <div key={dmg.id} className="p-2.5 rounded-xl bg-rose-950/20 border border-rose-900/30 text-xs">
                      <div className="flex justify-between font-mono">
                        <span className="text-zinc-500 text-[10px]">{dmg.date}</span>
                        <span className="text-rose-400 font-bold">-{dmg.hpLost} HP</span>
                      </div>
                      <p className="text-zinc-300 text-[11px] mt-0.5">{dmg.reason}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recoveries */}
            <div className="bg-[#111115] border border-white/[0.06] rounded-2xl p-4 space-y-2">
              <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4" />
                Журнал активного восстановления (+HP)
              </h4>
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                {recoveries.length === 0 ? (
                  <p className="text-xs text-zinc-600 text-center py-4">Сессий восстановления пока нет</p>
                ) : (
                  recoveries.map((rec) => (
                    <div key={rec.id} className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-900/30 text-xs">
                      <div className="flex justify-between font-mono">
                        <span className="text-zinc-500 text-[10px]">{rec.date}</span>
                        <span className="text-emerald-400 font-bold">+{rec.hpGained} HP</span>
                      </div>
                      <p className="text-zinc-300 text-[11px] mt-0.5">{rec.title}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
