import React, { useState } from 'react';
import { CloudSyncState } from '../utils/cloudSync';
import { 
  Copy, 
  Check, 
  X
} from 'lucide-react';

interface DeviceSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncConfig: CloudSyncState;
  onSaveConfig: (config: CloudSyncState) => void;
  onTriggerSync: () => void;
}

export const DeviceSyncModal: React.FC<DeviceSyncModalProps> = ({
  isOpen,
  onClose,
  syncConfig,
  onSaveConfig,
  onTriggerSync,
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [inputCode, setInputCode] = useState(syncConfig.syncCode);
  const [supabaseUrl, setSupabaseUrl] = useState(syncConfig.supabaseUrl || '');
  const [supabaseKey, setSupabaseKey] = useState(syncConfig.supabaseKey || '');
  const [activeTab, setActiveTab] = useState<'p2p' | 'supabase'>('p2p');

  if (!isOpen) return null;

  const pairingUrl = `${window.location.origin}${window.location.pathname}?syncCode=${syncConfig.syncCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(pairingUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleApplyCode = () => {
    if (inputCode.trim().length >= 4) {
      onSaveConfig({
        ...syncConfig,
        syncCode: inputCode.trim(),
        enabled: true,
        status: 'synced',
      });
      onTriggerSync();
    }
  };

  const handleSaveSupabase = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig({
      ...syncConfig,
      supabaseUrl: supabaseUrl.trim(),
      supabaseKey: supabaseKey.trim(),
      enabled: true,
      status: 'synced',
    });
    onTriggerSync();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#121216] border border-white/10 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <h2 className="font-bold text-sm text-zinc-100">Синхронизация Устройств</h2>
            <p className="text-[11px] text-zinc-500">Телефон ↔ Ноутбук в реальном времени</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-900 border border-white/10 rounded-xl text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('p2p')}
            className={`py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'p2p' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500'
            }`}
          >
            Код Сопряжения (P2P)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('supabase')}
            className={`py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'supabase' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500'
            }`}
          >
            Облако Supabase
          </button>
        </div>

        {activeTab === 'p2p' ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/5 space-y-2 text-center">
              <span className="text-[11px] text-zinc-400 font-medium">Ваш 6-значный код сопряжения:</span>
              <div className="text-2xl font-black font-mono tracking-widest text-zinc-100 py-1">
                {syncConfig.syncCode}
              </div>
              <p className="text-[10px] text-zinc-500">
                Откройте эту ссылку на смартфоне для мгновенного подключения
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleCopyLink}
                className="w-full py-2.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow transition-all"
              >
                {copiedUrl ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedUrl ? 'Ссылка скопирована!' : 'Скопировать ссылку для телефона'}</span>
              </button>

              <div className="pt-2 flex gap-2">
                <input
                  type="text"
                  placeholder="Ввести код сопряжения..."
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500"
                />
                <button
                  onClick={handleApplyCode}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200"
                >
                  Применить
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveSupabase} className="space-y-3">
            <div>
              <label className="text-xs text-zinc-400 font-medium block mb-1">Supabase URL</label>
              <input
                type="url"
                placeholder="https://xyz.supabase.co"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 font-medium block mb-1">Supabase Key</label>
              <input
                type="password"
                placeholder="eyJh..."
                value={supabaseKey}
                onChange={(e) => setSupabaseKey(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs"
              >
                Сохранить
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
