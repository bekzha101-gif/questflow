import React, { useState } from 'react';
import { TaskItem, Project, GoogleCalendarConfig, Priority, TimeLogEntry, UserStats } from '../types';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  Circle, 
  Plus, 
  Copy, 
  Check,
  CalendarDays,
  X,
  Flame,
  Coffee,
  Bell,
  Sparkles
} from 'lucide-react';
import { downloadIcsFile } from '../utils/calendarSync';
import { playQuestCompleteSound, playCoinSound } from '../utils/sound';
import { triggerQuestConfetti } from '../utils/confetti';
import { LifeCalendarView } from './LifeCalendarView';
import { 
  loadRecoveryCycleConfig, 
  saveRecoveryCycleConfig, 
  getDayCycleInfo, 
  requestDesktopNotificationPermission, 
  loadCompletedRecoveryActivities, 
  saveCompletedRecoveryActivities, 
  RecoveryCycleConfig, 
  RecoveryActivity 
} from '../utils/recoveryCycle';

interface CalendarTimeBlockingProps {
  tasks: TaskItem[];
  projects: Project[];
  calendarConfig: GoogleCalendarConfig;
  timeLogs?: TimeLogEntry[];
  onSyncCalendar: () => void;
  onOpenCalendarModal: () => void;
  onOpenQuickAdd: () => void;
  onToggleTask?: (taskId: string) => void;
  onUpdateStats?: (newStats: Partial<UserStats>) => void;
  onAwardRewards?: (exp: number, gold: number, hp?: number) => void;
}

