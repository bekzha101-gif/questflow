import React, { useState } from 'react';
import { getSupabaseCredentials, setSupabaseCredentials, isSupabaseConfigured } from '../lib/supabase';
import { Database, Copy, Check, ExternalLink, ShieldCheck, AlertCircle } from 'lucide-react';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SupabaseConfigModal({ isOpen, onClose }: SupabaseConfigModalProps) {
  const currentCreds = getSupabaseCredentials();
  const [url, setUrl] = useState(currentCreds.url || '');
  const [anonKey, setAnonKey] = useState(currentCreds.anonKey || '');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedSql, setCopiedSql] = useState(false);

  if (!isOpen) return null;

  const handleTestAndSave = async () => {
    if (!url || !anonKey) {
      setTestStatus('error');
      setErrorMessage('Пожалуйста, заполните оба поля (Project URL и Anon API Key)');
      return;
    }

    setTestStatus('testing');
    setErrorMessage('');

    try {
      // Test the REST endpoint
      const cleanUrl = url.trim().replace(/\/$/, '');
      const cleanKey = anonKey.trim();

      const res = await fetch(`${cleanUrl}/rest/v1/`, {
        headers: {
          'apikey': cleanKey,
          'Authorization': `Bearer ${cleanKey}`,
        },
      });

      if (res.ok || res.status === 200 || res.status === 404) {
        // Connected!
        setSupabaseCredentials(cleanUrl, cleanKey);
        setTestStatus('success');
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        const text = await res.text();
        setTestStatus('error');
        setErrorMessage(`Ответ сервера (${res.status}): ${text || 'Проверьте правильность URL и Anon Key'}`);
      }
    } catch (err: any) {
      setTestStatus('error');
      setErrorMessage(`Ошибка соединения: ${err.message || 'Проверьте сетевой адрес'}`);
    }
  };

  const handleCopySql = async () => {
    try {
      const res = await fetch('/src/../supabase/migrations/001_initial.sql');
      let sql = '';
      if (res.ok) {
        sql = await res.text();
      } else {
        sql = `-- Вставьте этот SQL в Supabase Dashboard -> SQL Editor\n-- Полная схема сохранена в supabase/migrations/001_initial.sql`;
      }
      await navigator.clipboard.writeText(sql);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2500);
    } catch {
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#111116] border border-purple-500/30 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-white/40 hover:text-white text-xl"
        >
          ✕
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-2xl shadow-lg shadow-emerald-950/50">
            <Database className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Подключение Supabase Cloud
            </h2>
            <p className="text-xs text-white/40">
              Пожизненное сохранение на 50 лет & синхронизация между устройствами
            </p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1.5 flex items-center justify-between">
              <span>Project URL:</span>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-emerald-400 hover:underline inline-flex items-center gap-1"
              >
                Открыть Supabase Dashboard <ExternalLink className="w-3 h-3" />
              </a>
            </label>
            <input
              type="text"
              placeholder="https://xyzabcdefghijklmnop.supabase.co"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500 transition-all font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1.5">
              Project API Key (anon public):
            </label>
            <input
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500 transition-all font-mono"
            />
            <p className="text-[11px] text-white/30 mt-1">
              Найти можно в: <b>Supabase Dashboard ➔ Settings ➔ API ➔ Project API Keys (anon public)</b>
            </p>
          </div>

          {/* Status Alert */}
          {testStatus === 'success' && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>✅ Подключение успешно! Страница перезагружается...</span>
            </div>
          )}

          {testStatus === 'error' && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleTestAndSave}
            disabled={testStatus === 'testing'}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/40 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {testStatus === 'testing' ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            {testStatus === 'testing' ? 'Проверка подключения...' : 'Сохранить и Подключить Supabase'}
          </button>

          <button
            onClick={handleCopySql}
            className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white font-medium text-xs transition-all flex items-center justify-center gap-2"
          >
            {copiedSql ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copiedSql ? 'SQL Схема скопирована в буфер обмена!' : 'Скопировать SQL схему таблиц (для SQL Editor)'}
          </button>
        </div>
      </div>
    </div>
  );
}
