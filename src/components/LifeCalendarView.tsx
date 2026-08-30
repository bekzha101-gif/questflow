import React, { useState } from 'react';
import { 
  Hourglass, 
  Flame, 
  Settings, 
  TrendingUp, 
  Clock, 
  Zap, 
  Compass,
  AlertTriangle,
  ChevronRight,
  Sparkles
} from 'lucide-react';

export interface LifeZone {
  startAge: number;
  endAge: number;
  title: string;
  shortLabel: string;
  productivityPercent: number;
  colorName: string;
  badgeClass: string;
  accentColor: string;
  dropExplanation: string;
  description: string;
  keyAdvice: string;
  energyTrait: string;
}

export function LifeCalendarView() {
  // User Birthdate: 9 October 2007
  const [birthDateStr, setBirthDateStr] = useState<string>(() => {
    return localStorage.getItem('questflow_birth_date') || '2007-10-09';
  });

  const [targetYears, setTargetYears] = useState<number>(() => {
    return Number(localStorage.getItem('questflow_target_lifespan_years')) || 80;
  });

  const [calendarSubMode, setCalendarSubMode] = useState<'weeks' | 'zones' | 'current_year'>('weeks');
  const [hoveredWeek, setHoveredWeek] = useState<{ age: number; week: number; year: number; zone: LifeZone } | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Save settings
  const handleSaveConfig = (bDate: string, years: number) => {
    setBirthDateStr(bDate);
    setTargetYears(years);
    localStorage.setItem('questflow_birth_date', bDate);
    localStorage.setItem('questflow_target_lifespan_years', String(years));
    setIsConfigOpen(false);
  };

  // Calculations
  const birthDate = new Date(birthDateStr);
  const now = new Date();

  // Validate birth date
  const isValidDate = !isNaN(birthDate.getTime()) && birthDate < now;
  const safeBirthDate = isValidDate ? birthDate : new Date('2007-10-09');

  const diffMs = Math.max(0, now.getTime() - safeBirthDate.getTime());
  const livedDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const livedWeeks = Math.floor(livedDays / 7);
  const livedMonths = Math.floor(livedDays / 30.4375);
  const livedYearsFloat = livedDays / 365.25;
  const livedYears = Math.floor(livedYearsFloat);
  const exactAgeMonths = Math.floor((livedDays % 365.25) / 30.4375);

  const totalTargetDays = Math.floor(targetYears * 365.25);
  const totalTargetWeeks = targetYears * 52;
  const remainingDays = Math.max(0, totalTargetDays - livedDays);
  const remainingWeeks = Math.max(0, totalTargetWeeks - livedWeeks);
  const remainingYears = Math.max(0, targetYears - livedYears);

  const percentLived = Math.min(100, Math.max(0, (livedDays / totalTargetDays) * 100));

  // Current year calculations
  const startOfCurrentYear = new Date(now.getFullYear(), 0, 1);
  const daysPassedThisYear = Math.floor((now.getTime() - startOfCurrentYear.getTime()) / (1000 * 60 * 60 * 24));
  const isLeapYear = (now.getFullYear() % 4 === 0 && now.getFullYear() % 100 !== 0) || (now.getFullYear() % 400 === 0);
  const totalDaysThisYear = isLeapYear ? 366 : 365;
  const remainingDaysThisYear = totalDaysThisYear - daysPassedThisYear;

  // Weeks remaining in current peak zone (up to age 25)
  const weeksUntil25 = Math.max(0, 25 * 52 - livedWeeks);

  // ─── Real-World Biological & Productivity Zones ──────────────────────────
  const lifeZones: LifeZone[] = [
    {
      startAge: 0,
      endAge: 15,
      title: '0–14 лет: Детство & Школа',
      shortLabel: '0-14л',
      productivityPercent: 35,
      colorName: 'Синяя',
      badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      accentColor: '#60a5fa',
      dropExplanation: 'Зависимость от школы и родителей, несформированная кора мозга.',
      description: 'Период физического роста, школьного обучения и первичного знакомства с миром.',
      keyAdvice: 'Формирование крепкого иммунитета, любознательности и базовой дисциплины.',
      energyTrait: '🌱 Старт пути'
    },
    {
      startAge: 15,
      endAge: 25,
      title: '15–24 года: АБСОЛЮТНЫЙ БИО-ПИК',
      shortLabel: '15-24л (Пик)',
      productivityPercent: 100,
      colorName: 'Зеленая',
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      accentColor: '#34d399',
      dropExplanation: '0% спада. Максимум тестостерона, гормона роста и АТФ в клетках.',
      description: 'Максимальный пик нейропластичности мозга, скорости обучения, тестостерона и выносливости. Ноль бытовых обременений, ноль ипотек, мгновенное восстановление после недосыпа.',
      keyAdvice: '🔥 ВЫ НАХОДИТЕСЬ ЗДЕСЬ (18 лет)! Стройте медиа-каналы, хард-скиллы, капитал и тело прямо сейчас.',
      energyTrait: '⚡ 100% Биологический максимум, работа без выгорания'
    },
    {
      startAge: 25,
      endAge: 35,
      title: '25–34 года: Реализация & Спад -25%',
      shortLabel: '25-34л (-25%)',
      productivityPercent: 75,
      colorName: 'Желтая',
      badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
      accentColor: '#fbbf24',
      dropExplanation: 'Спад на -25%: Замедление митохондрий, появление семьи, быта, кредитов.',
      description: 'Энергия падает на 25%. Недосып выбивает из колеи на 2 суток. Появляются быт и семья, которые дробят фокус. Компенсируется опытом.',
      keyAdvice: 'Строгий режим сна, спорт, защита от выгорания, монетизация навыков.',
      energyTrait: '🟡 75% Био-энергия + Опыт и первые крупные деньги'
    },
    {
      startAge: 35,
      endAge: 50,
      title: '35–49 лет: Зрелость & Спад -45%',
      shortLabel: '35-49л (-45%)',
      productivityPercent: 55,
      colorName: 'Оранжевая',
      badgeClass: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
      accentColor: '#fb923c',
      dropExplanation: 'Спад на -45%: Падение тестостерона на 1% в год, износ суставов.',
      description: 'Физическая энергия падает почти вдвое. Работать по 12 часов вручную физически невозможно. Побеждают те, кто умеет строить команды и инвестировать.',
      keyAdvice: 'Полный отказ от ручной рутины. Делегирование, инвестиции, чекапы здоровья.',
      energyTrait: '🟠 55% Био-энергия, компенсируемая авторитетом и капиталом'
    },
    {
      startAge: 50,
      endAge: 65,
      title: '50–64 года: Спад Мощи -65%',
      shortLabel: '50-64л (-65%)',
      productivityPercent: 35,
      colorName: 'Красная',
      badgeClass: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
      accentColor: '#f43f5e',
      dropExplanation: 'Спад на -65%: "Ты уже не тот молодой и сильный". Хрупкий сон, риски для здоровья.',
      description: 'Организм теряет физическую мощь. Главный ресурс — ранее созданные активы, пассивный доход, авторитет и наставничество.',
      keyAdvice: 'Контроль биохимии, поддержание формы, управление инвестициями, наставничество.',
      energyTrait: '📉 35% Физической энергии, цена ошибок возрастает'
    },
    {
      startAge: 65,
      endAge: 90,
      title: '65+ лет: Мудрость & Наследие',
      shortLabel: '65+л (15%)',
      productivityPercent: 15,
      colorName: 'Фиолетовая',
      badgeClass: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
      accentColor: '#c084fc',
      dropExplanation: 'Спад на -85%: Естественное старение клеток, фокус на сохранении ясности ума.',
      description: 'Фокус на долголетии, сохранении ясности ума, общении с семьей и передаче мудрости.',
      keyAdvice: 'Ежедневные прогулки, чтение, спокойствие ума, наставничество.',
      energyTrait: '🌿 15% Физическая активность, 100% Мудрость'
    }
  ];

  const getZoneForAge = (age: number): LifeZone => {
    return lifeZones.find((z) => age >= z.startAge && age < z.endAge) || lifeZones[lifeZones.length - 1];
  };

  const currentZone = getZoneForAge(livedYears);

  return (
    <div className="space-y-4 animate-fade-in select-none text-zinc-300">
      
      {/* ─── 1. Minimalist Executive Metric Strip ───────────────────────────── */}
      <div className="bg-[#101014] border border-white/[0.07] rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        
        {/* Top Title Row */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shadow-sm shadow-rose-500" />
            <h2 className="text-sm font-bold text-white tracking-tight">Календарь Жизни</h2>
            <span className="text-[11px] font-mono text-zinc-500">
              09.10.2007 • <strong className="text-zinc-300">{livedYears} лет {exactAgeMonths} мес</strong>
            </span>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/40">
              🟢 Пик сил (100%)
            </span>
          </div>

          <button
            onClick={() => setIsConfigOpen(!isConfigOpen)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[11px] text-zinc-400 hover:text-white transition-all cursor-pointer"
          >
            <Settings className="w-3 h-3" />
            <span>Настройки</span>
          </button>
        </div>

        {/* Collapsible Settings */}
        {isConfigOpen && (
          <div className="p-3 rounded-xl bg-black/50 border border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs animate-fade-in">
            <div>
              <label className="block text-zinc-400 mb-1 text-[11px]">Дата рождения:</label>
              <input
                type="date"
                value={birthDateStr}
                onChange={(e) => setBirthDateStr(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-rose-500 text-xs"
              />
            </div>
            <div>
              <label className="block text-zinc-400 mb-1 text-[11px]">Ориентир жизни (лет):</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={50}
                  max={120}
                  value={targetYears}
                  onChange={(e) => setTargetYears(Number(e.target.value))}
                  className="w-20 bg-zinc-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-rose-500 text-xs"
                />
                <button
                  onClick={() => handleSaveConfig(birthDateStr, targetYears)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer"
                >
                  Применить
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4 Minimalist Metric Columns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-white/[0.04]">
          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.03]">
            <span className="text-[10px] text-zinc-500 uppercase font-mono block">Прожито дней</span>
            <div className="text-lg sm:text-xl font-bold font-mono text-rose-400 mt-0.5">
              {livedDays.toLocaleString()}
            </div>
            <span className="text-[10px] text-zinc-600 font-mono">{livedMonths} мес</span>
          </div>

          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.03]">
            <span className="text-[10px] text-zinc-500 uppercase font-mono block">Прожито недель</span>
            <div className="text-lg sm:text-xl font-bold font-mono text-rose-400 mt-0.5">
              {livedWeeks.toLocaleString()}
            </div>
            <span className="text-[10px] text-zinc-600 font-mono">из {totalTargetWeeks.toLocaleString()}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-emerald-500/20">
            <span className="text-[10px] text-emerald-400/80 uppercase font-mono block">До 25 лет (Пик)</span>
            <div className="text-lg sm:text-xl font-bold font-mono text-emerald-400 mt-0.5">
              {weeksUntil25} нед
            </div>
            <span className="text-[10px] text-emerald-500/60 font-mono">100% мощности</span>
          </div>

          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.03]">
            <span className="text-[10px] text-zinc-500 uppercase font-mono block">Прожито жизни</span>
            <div className="text-lg sm:text-xl font-bold font-mono text-zinc-200 mt-0.5">
              {percentLived.toFixed(1)}%
            </div>
            <span className="text-[10px] text-zinc-600 font-mono">~{remainingYears} лет впереди</span>
          </div>
        </div>

        {/* Minimalist 2px Life Line */}
        <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden relative">
          <div
            className="h-full bg-gradient-to-r from-rose-500 via-rose-400 to-emerald-400 rounded-full transition-all duration-700"
            style={{ width: `${percentLived}%` }}
          />
        </div>
      </div>

      {/* ─── 2. Clean Segmented Navigation ─────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2.5 flex-wrap">
        <div className="flex items-center gap-1.5 bg-[#101014] border border-white/[0.06] rounded-xl p-0.5 text-xs">
          <button
            onClick={() => setCalendarSubMode('weeks')}
            className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              calendarSubMode === 'weeks'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Сетка Недель (80 лет)
          </button>

          <button
            onClick={() => setCalendarSubMode('zones')}
            className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              calendarSubMode === 'zones'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Био-Зоны & Продуктивность
          </button>

          <button
            onClick={() => setCalendarSubMode('current_year')}
            className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              calendarSubMode === 'current_year'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Дни {now.getFullYear()} ({daysPassedThisYear}/{totalDaysThisYear})
          </button>
        </div>

        {/* Minimalist Legend */}
        {calendarSubMode === 'weeks' && (
          <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-[2px] bg-rose-500" />
              <span className="text-zinc-400">Прожито</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-[2px] bg-amber-400 animate-pulse" />
              <span className="text-amber-300">Сейчас (18 лет)</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-[2px] bg-zinc-800" />
              <span className="text-zinc-500">Будущее</span>
            </span>
          </div>
        )}
      </div>

      {/* ─── 3. SUB-MODE 1: Clean Minimalist Weeks Matrix ──────────────────── */}
      {calendarSubMode === 'weeks' && (
        <div className="bg-[#0b0b0e] border border-white/[0.06] rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3">
          
          {/* Subtle Life Era Spectrum Bar on top */}
          <div className="grid grid-cols-5 gap-1 text-[10px] font-mono pb-2 border-b border-white/[0.04]">
            <div className="p-1.5 rounded-lg bg-blue-950/30 border border-blue-500/10 text-center">
              <span className="text-blue-400 block font-bold">0–14 лет</span>
              <span className="text-zinc-500 text-[9px]">База (35%)</span>
            </div>
            <div className="p-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-center ring-1 ring-emerald-500/20">
              <span className="text-emerald-300 block font-bold">15–24 года</span>
              <span className="text-emerald-400 text-[9px]">🟢 Пик (100%)</span>
            </div>
            <div className="p-1.5 rounded-lg bg-amber-950/20 border border-amber-500/10 text-center">
              <span className="text-amber-400 block font-bold">25–34 года</span>
              <span className="text-zinc-500 text-[9px]">Спад -25% (75%)</span>
            </div>
            <div className="p-1.5 rounded-lg bg-orange-950/20 border border-orange-500/10 text-center">
              <span className="text-orange-400 block font-bold">35–49 лет</span>
              <span className="text-zinc-500 text-[9px]">Спад -45% (55%)</span>
            </div>
            <div className="p-1.5 rounded-lg bg-rose-950/20 border border-rose-500/10 text-center">
              <span className="text-rose-400 block font-bold">50+ лет</span>
              <span className="text-zinc-500 text-[9px]">Спад -65% (35%)</span>
            </div>
          </div>

          {/* Clean Weeks Grid */}
          <div className="overflow-x-auto pt-1">
            <div className="min-w-[700px] space-y-[2.5px]">
              {Array.from({ length: targetYears }).map((_, yearIdx) => {
                const isCurrentYear = yearIdx === livedYears;
                const zone = getZoneForAge(yearIdx);
                const isDecade = yearIdx % 10 === 0;

                return (
                  <div key={yearIdx} className="flex items-center gap-2 group">
                    {/* Age Label with Zone Indicators */}
                    <div className="w-20 sm:w-28 text-[10px] font-mono text-right shrink-0 flex items-center justify-end gap-1">
                      {isCurrentYear ? (
                        <span className="text-[9px] font-black text-amber-300 bg-amber-950/90 px-1.5 py-0.5 rounded-md border border-amber-400/60 shadow-md shadow-amber-950/60 animate-pulse flex items-center gap-0.5">
                          <span>👉</span> 18 лет (Пик)
                        </span>
                      ) : yearIdx === 25 ? (
                        <span className="text-[8px] text-amber-400 bg-amber-950/50 px-1 py-0.2 rounded border border-amber-800/40">
                          25г (-25%)
                        </span>
                      ) : yearIdx === 35 ? (
                        <span className="text-[8px] text-orange-400 bg-orange-950/50 px-1 py-0.2 rounded border border-orange-800/40">
                          35г (-45%)
                        </span>
                      ) : yearIdx === 50 ? (
                        <span className="text-[8px] text-rose-400 bg-rose-950/50 px-1 py-0.2 rounded border border-rose-800/40">
                          50г (-65%)
                        </span>
                      ) : isDecade ? (
                        <span className="text-zinc-400 font-bold">{yearIdx} лет</span>
                      ) : yearIdx % 5 === 0 ? (
                        <span className="text-zinc-600">{yearIdx} лет</span>
                      ) : (
                        <span className="text-zinc-800 text-[9px]">{yearIdx}</span>
                      )}
                    </div>


                    {/* 52 Week cells (Color-coded by Life Zones) */}
                    <div className="flex items-center gap-[2.5px] flex-1">
                      {Array.from({ length: 52 }).map((_, weekIdx) => {
                        const totalWeekIndex = yearIdx * 52 + weekIdx;
                        const isPast = totalWeekIndex < livedWeeks;
                        const isCurrent = totalWeekIndex === livedWeeks;

                        // Dynamic zone styling for future weeks
                        let cellClass = '';
                        if (isCurrent) {
                          cellClass = 'bg-amber-400 ring-2 ring-amber-400 scale-125 z-10 shadow-lg shadow-amber-400/50 animate-pulse';
                        } else if (isPast) {
                          cellClass = 'bg-rose-500 hover:bg-rose-400 shadow-sm shadow-rose-950/50';
                        } else {
                          // Future weeks colored by their biological zone
                          if (yearIdx < 15) {
                            cellClass = 'bg-blue-950/60 border border-blue-500/30 hover:bg-blue-600/40';
                          } else if (yearIdx < 25) {
                            // 🟢 15-24 Green Peak Zone (Current Era)
                            cellClass = 'bg-emerald-950/80 border border-emerald-500/40 hover:bg-emerald-500/50 shadow-sm shadow-emerald-950/30';
                          } else if (yearIdx < 35) {
                            // 🟡 25-34 Yellow Zone
                            cellClass = 'bg-amber-950/60 border border-amber-500/30 hover:bg-amber-500/50';
                          } else if (yearIdx < 50) {
                            // 🟠 35-49 Orange Zone
                            cellClass = 'bg-orange-950/60 border border-orange-500/30 hover:bg-orange-500/50';
                          } else if (yearIdx < 65) {
                            // 🔴 50-64 Red Zone (Power drop)
                            cellClass = 'bg-rose-950/60 border border-rose-500/30 hover:bg-rose-500/50';
                          } else {
                            // 🟣 65+ Purple Zone
                            cellClass = 'bg-purple-950/40 border border-purple-500/20 hover:bg-purple-500/40';
                          }
                        }

                        return (
                          <div
                            key={weekIdx}
                            onMouseEnter={() =>
                              setHoveredWeek({
                                age: yearIdx,
                                week: weekIdx + 1,
                                year: safeBirthDate.getFullYear() + yearIdx,
                                zone,
                              })
                            }
                            className={`h-2 sm:h-2.5 flex-1 min-w-[5px] rounded-[1.5px] transition-all cursor-pointer ${cellClass}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>


          {/* Minimalist Floating Hover Bar */}
          {hoveredWeek ? (
            <div className="p-2.5 rounded-xl bg-[#14141a] border border-white/10 flex items-center justify-between text-[11px] animate-fade-in font-mono">
              <span className="text-white">
                Возраст: <strong className="text-zinc-200">{hoveredWeek.age} лет</strong> ({hoveredWeek.year} год) • Неделя {hoveredWeek.week}/52
              </span>
              <span className="text-zinc-400">
                {hoveredWeek.age < livedYears ? (
                  <span className="text-rose-400">🔴 Прожито</span>
                ) : hoveredWeek.age === livedYears ? (
                  <span className="text-amber-400 font-bold">⚡ Сейчас (18 лет)</span>
                ) : (
                  <span>{hoveredWeek.zone.shortLabel} • {hoveredWeek.zone.productivityPercent}% мощности</span>
                )}
              </span>
            </div>
          ) : (
            <div className="text-center text-[10px] text-zinc-600 font-mono py-1">
              Наведите курсор на любую неделю для просмотра возраста и этапа
            </div>
          )}
        </div>
      )}

      {/* ─── 4. SUB-MODE 2: Minimalist Zones Breakdown ─────────────────────── */}
      {calendarSubMode === 'zones' && (
        <div className="bg-[#0b0b0e] border border-white/[0.06] rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-white/[0.04]">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Кривая Биологической Энергии & Спада
              </h3>
              <p className="text-[11px] text-zinc-500">
                Физиологические причины снижения продуктивности по возрастам
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-800/30">
              Ваш потенциал сейчас: 100%
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {lifeZones.map((zone, idx) => {
              const isCurrentZone = livedYears >= zone.startAge && livedYears < zone.endAge;

              return (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border transition-all space-y-2.5 ${
                    isCurrentZone
                      ? 'bg-emerald-950/20 border-emerald-500/40 ring-1 ring-emerald-500/20'
                      : 'bg-[#101014] border-white/[0.05]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${zone.badgeClass}`}>
                          {zone.colorName}
                        </span>
                        {isCurrentZone && (
                          <span className="text-[9px] font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/30">
                            Вы сейчас здесь
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-xs text-white mt-1">{zone.title}</h4>
                    </div>

                    <div className="text-right">
                      <span className="text-lg font-black font-mono text-zinc-200">
                        {zone.productivityPercent}%
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    {zone.description}
                  </p>

                  <div className="p-2 rounded-lg bg-black/40 border border-white/[0.04] text-[10px] text-zinc-400 font-mono">
                    <strong className="text-zinc-300">Спад: </strong> {zone.dropExplanation}
                  </div>

                  <div className="text-[11px] text-zinc-300 pt-1 border-t border-white/[0.04]">
                    <span className="text-zinc-500">Фокус: </span> {zone.keyAdvice}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── 5. SUB-MODE 3: Current Year Days ───────────────────────────────── */}
      {calendarSubMode === 'current_year' && (
        <div className="bg-[#0b0b0e] border border-white/[0.06] rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-white/[0.04]">
            <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              {now.getFullYear()} Год • Прожито {daysPassedThisYear} из {totalDaysThisYear} дней
            </span>
            <span className="text-xs font-mono text-rose-400 font-bold">
              Осталось: {remainingDaysThisYear} дней
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {[
              'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
              'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'
            ].map((mName, mIdx) => {
              const daysInThisM = new Date(now.getFullYear(), mIdx + 1, 0).getDate();
              const isPastMonth = mIdx < now.getMonth();
              const isCurrentMonth = mIdx === now.getMonth();

              return (
                <div key={mIdx} className="bg-[#101014] border border-white/[0.04] rounded-xl p-2 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className={isCurrentMonth ? 'text-amber-300' : isPastMonth ? 'text-rose-400' : 'text-zinc-500'}>
                      {mName}
                    </span>
                    <span className="text-[8px] font-mono text-zinc-600">{daysInThisM}д</span>
                  </div>

                  <div className="grid grid-cols-7 gap-[2px]">
                    {Array.from({ length: daysInThisM }).map((_, dIdx) => {
                      const dayNumber = dIdx + 1;
                      const dateObj = new Date(now.getFullYear(), mIdx, dayNumber);
                      const isPastDay = dateObj < new Date(now.getFullYear(), now.getMonth(), now.getDate());
                      const isToday = dateObj.toDateString() === now.toDateString();

                      return (
                        <div
                          key={dIdx}
                          title={`${dayNumber} ${mName}`}
                          className={`h-2 rounded-[1px] transition-all cursor-pointer ${
                            isToday
                              ? 'bg-amber-400 ring-1 ring-amber-400 scale-125 z-10'
                              : isPastDay
                              ? 'bg-rose-500'
                              : 'bg-zinc-800'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Minimalist Memento Mori Quote */}
      <div className="p-3 rounded-xl bg-[#101014] border border-white/[0.04] flex items-center justify-between text-[11px] text-zinc-400 font-mono">
        <span className="flex items-center gap-1.5 text-zinc-300">
          <Compass className="w-3.5 h-3.5 text-rose-400" />
          <span><strong>Memento Mori:</strong> Каждый день в 18 лет имеет наивысшую отдачу.</span>
        </span>
        <span className="text-zinc-600 hidden sm:block">QuestFlow Life Matrix</span>
      </div>
    </div>
  );
}
