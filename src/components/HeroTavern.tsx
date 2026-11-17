import React, { useState } from 'react';
import { UserStats, Reward } from '../types';
import { Coins, Lock, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { RewardTier } from '@shared/types';
import { RULES, shopLocked } from '@shared/gamification';
import { useCollection } from '../store';
import { playCoinSound } from '../utils/sound';
import { triggerQuestConfetti } from '../utils/confetti';

// Магазин наград: маленькие (еда, соки, серии) и большие (поездки) — за золото.
// Награды редактируемые: название, цена, тип. Классов героя больше нет — все награды по правилам shared/gamification.

interface HeroTavernProps {
  stats: UserStats;
  rewards: Reward[];
  /** Не используется (раньше — смена класса героя) */
  onUpdateStats?: (newStats: Partial<UserStats>) => void;
  onBuyReward: (reward: Reward) => boolean;
  onAddReward: (reward: Omit<Reward, 'id' | 'timesPurchased'>) => void;
}

type ShopReward = Reward & { tier?: RewardTier; seed?: boolean };

interface Draft {
  id: string | null;
  title: string;
  cost: number;
  tier: RewardTier;
  description: string;
}

const EMPTY: Draft = { id: null, title: '', cost: 50, tier: 'small', description: '' };

const TIERS: { id: RewardTier; label: string; hint: string }[] = [
  { id: 'small', label: 'Маленькие', hint: 'на каждый день — за часы фокуса' },
  { id: 'big', label: 'Большие', hint: 'копятся неделями — за цели недели и месяца' },
];

export const HeroTavern: React.FC<HeroTavernProps> = ({ stats, rewards, onBuyReward, onAddReward }) => {
  const { upsert, remove } = useCollection<ShopReward>('rewards2');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const locked = shopLocked(stats as unknown as Parameters<typeof shopLocked>[0]);

  const flash = (ok: boolean, text: string) => {
    setMessage({ ok, text });
    window.setTimeout(() => setMessage(null), 4000);
  };

  const buy = (reward: ShopReward) => {
    if (locked) return flash(false, 'Магазин закрыт после HP 0 — откроется после полного дня (3 блока и все привычки).');
    if (stats.gold < reward.cost) return flash(false, `Не хватает золота: нужно ${reward.cost}, есть ${stats.gold}.`);
    if (onBuyReward(reward)) {
      if (stats.soundEnabled) playCoinSound();
      triggerQuestConfetti();
      flash(true, `Куплено: «${reward.title}» за ${reward.cost} золота.`);
    }
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft || !draft.title.trim()) return;
    const cost = Math.max(1, Math.round(Number(draft.cost) || 1));
    if (draft.id) {
      const cur = rewards.find((r) => r.id === draft.id) as ShopReward | undefined;
      if (cur) upsert({ ...cur, title: draft.title.trim(), cost, tier: draft.tier, description: draft.description.trim(), seed: false });
    } else {
      onAddReward({ title: draft.title.trim(), cost, tier: draft.tier, description: draft.description.trim(), type: 'real', icon: 'Gift' } as Omit<Reward, 'id' | 'timesPurchased'>);
    }
    setDraft(null);
  };

  const list = rewards as ShopReward[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#101014] border border-white/[0.07] rounded-2xl p-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Магазин наград</h2>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Полный блок фокуса — около {Math.round(120 * RULES.focus.goldPerMin) + RULES.focus.fullBlockGold} золота. Цены правятся.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/10 text-xs font-mono text-amber-300">
            <Coins className="w-3.5 h-3.5" />
            {stats.gold}
          </span>
          <button
            onClick={() => setDraft({ ...EMPTY })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            Награда
          </button>
        </div>
      </div>

      {locked && (
        <div className="flex items-center gap-2 p-3 rounded-2xl border border-rose-500/30 bg-rose-950/30 text-xs text-rose-200">
          <Lock className="w-4 h-4 shrink-0" />
          Магазин закрыт: HP дошло до 0. Откроется после первого полного дня — 3 блока фокуса и все привычки.
        </div>
      )}

      {message && (
        <div className={`p-3 rounded-2xl text-xs border ${message.ok ? 'bg-emerald-950/50 border-emerald-700/40 text-emerald-200' : 'bg-rose-950/50 border-rose-700/40 text-rose-200'}`}>
          {message.text}
        </div>
      )}

      {TIERS.map((tier) => {
        const items = list.filter((r) => (r.tier ?? 'small') === tier.id);
        return (
          <section key={tier.id} className="space-y-2">
            <div className="flex items-baseline gap-2 px-1">
              <h3 className="text-xs font-semibold text-zinc-200">{tier.label}</h3>
              <span className="text-[11px] text-zinc-500">{tier.hint}</span>
            </div>
            {items.length === 0 ? (
              <p className="text-[11px] text-zinc-600 px-1">Пока пусто</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {items.map((reward) => {
                  const can = !locked && stats.gold >= reward.cost;
                  const pct = Math.min(100, Math.round((stats.gold / Math.max(1, reward.cost)) * 100));
                  return (
                    <div key={reward.id} className="bg-[#0e0e13] border border-white/[0.07] rounded-2xl p-3.5 flex flex-col gap-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-zinc-100 truncate">{reward.title}</div>
                          {reward.description && <div className="text-[11px] text-zinc-500 line-clamp-2 mt-0.5">{reward.description}</div>}
                          {!!reward.timesPurchased && <div className="text-[10px] text-zinc-600 mt-0.5 font-mono">куплено: {reward.timesPurchased}</div>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            title="Изменить"
                            onClick={() => setDraft({ id: reward.id, title: reward.title, cost: reward.cost, tier: reward.tier ?? 'small', description: reward.description ?? '' })}
                            className="p-1 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            title="Удалить"
                            onClick={() => {
                              if (window.confirm(`Удалить награду «${reward.title}»?`)) remove(reward.id);
                            }}
                            className="p-1 rounded-lg text-zinc-500 hover:text-rose-300 hover:bg-white/5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {tier.id === 'big' && (
                        <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                          <div className="h-full bg-amber-400/70" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1 border-t border-white/5">
                        <span className="font-mono text-xs text-amber-300">{reward.cost}</span>
                        <button
                          onClick={() => buy(reward)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
                            can ? 'bg-zinc-100 hover:bg-white text-zinc-950' : 'bg-zinc-900 text-zinc-600'
                          }`}
                        >
                          Купить
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      {draft && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <form onSubmit={save} className="bg-[#121216] border border-white/10 rounded-3xl max-w-md w-full p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h2 className="font-semibold text-sm text-zinc-100">{draft.id ? 'Изменить награду' : 'Новая награда'}</h2>
              <button type="button" onClick={() => setDraft(null)} className="p-1 rounded-lg text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <label className="block text-xs text-zinc-400">
              Название
              <input
                required
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="mt-1 w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
              />
            </label>
            <label className="block text-xs text-zinc-400">
              Цена в золоте
              <input
                type="number"
                min={1}
                value={draft.cost}
                onChange={(e) => setDraft({ ...draft, cost: Number(e.target.value) })}
                className="mt-1 w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-500"
              />
            </label>
            <div className="flex gap-1.5">
              {TIERS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDraft({ ...draft, tier: t.id })}
                  className={`flex-1 px-3 py-1.5 rounded-xl text-xs border ${draft.tier === t.id ? 'bg-zinc-800 border-zinc-600 text-white' : 'border-white/10 text-zinc-500'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <label className="block text-xs text-zinc-400">
              Описание
              <input
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                className="mt-1 w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
              <button type="button" onClick={() => setDraft(null)} className="px-3.5 py-1.5 rounded-xl bg-zinc-900 text-xs text-zinc-400 hover:text-white">
                Отмена
              </button>
              <button type="submit" className="px-4 py-1.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs">
                Сохранить
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
