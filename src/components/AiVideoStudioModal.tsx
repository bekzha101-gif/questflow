import React, { useState, useEffect } from 'react';
import { Sparkles, Play, Pause, RotateCcw, Copy, Check, Sliders, Film, Type, Wand2, ArrowRight, X } from 'lucide-react';
import { VideoItem } from './ContentProductionBoard';

interface AiVideoStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: VideoItem | null;
  onSaveScript?: (videoId: string, script: string) => void;
}

export function AiVideoStudioModal({ isOpen, onClose, video, onSaveScript }: AiVideoStudioModalProps) {
  const [activeTab, setActiveTab] = useState<'hooks' | 'script' | 'teleprompter'>('hooks');
  const [scriptText, setScriptText] = useState(video?.scriptSnippet || '');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Teleprompter state
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(2); // 1-5
  const [fontSize, setFontSize] = useState(28); // 20-48px

  useEffect(() => {
    if (video) {
      setScriptText(video.scriptSnippet || defaultGeneratedScript(video.title));
    }
  }, [video]);

  // Teleprompter auto-scroll effect
  useEffect(() => {
    let animationFrame: number;
    const container = document.getElementById('teleprompter-scroll-container');

    const scrollStep = () => {
      if (isScrolling && container) {
        container.scrollTop += scrollSpeed * 0.8;
        if (container.scrollTop + container.clientHeight >= container.scrollHeight) {
          setIsScrolling(false);
        }
      }
      if (isScrolling) {
        animationFrame = requestAnimationFrame(scrollStep);
      }
    };

    if (isScrolling) {
      animationFrame = requestAnimationFrame(scrollStep);
    }
    return () => cancelAnimationFrame(animationFrame);
  }, [isScrolling, scrollSpeed]);

  if (!isOpen || !video) return null;

  const generatedHooks = [
    `«99% людей делают это неправильно, пока не узнают этот секрет...»`,
    `«Почему топовые авторы молчат об этой фишке в 2026 году? Смотри до конца.»`,
    `«Я потратил 30 дней на этот эксперимент, и результат меня шокировал!»`,
    `«Если вы хотите удвоить просмотры прямо сейчас, примените это простое правило:»`,
    `«Секретная связка, которая изменила всё за 48 часов. Сохрани, чтобы не потерять.»`
  ];

  function defaultGeneratedScript(title: string) {
    return `[0-3s ХУК]: ${title} — почему об этом никто не говорит?\n\n[3-15s ПРОБЛЕМА]: Большинство авторов тратят часы на монтаж, но их ролики не удерживают внимание дольше 5 секунд.\n\n[15-35s РЕШЕНИЕ]: Вот 3 шага, которые изменят удержание:\n1. Динамическая смена кадра каждые 2.5 секунды.\n2. Визуальные акценты и субтитры с выделением ключевых слов.\n3. Смысловая петля перед финалом.\n\n[35-50s ПРИМЕР]: Посмотрите, как это работает на практике в моих прошлых роликах.\n\n[50-60s CTA]: Подпишись на канал, если хочешь создавать топовый контент каждый день!`;
  }

  const handleCopyHook = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSave = () => {
    if (video && onSaveScript) {
      onSaveScript(video.id, scriptText);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-[#111116] border border-purple-500/30 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-purple-950/40 via-transparent to-pink-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-xl shadow-lg shadow-purple-950/50">
              <Film className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Студия Сценариев & AI Хуков
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Viral Engine
                </span>
              </h2>
              <p className="text-xs text-white/40 truncate max-w-md">
                Ролик: <span className="text-white font-medium">«{video.title}»</span>
              </p>
            </div>
          </div>

          <button onClick={onClose} className="text-white/40 hover:text-white text-xl cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-white/5 bg-white/[0.02]">
          <button
            onClick={() => setActiveTab('hooks')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'hooks'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-950/50'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>5 Вирусных Хуков</span>
          </button>

          <button
            onClick={() => setActiveTab('script')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'script'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-950/50'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            <span>Сценарий Shorts (60 сек)</span>
          </button>

          <button
            onClick={() => setActiveTab('teleprompter')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'teleprompter'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-950/50'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>Телесуфлер для озвучки</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="overflow-y-auto p-6 flex-1 space-y-4">
          
          {/* TAB 1: Viral Hooks */}
          {activeTab === 'hooks' && (
            <div className="space-y-3">
              <div className="text-xs text-white/50 mb-2 flex items-center justify-between">
                <span>Хуки, сгенерированные для удержания первых 3 секунд ролика:</span>
                <span className="text-[10px] font-mono text-purple-400">Алгоритмический CTR 85%+</span>
              </div>

              {generatedHooks.map((hook, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 hover:border-purple-500/30 transition-all flex items-center justify-between gap-4 group"
                >
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed font-medium">
                      {hook}
                    </p>
                  </div>

                  <button
                    onClick={() => handleCopyHook(hook, idx)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-purple-600/30 text-white/50 hover:text-purple-300 border border-white/10 transition-all shrink-0 cursor-pointer"
                    title="Копировать хук"
                  >
                    {copiedIndex === idx ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* TAB 2: Full Script Editor */}
          {activeTab === 'script' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-white/50">
                <span>Текст сценария с хронометражем и таймкодами:</span>
                <button
                  onClick={() => setScriptText(defaultGeneratedScript(video.title))}
                  className="text-purple-400 hover:underline text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <Wand2 className="w-3 h-3" /> Перегенерировать
                </button>
              </div>

              <textarea
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                rows={12}
                placeholder="Напишите или сгенерируйте сценарий..."
                className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-xs sm:text-sm text-white font-mono leading-relaxed focus:outline-none focus:border-purple-500 transition-all resize-y"
              />
            </div>
          )}

          {/* TAB 3: Teleprompter Mode */}
          {activeTab === 'teleprompter' && (
            <div className="space-y-4">
              {/* Teleprompter Controls */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10 flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsScrolling(!isScrolling)}
                    className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                      isScrolling
                        ? 'bg-amber-500 hover:bg-amber-600 text-black shadow-lg shadow-amber-950/50'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/50'
                    }`}
                  >
                    {isScrolling ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    <span>{isScrolling ? 'Пауза' : 'Старт суфлера'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsScrolling(false);
                      const el = document.getElementById('teleprompter-scroll-container');
                      if (el) el.scrollTop = 0;
                    }}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all cursor-pointer"
                    title="В начало"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>

                {/* Speed & Font sliders */}
                <div className="flex items-center gap-4 text-xs text-white/60">
                  <div className="flex items-center gap-2">
                    <span>Скорость: {scrollSpeed}x</span>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={0.5}
                      value={scrollSpeed}
                      onChange={(e) => setScrollSpeed(Number(e.target.value))}
                      className="w-20 accent-purple-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span>Размер: {fontSize}px</span>
                    <input
                      type="range"
                      min={20}
                      max={44}
                      step={2}
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className="w-20 accent-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* Scrolling Text Window */}
              <div
                id="teleprompter-scroll-container"
                className="h-72 bg-black/90 border border-purple-500/20 rounded-3xl p-8 overflow-y-auto font-sans font-bold leading-relaxed text-center select-none space-y-6 shadow-inner relative"
                style={{ fontSize: `${fontSize}px` }}
              >
                {scriptText.split('\n\n').map((para, i) => (
                  <p key={i} className="text-zinc-100 drop-shadow-md">
                    {para}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-black/40 border-t border-white/5 flex items-center justify-between text-xs">
          <span className="text-white/40 text-[11px]">
            AI Студия оптимизирует структуру сценария под максимальное удержание
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all cursor-pointer font-medium"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 text-white font-bold transition-all shadow-lg shadow-purple-950/40 cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Сохранить сценарий</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
