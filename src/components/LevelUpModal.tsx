import React from 'react';
import { UserStats } from '../types';
import { CheckCircle2 } from 'lucide-react';

interface LevelUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: UserStats;
}

export const LevelUpModal: React.FC<LevelUpModalProps> = ({
  isOpen,
  onClose,
  stats,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#121216] border border-white/10 rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95">
        <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center text-2xl mx-auto">
          👑
        </div>

        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">
            ПОВЫШЕНИЕ РАНГА
          </span>
          <h2 className="text-xl font-bold text-zinc-100 mt-0.5">
            Уровень {stats.level}
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Здоровье полностью восстановлено. Начислен бонус к золоту.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 py-1">
          <div className="p-3 rounded-2xl bg-zinc-900 border border-white/5">
            <span className="text-[10px] text-zinc-500 block">Здоровье</span>
            <span className="text-sm font-bold font-mono text-zinc-200">100% HP</span>
          </div>
          <div className="p-3 rounded-2xl bg-zinc-900 border border-white/5">
            <span className="text-[10px] text-zinc-500 block">Бонус</span>
            <span className="text-sm font-bold font-mono text-zinc-200">+50 🪙</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs shadow transition-all active:scale-95"
        >
          Продолжить фокус
        </button>
      </div>
    </div>
  );
};
