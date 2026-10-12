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
  X,
  Download,
  Upload,
} from 'lucide-react';

interface HeaderProps {
  stats: UserStats;
  onUpdateStats: (newStats: Partial<UserStats>) => void;
  onOpenQuickAdd: () => void;
  onOpenSearch?: () => void;
  onOpenCalendarModal: () => void;
  onOpenDeviceSyncModal: () => void;
  onResetProgress?: () => void;
  onExportData?: () => void;
  onImportData?: (file: File) => void;
  notifications: NotificationItem[];
  onMarkNotificationsRead: () => void;
  calendarConfig: GoogleCalendarConfig;
  title: string;
  syncStatus?: 'synced' | 'syncing' | 'error' | string;
}

export const Header: React.FC<HeaderProps> = ({
  stats,
  onUpdateStats,
  onOpenQuickAdd,
  onOpenDeviceSyncModal,
  onResetProgress,
  onExportData,
  onImportData,
  notifications,
  onMarkNotificationsRead,
  title,
  syncStatus,
}) => {
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const unreadNotifs = notifications.filter((n) => !n.read).length;
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const syncLabel =
    syncStatus === 'synced' ? 'Данные сохранены в облако' :
    syncStatus === 'syncing' ? 'Синхронизация...' :
    syncStatus === 'error' ? 'Ошибка синхронизации' : 'Локальный режим';
  const syncDotClass =
    syncStatus === 'synced' ? 'bg-emerald-400' :
    syncStatus === 'syncing' ? 'bg-blue-400 animate-pulse' :
    syncStatus === 'error' ? 'bg-red-400' : 'bg-zinc-600';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImportData) {
      onImportData(file);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#09090b]/90 backdrop-blur-md border-b border-white/[0.06] px-4 sm:px-6 py-2 transition-all">
      <div className="flex items-center justify-between gap-3">
        
        {/* Left: текущий раздел */}
        <h1 className="font-bold text-white text-base tracking-tight truncate">{title}</h1>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          
          {/* Статус синхронизации: открывает окно «Хранение и синхронизация» */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('questflow:open-sync'))}
            title={`${syncLabel}. Хранение и синхронизация`}
            aria-label={`${syncLabel}. Открыть хранение и синхронизацию`}
            className="flex items-center justify-center w-8 h-8 rounded-xl hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <span className={`w-2 h-2 rounded-full ${syncDotClass}`} />
          </button>

          {/* Quick Add Primary Button (на телефоне эту роль играет «+» в нижней навигации) */}
          <button
            onClick={onOpenQuickAdd}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs transition-all active:scale-95 cursor-pointer shadow-sm"
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

                {/* Export Backup JSON */}
                {onExportData && (
                  <button
                    onClick={() => {
                      setShowSettingsMenu(false);
                      onExportData();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-emerald-950/30 text-zinc-300 hover:text-emerald-300 transition-colors text-left cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-emerald-400" />
                    <span>Скачать резервную копию (JSON)</span>
                  </button>
                )}

                {/* Import Backup JSON */}
                {onImportData && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <button
                      onClick={() => {
                        setShowSettingsMenu(false);
                        fileInputRef.current?.click();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-blue-950/30 text-zinc-300 hover:text-blue-300 transition-colors text-left cursor-pointer"
                    >
                      <Upload className="w-4 h-4 text-blue-400" />
                      <span>Восстановить из файла (JSON)</span>
                    </button>
                  </>
                )}

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
