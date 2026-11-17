import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { SupabaseConfigModal } from './SupabaseConfigModal';
import { connectCloud, disconnectCloud } from '../store';
import { needsLegacyImport, runLegacyImport, type ImportReport } from '../store/legacyImport';
import { ensureSeeds } from '../store/seeds';
import { todayStr } from '@shared/time';
import { 
  Mail, 
  Lock, 
  Sparkles, 
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

export type CloudState = 'none' | 'connecting' | 'ready' | 'failed';
/** Состояние облака вместе с тем, для кого оно читалось */
export interface CloudGate {
  userId: string | null;
  state: CloudState;
}

/**
 * Можно ли монтировать приложение. Вошедший пользователь — только когда его облако прочитано
 * ('ready') или чтение не удалось ('failed'), и именно его, а не прошлого пользователя.
 * Без входа — только когда облако уже отключено. Иначе эффекты App (сброс дня, итоги игры)
 * успели бы записать данные из старого кеша до чтения облака.
 */
export function canMountApp(authResolved: boolean, userId: string | null, cloud: CloudGate): boolean {
  if (!authResolved) return false;
  if (userId === null) return cloud.userId === null;
  return cloud.userId === userId && (cloud.state === 'ready' || cloud.state === 'failed');
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

  // Окно «Хранение и синхронизация» открывается точкой статуса в шапке приложения
  useEffect(() => {
    const openSyncInfo = () => setIsSyncInfoModalOpen(true);
    window.addEventListener('questflow:open-sync', openSyncInfo);
    return () => window.removeEventListener('questflow:open-sync', openSyncInfo);
  }, []);
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
  const [password, setPassword] = useState('');

  // Вход проверен (есть сессия или точно нет) — только после этого сеем стартовые данные
  const [authResolved, setAuthResolved] = useState<boolean>(() => !supabase || !isSupabaseConfigured);
  // Перенос старых данных браузера в новые таблицы (одна кнопка при первом входе новой версии)
  const [importStage, setImportStage] = useState<'needed' | 'running' | 'done' | 'error'>(() =>
    needsLegacyImport() ? 'needed' : 'done'
  );
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Облако хранилища: подключаем при входе, отключаем при выходе.
  // Пока облако не прочитано, приложение не монтируется: иначе его эффекты (сброс дня и т.п.)
  // записали бы запасные значения поверх настоящих данных.
  const userId = session?.user.id ?? null;
  const [cloud, setCloud] = useState<CloudGate>({ userId: null, state: 'none' });
  const [cloudAttempt, setCloudAttempt] = useState(0);
  // Состояние облака текущего пользователя: облако прошлого пользователя считается «ещё читаю»
  const cloudState: CloudState = cloud.userId === userId ? cloud.state : userId ? 'connecting' : 'none';
  useEffect(() => {
    if (!userId || !supabase) {
      disconnectCloud();
      setCloud({ userId: null, state: 'none' });
      return;
    }
    let alive = true;
    setCloud({ userId, state: 'connecting' });
    void connectCloud(supabase, userId).then((ok) => {
      if (alive) setCloud({ userId, state: ok ? 'ready' : 'failed' });
    });
    return () => {
      alive = false;
    };
  }, [userId, cloudAttempt]);

  const retryCloud = () => {
    disconnectCloud();
    setCloudAttempt((n) => n + 1);
  };

  // Стартовые данные из брифинга — один раз, после переноса и после чтения облака
  useEffect(() => {
    if (importStage === 'done' && authResolved && cloudState !== 'connecting') void ensureSeeds();
  }, [importStage, authResolved, cloudState]);

  const handleLegacyImport = async () => {
    setImportStage('running');
    setImportError(null);
    try {
      const report = await runLegacyImport();
      setImportReport(report);

      setImportStage('done');
    } catch (e) {
      console.error('Перенос не удался', e);
      setImportError(e instanceof Error ? e.message : String(e));
      setImportStage('error');
    }
  };

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
      setAuthResolved(true);
    }).catch(() => {
      // Supabase is offline or paused — stay in guest/local mode
      if (isMounted) setAuthResolved(true);
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
    a.download = `questflow-backup-${todayStr()}.json`;
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

  // Вход по ссылке из письма: пароль не нужен. Новых аккаунтов не создаёт — приложение личное
  const handleMagicLink = async () => {
    if (!supabase) return;
    if (!email.trim()) {
      setError('Впишите email, на него придёт ссылка для входа.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + window.location.pathname },
      });
      if (error) setError(`Письмо не отправлено: ${error.message}`);
      else setSuccessMessage('Письмо отправлено. Откройте ссылку из него в этом же браузере — вход произойдёт сам.');
    } catch {
      setError('Сервер Supabase не отвечает. Попробуйте позже.');
    } finally {
      setIsLoading(false);
    }
  };

  // Смена пароля, когда вход уже выполнен (например, по ссылке из письма)
  const [newPassword, setNewPassword] = useState('');
  const [passwordNote, setPasswordNote] = useState<string | null>(null);
  const handleChangePassword = async () => {
    if (!supabase) return;
    if (newPassword.length < 8) {
      setPasswordNote('Пароль — минимум 8 символов.');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordNote(error ? `Не удалось: ${error.message}` : 'Пароль изменён.');
    if (!error) setNewPassword('');
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

  // Что показать вместо приложения: проверка входа, чтение облака, перенос старых данных
  const waitingCloud = !canMountApp(authResolved, userId, cloud);
  const gateScreen =
    importStage !== 'done' ? (
      <div className="min-h-screen bg-[#09090c] text-zinc-200 flex items-center justify-center p-4">
        <div className="linear-card bg-[#0e0e13] border border-white/[0.07] rounded-3xl max-w-md w-full p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-purple-400" />
            <h1 className="font-semibold text-sm text-white">Новая версия QuestFlow</h1>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Данные теперь хранятся в Supabase, чтобы сайт и Telegram-бот видели одно и то же.
            Перед переносом браузер скачает файл-бэкап всех данных. Старые данные в браузере не удаляются,
            повторный перенос ничего не дублирует.
          </p>
          {!session && (
            <p className="text-[11px] text-amber-300/80 leading-relaxed">
              Перенос идёт только в облако: войдите в аккаунт. Так старые данные этого браузера не вернут то,
              что уже удалено на другом устройстве.
            </p>
          )}
          {session && cloudState === 'failed' && (
            <p className="text-[11px] text-rose-300 leading-relaxed">Нет связи с облаком. Проверьте интернет и повторите.</p>
          )}
          {importStage === 'error' && (
            <p className="text-[11px] text-rose-300 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Перенос не удался: {importError}. Данные не тронуты, попробуйте ещё раз.</span>
            </p>
          )}
          {!session ? (
            <button
              onClick={() => setShowAuthFormModal(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium cursor-pointer"
            >
              <Cloud className="w-4 h-4" />
              Войти в аккаунт
            </button>
          ) : cloudState === 'failed' ? (
            <button
              onClick={retryCloud}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium cursor-pointer"
            >
              <CloudOff className="w-4 h-4" />
              Повторить
            </button>
          ) : (
            <button
              onClick={handleLegacyImport}
              disabled={importStage === 'running' || cloudState !== 'ready'}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white text-sm font-medium cursor-pointer"
            >
              <Download className="w-4 h-4" />
              {importStage === 'running' ? 'Переношу…' : cloudState === 'ready' ? 'Перенести в облако' : 'Читаю облако…'}
            </button>
          )}
        </div>
      </div>
    ) : waitingCloud ? (
      <div className="min-h-screen bg-[#09090c] flex items-center justify-center text-xs text-zinc-500">
        Загружаю данные…
      </div>
    ) : null;

  // If user is inside the app (session OR guestMode)
  return (
    <>
      {gateScreen ?? children}

      {importReport && (!importReport.alreadyImported || importReport.cloudAlreadyImported) && (
        <div className="fixed bottom-20 md:bottom-6 right-4 z-[9998] max-w-xs bg-[#121218] border border-white/[0.07] rounded-2xl p-4 text-xs text-zinc-300 space-y-2 shadow-2xl">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Данные перенесены
            </span>
            <button onClick={() => setImportReport(null)} className="p-1 text-zinc-500 hover:text-white cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-zinc-400">
            {importReport.cloudAlreadyImported
              ? `В облаке уже есть перенесённые данные: старые данные этого браузера не отправлены. Бэкап: ${importReport.backupFile}.`
              : `Бэкап: ${importReport.backupFile}. Записано строк: ${Object.values(importReport.counts).reduce((a, b) => a + (b ?? 0), 0)}.`}
          </p>
        </div>
      )}

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

              {session && (
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Новый пароль (от 8 символов)"
                      className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                    <button
                      onClick={handleChangePassword}
                      className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs cursor-pointer"
                    >
                      Сменить пароль
                    </button>
                  </div>
                  {passwordNote && <p className="text-[11px] text-zinc-400">{passwordNote}</p>}
                </div>
              )}

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

            <button
              type="button"
              onClick={handleMagicLink}
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-purple-950/50 hover:bg-purple-900/60 border border-purple-500/30 text-purple-200 hover:text-white font-semibold text-xs transition-all cursor-pointer disabled:opacity-60"
            >
              Забыли пароль? Войти по ссылке из письма
            </button>

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
