import React, { useState } from 'react';
import { GoogleCalendarConfig } from '../types';
import { 
  X, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  LogIn, 
  LogOut, 
  RefreshCw, 
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { requestGoogleAccessToken } from '../utils/googleCalendarApi';

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
  const [autoSync, setAutoSync] = useState(config.autoSync !== false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  if (!isOpen) return null;

  const hasActiveToken = Boolean(
    config.accessToken && 
    config.tokenExpiresAt && 
    config.tokenExpiresAt > Date.now()
  );

  const handleConnectGoogle = async () => {
    if (!clientId.trim()) {
      setAuthError('Сначала укажите Google OAuth Client ID ниже');
      return;
    }

    setAuthError(null);
    setIsAuthenticating(true);

    try {
      const { accessToken, expiresIn } = await requestGoogleAccessToken(clientId.trim());
      const expiresAt = Date.now() + (expiresIn * 1000) - (60 * 1000); // 1 minute safety buffer

      const updatedConfig: GoogleCalendarConfig = {
        ...config,
        clientId: clientId.trim(),
        apiKey: apiKey.trim(),
        calendarName: calendarName.trim(),
        connected: true,
        autoSync,
        accessToken,
        tokenExpiresAt: expiresAt,
        lastSyncedAt: new Date().toLocaleTimeString(),
      };

      onSaveConfig(updatedConfig);
      setIsAuthenticating(false);
    } catch (err: any) {
      console.error('Google Auth Error:', err);
      setAuthError(err?.message || 'Не удалось авторизоваться в Google');
      setIsAuthenticating(false);
    }
  };

  const handleDisconnect = () => {
    onSaveConfig({
      ...config,
      connected: false,
      accessToken: undefined,
      tokenExpiresAt: undefined,
      lastSyncedAt: undefined,
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig({
      ...config,
      clientId: clientId.trim(),
      apiKey: apiKey.trim(),
      calendarName: calendarName.trim(),
      autoSync,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#121216] border border-white/10 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              📅
            </div>
            <div>
              <h2 className="font-bold text-sm text-zinc-100">Синхронизация с Google Календарём</h2>
              <p className="text-[11px] text-zinc-500">Автозапись рабочих сессий таймера и дедлайнов</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Connection Status Box */}
        <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${
          hasActiveToken 
            ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
            : config.connected
            ? 'bg-amber-950/20 border-amber-500/30 text-amber-300'
            : 'bg-zinc-900/60 border-white/5 text-zinc-400'
        }`}>
          <div className="flex items-center gap-2.5">
            {hasActiveToken ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : config.connected ? (
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            ) : (
              <div className="w-5 h-5 rounded-full border border-zinc-600 shrink-0" />
            )}
            <div>
              <div className="text-xs font-semibold text-zinc-200">
                {hasActiveToken 
                  ? 'Подключено к Google Календарю' 
                  : config.connected 
                  ? 'Требуется повторный вход в Google' 
                  : 'Google Календарь не подключен'}
              </div>
              <div className="text-[11px] text-zinc-500">
                {config.lastSyncedAt 
                  ? `Посл. активность: ${config.lastSyncedAt}` 
                  : 'Нажмите «Войти через Google» для включения'}
              </div>
            </div>
          </div>

          <div>
            {hasActiveToken ? (
              <button
                type="button"
                onClick={handleDisconnect}
                className="px-2.5 py-1 text-[11px] rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center gap-1 transition-colors"
              >
                <LogOut className="w-3 h-3" /> Отключить
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnectGoogle}
                disabled={isAuthenticating}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 transition-all shadow-md disabled:opacity-50"
              >
                {isAuthenticating ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <LogIn className="w-3.5 h-3.5" />
                )}
                Войти через Google
              </button>
            )}
          </div>
        </div>

        {authError && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{authError}</span>
          </div>
        )}

        {/* Configuration Form */}
        <form onSubmit={handleSave} className="space-y-3.5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-zinc-400 font-medium">Google OAuth Client ID</label>
              <button
                type="button"
                onClick={() => setShowInstructions(!showInstructions)}
                className="text-[11px] text-blue-400 hover:underline flex items-center gap-1"
              >
                <HelpCircle className="w-3 h-3" /> Как получить?
              </button>
            </div>
            <input
              type="text"
              placeholder="123456...apps.googleusercontent.com"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full bg-zinc-900/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          {showInstructions && (
            <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/20 text-[11px] text-zinc-300 space-y-1.5 leading-relaxed">
              <div className="font-semibold text-blue-400">Быстрая инструкция (2 минуты):</div>
              <ol className="list-decimal pl-4 space-y-1 text-zinc-400">
                <li>Откройте <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-blue-400 underline inline-flex items-center gap-0.5">Google Cloud Credentials <ExternalLink className="w-2.5 h-2.5" /></a></li>
                <li>Создайте проект или выберите существующий, затем нажмите «Create Credentials» → «OAuth client ID».</li>
                <li>Тип приложения: «Web application».</li>
                <li>В «Authorised JavaScript origins» добавьте текущий адрес: <code className="text-zinc-200 bg-white/5 px-1 py-0.5 rounded">{window.location.origin}</code></li>
                <li>Скопируйте Client ID, вставьте в поле выше и нажмите кнопку «Войти через Google».</li>
              </ol>
            </div>
          )}

          <div>
            <label className="text-xs text-zinc-400 font-medium block mb-1">Название календаря в приложении</label>
            <input
              type="text"
              value={calendarName}
              onChange={(e) => setCalendarName(e.target.value)}
              className="w-full bg-zinc-900/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div className="pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs text-zinc-300 select-none">
              <input
                type="checkbox"
                checked={autoSync}
                onChange={(e) => setAutoSync(e.target.checked)}
                className="w-4 h-4 rounded bg-zinc-900 border-white/20 text-blue-600 focus:ring-0 focus:ring-offset-0"
              />
              <span>Автоматически записывать завершённые рабочие сессии таймера в Google Календарь</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl bg-zinc-900 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs shadow transition-colors"
            >
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
