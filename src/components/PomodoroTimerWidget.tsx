import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Sparkles, Trophy, Coffee, Flame, X, ChevronUp, ChevronDown } from 'lucide-react';
import { playQuestCompleteSound, playCoinSound } from '../utils/sound';
import { triggerQuestConfetti } from '../utils/confetti';

interface PomodoroTimerWidgetProps {
  onSprintComplete?: (exp: number, gold: number) => void;
}

type TimerMode = 'work' | 'shortBreak' | 'longBreak';
type AmbientSound = 'none' | 'gamma' | 'brown' | 'alpha';

export function PomodoroTimerWidget({ onSprintComplete }: PomodoroTimerWidgetProps) {
  const [mode, setMode] = useState<TimerMode>('work');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [completedSprints, setCompletedSprints] = useState(0);
  const [ambientSound, setAmbientSound] = useState<AmbientSound>('none');
  const [isMinimized, setIsMinimized] = useState(true);

  // Audio Context ref for Web Audio API synthesis
  const audioCtxRef = useRef<AudioContext | null>(null);
  const soundNodeRef = useRef<{ osc?: OscillatorNode; gain?: GainNode; noise?: AudioNode } | null>(null);

  // Mode Durations
  const modeTimes = {
    work: 25 * 60,
    shortBreak: 5 * 60,
    longBreak: 15 * 60,
  };

  // Switch mode helper
  const handleSwitchMode = (newMode: TimerMode) => {
    setMode(newMode);
    setTimeLeft(modeTimes[newMode]);
    setIsRunning(false);
  };

  // Countdown timer effect
  useEffect(() => {
    let interval: any = null;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (isRunning && timeLeft === 0) {
      setIsRunning(false);
      stopAmbientSound();

      if (mode === 'work') {
        const nextSprints = completedSprints + 1;
        setCompletedSprints(nextSprints);
        playQuestCompleteSound();
        playCoinSound();
        triggerQuestConfetti();

        if (onSprintComplete) {
          onSprintComplete(25, 15);
        }

        // Switch to appropriate break
        if (nextSprints % 4 === 0) {
          handleSwitchMode('longBreak');
        } else {
          handleSwitchMode('shortBreak');
        }
      } else {
        handleSwitchMode('work');
      }
    }

    return () => clearInterval(interval);
  }, [isRunning, timeLeft, mode, completedSprints, onSprintComplete]);

  // ─── Web Audio API Soundscape Synthesizer ──────────────────────────────────
  const startAmbientSound = (type: AmbientSound) => {
    stopAmbientSound();
    if (type === 'none') return;

    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.12, ctx.currentTime);
      masterGain.connect(ctx.destination);

      if (type === 'gamma' || type === 'alpha') {
        // Binaural Beat generator (Carrier 220Hz + Offset 40Hz for gamma or 10Hz for alpha)
        const offset = type === 'gamma' ? 40 : 10;
        const oscLeft = ctx.createOscillator();
        const oscRight = ctx.createOscillator();
        const merger = ctx.createChannelMerger(2);

        oscLeft.frequency.setValueAtTime(216, ctx.currentTime);
        oscRight.frequency.setValueAtTime(216 + offset, ctx.currentTime);

        oscLeft.type = 'sine';
        oscRight.type = 'sine';

        oscLeft.connect(merger, 0, 0);
        oscRight.connect(merger, 0, 1);
        merger.connect(masterGain);

        oscLeft.start();
        oscRight.start();

        soundNodeRef.current = { osc: oscLeft, gain: masterGain };
      } else if (type === 'brown') {
        // Synthesize real-time soothing Brown Noise
        const bufferSize = ctx.sampleRate * 2;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          output[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = output[i];
          output[i] *= 3.5;
        }

        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, ctx.currentTime);

        whiteNoise.connect(filter);
        filter.connect(masterGain);
        whiteNoise.start();

        soundNodeRef.current = { gain: masterGain, noise: whiteNoise };
      }
    } catch {
      // Audio context policy fallback
    }
  };

  const stopAmbientSound = () => {
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch {}
      audioCtxRef.current = null;
      soundNodeRef.current = null;
    }
  };

  const handleToggleSound = (type: AmbientSound) => {
    const next = ambientSound === type ? 'none' : type;
    setAmbientSound(next);
    if (isRunning) {
      startAmbientSound(next);
    }
  };

  const handleToggleTimer = () => {
    if (!isRunning) {
      setIsRunning(true);
      if (ambientSound !== 'none') {
        startAmbientSound(ambientSound);
      }
    } else {
      setIsRunning(false);
      stopAmbientSound();
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    stopAmbientSound();
    setTimeLeft(modeTimes[mode]);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = ((modeTimes[mode] - timeLeft) / modeTimes[mode]) * 100;

  return (
    <div className="fixed bottom-20 md:bottom-5 left-4 z-40 animate-fade-in select-none">
      {/* Minimized Pill */}
      {isMinimized ? (
        <div
          onClick={() => setIsMinimized(false)}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-2xl border backdrop-blur-md cursor-pointer transition-all shadow-2xl ${
            isRunning
              ? 'bg-purple-950/90 border-purple-500/50 text-white ring-2 ring-purple-500/30'
              : 'bg-[#121216]/90 border-white/10 text-white/70 hover:text-white hover:border-white/20'
          }`}
        >
          <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          <span className="font-mono font-bold text-xs">{formatTime(timeLeft)}</span>
          <span className="text-[10px] text-white/40 uppercase font-mono">
            {mode === 'work' ? 'Фокус' : 'Отдых'}
          </span>
          <ChevronUp className="w-3.5 h-3.5 text-white/40" />
        </div>
      ) : (
        /* Expanded Full Widget */
        <div className="bg-[#121218]/95 backdrop-blur-xl border border-white/15 rounded-3xl p-4 shadow-2xl w-72 space-y-3.5 relative overflow-hidden">
          {/* Progress bar line */}
          <div
            className="absolute top-0 left-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />

          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <Flame className="w-4 h-4 text-orange-400" />
              <span>Помодоро Спринт</span>
            </div>
            <button
              onClick={() => setIsMinimized(true)}
              className="text-white/40 hover:text-white cursor-pointer"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Mode Tabs */}
          <div className="grid grid-cols-3 gap-1 p-0.5 bg-black/40 rounded-xl border border-white/5 text-[10px] font-semibold">
            <button
              onClick={() => handleSwitchMode('work')}
              className={`py-1 rounded-lg transition-all cursor-pointer ${
                mode === 'work' ? 'bg-purple-600 text-white shadow' : 'text-white/40 hover:text-white'
              }`}
            >
              Фокус 25м
            </button>
            <button
              onClick={() => handleSwitchMode('shortBreak')}
              className={`py-1 rounded-lg transition-all cursor-pointer ${
                mode === 'shortBreak' ? 'bg-emerald-600 text-white shadow' : 'text-white/40 hover:text-white'
              }`}
            >
              Перерыв 5м
            </button>
            <button
              onClick={() => handleSwitchMode('longBreak')}
              className={`py-1 rounded-lg transition-all cursor-pointer ${
                mode === 'longBreak' ? 'bg-indigo-600 text-white shadow' : 'text-white/40 hover:text-white'
              }`}
            >
              Отдых 15м
            </button>
          </div>

          {/* Timer Display */}
          <div className="text-center py-1">
            <div className="text-4xl font-black font-mono tracking-tighter text-white drop-shadow-md">
              {formatTime(timeLeft)}
            </div>
            <div className="text-[10px] text-white/40 font-mono mt-1">
              Закрыто спринтов сегодня: <strong className="text-purple-300 font-bold">{completedSprints}</strong> (+{completedSprints * 25} EXP)
            </div>
          </div>

          {/* Main Controls */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={handleToggleTimer}
              className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95 ${
                isRunning
                  ? 'bg-amber-500 hover:bg-amber-600 text-black shadow-amber-950/50'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 text-white shadow-purple-950/50'
              }`}
            >
              {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isRunning ? 'Пауза' : 'Старт Спринта'}</span>
            </button>

            <button
              onClick={handleReset}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white border border-white/10 transition-all cursor-pointer"
              title="Сброс"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Ambient Soundscapes Switcher */}
          <div className="pt-2 border-t border-white/5 space-y-1.5">
            <div className="text-[10px] text-white/40 font-semibold flex items-center justify-between">
              <span>Фоновый саундскейп:</span>
              <span className="text-[9px] font-mono text-purple-400">Web Audio API</span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-[9px] font-medium">
              <button
                onClick={() => handleToggleSound('gamma')}
                className={`py-1 rounded-lg border transition-all cursor-pointer ${
                  ambientSound === 'gamma'
                    ? 'bg-purple-500/20 border-purple-500 text-purple-300 font-bold'
                    : 'bg-white/5 border-transparent text-white/40 hover:text-white'
                }`}
              >
                🧠 40Hz Gamma
              </button>
              <button
                onClick={() => handleToggleSound('brown')}
                className={`py-1 rounded-lg border transition-all cursor-pointer ${
                  ambientSound === 'brown'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                    : 'bg-white/5 border-transparent text-white/40 hover:text-white'
                }`}
              >
                🌊 Brown Noise
              </button>
              <button
                onClick={() => handleToggleSound('alpha')}
                className={`py-1 rounded-lg border transition-all cursor-pointer ${
                  ambientSound === 'alpha'
                    ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 font-bold'
                    : 'bg-white/5 border-transparent text-white/40 hover:text-white'
                }`}
              >
                ✨ 10Hz Alpha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
