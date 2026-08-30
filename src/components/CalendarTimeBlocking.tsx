import React, { useState } from 'react';
import { TaskItem, Project, GoogleCalendarConfig, Priority } from '../types';
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
  X
} from 'lucide-react';
import { downloadIcsFile } from '../utils/calendarSync';
import { playQuestCompleteSound, playCoinSound } from '../utils/sound';
import { triggerQuestConfetti } from '../utils/confetti';
import { LifeCalendarView } from './LifeCalendarView';

interface CalendarTimeBlockingProps {
  tasks: TaskItem[];
  projects: Project[];
  calendarConfig: GoogleCalendarConfig;
  onSyncCalendar: () => void;
  onOpenCalendarModal: () => void;
  onOpenQuickAdd: () => void;
  onToggleTask?: (taskId: string) => void;
}

export const CalendarTimeBlocking: React.FC<CalendarTimeBlockingProps> = ({
  tasks,
  projects,
  calendarConfig,
  onSyncCalendar,
  onOpenCalendarModal,
  onOpenQuickAdd,
  onToggleTask,
}) => {
  const [viewDate, setViewDate] = useState<Date>(() => new Date());
  const [viewMode, setViewMode] = useState<'month' | 'day_timeline' | 'life_calendar'>('month');
  const [selectedDayTasks, setSelectedDayTasks] = useState<{ dateStr: string; tasks: TaskItem[] } | null>(null);


  const [copiedFeed, setCopiedFeed] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

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

              const dayTasks = tasks.filter((t) => {
                if (t.dueDate === dateStr) return true;
                if (t.type === 'daily') return true;
                return false;
              });

              return (
                <div
                  key={`day-${dayNum}`}
                  onClick={() => setSelectedDayTasks({ dateStr, tasks: dayTasks })}
                  className={`min-h-[85px] sm:min-h-[110px] rounded-2xl border p-2 flex flex-col justify-between cursor-pointer transition-all ${
                    isToday
                      ? 'bg-[#14141c] border-zinc-500'
                      : 'bg-[#101014] hover:bg-[#15151a] border-white/5 hover:border-white/15'
                  }`}
                >
                  {/* Top Day Number */}
                  <div className="flex items-center justify-between mb-1">
                    {isToday ? (
                      <span className="w-6 h-6 rounded-full bg-zinc-100 text-zinc-950 font-bold text-xs flex items-center justify-center shadow">
                        {dayNum}
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-zinc-400">
                        {dayNum}
                      </span>
                    )}

                    {dayTasks.length > 0 && (
                      <span className="text-[9px] text-zinc-600 font-mono hidden sm:inline">
                        {dayTasks.filter(t => t.completed).length}/{dayTasks.length}
                      </span>
                    )}
                  </div>

                  {/* Task chips inside day */}
                  <div className="flex-1 space-y-1 overflow-hidden">
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
              const matching = tasks.filter((t) => {
                if (!t.dueTime) return false;
                const taskHour = parseInt(t.dueTime.split(':')[0], 10);
                return taskHour === hour;
              });

              return (
                <div key={hour} className="flex items-start gap-4 min-h-[44px] py-1 border-b border-white/[0.03]">
                  <span className="w-12 text-xs font-mono text-zinc-600 pt-1 select-none shrink-0">
                    {hourStr}
                  </span>

                  <div className="flex-1 space-y-1">
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
            </div>

            <div className="pt-4 border-t border-white/5 flex justify-between items-center mt-2">
              <button
                onClick={() => {
                  setSelectedDayTasks(null);
                  onOpenQuickAdd();
                }}
                className="px-3.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow"
              >
                <Plus className="w-3.5 h-3.5" /> Добавить
              </button>

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
