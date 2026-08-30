import React, { useState, useEffect } from 'react';
import { 
  ActivityTag, 
  DailyLogEntry, 
  MonthlyBigDataState, 
  initialBigDataMonth, 
  calculateMonthlyStats,
  SleepCycleSyncConfig
} from '../utils/bigDataTracker';
import { parseSleepCycleCsv, mergeSleepCycleDataIntoDays } from '../utils/sleepCycleParser';
import { 
  GoogleFitConfig, 
  loadGoogleFitConfig, 
  saveGoogleFitConfig, 
  fetchGoogleFitSleepData, 
  initGoogleFitTokenAuth 
} from '../utils/googleFitApi';
import { 
  Sparkles, 
  Calendar, 
  Moon, 
  Pill, 
  Flame, 
  Activity, 
  Award, 
  Edit3, 
  Plus, 
  X, 
  TrendingUp, 
  Dna, 
  HeartPulse, 
  BookOpen, 
  Check, 
  Download,
  Share2,
  RefreshCw,
  Copy,
  Smartphone,
  CheckCircle2,
  Key,
  ShieldCheck,
  AlertCircle,
  Brain,
  FileSpreadsheet
} from 'lucide-react';
import { AiLifeAdvisorModal } from './AiLifeAdvisorModal';
import { BigDataChart } from './BigDataChart';
import { playQuestCompleteSound, playCoinSound } from '../utils/sound';
import { triggerQuestConfetti } from '../utils/confetti';


interface BigDataLifeTrackerProps {
  onLogReward?: (exp: number, gold: number) => void;

}

