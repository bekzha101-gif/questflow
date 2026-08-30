import React, { useState } from 'react';
import { UserStats, Reward, HeroClass } from '../types';
import { 
  ShoppingBag, 
  Coins, 
  Heart, 
  Shield, 
  Gamepad2, 
  Coffee, 
  Gift, 
  Plus, 
  Check, 
  X
} from 'lucide-react';
import { playCoinSound } from '../utils/sound';
import { triggerQuestConfetti } from '../utils/confetti';

interface HeroTavernProps {
  stats: UserStats;
  rewards: Reward[];
  onUpdateStats: (newStats: Partial<UserStats>) => void;
  onBuyReward: (reward: Reward) => boolean;
  onAddReward: (reward: Omit<Reward, 'id' | 'timesPurchased'>) => void;
}

export const HeroTavern: React.FC<HeroTavernProps> = ({
  stats,
  rewards,
  onUpdateStats,
  onBuyReward,
  onAddReward,
}) => {
  const [activeTab, setActiveTab] = useState<'shop' | 'profile'>('shop');
  const [showAddRewardModal, setShowAddRewardModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCost, setNewCost] = useState(30);
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<'real' | 'game'>('real');
  const [shopMessage, setShopMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const classes: { id: HeroClass; name: string; icon: string; perk: string }[] = [
    { id: 'Mage', name: 'Маг Знаний', icon: '🧙‍♂️', perk: '+25% к опыту (EXP) за любые задачи' },
    { id: 'Warrior', name: 'Воин Дисциплины', icon: '⚔️', perk: '+35% к Опыту и Золоту за срочные P1 квесты' },
    { id: 'Rogue', name: 'Тайный Ловкач', icon: '🗡️', perk: '+35% к золоту с каждого закрытого квеста' },
    { id: 'Healer', name: 'Целитель Баланса', icon: '🌿', perk: '+50% к эффективности Зелий Здоровья' },
  ];

  const handlePurchase = (reward: Reward) => {
    if (stats.gold < reward.cost) {
      setShopMessage({
        type: 'error',
        text: `Недостаточно золота! Нужно ${reward.cost} 🪙, а у вас ${stats.gold} 🪙. Закрывайте квесты для фарма золота!`,
      });
      setTimeout(() => setShopMessage(null), 4000);
      return;
    }
    const success = onBuyReward(reward);
    if (success) {
      if (stats.soundEnabled) playCoinSound();
      triggerQuestConfetti();
      setShopMessage({
        type: 'success',
        text: `✨ Вы успешно приобрели «${reward.title}» за ${reward.cost} 🪙!`,
      });
      setTimeout(() => setShopMessage(null), 4000);
    }
  };


  const handleCreateReward = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onAddReward({
      title: newTitle.trim(),
      cost: Number(newCost) || 20,
      description: newDesc.trim() || 'Пользовательская награда',
      type: newType,
      icon: newType === 'game' ? 'Sparkles' : 'Gift',
    });
    setNewTitle('');
    setNewDesc('');
    setShowAddRewardModal(false);
  };

  const getRewardIcon = (iconName: string) => {
    switch (iconName) {
      case 'Gamepad2': return <Gamepad2 className="w-5 h-5 text-zinc-400" />;
      case 'Coffee': return <Coffee className="w-5 h-5 text-zinc-400" />;
      case 'Gift': return <Gift className="w-5 h-5 text-zinc-400" />;
      case 'Heart': return <Heart className="w-5 h-5 text-zinc-400" />;
      case 'Shield': return <Shield className="w-5 h-5 text-zinc-400" />;
      default: return <ShoppingBag className="w-5 h-5 text-zinc-400" />;
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-5 px-3 sm:px-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#111115] border border-white/[0.08] rounded-3xl p-4 sm:p-5">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
            <span>Магазин Наград & Профиль</span>
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Обменивайте накопленное золото на реальные и игровые награды
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/10 text-xs font-semibold text-zinc-200">
            <span>🪙</span>
            <span className="font-mono">{stats.gold} Золота</span>
          </div>

          <button
            onClick={() => setShowAddRewardModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs shadow transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Добавить награду</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 border-b border-white/5 pb-2.5">
        <button
          onClick={() => setActiveTab('shop')}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            activeTab === 'shop'
              ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Магазин ({rewards.length})
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            activeTab === 'profile'
              ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Класс Героя: {stats.heroClass}
        </button>
      </div>

      {/* In-app Shop Message Toast */}
      {shopMessage && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-medium border flex items-center justify-between animate-fade-in ${
            shopMessage.type === 'error'
              ? 'bg-rose-950/80 border-rose-800/60 text-rose-300 shadow-lg shadow-rose-950/40'
              : 'bg-emerald-950/80 border-emerald-800/60 text-emerald-300 shadow-lg shadow-emerald-950/40'
          }`}
        >
          <span>{shopMessage.text}</span>
          <button
            onClick={() => setShopMessage(null)}
            className="text-white/40 hover:text-white ml-2 text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {activeTab === 'shop' ? (

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {rewards.map((reward) => (
            <div
              key={reward.id}
              className="bg-[#111115] hover:bg-[#15151a] border border-white/[0.08] rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center shrink-0">
                  {getRewardIcon(reward.icon)}
                </div>

                <div className="min-w-0">
                  <h3 className="font-bold text-xs text-zinc-200 truncate">{reward.title}</h3>
                  <p className="text-[11px] text-zinc-500 line-clamp-2 mt-0.5">{reward.description}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-zinc-200">
                  {reward.cost} 🪙
                </span>

                <button
                  onClick={() => handlePurchase(reward)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                    stats.gold >= reward.cost
                      ? 'bg-zinc-100 hover:bg-white text-zinc-950 shadow'
                      : 'bg-zinc-900 text-zinc-600 cursor-not-allowed'
                  }`}
                >
                  Купить
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Hero Class Profile */
        <div className="space-y-4">
          <h2 className="font-bold text-sm text-zinc-200">Специализация Героя</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {classes.map((cls) => {
              const isSelected = stats.heroClass === cls.id;

              return (
                <div
                  key={cls.id}
                  onClick={() => onUpdateStats({ heroClass: cls.id })}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-zinc-800/60 border-zinc-500 shadow-sm'
                      : 'bg-[#111115] hover:bg-[#15151a] border-white/[0.08]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{cls.icon}</span>
                      <span className="font-bold text-xs text-zinc-200">{cls.name}</span>
                    </div>
                    {isSelected && (
                      <span className="text-[10px] uppercase font-bold text-zinc-200 bg-zinc-700 px-2 py-0.5 rounded">
                        Активен
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">{cls.perk}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal */}
      {showAddRewardModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121216] border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h2 className="font-bold text-sm text-zinc-100">Новая награда</h2>
              <button
                onClick={() => setShowAddRewardModal(false)}
                className="p-1 rounded-lg text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateReward} className="space-y-3.5">
              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">Название награды</label>
                <input
                  type="text"
                  required
                  placeholder="Серия сериала, прогулка, кофе..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">Стоимость (Золото 🪙)</label>
                <input
                  type="number"
                  min="1"
                  value={newCost}
                  onChange={(e) => setNewCost(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">Описание</label>
                <input
                  type="text"
                  placeholder="Условия разблокировки..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowAddRewardModal(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-zinc-900 text-xs text-zinc-400 hover:text-white"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
