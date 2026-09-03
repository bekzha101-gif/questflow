import React, { useState } from 'react';
import { UserStats, NotificationItem, GoogleCalendarConfig } from '../types';
import { 
  Plus, 
  Settings,
  Volume2, 
  VolumeX, 
  Smartphone,
  RotateCcw,
  Bell,
  X
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
  onOpenDeviceSyncModal,
  onResetProgress,
  notifications,
  onMarkNotificationsRead,
}) => {
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const unreadNotifs = notifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-40 bg-[#09090b]/90 backdrop-blur-md border-b border-white/[0.06] px-4 sm:px-6 py-3 transition-all">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
        
        {/* Left: Brand Logo & Title */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm shadow-md font-bold text-white">
            ⚡
          </div>
          <span className="font-bold text-white text-base tracking-tight">
            QuestFlow
          </span>
        </div>




        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          
          {/* Quick Add Primary Button */}
          <button
            onClick={onOpenQuickAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs transition-all active:scale-95 cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Новая задача</span>
          </button>

          {/* Settings & Options Dropdown Trigger */}
          <div className="relative">
            <button
              onClick={() => {
                setShowSettingsMenu(!showSettingsMenu);
                if (unreadNotifs > 0) onMarkNotificationsRead();
              }}
              className={`p-2 rounded-xl border transition-all cursor-pointer relative ${
                showSettingsMenu
                  ? 'bg-zinc-800 text-white border-zinc-600'
                  : 'bg-[#121216] text-zinc-400 hover:text-white border-white/[0.06] hover:border-white/[0.12]'
              }`}
              title="Настройки и опции"
            >
              <Settings className="w-4 h-4" />
              {unreadNotifs > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-purple-500" />
              )}
            </button>

            {/* Dropdown Menu */}
            {showSettingsMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-[#141418] border border-white/[0.1] rounded-2xl p-2.5 shadow-2xl z-50 animate-in fade-in space-y-1.5 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.06] px-1.5 text-zinc-400 font-medium">
                  <span>Опции</span>
                  <button
                    onClick={() => setShowSettingsMenu(false)}
                    className="p-1 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Sound Toggle */}
                <button
                  onClick={() => onUpdateStats({ soundEnabled: !stats.soundEnabled })}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-white/[0.05] text-zinc-300 transition-colors text-left cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    {stats.soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-zinc-500" />}
                    <span>Звуковые эффекты</span>
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {stats.soundEnabled ? 'ВКЛ' : 'ВЫКЛ'}
                  </span>
                </button>

                {/* Device Sync */}
                <button
                  onClick={() => {
                    setShowSettingsMenu(false);
                    onOpenDeviceSyncModal();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-white/[0.05] text-zinc-300 transition-colors text-left cursor-pointer"
                >
                  <Smartphone className="w-4 h-4 text-purple-400" />
                  <span>Синхронизация с телефоном</span>
                </button>

                {/* Reset Progress */}
                {onResetProgress && (
                  <button
                    onClick={() => {
                      setShowSettingsMenu(false);
                      if (window.confirm('Сбросить весь тестовый прогресс до 1 уровня (0 EXP, 0 золота)?')) {
                        onResetProgress();
                      }
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-rose-950/40 text-zinc-400 hover:text-rose-300 transition-colors text-left cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4 text-rose-400" />
                    <span>Сбросить прогресс</span>
                  </button>
                )}

                {/* Notifications summary */}
                {notifications.length > 0 && (
                  <div className="pt-2 border-t border-white/[0.06] px-1 space-y-1">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
                      История ({notifications.length})
                    </span>
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {notifications.slice(0, 3).map((n) => (
                        <div key={n.id} className="p-2 rounded-lg bg-black/30 text-[11px] text-zinc-400">
                          <p className="font-medium text-zinc-200">{n.title}</p>
                          <p className="text-[10px] text-zinc-500 truncate">{n.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