export const BigDataLifeTracker: React.FC<BigDataLifeTrackerProps> = ({ onLogReward }) => {
  const [data, setData] = useState<MonthlyBigDataState>(() => {
    try {
      const saved = localStorage.getItem('questflow_bigdata_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...initialBigDataMonth,
          ...parsed,
          sleepSync: {
            ...initialBigDataMonth.sleepSync,
            ...(parsed.sleepSync || {}),
          },
          biometrics: {
            ...initialBigDataMonth.biometrics,
            ...(parsed.biometrics || {}),
          },
          hormones: {
            ...initialBigDataMonth.hormones,
            ...(parsed.hormones || {}),
          },
        };
      }
      return initialBigDataMonth;
    } catch {
      return initialBigDataMonth;
    }
  });

  // Google Fit API Configuration
  const [gfitConfig, setGfitConfig] = useState<GoogleFitConfig>(loadGoogleFitConfig);
  const [customTokenInput, setCustomTokenInput] = useState('');
  const [customClientIdInput, setCustomClientIdInput] = useState(gfitConfig.clientId);
  const [apiStatusMessage, setApiStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);
  const [showTokenDetails, setShowTokenDetails] = useState(false);

  const [activeTab, setActiveTab] = useState<'log' | 'analytics' | 'biometrics' | 'journal'>('log');
  const [editingDay, setEditingDay] = useState<DailyLogEntry | null>(null);
  const [isSleepModalOpen, setIsSleepModalOpen] = useState(false);
  const [isAiAdvisorOpen, setIsAiAdvisorOpen] = useState(false);
  const [isSyncingSleep, setIsSyncingSleep] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const handleExportCsv = () => {
    const headers = ['День', 'День недели', 'Сон', 'Минуты сна', 'Добавки / Ноотропы', 'Оценка (1-10)', 'Почему / Рефлексия', 'Сферы / Теги'];
    const rows = data.days.map(d => [
      d.day,
      d.dayOfWeek,
      `"${d.sleep || ''}"`,
      d.sleepMinutes || '',
      `"${(d.supplements || '').replace(/"/g, '""')}"`,
      d.score !== null ? d.score : '',
      `"${(d.why || '').replace(/"/g, '""')}"`,
      `"${d.tags.join(', ')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bigdata-tracker-${data.year}-${data.monthName.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };


  // Form for day edit
  const [formSleep, setFormSleep] = useState('');
  const [formSupplements, setFormSupplements] = useState('');
  const [formScore, setFormScore] = useState<string>('');
  const [formWhy, setFormWhy] = useState('');
  const [formTags, setFormTags] = useState<ActivityTag[]>([]);

  const stats = calculateMonthlyStats(data);

  const saveData = (nextState: MonthlyBigDataState) => {
    setData(nextState);
    try {
      localStorage.setItem('questflow_bigdata_v1', JSON.stringify(nextState));
    } catch (e) {
      console.error(e);
    }
  };

  const openDayEdit = (entry: DailyLogEntry) => {
    setEditingDay(entry);
    setFormSleep(entry.sleep || '7ч 30м');
    setFormSupplements(entry.supplements || '');
    setFormScore(entry.score !== null ? entry.score.toString() : '7.0');
    setFormWhy(entry.why || '');
    setFormTags([...entry.tags]);
  };

  const handleSaveDay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDay) return;

    let minutes = 450;
    const match = formSleep.match(/(\d+)\s*ч\s*(\d+)?/i);
    if (match) {
      const hours = parseInt(match[1], 10) || 0;
      const mins = parseInt(match[2], 10) || 0;
      minutes = hours * 60 + mins;
    }

    const numScore = formScore.trim() ? Math.min(10, Math.max(1, parseFloat(formScore.replace(',', '.')))) : null;

    const updatedDays = data.days.map((d) =>
      d.day === editingDay.day
        ? {
            ...d,
            sleep: formSleep.trim(),
            sleepMinutes: minutes,
            supplements: formSupplements.trim(),
            score: numScore,
            why: formWhy.trim(),
            tags: formTags,
          }
        : d
    );

    saveData({
      ...data,
      days: updatedDays,
    });

    setEditingDay(null);

    if (onLogReward) {
      onLogReward(20, 15);
      playQuestCompleteSound();
      playCoinSound();
      triggerQuestConfetti();
    }
  };

  // Google OAuth 2.0 Live Sign-In
  const handleGoogleFitOAuthLogin = () => {
    setIsOAuthLoading(true);
    setApiStatusMessage({ type: 'info', text: 'Запуск окна авторизации Google...' });

    initGoogleFitTokenAuth(
      customClientIdInput.trim() || gfitConfig.clientId,
      (token, expiresIn) => {
        const nextConfig: GoogleFitConfig = {
          ...gfitConfig,
          accessToken: token,
          tokenExpiresAt: Date.now() + expiresIn * 1000,
          isConnected: true,
          lastSyncTime: new Date().toLocaleTimeString(),
        };
        setGfitConfig(nextConfig);
        saveGoogleFitConfig(nextConfig);
        setIsOAuthLoading(false);
        setApiStatusMessage({ type: 'success', text: 'Успешная авторизация в Google Fit API!' });
        
        // Auto-trigger fetch
        handleFetchGoogleFitApi(token);
      },
      (err) => {
        setIsOAuthLoading(false);
        setApiStatusMessage({ 
          type: 'error', 
          text: `Ошибка OAuth: ${err?.message || err?.error || 'Окно авторизации закрыто'}. Вы можете ввести токен вручную.` 
        });
      }
    );
  };

  // Live Query Google Fit REST API
  const handleFetchGoogleFitApi = async (overrideToken?: string) => {
    const token = overrideToken || gfitConfig.accessToken || customTokenInput.trim();
    if (!token) {
      setApiStatusMessage({ 
        type: 'error', 
        text: 'Токен отсутствует. Нажмите "Войти через Google" или вставьте токен вручную.' 
      });
      return;
    }

    setIsSyncingSleep(true);
    setApiStatusMessage({ type: 'info', text: 'Отправка запроса к Google Fitness API (https://www.googleapis.com/fitness/v1)...' });

    const result = await fetchGoogleFitSleepData(token, data.year, 8);

    if (result.error) {
      setIsSyncingSleep(false);
      setApiStatusMessage({ type: 'error', text: result.error });
      return;
    }

    if (result.sessions.length === 0) {
      // If API returned 0 sleep sessions, let user know
      setIsSyncingSleep(false);
      setApiStatusMessage({ 
        type: 'info', 
        text: 'Google Fit API ответил успешно (200 OK), но в Google Fit пока нет сессий сна за этот месяц. Убедитесь, что Sleep Cycle завершил запись утренней сессии.' 
      });
      return;
    }

    // Merge sessions into days
    const updatedDays = data.days.map((d) => {
      const match = result.sessions.find((s) => s.dayOfMonth === d.day);
      if (match) {
        return {
          ...d,
          sleep: match.sleepDurationStr,
          sleepMinutes: match.durationMinutes,
          sleepQualityPercent: match.sleepQualityPercent,
          isAutoSynced: true,
        };
      }
      return d;
    });

    const nextConfig: GoogleFitConfig = {
      ...gfitConfig,
      lastSyncTime: `Сегодня, ${new Date().toLocaleTimeString().slice(0, 5)}`,
      isConnected: true,
    };
    setGfitConfig(nextConfig);
    saveGoogleFitConfig(nextConfig);

    saveData({
      ...data,
      days: updatedDays,
      sleepSync: {
        ...data.sleepSync,
        lastSyncedAt: `Google Fit API (${result.sessions.length} ночей)`,
      },
    });

    setIsSyncingSleep(false);
    setApiStatusMessage({ 
      type: 'success', 
      text: `✓ Успешно получено ${result.sessions.length} сессий сна из Google Fit API!` 
    });

    if (onLogReward) {
      onLogReward(50, 40);
      playQuestCompleteSound();
      playCoinSound();
      triggerQuestConfetti();
    }
  };

  const handleSaveCustomToken = () => {
    if (!customTokenInput.trim()) return;
    const nextConfig: GoogleFitConfig = {
      ...gfitConfig,
      accessToken: customTokenInput.trim(),
      tokenExpiresAt: Date.now() + 3600 * 1000,
      isConnected: true,
      lastSyncTime: new Date().toLocaleTimeString(),
    };
    setGfitConfig(nextConfig);
    saveGoogleFitConfig(nextConfig);
    handleFetchGoogleFitApi(customTokenInput.trim());
  };

  const handleFileUploadSleepCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const records = parseSleepCycleCsv(text);
        if (records.length > 0) {
          const updatedDays = mergeSleepCycleDataIntoDays(data.days, records);
          saveData({
            ...data,
            days: updatedDays,
            sleepSync: {
              ...data.sleepSync,
              lastSyncedAt: `CSV Импорт (${records.length} записей)`,
            },
          });
          setApiStatusMessage({ 
            type: 'success', 
            text: `✓ Успешно импортировано ${records.length} ночей из файла Sleep Cycle!` 
          });
          if (onLogReward) {
            onLogReward(50, 40);
            playQuestCompleteSound();
            playCoinSound();
            triggerQuestConfetti();
          }
        }
      }
    };
    reader.readAsText(file);
  };

  const handleCopyWebhook = () => {
    const url = `https://questflow.app/api/v1/integrations/sleep-cycle/webhook?token=${data.sleepSync.webhookToken}`;
    navigator.clipboard.writeText(url);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const handleQuickToggleTag = (dayNum: number, tag: ActivityTag, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedDays = data.days.map((d) => {
      if (d.day === dayNum) {
        const hasTag = d.tags.includes(tag);
        const nextTags = hasTag ? d.tags.filter((t) => t !== tag) : [...d.tags, tag];
        return { ...d, tags: nextTags };
      }
      return d;
    });

    saveData({ ...data, days: updatedDays });
    if (onLogReward) {
      onLogReward(5, 3);
      playCoinSound();
    }
  };

  const availableTags: { id: ActivityTag; label: string; desc: string }[] = [
    { id: 'Work', label: 'Work', desc: 'Работа / Образование' },
    { id: 'Work+', label: 'Work+', desc: 'Сверх-продуктивный день' },
    { id: 'Tr', label: 'Tr', desc: 'Тренировка / Спорт' },
    { id: 'Dr', label: 'Dr', desc: 'Драйв / Энергия' },
    { id: 'Soc', label: 'Soc', desc: 'Социализация / Друзья' },
    { id: 'NC', label: 'NC', desc: 'No Cigarettes (Без никотина)' },
    { id: 'NP', label: 'NP', desc: 'No Porn / Дофамин детокс' },
    { id: 'ПП', label: 'ПП', desc: 'Правильное питание' },
  ];

  const getScoreColorClass = (score: number | null) => {
    if (score === null) return 'text-zinc-600 bg-zinc-900 border-zinc-800';
    if (score >= 7.5) return 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30';
    if (score >= 6.5) return 'text-zinc-100 bg-zinc-800 border-zinc-700';
    if (score >= 5.0) return 'text-amber-400 bg-amber-950/40 border-amber-500/30';
    return 'text-rose-400 bg-rose-950/40 border-rose-500/30';
  };

  return (
    <div className="max-w-7xl mx-auto py-5 px-3 sm:px-6 space-y-5">
      
      {/* Header & Tabs */}
      <div className="bg-[#111115] border border-white/[0.08] rounded-3xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
                <span>Big Data Самоконтроль</span>
                <span className="text-[10px] font-mono font-bold bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full border border-zinc-700">
                  CleverMind v2.0
                </span>
              </h1>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Табличка, которая тебя поменяет — ежедневный хронометраж сна, веществ, оценки дня и дофамина
            </p>
          </div>

          {/* Sleep Cycle & Google Fit Sync Controls */}
          <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
            
            {/* Sleep Cycle Auto-Sync Button */}
            <button
              onClick={() => setIsSleepModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 font-sans font-medium transition-all shadow-sm group"
            >
              <Moon className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-200" />
              <span>Sleep Cycle / Google Fit API</span>
              <span className={`w-1.5 h-1.5 rounded-full ${gfitConfig.isConnected ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`} />
            </button>

            {/* AI Advisor Button */}
            <button
              onClick={() => setIsAiAdvisorOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/60 hover:bg-purple-900/80 border border-purple-500/30 text-purple-200 font-sans font-semibold transition-all shadow-sm group"
            >
              <Brain className="w-3.5 h-3.5 text-purple-400 group-hover:text-purple-200" />
              <span>🧠 ИИ-Анализ месяца</span>
            </button>

            {/* CSV Export Button */}
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 font-sans font-medium transition-all"
              title="Скачать таблицу месяца в CSV формате"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>CSV</span>
            </button>

            <div className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/10 text-zinc-300">
              Ср. оценка: <strong className="text-zinc-100 font-black">{stats.avgScore}</strong>/10
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/10 text-zinc-300">
              Сон: <strong className="text-zinc-100">{stats.avgSleepHoursStr}</strong>
            </div>
          </div>
        </div>


        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 border-t border-white/5 pt-3 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('log')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'log' ? 'bg-zinc-100 text-zinc-950 font-bold shadow' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            📋 Таблица Дней (31)
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'analytics' ? 'bg-zinc-100 text-zinc-950 font-bold shadow' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            📊 Аналитика & Корреляции
          </button>
          <button
            onClick={() => setActiveTab('biometrics')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'biometrics' ? 'bg-zinc-100 text-zinc-950 font-bold shadow' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            🧬 Биометрия & Гормоны
          </button>
          <button
            onClick={() => setActiveTab('journal')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'journal' ? 'bg-zinc-100 text-zinc-950 font-bold shadow' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            📝 Дневник & Итоги
          </button>
        </div>
      </div>

      {activeTab === 'log' && (
        /* Full 31-Day Table */
        <div className="bg-[#111115] border border-white/[0.08] rounded-3xl p-4 sm:p-5 shadow-2xl space-y-3 overflow-hidden">
          <div className="flex items-center justify-between pb-2 border-b border-white/5 text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-200">
                Лог за {data.monthName} {data.year} (Кликните на строку для заполнения)
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                • Источник: {data.sleepSync.lastSyncedAt}
              </span>
            </div>

            <button
              onClick={() => handleFetchGoogleFitApi()}
              disabled={isSyncingSleep}
              className="flex items-center gap-1 text-[11px] font-mono text-zinc-300 hover:text-white bg-zinc-900 border border-white/10 hover:border-white/20 px-2.5 py-1 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncingSleep ? 'animate-spin' : ''}`} />
              <span>{isSyncingSleep ? 'Запрос к API...' : 'Запросить сон по API'}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[780px]">
              <thead>
                <tr className="border-b border-white/10 text-zinc-500 text-[11px] font-mono uppercase tracking-wider">
                  <th className="py-2 px-2 w-16">День</th>
                  <th className="py-2 px-2 w-32">Сон (Sleep Cycle)</th>
                  <th className="py-2 px-3">Что использовалось (Добавки / Ноотропы)</th>
                  <th className="py-2 px-2 w-20 text-center">Оценка</th>
                  <th className="py-2 px-3">Почему / Рефлексия</th>
                  <th className="py-2 px-3 w-52">Сферы (1-клик)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {data.days.map((entry) => {
                  const isWeekend = entry.dayOfWeek === 'сб' || entry.dayOfWeek === 'вс';
                  const isCurrentDay = entry.day === 29;

                  return (
                    <tr
                      key={entry.day}
                      onClick={() => openDayEdit(entry)}
                      className={`cursor-pointer transition-colors group ${
                        isCurrentDay
                          ? 'bg-zinc-800/40 hover:bg-zinc-800/60'
                          : 'hover:bg-[#15151b]'
                      }`}
                    >
                      {/* Day & Weekday */}
                      <td className="py-2.5 px-2 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-5 h-5 rounded flex items-center justify-center font-bold text-xs ${
                            isCurrentDay ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-200'
                          }`}>
                            {entry.day}
                          </span>
                          <span className={`text-[10px] uppercase font-bold ${
                            isWeekend ? 'text-zinc-400' : 'text-zinc-600'
                          }`}>
                            {entry.dayOfWeek}
                          </span>
                        </div>
                      </td>

                      {/* Sleep (with Sleep Cycle Quality Badge) */}
                      <td className="py-2.5 px-2 font-mono text-zinc-300">
                        {entry.sleep ? (
                          <div className="flex items-center gap-1.5">
                            <span>{entry.sleep}</span>
                            {entry.sleepQualityPercent && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono" title={`Качество сна: ${entry.sleepQualityPercent}%`}>
                                {entry.sleepQualityPercent}%
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-700 italic">—</span>
                        )}
                      </td>

                      {/* Supplements / Nootropics */}
                      <td className="py-2.5 px-3 text-zinc-400 truncate max-w-[200px]" title={entry.supplements}>
                        {entry.supplements ? (
                          <span className="text-zinc-300">{entry.supplements}</span>
                        ) : (
                          <span className="text-zinc-600 italic">(ничего)</span>
                        )}
                      </td>

                      {/* Score */}
                      <td className="py-2.5 px-2 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-lg font-mono font-bold text-xs border ${getScoreColorClass(entry.score)}`}>
                          {entry.score !== null ? entry.score.toFixed(1) : '—'}
                        </span>
                      </td>

                      {/* Why */}
                      <td className="py-2.5 px-3 text-zinc-400 truncate max-w-[220px]" title={entry.why}>
                        {entry.why || <span className="text-zinc-700 italic">Нажмите, чтобы добавить заметку...</span>}
                      </td>

                      {/* Interactive Activity Tags */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          {(['Work', 'Tr', 'Dr', 'Soc', 'NC', 'NP'] as ActivityTag[]).map((tagKey) => {
                            const isTagged = entry.tags.includes(tagKey) || entry.tags.includes(`${tagKey}+` as ActivityTag);
                            const isPlus = entry.tags.includes(`${tagKey}+` as ActivityTag);

                            return (
                              <button
                                key={tagKey}
                                onClick={(e) => handleQuickToggleTag(entry.day, tagKey, e)}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-all ${
                                  isTagged
                                    ? isPlus
                                      ? 'bg-zinc-100 text-zinc-950 font-black shadow-sm'
                                      : 'bg-zinc-700 text-zinc-100 border border-zinc-600'
                                    : 'bg-zinc-900 text-zinc-600 hover:text-zinc-400 border border-white/[0.02]'
                                }`}
                                title={`Клик для переключения ${tagKey}`}
                              >
                                {isPlus ? `${tagKey}+` : tagKey}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        /* Big Data Correlations & Spheres Matrix */
        <div className="space-y-4">
          {/* Interactive SVG 31-Day Trend Line Chart */}
          <BigDataChart days={data.days} />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">

            
            {/* Avg Score */}
            <div className="bg-[#111115] border border-white/[0.08] rounded-3xl p-5 space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase font-mono font-semibold">Средняя Оценка Месяца</span>
              <div className="text-3xl font-black font-mono text-zinc-100 tracking-tight">
                {stats.avgScore} <span className="text-sm text-zinc-500 font-normal">/ 10</span>
              </div>
              <p className="text-[11px] text-zinc-500">Заполнено {stats.scoredDaysCount} дней из 31</p>
            </div>

            {/* Work & Productivity */}
            <div className="bg-[#111115] border border-white/[0.08] rounded-3xl p-5 space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase font-mono font-semibold">Дни Продуктивности (Work)</span>
              <div className="text-3xl font-black font-mono text-zinc-100 tracking-tight">
                {stats.workDays} <span className="text-sm text-zinc-500 font-normal">дней</span>
              </div>
              <p className="text-[11px] text-zinc-500">{Math.round((stats.workDays / 31) * 100)}% от общего месяца</p>
            </div>

            {/* Training */}
            <div className="bg-[#111115] border border-white/[0.08] rounded-3xl p-5 space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase font-mono font-semibold">Спорт & Тренировки (Tr)</span>
              <div className="text-3xl font-black font-mono text-zinc-100 tracking-tight">
                {stats.trainingDays} <span className="text-sm text-zinc-500 font-normal">тренировок</span>
              </div>
              <p className="text-[11px] text-zinc-500">Регулярность: ~3.5 раза в неделю</p>
            </div>

            {/* Drive / Energy */}
            <div className="bg-[#111115] border border-white/[0.08] rounded-3xl p-5 space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase font-mono font-semibold">Дни Высокого Драйва (Dr)</span>
              <div className="text-3xl font-black font-mono text-zinc-100 tracking-tight">
                {stats.driveDays} <span className="text-sm text-zinc-500 font-normal">дней</span>
              </div>
              <p className="text-[11px] text-zinc-500">Пиковая энергия и высокая мотивация</p>
            </div>
          </div>

          {/* Correlations Block */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* Sleep vs Score Correlation */}
            <div className="bg-[#111115] border border-white/[0.08] rounded-3xl p-5 space-y-3">
              <h3 className="font-bold text-sm text-zinc-100 flex items-center gap-2">
                <Moon className="w-4 h-4 text-zinc-400" />
                <span>Корреляция: Сон ➔ Самочувствие и Драйв</span>
              </h3>
              
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-white/5 space-y-1">
                  <span className="text-[10px] text-zinc-500 font-mono block">Сон ≥ 7ч 20м (Sleep Cycle)</span>
                  <p className="text-xl font-bold font-mono text-emerald-400">{stats.avgHighSleepScore} / 10</p>
                  <p className="text-[10px] text-zinc-500">Высокая продуктивность и стабильный фокус</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-white/5 space-y-1">
                  <span className="text-[10px] text-zinc-500 font-mono block">Сон &lt; 7ч 20м</span>
                  <p className="text-xl font-bold font-mono text-amber-400">{stats.avgLowSleepScore} / 10</p>
                  <p className="text-[10px] text-zinc-500">Снижение концентрации и драйва</p>
                </div>
              </div>
            </div>

            {/* Dopamine Detox & Health Control */}
            <div className="bg-[#111115] border border-white/[0.08] rounded-3xl p-5 space-y-3">
              <h3 className="font-bold text-sm text-zinc-100 flex items-center gap-2">
                <Flame className="w-4 h-4 text-zinc-400" />
                <span>Дофаминовая Чистота & Контроль Привычек</span>
              </h3>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-white/5 space-y-1">
                  <span className="text-[10px] text-zinc-500 font-mono block">No Cigarettes (NC)</span>
                  <p className="text-xl font-bold font-mono text-zinc-100">{stats.ncDays} / 31</p>
                  <p className="text-[10px] text-zinc-500">Чистые легкие и чистый дофамин</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-white/5 space-y-1">
                  <span className="text-[10px] text-zinc-500 font-mono block">Dopamine Detox (NP)</span>
                  <p className="text-xl font-bold font-mono text-zinc-100">{stats.npDays} / 31</p>
                  <p className="text-[10px] text-zinc-500">Сохранение сексуальной энергии и фокуса</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'biometrics' && (
        /* Biometrics & Hormones Profile */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* Physical Body Metrics */}
          <div className="bg-[#111115] border border-white/[0.08] rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <h3 className="font-bold text-sm text-zinc-100 flex items-center gap-2">
                <Activity className="w-4 h-4 text-zinc-400" />
                <span>Антропометрия & Замеры Тела</span>
              </h3>
              <span className="text-[10px] font-mono text-zinc-500">Ежемесячный замер</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-2xl bg-zinc-900 border border-white/5">
                <span className="text-[10px] text-zinc-500 block">Вес</span>
                <span className="text-lg font-bold font-mono text-zinc-100">{data.biometrics.weightKg} кг</span>
              </div>
              <div className="p-3 rounded-2xl bg-zinc-900 border border-white/5">
                <span className="text-[10px] text-zinc-500 block">Живот / Талия</span>
                <span className="text-lg font-bold font-mono text-zinc-100">{data.biometrics.waistCm} см</span>
              </div>
              <div className="p-3 rounded-2xl bg-zinc-900 border border-white/5">
                <span className="text-[10px] text-zinc-500 block">Руки (бицепс)</span>
                <span className="text-lg font-bold font-mono text-zinc-100">{data.biometrics.armsCm} см</span>
              </div>
              <div className="p-3 rounded-2xl bg-zinc-900 border border-white/5">
                <span className="text-[10px] text-zinc-500 block">Икры</span>
                <span className="text-lg font-bold font-mono text-zinc-100">{data.biometrics.calvesCm} см</span>
              </div>
              <div className="p-3 rounded-2xl bg-zinc-900 border border-white/5">
                <span className="text-[10px] text-zinc-500 block">Бедро</span>
                <span className="text-lg font-bold font-mono text-zinc-100">{data.biometrics.thighsCm} см</span>
              </div>
              <div className="p-3 rounded-2xl bg-zinc-900 border border-white/5">
                <span className="text-[10px] text-zinc-500 block">% Жира</span>
                <span className="text-lg font-bold font-mono text-zinc-100">{data.biometrics.bodyFatPercent}%</span>
              </div>
            </div>
          </div>

          {/* Hormones & Blood Work */}
          <div className="bg-[#111115] border border-white/[0.08] rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <h3 className="font-bold text-sm text-zinc-100 flex items-center gap-2">
                <Dna className="w-4 h-4 text-zinc-400" />
                <span>Гормональный Профиль (Лаборатория)</span>
              </h3>
              <span className="text-[10px] font-mono text-zinc-500">Тест: {data.hormones.lastTestDate}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-2xl bg-zinc-900 border border-white/5">
                <span className="text-[10px] text-zinc-500 block">Тестостерон</span>
                <span className="text-base font-bold font-mono text-zinc-100">{data.hormones.testosteroneNmol} нмоль/л</span>
              </div>
              <div className="p-3 rounded-2xl bg-zinc-900 border border-white/5">
                <span className="text-[10px] text-zinc-500 block">Эстрадиол</span>
                <span className="text-base font-bold font-mono text-zinc-100">{data.hormones.estradiolNgL} нг/л</span>
              </div>
              <div className="p-3 rounded-2xl bg-zinc-900 border border-white/5">
                <span className="text-[10px] text-zinc-500 block">ГСПГ</span>
                <span className="text-base font-bold font-mono text-zinc-100">{data.hormones.shbgNmol} нмоль/л</span>
              </div>
              <div className="p-3 rounded-2xl bg-zinc-900 border border-white/5">
                <span className="text-[10px] text-zinc-500 block">Лютеинизирующий (ЛГ)</span>
                <span className="text-base font-bold font-mono text-zinc-100">{data.hormones.lh} мМЕ/мл</span>
              </div>
              <div className="p-3 rounded-2xl bg-zinc-900 border border-white/5">
                <span className="text-[10px] text-zinc-500 block">Гематокрит (ОАК)</span>
                <span className="text-base font-bold font-mono text-zinc-100">{data.hormones.hematocrit}%</span>
              </div>
            </div>

            <p className="text-[11px] text-zinc-500 italic">
              * Лабораторные анализы обновляются каждые 2-3 месяца для мониторинга физиологической калибровки.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'journal' && (
        /* Observations & Monthly Retrospective */
        <div className="space-y-4">
          <div className="bg-[#111115] border border-white/[0.08] rounded-3xl p-5 space-y-3">
            <h3 className="font-bold text-sm text-zinc-100 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-zinc-400" />
              <span>Наблюдения и Заметки Месяца</span>
            </h3>
            <textarea
              rows={4}
              value={data.observations}
              onChange={(e) => saveData({ ...data, observations: e.target.value })}
              className="w-full bg-zinc-900 border border-white/10 rounded-2xl p-3 text-xs text-zinc-200 leading-relaxed focus:outline-none focus:border-zinc-500"
              placeholder="Инсайты, мысли, размышления, эмоции..."
            />
          </div>

          <div className="bg-[#111115] border border-white/[0.08] rounded-3xl p-5 space-y-3">
            <h3 className="font-bold text-sm text-zinc-100 flex items-center gap-2">
              <Award className="w-4 h-4 text-zinc-400" />
              <span>Итоги Месяца (Big Data Ретроспектива)</span>
            </h3>
            <textarea
              rows={3}
              value={data.monthlySummary}
              onChange={(e) => saveData({ ...data, monthlySummary: e.target.value })}
              className="w-full bg-zinc-900 border border-white/10 rounded-2xl p-3 text-xs text-zinc-200 leading-relaxed focus:outline-none focus:border-zinc-500"
              placeholder="Ключевые результаты, победы и планы на следующий месяц..."
            />
          </div>
        </div>
      )}

      {/* Day Edit Modal */}
      {editingDay && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121216] border border-white/10 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h2 className="font-bold text-sm text-zinc-100">
                  Заполнить день {editingDay.day} ({editingDay.dayOfWeek.toUpperCase()})
                </h2>
                <p className="text-[11px] text-zinc-500">
                  Заполнение дня начисляет +20 EXP и +15 🪙 в профиль героя
                </p>
              </div>
              <button
                onClick={() => setEditingDay(null)}
                className="p-1 rounded-lg text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDay} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Сон (ч/м)</label>
                  <input
                    type="text"
                    required
                    placeholder="7ч 40м"
                    value={formSleep}
                    onChange={(e) => setFormSleep(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Оценка Дня (1.0 - 10.0)</label>
                  <input
                    type="text"
                    placeholder="7.2"
                    value={formScore}
                    onChange={(e) => setFormScore(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">
                  Что использовалось (Добавки, Ноотропы, Адаптогены, Кофе)
                </label>
                <input
                  type="text"
                  placeholder="Кофеин 100 мг, Элеутерококк, Тирозин..."
                  value={formSupplements}
                  onChange={(e) => setFormSupplements(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">
                  Почему / Причина оценки дня / Инсайты
                </label>
                <textarea
                  rows={2}
                  placeholder="Отличный фокус на монтаже, закрыл 3 квеста..."
                  value={formWhy}
                  onChange={(e) => setFormWhy(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
                />
              </div>

              {/* Tags Selector */}
              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1.5">
                  Сферы активности дня:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {availableTags.map((tag) => {
                    const isSelected = formTags.includes(tag.id);
                    return (
                      <div
                        key={tag.id}
                        onClick={() => {
                          if (isSelected) {
                            setFormTags(formTags.filter((t) => t !== tag.id));
                          } else {
                            setFormTags([...formTags, tag.id]);
                          }
                        }}
                        className={`p-2 rounded-xl border cursor-pointer flex items-center justify-between text-xs transition-all ${
                          isSelected
                            ? 'bg-zinc-800 border-zinc-500 text-white shadow-sm'
                            : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <div className="truncate">
                          <span className="font-bold font-mono">{tag.label}</span>
                          <span className="text-[10px] text-zinc-500 block truncate">{tag.desc}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-zinc-200 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setEditingDay(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-zinc-900 text-xs text-zinc-400 hover:text-white"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs shadow"
                >
                  Сохранить лог (+20 EXP)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sleep Cycle / Google Fit REST API Modal */}
      {isSleepModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121216] border border-white/10 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-200">
                  <Moon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-sm text-zinc-100">Google Fit & Sleep Cycle REST API</h2>
                  <p className="text-[11px] text-zinc-500">Прямое подключение к облаку Google Fitness API</p>
                </div>
              </div>
              <button
                onClick={() => setIsSleepModalOpen(false)}
                className="p-1 rounded-lg text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Status Message Alert */}
            {apiStatusMessage && (
              <div className={`p-3 rounded-2xl text-xs flex items-start gap-2.5 border ${
                apiStatusMessage.type === 'success' 
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30' 
                  : apiStatusMessage.type === 'error'
                  ? 'bg-rose-950/40 text-rose-300 border-rose-500/30'
                  : 'bg-zinc-900 text-zinc-300 border-white/10'
              }`}>
                {apiStatusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
                {apiStatusMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />}
                {apiStatusMessage.type === 'info' && <RefreshCw className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5 animate-spin" />}
                <p className="flex-1 leading-relaxed">{apiStatusMessage.text}</p>
              </div>
            )}

            {/* Integration Methods */}
            <div className="space-y-3.5 text-xs">
              
              {/* 1. Direct Google Fit REST API Box */}
              <div className="p-4 rounded-2xl bg-zinc-900 border border-white/10 space-y-3 shadow-inner">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HeartPulse className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-zinc-100">Прямой доступ к Google Fit API</span>
                  </div>
                  <span className="text-[10px] font-mono bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded border border-white/5">
                    fitness.googleapis.com
                  </span>
                </div>

                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Запрашивает сессии сна (<code>activityType: 72</code> и <code>com.google.sleep.segment</code>), записанные приложением Sleep Cycle в ваше хранилище Google.
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={handleGoogleFitOAuthLogin}
                    disabled={isOAuthLoading}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs shadow flex items-center justify-center gap-2 transition-all"
                  >
                    <ShieldCheck className="w-4 h-4 text-zinc-900" />
                    <span>{isOAuthLoading ? 'Подключение OAuth...' : 'Войти через Google (OAuth)'}</span>
                  </button>

                  <button
                    onClick={() => handleFetchGoogleFitApi()}
                    disabled={isSyncingSleep}
                    className="py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all border border-white/5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSleep ? 'animate-spin' : ''}`} />
                    <span>{isSyncingSleep ? 'Запрос...' : 'Запросить API'}</span>
                  </button>
                </div>

                {/* Direct Token / Credentials Settings */}
                <div className="pt-2 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setShowTokenDetails(!showTokenDetails)}
                    className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-mono"
                  >
                    <Key className="w-3 h-3" />
                    <span>{showTokenDetails ? 'Скрыть настройки токена' : 'Ввести токен Google OAuth вручную'}</span>
                  </button>

                  {showTokenDetails && (
                    <div className="mt-2.5 space-y-2 bg-black/40 p-3 rounded-xl border border-white/5">
                      <div>
                        <label className="text-[10px] text-zinc-500 font-mono block mb-1">
                          OAuth Access Token (Bearer ya29...):
                        </label>
                        <input
                          type="password"
                          placeholder="Вставьте токен из Google OAuth Playground..."
                          value={customTokenInput}
                          onChange={(e) => setCustomTokenInput(e.target.value)}
                          className="w-full bg-zinc-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-500"
                        />
                      </div>

                      <button
                        onClick={handleSaveCustomToken}
                        className="w-full py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold"
                      >
                        Применить токен и запросить данные
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Database Export from Sleep Cycle (CSV) */}
              <div className="p-3.5 rounded-2xl bg-zinc-900 border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-zinc-400" />
                    <span className="font-semibold text-zinc-200">Импорт файла Sleep Cycle (sleepdata.csv)</span>
                  </div>
                  <span className="text-[9px] font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                    100% точно
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  В Sleep Cycle: <em>Профиль ➔ Ещё ➔ База данных ➔ Экспорт базы в CSV</em>. Выберите файл, чтобы моментально перенести все ваши реальные ночи:
                </p>

                <label className="flex items-center justify-center gap-2 w-full p-2.5 rounded-xl border border-dashed border-white/20 hover:border-white/40 bg-black/20 hover:bg-black/40 cursor-pointer text-xs text-zinc-300 font-semibold transition-all">
                  <Download className="w-3.5 h-3.5" />
                  <span>Выбрать файл sleepdata.csv</span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileUploadSleepCsv}
                    className="hidden"
                  />
                </label>
              </div>

              {/* 3. iOS Shortcuts Webhook */}
              <div className="p-3.5 rounded-2xl bg-zinc-900 border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-zinc-400" />
                    <span className="font-semibold text-zinc-200">Webhook для автоматизаций</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`https://questflow.app/api/sleep-cycle/webhook?token=${data.sleepSync.webhookToken}`}
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 text-[11px] font-mono text-zinc-400 truncate select-all"
                  />
                  <button
                    onClick={handleCopyWebhook}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold shrink-0 flex items-center gap-1"
                  >
                    {copiedWebhook ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedWebhook ? 'Скопировано' : 'Копировать'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
              <button
                onClick={() => setIsSleepModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs shadow"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Life Advisor Modal */}
      <AiLifeAdvisorModal
        isOpen={isAiAdvisorOpen}
        onClose={() => setIsAiAdvisorOpen(false)}
        days={data.days}
      />
    </div>
  );
};


