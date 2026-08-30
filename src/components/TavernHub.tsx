import React, { useState } from 'react';
import { UserStats, Reward } from '../types';
import { HeroTavern } from './HeroTavern';
import { TeamChannelsManager } from './TeamChannelsManager';
import { 
  ShoppingBag, 
  Users, 
  Sparkles, 
  Shield, 
  Coins, 
  Trophy 
} from 'lucide-react';

interface TavernHubProps {
  stats: UserStats;
  rewards: Reward[];
  onUpdateStats: (newStats: Partial<UserStats>) => void;
  onBuyReward: (reward: Reward) => boolean;
  onAddReward: (reward: Omit<Reward, 'id' | 'timesPurchased'>) => void;
}

export function TavernHub({
  stats,
  rewards,
  onUpdateStats,
  onBuyReward,
  onAddReward,
}: TavernHubProps) {
  const [tavernTab, setTavernTab] = useState<'shop' | 'team'>('shop');

  return (
    <div className="space-y-4 max-w-7xl mx-auto py-2 px-2 sm:px-4 animate-fade-in select-none">
      
      {/* ─── Tavern Sub-Header & Switcher ──────────────────────────────────── */}
      <div className="bg-[#101014] border border-white/[0.07] rounded-2xl p-3 sm:p-4 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">Таверна & Команда</h2>
            <p className="text-[11px] text-zinc-400 font-mono">Трата золота 🪙, Прокачка Героя и Совместная работа</p>
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="flex items-center gap-1.5 bg-black/50 border border-white/10 rounded-xl p-1 text-xs flex-wrap">
          <button
            onClick={() => setTavernTab('shop')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              tavernTab === 'shop' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
            <span>Магазин Наград ({stats.gold} 🪙)</span>
          </button>

          <button
            onClick={() => setTavernTab('team')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              tavernTab === 'team' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-purple-400" />
            <span>Команда & Каналы</span>
          </button>
        </div>
      </div>

      {/* ─── Views ─────────────────────────────────────────────────────────── */}
      {tavernTab === 'shop' && (
        <HeroTavern
          stats={stats}
          rewards={rewards}
          onUpdateStats={onUpdateStats}
          onBuyReward={onBuyReward}
          onAddReward={onAddReward}
        />
      )}

      {tavernTab === 'team' && (
        <TeamChannelsManager />
      )}
    </div>
  );
}
