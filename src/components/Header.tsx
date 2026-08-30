import React, { useState } from 'react';
import { UserStats, NotificationItem, GoogleCalendarConfig } from '../types';
import { 
  Sparkles, 
  Coins, 
  Flame, 
  Volume2, 
  VolumeX, 
  Plus, 
  Calendar, 
  Bell, 
  Smartphone,
  Check,
  Search,
  RotateCcw
} from 'lucide-react';

interface HeaderProps {
  stats: UserStats;
  onUpdateStats: (newStats: Partial<UserStats>) => void;
  onOpenQuickAdd: () => void;
  onOpenSearch?: () => void;
  onOpenCalendarModal: () => void;
  onOpenDeviceSyncModal: () => void;
  onResetProgress?: () => void;
  notifications: NotificationItem[];
  onMarkNotificationsRead: () => void;
  calendarConfig: GoogleCalendarConfig;
}

export const Header: React.FC<HeaderProps> = ({
  stats,
  onUpdateStats,
  onOpenQuickAdd,
  onOpenSearch,
  onOpenCalendarModal,
  onOpenDeviceSyncModal,
  onResetProgress,
  notifications,
  onMarkNotificationsRead,
  calendarConfig,
}) => {

  const [showNotifs, setShowNotifs] = useState(false);
  const unreadNotifs = notifications.filter((n) => !n.read).length;

  const hpPercent = Math.max(0, Math.min(100, (stats.hp / stats.maxHp) * 100));
  const expPercent = Math.max(0, Math.min(100, (stats.exp / stats.maxExp) * 100));

  return (
    <header className="sticky top-0 z-40 bg-[#09090b]/95 backdrop-blur-md border-b border-white/[0.08] px-3 sm:px-6 py-2.5 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Left: Brand & Hero Character Profile */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center text-xl shrink-0">
              {stats.avatarUrl}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-zinc-100 text-sm tracking-tight">{stats.title}</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300">
                  Lvl {stats.level} • {stats.heroClass}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 font-medium mt-0.5">
                QuestFlow Focus Suite
              </p>
            </div>
          </div>

          {/* Mobile Quick Actions */}
          <div className="flex items-center gap-1.5 md:hidden">
            <button
              onClick={onOpenDeviceSyncModal}
              className="p-1.5 rounded-lg bg-zinc-900 border border-white/10 text-zinc-400 active:scale-95"
              title="Синхронизация"
            >
              <Smartphone className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenQuickAdd}
              className="flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-100 text-zinc-900 font-bold active:scale-95"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center: HP & EXP Progress Bars (Minimalist Slate/Zinc) */}
        <div className="flex items-center gap-3 sm:gap-4 w-full md:w-auto md:flex-1 md:max-w-xs lg:max-w-sm">
          {/* Health Bar */}
          <div className="w-1/2">
            <div className="flex justify-between items-center text-[10px] mb-1 font-medium">
              <span className="text-zinc-400">HP</span>
              <span className="text-zinc-500 tabular-nums font-mono">
                {stats.hp}/{stats.maxHp}
              </span>
            </div>
            <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-white/5">
              <div
                className="h-full bg-zinc-300 rounded-full transition-all duration-500"
                style={{ width: `${hpPercent}%` }}
              />
            </div>
          </div>

          {/* EXP Bar */}
          <div className="w-1/2">
            <div className="flex justify-between items-center text-[10px] mb-1 font-medium">
              <span className="text-zinc-400">EXP</span>
              <span className="text-zinc-500 tabular-nums font-mono">
                {stats.exp}/{stats.maxExp}
              </span>
            </div>
            <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-white/5">
              <div
                className="h-full bg-zinc-400 rounded-full transition-all duration-500"
                style={{ width: `${expPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right: Currencies, Audio & Action Buttons */}
        <div className="hidden md:flex items-center gap-2.5">
          {/* Gold Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-900 border border-white/10 text-xs font-semibold text-zinc-300">
            <span className="text-amber-400/90 font-bold">🪙</span>
            <span className="font-mono tabular-nums">{stats.gold}</span>
          </div>

          {/* Streak Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-900 border border-white/10 text-xs font-semibold text-zinc-300">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            <span className="font-mono tabular-nums">{stats.streak} дн</span>
          </div>

          {/* Global Search Cmd+K Trigger */}
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs text-zinc-400 hover:text-zinc-200 transition-colors group cursor-pointer"
            title="Глобальный поиск (Cmd + K)"
          >
            <Search className="w-3.5 h-3.5 text-zinc-400 group-hover:text-purple-400" />
            <span className="hidden xl:inline text-zinc-400">Поиск...</span>
            <kbd className="hidden lg:inline text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-500 group-hover:text-zinc-300">
              ⌘K
            </kbd>
          </button>

          {/* Audio Mute Toggle */}
          <button
            onClick={() => onUpdateStats({ soundEnabled: !stats.soundEnabled })}
            className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            title={stats.soundEnabled ? 'Выключить звук' : 'Включить звук'}
          >
            {stats.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Reset Farmed Progress Button */}
          {onResetProgress && (
            <button
              onClick={() => {
                if (window.confirm('Сбросить весь тестовый прогресс до 1 уровня (0 EXP, 0 золота, 100 HP)?')) {
                  onResetProgress();
                }
              }}
              className="p-1.5 rounded-xl bg-zinc-900 hover:bg-rose-950/60 border border-white/10 hover:border-rose-500/40 text-zinc-400 hover:text-rose-300 transition-colors cursor-pointer"
              title="Сбросить прогресс до 1 уровня"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {/* Device Sync Modal Trigger */}
          <button
            onClick={onOpenDeviceSyncModal}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
            title="Синхронизация между устройствами"
          >
            <Smartphone className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden lg:inline">Синхронизация</span>
          </button>

          {/* Notifications Trigger */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifs(!showNotifs);
                if (unreadNotifs > 0) onMarkNotificationsRead();
              }}
              className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-zinc-200 relative transition-colors"
              title="Уведомления"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifs > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-zinc-100" />
              )}
            </button>

            {/* Notifications Popup */}
            {showNotifs && (
              <div className="absolute right-0 mt-2 w-72 bg-[#121216] border border-white/10 rounded-2xl p-3 shadow-xl z-50 animate-in fade-in space-y-2">
                <div className="flex justify-between items-center pb-2 border-b border-white/5 text-xs font-semibold text-zinc-300">
                  <span>Уведомления</span>
                  <span className="text-[10px] text-zinc-500 font-mono">{notifications.length}</span>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1.5">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-zinc-500 text-center py-4">Нет новых уведомлений</p>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className="p-2 rounded-xl bg-zinc-900/60 text-xs space-y-0.5">
                        <p className="font-medium text-zinc-200">{n.title}</p>
                        <p className="text-[11px] text-zinc-400">{n.message}</p>
                        <p className="text-[9px] text-zinc-600 font-mono">{n.time}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Add Button */}
          <button
            onClick={onOpenQuickAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs shadow transition-all active:scale-95"
            title="Быстрое добавление квеста (⌘K)"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Добавить</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.2 text-[9px] font-mono bg-zinc-200 text-zinc-800 rounded">
              ⌘K
            </kbd>
          </button>
        </div>
      </div>
    </header>
  );
};
