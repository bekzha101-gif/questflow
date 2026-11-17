import { useState } from 'react';
import { UserStats, Reward } from '../types';
import { HeroTavern } from './HeroTavern';
import { TeamChannelsManager } from './TeamChannelsManager';
import { ShoppingBag, Users } from 'lucide-react';

interface TavernHubProps {
  stats: UserStats;
  rewards: Reward[];
  /** Не используется: классов героя больше нет */
  onUpdateStats?: (newStats: Partial<UserStats>) => void;
  onBuyReward: (reward: Reward) => boolean;
  onAddReward: (reward: Omit<Reward, 'id' | 'timesPurchased'>) => void;
}

// Магазин наград и команда каналов
export function TavernHub({ stats, rewards, onBuyReward, onAddReward }: TavernHubProps) {
  const [tab, setTab] = useState<'shop' | 'team'>('shop');
  const btn = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
      active ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
    }`;

  return (
    <div className="space-y-3 animate-fade-in select-none">
      <div className="inline-flex items-center gap-1 bg-black/40 border border-white/10 rounded-xl p-1">
        <button onClick={() => setTab('shop')} className={btn(tab === 'shop')}>
          <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
          Магазин
        </button>
        <button onClick={() => setTab('team')} className={btn(tab === 'team')}>
          <Users className="w-3.5 h-3.5 text-purple-400" />
          Команда
        </button>
      </div>

      {tab === 'shop' && <HeroTavern stats={stats} rewards={rewards} onBuyReward={onBuyReward} onAddReward={onAddReward} />}
      {tab === 'team' && <TeamChannelsManager />}
    </div>
  );
}
