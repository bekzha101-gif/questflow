import React, { useEffect, useState } from 'react';
import { RotateCcw, X, Check } from 'lucide-react';

export interface SnackbarAction {
  id: string;
  message: string;
  onUndo?: () => void;
  durationMs?: number;
}

interface UndoSnackbarProps {
  action: SnackbarAction | null;
  onClose: () => void;
}

export function UndoSnackbar({ action, onClose }: UndoSnackbarProps) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!action) return;

    setProgress(100);
    const duration = action.durationMs || 5000;
    const startTime = Date.now();

    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
    }, 50);

    const closeTimer = setTimeout(() => {
      onClose();
    }, duration);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(closeTimer);
    };
  }, [action, onClose]);

  if (!action) return null;

  return (
    <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[99999] flex flex-col items-center animate-slide-up select-none">
      <div className="bg-[#18181f] border border-white/15 rounded-2xl shadow-2xl px-4 py-2.5 flex items-center gap-3 text-xs text-white max-w-sm w-full overflow-hidden relative backdrop-blur-lg">
        {/* Animated bottom progress bar */}
        <div
          className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-75"
          style={{ width: `${progress}%` }}
        />

        <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
          <Check className="w-3 h-3" />
        </div>

        <span className="flex-1 truncate font-medium">{action.message}</span>

        {action.onUndo && (
          <button
            onClick={() => {
              action.onUndo?.();
              onClose();
            }}
            className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-md transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Отмена</span>
          </button>
        )}

        <button
          onClick={onClose}
          className="text-white/40 hover:text-white transition-colors cursor-pointer shrink-0"
          title="Закрыть"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