export const CalendarTimeBlocking: React.FC<CalendarTimeBlockingProps> = ({
  tasks,
  projects,
  calendarConfig,
  timeLogs = [],
  onSyncCalendar,
  onOpenCalendarModal,
  onOpenQuickAdd,
  onToggleTask,
  onUpdateStats,
  onAwardRewards,
}) => {
  const [viewDate, setViewDate] = useState<Date>(() => new Date());
  const [viewMode, setViewMode] = useState<'month' | 'day_timeline' | 'life_calendar'>('month');
  const [selectedDayTasks, setSelectedDayTasks] = useState<{ 
    dateStr: string; 
    tasks: TaskItem[]; 
    timeLogs: TimeLogEntry[]; 
  } | null>(null);


  const [copiedFeed, setCopiedFeed] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Recovery cycle state (7 work days + 1 recovery day)
  const [recoveryConfig, setRecoveryConfig] = useState<RecoveryCycleConfig>(loadRecoveryCycleConfig);
  const [completedActivitiesMap, setCompletedActivitiesMap] = useState<Record<string, string[]>>(loadCompletedRecoveryActivities);
  const [isPushGranted, setIsPushGranted] = useState<boolean>(() => {
    return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
  });

  const handleRequestPush = async () => {
    const granted = await requestDesktopNotificationPermission();
    setIsPushGranted(granted);
    if (granted) {
      alert('🔔 Системные уведомления macOS успешно активированы! QuestFlow предупредит вас за 24 часа до дня активного восстановления.');
    } else {
      alert('⚠️ Разрешение на системные уведомления не получено. Проверьте настройки уведомлений браузера или macOS.');
    }
  };

  const handleSetCycleStartDate = (dateStr: string) => {
    const nextConfig = { ...recoveryConfig, cycleStartDate: dateStr };
    setRecoveryConfig(nextConfig);
    saveRecoveryCycleConfig(nextConfig);
    playQuestCompleteSound();
    triggerQuestConfetti();
    alert(`✅ Дата ${dateStr} успешно установлена как начало цикла! Теперь от этой даты отсчитываются 7 рабочих дней (зеленые) и 8-й день восстановления (красный).`);
  };

  const handleToggleActivity = (dateStr: string, act: RecoveryActivity) => {
    const currentList = completedActivitiesMap[dateStr] || [];
    const isDone = currentList.includes(act.id);
    const updatedList = isDone 
      ? currentList.filter((id) => id !== act.id)
      : [...currentList, act.id];

    const nextMap = { ...completedActivitiesMap, [dateStr]: updatedList };
    setCompletedActivitiesMap(nextMap);
    saveCompletedRecoveryActivities(nextMap);

    if (!isDone) {
      playQuestCompleteSound();
      playCoinSound();
      triggerQuestConfetti();
      if (onAwardRewards) {
        onAwardRewards(act.expReward, act.goldReward, act.hpReward);
      } else if (onUpdateStats) {
        onUpdateStats({ hp: act.hpReward });
      }
    }
  };

  const prevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setViewDate(new Date());
  };

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];
  const currentMonthName = monthNames[viewDate.getMonth()];
  const currentYear = viewDate.getFullYear();

  const weekDays = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];

  const firstDayOfWeek = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 0).getDate();

  const totalCellsNeeded = firstDayOfWeek + daysInMonth;
  const trailingDaysCount = (7 - (totalCellsNeeded % 7)) % 7;

  const todayStr = new Date().toISOString().split('T')[0];


  const handleManualSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      onSyncCalendar();
      setIsSyncing(false);
    }, 600);
  };

  const handleCopyFeedUrl = () => {
    navigator.clipboard.writeText('webcal://questflow.app/api/calendar/feed-demo.ics');
    setCopiedFeed(true);
    setTimeout(() => setCopiedFeed(false), 2000);
  };

  const handleTaskCheck = (t: TaskItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleTask) {
      if (!t.completed) {
        playQuestCompleteSound();
        playCoinSound();
        triggerQuestConfetti();
      }
      onToggleTask(t.id);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-4 sm:py-6 px-2 sm:px-4 space-y-4">
      
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-[#111115] border border-white/[0.08] rounded-2xl p-3.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-300">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-xs text-zinc-100">{calendarConfig.calendarName}</h2>
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
            </div>
            <p className="text-[11px] text-zinc-500 font-mono">
              Двусторонняя синхронизация Google Calendar
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
          {/* View Mode Toggle */}
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-1 flex items-center gap-1 text-xs">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                viewMode === 'month' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Сетка Месяца
            </button>
            <button
              onClick={() => setViewMode('day_timeline')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                viewMode === 'day_timeline' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Тайм-Блокинг
            </button>
            <button
              onClick={() => setViewMode('life_calendar')}
              className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'life_calendar'
                  ? 'bg-gradient-to-r from-rose-600 to-purple-600 text-white shadow-md shadow-rose-950/50'
                  : 'text-rose-400 hover:text-rose-300'
              }`}
            >
              <span>⏳ Календарь Жизни</span>
            </button>
          </div>


          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs font-medium text-zinc-300 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sync...' : 'Синхронизировать'}</span>
          </button>

          <button
            onClick={() => downloadIcsFile(tasks)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs shadow transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>.ICS</span>
          </button>
        </div>
      </div>

      {viewMode === 'life_calendar' ? (
        <LifeCalendarView />
      ) : viewMode === 'month' ? (
        /* Month Grid */
        <div className="bg-[#09090c] border border-white/[0.08] rounded-3xl p-4 sm:p-6 shadow-2xl">

          
          {/* Month Header */}
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
              {currentMonthName} {currentYear}
            </h1>

            {/* Navigation: < Today > */}
            <div className="flex items-center gap-1.5 text-xs">
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                onClick={goToToday}
                className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs font-medium text-zinc-300 transition-colors"
              >
                Today
              </button>

              <button
                onClick={nextMonth}
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-white transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 7+1 Active Recovery Cycle Legend & Push Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 mb-4 px-3.5 py-2.5 rounded-2xl bg-[#121217] border border-white/[0.07] text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-emerald-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                <span className="font-semibold">7 дней: Рабочий фокус</span>
              </div>
              <span className="text-zinc-600 hidden sm:inline">•</span>
              <div className="flex items-center gap-1.5 text-rose-300">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)] animate-pulse" />
                <span className="font-semibold">8-й день: Активное восстановление (баня, бассейн, детокс)</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRequestPush}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border flex items-center gap-1.5 transition-all tactile-btn ${
                  isPushGranted
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-300'
                }`}
                title="Включить системные оповещения macOS за 24 часа до детокса"
              >
                <Bell className={`w-3 h-3 ${isPushGranted ? 'text-emerald-400' : 'text-zinc-400'}`} />
                <span>{isPushGranted ? 'Push 24ч активен' : 'Включить Push macOS'}</span>
              </button>
            </div>
          </div>

          {/* Weekday Names */}
          <div className="grid grid-cols-7 gap-px mb-2 text-center">
            {weekDays.map((day) => (
              <div key={day} className="text-[11px] font-bold text-zinc-500 tracking-wider py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {/* Leading days */}
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => {
              const dayNum = daysInPrevMonth - firstDayOfWeek + idx + 1;
              return (
                <div
                  key={`leading-${idx}`}
                  className="min-h-[85px] sm:min-h-[110px] rounded-2xl bg-[#0d0d10]/40 border border-white/[0.02] p-2 opacity-30 select-none"
                >
                  <span className="text-xs font-mono text-zinc-600">{dayNum}</span>
                </div>
              );
            })}

            {/* Month days */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateStr = `${viewDate.getFullYear()}-${(viewDate.getMonth() + 1).toString().padStart(2, '0')}-${dayNum.toString().padStart(2, '0')}`;
              const isToday = dateStr === todayStr;

              const cycleInfo = getDayCycleInfo(dateStr, recoveryConfig);
              const isCycleRecovery = cycleInfo.isRecoveryDay;

              const dayTasks = tasks.filter((t) => {
                if (t.dueDate === dateStr) return true;
                if (t.type === 'daily') return true;
                return false;
              });

              const dayTimeLogs = timeLogs.filter((tl) => tl.startedAt.startsWith(dateStr));
              const focusMins = dayTimeLogs
                .filter((tl) => tl.mode === 'work')
                .reduce((sum, tl) => sum + tl.actualMinutes, 0);

              return (
                <div
                  key={`day-${dayNum}`}
                  onClick={() => setSelectedDayTasks({ dateStr, tasks: dayTasks, timeLogs: dayTimeLogs })}
                  className={`min-h-[85px] sm:min-h-[110px] rounded-2xl border p-2 flex flex-col justify-between cursor-pointer transition-all ${
                    isCycleRecovery
                      ? isToday
                        ? 'bg-rose-950/45 border-rose-400 ring-2 ring-rose-500 shadow-[inset_0_0_18px_rgba(244,63,94,0.3)]'
                        : 'bg-rose-950/25 hover:bg-rose-950/35 border-rose-500/40 hover:border-rose-400/70 shadow-[inset_0_0_12px_rgba(244,63,94,0.12)]'
                      : isToday
                      ? 'bg-emerald-950/35 border-emerald-400 ring-2 ring-emerald-500 shadow-[inset_0_0_15px_rgba(16,185,129,0.25)]'
                      : 'bg-emerald-950/15 hover:bg-emerald-950/25 border-emerald-500/25 hover:border-emerald-500/45 shadow-[inset_0_0_10px_rgba(16,185,129,0.06)]'
                  }`}
                >
                  {/* Top Day Number & Cycle Indicator */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      {isToday ? (
                        <span className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center shadow ${
                          isCycleRecovery ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-zinc-950'
                        }`}>
                          {dayNum}
                        </span>
                      ) : (
                        <span className={`text-xs font-semibold ${isCycleRecovery ? 'text-rose-300' : 'text-zinc-300'}`}>
                          {dayNum}
                        </span>
                      )}

                      {isCycleRecovery ? (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-rose-500/25 text-rose-300 border border-rose-500/40 flex items-center gap-0.5">
                          🧖‍♂️ Детокс
                        </span>
                      ) : (
                        <span className="text-[8px] font-mono font-medium px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                          Д{cycleInfo.dayNumberInCycle}/7
                        </span>
                      )}
                    </div>

                    {dayTasks.length > 0 && (
                      <span className="text-[9px] text-zinc-500 font-mono hidden sm:inline">
                        {dayTasks.filter(t => t.completed).length}/{dayTasks.length}
                      </span>
                    )}
                  </div>

                  {/* Task chips & focus log badge inside day */}
                  <div className="flex-1 space-y-1 overflow-hidden">
                    {isCycleRecovery && (
                      <div className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/25 truncate flex items-center gap-1">
                        <span>🧖‍♂️ Сауна, бассейн, детокс</span>
                      </div>
                    )}

                    {focusMins > 0 && (
                      <div className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/20 truncate flex items-center gap-1">
                        <Flame className="w-2.5 h-2.5 shrink-0 text-amber-400" />
                        <span>{focusMins}м фокус</span>
                      </div>
                    )}

                    {dayTasks.slice(0, 2).map((t) => (
                      <div
                        key={t.id}
                        onClick={(e) => handleTaskCheck(t, e)}
                        className={`px-1.5 py-0.5 rounded text-[9px] truncate border flex items-center gap-1 transition-all ${
                          t.completed
                            ? 'bg-zinc-900/60 text-zinc-600 border-transparent line-through'
                            : 'bg-zinc-800/80 text-zinc-300 border-white/5 hover:border-white/15'
                        }`}
                      >
                        <span className="truncate flex-1 font-medium">{t.title}</span>
                      </div>
                    ))}

                    {dayTasks.length > 2 && (
                      <span className="text-[9px] text-zinc-500 font-medium block">
                        +{dayTasks.length - 2} ещё
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Trailing days */}
            {Array.from({ length: trailingDaysCount }).map((_, idx) => (
              <div
                key={`trailing-${idx}`}
                className="min-h-[85px] sm:min-h-[110px] rounded-2xl bg-[#0d0d10]/40 border border-white/[0.02] p-2 opacity-30 select-none"
              >
                <span className="text-xs font-mono text-zinc-600">{idx + 1}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Timeline View */
        <div className="bg-[#111115] border border-white/[0.08] rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h3 className="font-bold text-sm text-zinc-200">Почасовой График (24ч)</h3>
            <button
              onClick={onOpenQuickAdd}
              className="text-xs text-zinc-300 hover:text-white font-medium flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Запланировать блок
            </button>
          </div>

          <div className="space-y-1.5">
            {Array.from({ length: 15 }, (_, i) => i + 8).map((hour) => {
              const hourStr = `${hour.toString().padStart(2, '0')}:00`;
              const targetDayStr = viewDate.toISOString().split('T')[0];

              const matching = tasks.filter((t) => {
                if (!t.dueTime) return false;
                const taskHour = parseInt(t.dueTime.split(':')[0], 10);
                return taskHour === hour;
              });

              const matchingLogs = timeLogs.filter((tl) => {
                if (!tl.startedAt.startsWith(targetDayStr)) return false;
                const logHour = new Date(tl.startedAt).getHours();
                return logHour === hour;
              });

              return (
                <div key={hour} className="flex items-start gap-4 min-h-[44px] py-1 border-b border-white/[0.03]">
                  <span className="w-12 text-xs font-mono text-zinc-600 pt-1 select-none shrink-0">
                    {hourStr}
                  </span>

                  <div className="flex-1 space-y-1">
                    {matchingLogs.map((tl) => (
                      <div
                        key={tl.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                          tl.mode === 'work'
                            ? 'bg-amber-950/25 border-amber-500/30 text-amber-200'
                            : 'bg-emerald-950/25 border-emerald-500/30 text-emerald-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {tl.mode === 'work' ? (
                            <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          ) : (
                            <Coffee className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          )}
                          <span className="font-semibold truncate">{tl.title}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[10px] shrink-0">
                          <span className="text-zinc-400">
                            {new Date(tl.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {tl.actualMinutes}м
                          </span>
                          {tl.expEarned ? (
                            <span className="text-amber-400 font-bold">+{tl.expEarned} EXP</span>
                          ) : null}
                        </div>
                      </div>
                    ))}

                    {matching.map((t) => (
                      <div
                        key={t.id}
                        className={`p-2.5 rounded-xl border border-white/5 flex items-center justify-between text-xs ${
                          t.completed ? 'bg-zinc-900/40 text-zinc-500 line-through' : 'bg-zinc-900 text-zinc-200'
                        }`}
                      >
                        <span className="font-medium">{t.title}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {t.dueTime} • {t.durationMinutes || 30}м
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Day Modal */}
      {selectedDayTasks && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121216] border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div>
                <h3 className="font-bold text-sm text-zinc-100">Задачи на {selectedDayTasks.dateStr}</h3>
                <p className="text-[11px] text-zinc-500">
                  {selectedDayTasks.tasks.filter((t) => t.completed).length} из {selectedDayTasks.tasks.length} выполнено
                </p>
              </div>
              <button
                onClick={() => setSelectedDayTasks(null)}
                className="p-1 rounded-lg text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {/* 7+1 Cycle Status Banner & Start Date Selector */}
              {(() => {
                const selectedCycle = getDayCycleInfo(selectedDayTasks.dateStr, recoveryConfig);
                const isStartDay = recoveryConfig.cycleStartDate === selectedDayTasks.dateStr;
                const dayActs = completedActivitiesMap[selectedDayTasks.dateStr] || [];

                return (
                  <div className="space-y-3 mb-3">
                    <div className={`p-3 rounded-2xl border flex items-center justify-between gap-2.5 ${
                      selectedCycle.isRecoveryDay
                        ? 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                        : 'bg-emerald-950/30 border-emerald-500/35 text-emerald-200'
                    }`}>
                      <div className="min-w-0">
                        <div className="text-xs font-bold flex items-center gap-1.5">
                          {selectedCycle.isRecoveryDay ? (
                            <>
                              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)] animate-pulse" />
                              <span>День 8: Активное восстановление</span>
                            </>
                          ) : (
                            <>
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                              <span>День {selectedCycle.dayNumberInCycle} из 7: Рабочий фокус</span>
                            </>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-0.5 truncate">
                          {selectedCycle.isRecoveryDay
                            ? 'Полный цифровой детокс: без гаджетов и интернета'
                            : 'Спринт фокус-задач и тайм-блоков'}
                        </p>
                      </div>

                      <button
                        onClick={() => handleSetCycleStartDate(selectedDayTasks.dateStr)}
                        className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold shrink-0 transition-all tactile-btn ${
                          isStartDay
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-white/10 hover:bg-white/20 text-white'
                        }`}
                        title="Сделать эту дату точкой отсчета цикла"
                      >
                        {isStartDay ? '★ Старт цикла' : '📍 Начать цикл отсюда'}
                      </button>
                    </div>

                    {/* Prescribed Recovery Checklist */}
                    {selectedCycle.isRecoveryDay && (
                      <div className="p-3.5 rounded-2xl bg-rose-950/30 border border-rose-500/40 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-rose-200 flex items-center gap-1.5">
                            <span>🧖‍♂️ Практики восстановления</span>
                          </span>
                          <span className="text-[10px] font-mono font-bold text-rose-400">
                            {dayActs.length}/{recoveryConfig.activities.length} выполнено
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          {recoveryConfig.activities.map((act) => {
                            const isDone = dayActs.includes(act.id);
                            return (
                              <button
                                key={act.id}
                                onClick={() => handleToggleActivity(selectedDayTasks.dateStr, act)}
                                className={`w-full p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all tactile-btn ${
                                  isDone
                                    ? 'bg-rose-900/40 border-rose-500/50 text-rose-200'
                                    : 'bg-zinc-900/90 hover:bg-zinc-800 border-white/5 text-zinc-300'
                                }`}
                              >
                                <div className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                                  isDone ? 'bg-rose-500 border-rose-400 text-white' : 'border-zinc-600'
                                }`}>
                                  {isDone && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-bold flex items-center gap-1.5">
                                    <span>{act.icon}</span>
                                    <span className={isDone ? 'line-through text-rose-300/80' : 'text-zinc-200'}>{act.title}</span>
                                  </div>
                                  <p className="text-[10px] text-zinc-400 mt-0.5">{act.description}</p>
                                </div>
                                <div className="text-[10px] font-mono text-amber-400 shrink-0 font-semibold">
                                  +{act.expReward} EXP
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {dayActs.length === recoveryConfig.activities.length && (
                          <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>🏆 Все практики закрыты! Получен трофей «Мастер перезагрузки» и полное восстановление HP!</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {selectedDayTasks.tasks.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-6">Нет запланированных задач</p>
              ) : (
                selectedDayTasks.tasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={(e) => handleTaskCheck(t, e)}
                    className={`p-3 rounded-2xl border cursor-pointer flex items-center justify-between gap-3 text-xs transition-all ${
                      t.completed ? 'bg-zinc-900/40 border-transparent text-zinc-500' : 'bg-zinc-900 border-white/5 text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      {t.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-zinc-400 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-zinc-600 shrink-0" />
                      )}
                      <span className={`truncate font-medium ${t.completed ? 'line-through' : ''}`}>
                        {t.title}
                      </span>
                    </div>
                    <span className="text-[9px] uppercase font-mono text-zinc-500 shrink-0">
                      {t.priority}
                    </span>
                  </div>
                ))
              )}

              {selectedDayTasks.timeLogs && selectedDayTasks.timeLogs.length > 0 && (
                <div className="pt-3 border-t border-white/5 space-y-2 mt-2">
                  <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    <span>Сессии таймера ({selectedDayTasks.timeLogs.length})</span>
                  </div>
                  {selectedDayTasks.timeLogs.map((tl) => (
                    <div
                      key={tl.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                        tl.mode === 'work'
                          ? 'bg-amber-950/20 border-amber-500/20 text-amber-200'
                          : 'bg-emerald-950/20 border-emerald-500/20 text-emerald-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {tl.mode === 'work' ? (
                          <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        ) : (
                          <Coffee className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        )}
                        <span className="font-medium truncate">{tl.title}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-400 shrink-0">
                        <span>{new Date(tl.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>•</span>
                        <span>{tl.actualMinutes}м</span>
                        {tl.expEarned ? <span className="text-amber-400">+{tl.expEarned} EXP</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-white/5 flex justify-between items-center mt-2">
              {(() => {
                const selectedCycle = getDayCycleInfo(selectedDayTasks.dateStr, recoveryConfig);
                return selectedCycle.isRecoveryDay ? (
                  <div className="text-[11px] font-bold text-rose-300 py-1 flex items-center gap-1.5">
                    <X className="w-3.5 h-3.5 text-rose-400" />
                    <span>«Сегодня день отдыха. Уберите гаджеты и идите в баню!»</span>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setSelectedDayTasks(null);
                      onOpenQuickAdd();
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow"
                  >
                    <Plus className="w-3.5 h-3.5" /> Добавить
                  </button>
                );
              })()}

              <button
                onClick={() => setSelectedDayTasks(null)}
                className="px-3.5 py-1.5 rounded-xl bg-zinc-900 text-xs text-zinc-400 hover:text-white"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
