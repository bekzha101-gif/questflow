import React, { useState } from 'react';
import { Boss, UserStats } from '../types';
import { 
  Swords, 
  Flame, 
  Sparkles, 
  Coins, 
  Clock, 
  ShieldAlert, 
  Trophy,
  Skull
} from 'lucide-react';
import { playBossHitSound, playQuestCompleteSound } from '../utils/sound';
import { triggerQuestConfetti } from '../utils/confetti';

interface BossRaidProps {
  boss: Boss;
  stats: UserStats;
  onAttackBoss: (damage: number) => void;
  onDefeatBoss: () => void;
}

export const BossRaid: React.FC<BossRaidProps> = ({
  boss,
  stats,
  onAttackBoss,
  onDefeatBoss,
}) => {
  const [battleLogs, setBattleLogs] = useState<string[]>([
    '⚔️ Рейд начался! Наносите урон боссу, выполняя ключевые задачи (P1/P2) и держа стрики.',
    '💥 Вы нанесли 120 урона за закрытие задачи "Смонтировать ролик по геймификации"!',
    '🛡️ Босс пытается отвлечь вас уведомлениями в соцсетях. Держите щит фокуса!',
  ]);

  const bossHpPercent = Math.max(0, Math.min(100, (boss.currentHp / boss.maxHp) * 100));

  const handleTestAttack = () => {
    const dmg = stats.heroClass === 'Warrior' ? 150 : 100;
    if (stats.soundEnabled) playBossHitSound();
    triggerQuestConfetti();
    onAttackBoss(dmg);
    setBattleLogs((prev) => [
      `💥 Сокрушительный удар Героя! Босс потерял ${dmg} HP! (${new Date().toLocaleTimeString()})`,
      ...prev.slice(0, 8),
    ]);
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      
      {/* Boss Arena Card */}
      <div className="relative bg-gradient-to-b from-[#1c0e14] via-[#140e15] to-[#0d090e] border border-rose-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden glow-rose text-center">
        
        {/* Glow ambient */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-rose-600/20 blur-3xl pointer-events-none" />

        {/* Header Badges */}
        <div className="flex items-center justify-between gap-2 mb-6 relative z-10 text-xs">
          <span className="px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold flex items-center gap-1.5 animate-pulse">
            <Skull className="w-3.5 h-3.5" /> СЕЗОННЫЙ БОСС
          </span>
          <span className="text-white/40 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Сброс через: 3 дня
          </span>
        </div>

        {/* Boss Avatar & Title */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl bg-gradient-to-b from-rose-500/20 to-red-950/40 border-2 border-rose-500/50 flex items-center justify-center text-6xl sm:text-7xl shadow-2xl mb-4 hover:scale-105 transition-transform duration-300">
            {boss.avatar}
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {boss.name}
          </h1>
          <p className="text-xs sm:text-sm text-rose-300/80 font-medium mt-0.5">
            «{boss.title}»
          </p>
        </div>

        {/* Boss HP Bar */}
        <div className="max-w-xl mx-auto mt-6 mb-8 relative z-10">
          <div className="flex justify-between items-center text-xs font-bold mb-2">
            <span className="text-rose-400 flex items-center gap-1">
              <ShieldAlert className="w-4 h-4" /> ЗДОРОВЬЕ БОССА
            </span>
            <span className="text-white tabular-nums text-sm">
              {boss.currentHp} / {boss.maxHp} HP ({Math.round(bossHpPercent)}%)
            </span>
          </div>

          <div className="h-4 w-full bg-black/60 rounded-full overflow-hidden border border-rose-500/40 p-0.5">
            <div
              className="h-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 rounded-full transition-all duration-500 shadow-md"
              style={{ width: `${bossHpPercent}%` }}
            />
          </div>
        </div>

        {/* Raid Loot Box */}
        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto mb-6 relative z-10 text-xs">
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-amber-300">Награда: +{boss.rewardExp} EXP</span>
          </div>
          <div className="p-3 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center gap-2">
            <Coins className="w-4 h-4 text-yellow-400" />
            <span className="font-bold text-yellow-300">Награда: +{boss.rewardGold} Золота</span>
          </div>
        </div>

        {/* Attack Button */}
        <div className="relative z-10">
          <button
            onClick={handleTestAttack}
            className="px-8 py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-extrabold text-sm shadow-xl shadow-rose-950/40 active:scale-95 transition-all inline-flex items-center gap-2"
          >
            <Swords className="w-4 h-4" />
            <span>⚔️ НАПРЯМУЮ АТАКОВАТЬ БОССА ({stats.heroClass === 'Warrior' ? '150' : '100'} DMG)</span>
          </button>
          <p className="text-[11px] text-white/40 mt-2">
            * Босс автоматически получает урон каждый раз, когда вы закрываете задачи в Todoist или Flow Shorts
          </p>
        </div>
      </div>

      {/* Battle Combat Log */}
      <div className="bg-[#121217] border border-white/10 rounded-2xl p-5">
        <h2 className="text-xs font-bold text-white/70 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span>📜 Журнал Битвы (Combat Log)</span>
        </h2>
        <div className="space-y-2 max-h-48 overflow-y-auto font-mono text-xs text-white/70">
          {battleLogs.map((log, idx) => (
            <div key={idx} className="p-2 rounded-xl bg-white/[0.02] border border-white/5">
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
