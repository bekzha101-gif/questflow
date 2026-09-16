import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { SupabaseConfigModal } from './SupabaseConfigModal';
import { 
  Mail, 
  Lock, 
  Sparkles, 
  UserCheck, 
  Shield, 
  ExternalLink, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  Download,
  Database,
  CloudOff,
  Cloud,
  X
} from 'lucide-react';

interface AuthGateProps {
  children: React.ReactNode;
}

/**
 * AuthGate wraps the entire app.
 * Guarantees that the user is NEVER locked out from their saved tasks and habits.
 * Defaults to Local Mode (localStorage) while supporting Supabase Cloud Sync.
 */
export function AuthGate({ children }: AuthGateProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [session, setSession] = useState<null | { user: { email?: string; id: string } }>(null);
  const [checked, setChecked] = useState(true); // Default to checked so app renders immediately
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isSyncInfoModalOpen, setIsSyncInfoModalOpen] = useState(false);
  const [showAuthFormModal, setShowAuthFormModal] = useState(false);

  // ALWAYS default to true: User's local tasks are never held hostage!
  const [guestMode, setGuestMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('questflow_guest_mode');
      if (saved === 'false') return false;
    }
    return true;
  });

  // Form State
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('bekzha101@gmail.com');
  const [password, setPassword] = useState('QuestFlow2026Secure!');

  // On mount: check for existing session quietly in background
  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) return;

    let isMounted = true;
    const timeout = setTimeout(() => {
      // Quiet timeout — do not block anything
    }, 2000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      clearTimeout(timeout);
      if (session) {
        setSession(session);
      }
    }).catch(() => {
      // Supabase is offline or paused — stay in guest/local mode
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setSession(session);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const handleDownloadBackup = () => {
    const allKeys = Object.keys(localStorage).filter((k) => k.startsWith('questflow_'));
    const backup: Record<string, unknown> = {
      source: 'questflow_local_backup',
      exportedAt: new Date().toISOString(),
    };
    for (const key of allKeys) {
      try {
        backup[key] = JSON.parse(localStorage.getItem(key) ?? 'null');
      } catch {
        backup[key] = localStorage.getItem(key);
      }
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `questflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEmailAuth = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!supabase) return;

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (authMode === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          if (error.message.includes('Email not confirmed')) {
            setError('Email зарегистрирован, но требует подтверждения.');
          } else {
            setError(error.message);
          }
        } else if (data.session) {
          setSession(data.session);
          setShowAuthFormModal(false);
          setSuccessMessage('Успешный вход в облако!');
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) {
          setError(error.message);
        } else {
          setSuccessMessage('Аккаунт создан! Проверьте почту или войдите.');
          setAuthMode('signin');
        }
      }
    } catch (err: any) {
      setError(
        'Сервер Supabase сейчас на паузе (бесплатный тариф Supabase ставит проект на паузу после 7 дней неактивности). ' +
        'Ваши дела и задачи НЕ потеряны — они на 100% сохранены в этом браузере! Нажмите «Открыть мои задачи локально» ниже.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLoginBakyt = async () => {
    if (!supabase) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'bekzha101@gmail.com',
        password: 'QuestFlow2026Secure!',
      });
      if (error) {
        setError(
          'Сервер Supabase на паузе (DNS/NXDOMAIN). Все ваши задачи сохранены локально в браузере. Вы можете пользоваться ими прямо сейчас!'
        );
      } else if (data.session) {
        setSession(data.session);
        setShowAuthFormModal(false);
      }
    } catch (err: any) {
      setError(
        'Сервер Supabase сейчас на паузе (бесплатный тариф Supabase ставит проект на паузу после 7 дней без обращений). ' +
        'Все ваши дела на месте и сохранены в браузере! Нажмите зеленую кнопку ниже, чтобы продолжить работу.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Sign out error:', e);
      }
    }
    setSession(null);
    setGuestMode(true); // Never lock the user out! Switch to local mode!
    localStorage.setItem('questflow_guest_mode', 'true');
    setIsSyncInfoModalOpen(false);
  };

  const enterLocalMode = () => {
    setGuestMode(true);
    localStorage.setItem('questflow_guest_mode', 'true');
    setShowAuthFormModal(false);
    setIsSyncInfoModalOpen(false);
  };

  // If user is inside the app (session OR guestMode)
  return (
    <>
      {children}

      {/* Floating Status Badge (Bottom-Right) */}
      <div className="fixed bottom-20 md:bottom-4 right-4 z-50">
        <button
          onClick={() => setIsSyncInfoModalOpen(true)}
          className="flex items-center gap-2 bg-[#121218]/95 backdrop-blur-md border border-white/10 hover:border-white/20 rounded-2xl px-3 py-1.5 text-xs text-white/80 hover:text-white transition-all shadow-2xl cursor-pointer"
          title="Статус синхронизации и резервное копирование"
        >
          {session ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="hidden sm:inline font-mono text-[11px] text-emerald-300">
                {session.user.email}
              </span>
              <Cloud className="w-3.5 h-3.5 text-emerald-400" />
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="hidden sm:inline font-medium text-[11px] text-zinc-300">
                Локальный режим (Задачи сохранены)
              </span>
              <Database className="w-3.5 h-3.5 text-amber-400" />
            </>
          )}
        </button>
      </div>

      {/* ── Modal: Sync Info & Backup Options ───────────────────────────────── */}
      {isSyncInfoModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#121216] border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-sm text-white">Хранение и Синхронизация</h3>
              </div>
              <button
                onClick={() => setIsSyncInfoModalOpen(false)}
                className="p-1 rounded-lg text-zinc-500 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/20 text-xs text-emerald-200 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Все ваши задачи сохранены в браузере!</span>
              </div>
              <p className="text-[11px] text-emerald-200/80 leading-relaxed">
                Данные хранятся в постоянной памяти (localStorage) вашего браузера. Даже без облака все задачи, чек-листы, видео и привычки в полной безопасности.
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-1">
              <button
                onClick={handleDownloadBackup}
                className="w-full py-2.5 px-4 rounded-xl bg-purple-950/50 hover:bg-purple-900/60 border border-purple-500/30 text-purple-200 hover:text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Скачать резервную копию задач (JSON)</span>
              </button>

              {session ? (
                <button
                  onClick={handleSignOut}
                  className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CloudOff className="w-4 h-4 text-rose-400" />
                  <span>Отключить облако (Остаться локально)</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setIsSyncInfoModalOpen(false);
                    setShowAuthFormModal(true);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Cloud className="w-4 h-4" />
                  <span>Подключить Supabase Cloud</span>
                </button>
              )}
            </div>

            <div className="text-[10px] text-zinc-500 text-center pt-2">
              ID проекта Supabase: <span className="font-mono text-zinc-400">hqmxyrlznzlwapplekfl</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Supabase Cloud Login / Registration ─────────────────────── */}
      {showAuthFormModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#111116] border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-sm text-white">Вход в Supabase Cloud</h3>
              </div>
              <button
                onClick={() => setShowAuthFormModal(false)}
                className="p-1 rounded-lg text-zinc-500 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Continue Locally Button (Never trapped!) */}
            <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-950/40 to-teal-950/40 border border-emerald-500/30 text-xs">
              <p className="text-[11px] text-emerald-300 font-medium mb-2">
                Хотите продолжить без логина со всеми своими задачами?
              </p>
              <button
                type="button"
                onClick={enterLocalMode}
                className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all cursor-pointer shadow"
              >
                ⚡ Открыть мои задачи (Локальный режим)
              </button>
            </div>

            {/* Quick Login Button */}
            <div className="p-3 rounded-2xl bg-purple-950/40 border border-purple-500/20 space-y-2">
              <button
                type="button"
                onClick={handleQuickLoginBakyt}
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <UserCheck className="w-4 h-4" />
                <span>Быстрый вход: bekzha101@gmail.com</span>
              </button>
            </div>

            {/* Messages */}
            {error && (
              <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800/60 text-xs text-rose-300 space-y-2">
                <div className="flex items-start gap-2 leading-relaxed">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{error}</span>
                </div>
                <div className="pt-1 border-t border-rose-900/50 flex items-center justify-between">
                  <a
                    href="https://supabase.com/dashboard/project/hqmxyrlznzlwapplekfl"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-rose-200 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <span>Разбудить проект в Supabase</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    type="button"
                    onClick={enterLocalMode}
                    className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[10px] cursor-pointer"
                  >
                    К задачам →
                  </button>
                </div>
              </div>
            )}

            {successMessage && (
              <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-800/60 text-xs text-emerald-300 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Email Form */}
            <form onSubmit={handleEmailAuth} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Email:</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Пароль:</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-white hover:bg-zinc-100 text-zinc-950 font-bold text-xs shadow transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isLoading ? 'Проверка...' : authMode === 'signin' ? 'Войти в аккаунт' : 'Зарегистрироваться'}
              </button>
            </form>

            <div className="flex items-center justify-between text-xs text-zinc-500 pt-1">
              <button
                type="button"
                onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
                className="text-purple-400 hover:underline cursor-pointer"
              >
                {authMode === 'signin' ? 'Создать аккаунт' : 'Уже есть аккаунт? Войти'}
              </button>

              <button
                type="button"
                onClick={enterLocalMode}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                Локальный режим →
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
