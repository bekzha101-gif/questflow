import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { SupabaseConfigModal } from './SupabaseConfigModal';
import { Mail, Lock, Sparkles, UserCheck, Shield, ExternalLink, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

interface AuthGateProps {
  children: React.ReactNode;
}

/**
 * AuthGate wraps the entire app.
 * Supports Email/Password, 1-Click login for verified account, Google OAuth, and Local Guest mode.
 */
export function AuthGate({ children }: AuthGateProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [session, setSession] = useState<null | { user: { email?: string; id: string } }>(null);
  const [checked, setChecked] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [guestMode, setGuestMode] = useState(false);

  // Form State
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('bekzha101@gmail.com');
  const [password, setPassword] = useState('QuestFlow2026Secure!');

  // On mount: check for existing session
  React.useEffect(() => {
    if (!supabase || !isSupabaseConfigured) {
      setChecked(true);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setChecked(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

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
      setError(err.message || 'Ошибка авторизации');
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
        setError(error.message);
      } else if (data.session) {
        setSession(data.session);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!supabase) return;
    setIsLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      if (error.message.includes('not enabled') || error.message.includes('validation_failed')) {
        setError(
          'Google OAuth провайдер не включен в Supabase Dashboard. Используйте вход по Email ниже или включите Google в Settings ➔ Authentication ➔ Providers ➔ Google.'
        );
      } else {
        setError(error.message);
      }
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setGuestMode(false);
  };

  // Not configured → dev mode, pass through
  if (!isSupabaseConfigured || !supabase) {
    return (
      <>
        {/* Dev mode banner */}
        <div className="fixed bottom-0 left-0 right-0 z-[9999] bg-gradient-to-r from-amber-950/95 via-purple-950/95 to-amber-950/95 backdrop-blur border-t border-amber-500/40 px-4 py-2 text-center text-xs text-amber-200 flex items-center justify-center gap-3 shadow-2xl">
          <span className="font-bold flex items-center gap-1.5 text-amber-300">
            <span>⚠️</span> Локальный режим
          </span>
          <span className="text-amber-500/60">|</span>
          <span className="text-white/80">Данные хранятся в localStorage браузера.</span>
          <button
            onClick={() => setIsConfigModalOpen(true)}
            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            ⚡ Подключить Supabase (1 клик)
          </button>
        </div>

        <SupabaseConfigModal
          isOpen={isConfigModalOpen}
          onClose={() => setIsConfigModalOpen(false)}
        />

        {children}
      </>
    );
  }

  // Still checking session
  if (!checked) {
    return (
      <div className="min-h-screen bg-[#09090c] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Logged in OR Guest Mode → render app with user context + sign out option
  if (session || guestMode) {
    return (
      <>
        {children}
        {/* Floating user badge */}
        <div className="fixed bottom-20 md:bottom-4 right-4 z-50">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 bg-[#1a1a2e]/90 backdrop-blur border border-white/10 rounded-2xl px-3 py-1.5 text-xs text-white/70 hover:text-white hover:border-white/30 transition-all shadow-xl cursor-pointer"
            title="Выйти из аккаунта"
          >
            <span className="w-5 h-5 rounded-full bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-[10px] font-bold text-white shadow">
              {session?.user.email?.[0]?.toUpperCase() ?? 'G'}
            </span>
            <span className="hidden sm:block font-medium">{session?.user.email ?? 'Гостевой режим'}</span>
            <span className="text-white/30 hover:text-rose-400">✕</span>
          </button>
        </div>
      </>
    );
  }

  // Not logged in → Auth Screen
  return (
    <div className="min-h-screen bg-[#09090c] flex flex-col items-center justify-center px-4 py-8 bg-grid-pattern">
      <div className="w-full max-w-md">
        {/* Logo Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-purple-600 via-indigo-600 to-pink-600 flex items-center justify-center text-3xl mb-4 shadow-2xl shadow-purple-900/60 ring-1 ring-white/20">
            ⚡
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">QuestFlow Cloud</h1>
          <p className="text-xs text-white/40 mt-1">
            Пожизненное сохранение на 50 лет & синхронизация между устройствами
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-[#111116]/95 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5">
          
          {/* Quick 1-Click Login for Owner */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-950/60 to-indigo-950/60 border border-purple-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Быстрый вход владельца
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/40">
                Готово
              </span>
            </div>
            <button
              onClick={handleQuickLoginBakyt}
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-950/50 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <UserCheck className="w-4 h-4" />
              <span>Войти как bekzha101@gmail.com</span>
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 text-[10px] text-white/30 uppercase tracking-wider font-mono">
            <div className="h-px flex-1 bg-white/10" />
            <span>или email & пароль</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {/* Messages */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800/60 text-xs text-rose-300 flex items-start gap-2 leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-800/60 text-xs text-emerald-300 flex items-start gap-2 leading-relaxed">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Email / Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1">Email:</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-white/30 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500 transition-all font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1">Пароль:</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-white/30 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500 transition-all font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              <span>{authMode === 'signin' ? 'Войти в аккаунт' : 'Зарегистрироваться'}</span>
            </button>
          </form>

          {/* Toggle Signin / Signup */}
          <div className="flex items-center justify-between text-xs text-white/40 pt-1">
            <button
              type="button"
              onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
              className="text-purple-400 hover:underline cursor-pointer"
            >
              {authMode === 'signin' ? 'Создать новый аккаунт' : 'Уже есть аккаунт? Войти'}
            </button>

            <button
              type="button"
              onClick={() => setGuestMode(true)}
              className="text-white/40 hover:text-white/80 cursor-pointer"
            >
              Гостевой режим →
            </button>
          </div>

          {/* Google OAuth Option */}
          <div className="pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white font-medium text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>Войти через Google OAuth</span>
            </button>
          </div>
        </div>

        {/* Feature List Footer */}
        <div className="mt-6 flex items-center justify-center gap-6 text-[11px] text-white/30">
          <span className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400" /> RLS Защита
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" /> Supabase Cloud
          </span>
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> 50 лет хранения
          </span>
        </div>
      </div>
    </div>
  );
}
