import React, { useState } from 'react';
import { GoogleCalendarConfig } from '../types';
import { 
  X
} from 'lucide-react';

interface GoogleCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GoogleCalendarConfig;
  onSaveConfig: (config: GoogleCalendarConfig) => void;
}

export const GoogleCalendarModal: React.FC<GoogleCalendarModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [clientId, setClientId] = useState(config.clientId || '');
  const [apiKey, setApiKey] = useState(config.apiKey || '');
  const [calendarName, setCalendarName] = useState(config.calendarName || 'Основной Календарь');

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig({
      ...config,
      clientId: clientId.trim(),
      apiKey: apiKey.trim(),
      calendarName: calendarName.trim(),
      connected: true,
      lastSyncedAt: new Date().toLocaleTimeString(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#121216] border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <h2 className="font-bold text-sm text-zinc-100">Настройки Google Calendar</h2>
            <p className="text-[11px] text-zinc-500">Синхронизация дедлайнов и тайм-блоков</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 font-medium block mb-1">Название календаря</label>
            <input
              type="text"
              value={calendarName}
              onChange={(e) => setCalendarName(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-400 font-medium block mb-1">Google OAuth Client ID</label>
            <input
              type="text"
              placeholder="123456...apps.googleusercontent.com"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-400 font-medium block mb-1">API Key (Опционально)</label>
            <input
              type="password"
              placeholder="AIzaSy..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl bg-zinc-900 text-xs text-zinc-400 hover:text-white"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs shadow"
            >
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
