import React, { useState, useEffect } from 'react';
import { DailyLogEntry } from '../utils/bigDataTracker';
import { generateBigDataInsights, AiInsightReport } from '../utils/aiLifeAdvisor';
import { Sparkles, Brain, Moon, Zap, ShieldAlert, ArrowUpRight, CheckCircle2, TrendingUp, X } from 'lucide-react';

interface AiLifeAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  days: DailyLogEntry[];
}


export function AiLifeAdvisorModal({ isOpen, onClose, days }: AiLifeAdvisorModalProps) {
  const [report, setReport] = useState<AiInsightReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      generateBigDataInsights(days).then((res) => {
        setReport(res);
        setLoading(false);
      });
    }
  }, [isOpen, days]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#111116] border border-purple-500/30 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-gradient-to-r from-purple-950/40 via-transparent to-pink-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-xl shadow-lg shadow-purple-950/50">
              <Brain className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                ИИ-Анализ Продуктивности & Big Data
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  CleverMind AI
                </span>
              </h2>
              <p className="text-xs text-white/40">
                Глубокий анализ корреляций сна, ноотропов и фокуса за 31 день
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto p-6 space-y-6">
          {loading || !report ? (
            <div className="py-16 text-center space-y-4">
              <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-white/50">Анализ нейросетью корреляций и паттернов энергии...</p>
            </div>
          ) : (
            <>
              {/* Top Summary Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-900/30 to-zinc-900/50 border border-purple-500/20 text-xs text-purple-100/90 leading-relaxed flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white mb-1">Главный вывод месяца</div>
                  {report.summary}
                </div>
              </div>

              {/* 2 Column Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Sleep Optimal Window */}
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                    <Moon className="w-4 h-4 text-indigo-400" />
                    Оптимальный Сон
                  </div>
                  <div className="text-2xl font-bold font-mono text-white">
                    {report.sleepCorrelation.optimalDurationRange}
                  </div>
                  <p className="text-[11px] text-white/50 leading-relaxed">
                    {report.sleepCorrelation.recommendation}
                  </p>
                </div>

                {/* Score & Factors */}
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    Средний Балл Фокуса
                  </div>
                  <div className="text-2xl font-bold font-mono text-emerald-400 flex items-center gap-2">
                    {report.scoreAnalysis.averageScore} <span className="text-xs text-white/40">/ 10</span>
                  </div>
                  <p className="text-[11px] text-white/50 leading-relaxed">
                    {report.scoreAnalysis.topPositiveFactors[0]}
                  </p>
                </div>
              </div>

              {/* Action Pillars */}
              <div>
                <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  3 Стратегических Шага для Роста Энергии
                </h3>
                <div className="space-y-2.5">
                  {report.actionPillars.map((pillar, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 transition-all flex items-start gap-3"
                    >
                      <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-white">{pillar.title}</div>
                        <div className="text-[11px] text-white/50 leading-relaxed">{pillar.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top & Low Days */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-900/30">
                  <div className="text-xs font-bold text-emerald-400 mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Пиковые дни фокуса
                  </div>
                  <ul className="text-[11px] text-white/60 space-y-1">
                    {report.scoreAnalysis.bestDays.map((d, i) => (
                      <li key={i} className="truncate">• {d}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3.5 rounded-2xl bg-rose-950/20 border border-rose-900/30">
                  <div className="text-xs font-bold text-rose-400 mb-2 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" /> Дни спада энергии
                  </div>
                  <ul className="text-[11px] text-white/60 space-y-1">
                    {report.scoreAnalysis.worstDays.map((d, i) => (
                      <li key={i} className="truncate">• {d}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-black/40 border-t border-white/5 flex items-center justify-between text-xs">
          <span className="text-[11px] text-white/40">
            Основано на доказательном анализе сна и биометрии
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition-all"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
