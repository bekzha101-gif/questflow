import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Channel, Income } from '@shared/types';
import { RULES } from '@shared/gamification';
import { todayStr } from '@shared/time';
import { useCollection } from '../../store';
import { applyGame } from './game';
import { incomeByChannel } from './series';

// «Прогресс» → «Доход»: ввод по каналам в USD (бот спрашивает в воскресенье). Каждые $100 — EXP по правилам.

export function IncomePanel({ incomeTotal }: { incomeTotal: number }) {
  const { items: rows, upsert, remove } = useCollection<Income>('income');
  const { items: channels } = useCollection<Channel>('channels2');
  const [date, setDate] = useState(todayStr());
  const [channelId, setChannelId] = useState('');
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('AdSense');

  const nameOf = (id: string) => channels.find((c) => c.id === id)?.name ?? 'Без канала';
  const byChannel = incomeByChannel(rows);
  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date));
  const toNext = 100 - (incomeTotal % 100);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const usd = Math.round(Number(amount.replace(',', '.')) * 100) / 100;
    if (!(usd > 0)) return;
    const row: Income = { id: `income-${Date.now()}`, date, amountUsd: usd, source: source.trim() || undefined, ...(channelId ? { channelId } : {}) };
    upsert(row);
    applyGame({ kind: 'income', ref: row.id, amountUsd: usd });
    setAmount('');
  };

  const del = (row: Income) => {
    if (!window.confirm(`Удалить запись $${row.amountUsd}? Уже начисленный EXP не снимается.`)) return;
    remove(row.id);
    // Сумма дохода уменьшается; повторно за те же сотни EXP не даётся
    applyGame({ kind: 'income', ref: `${row.id}:delete`, amountUsd: -row.amountUsd });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <section className="bg-[#0e0e13] border border-white/[0.07] rounded-2xl p-4">
          <div className="text-[11px] text-zinc-500">Всего дохода</div>
          <div className="text-3xl font-semibold font-mono text-zinc-100 mt-1">${incomeTotal}</div>
          <p className="text-[11px] text-zinc-500 mt-2">
            Каждые $100 — +{RULES.incomeExpPer100} EXP. До следующих: ${Math.round(toNext * 100) / 100}.
          </p>
        </section>

        <form onSubmit={add} className="lg:col-span-2 bg-[#0e0e13] border border-white/[0.07] rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
          <label className="text-[11px] text-zinc-500 col-span-1">
            Дата
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full bg-zinc-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-zinc-200" />
          </label>
          <label className="text-[11px] text-zinc-500 col-span-1 sm:col-span-2">
            Канал
            <select value={channelId} onChange={(e) => setChannelId(e.target.value)} className="mt-1 w-full bg-zinc-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-zinc-200">
              <option value="">Без канала</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-zinc-500">
            USD
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="mt-1 w-full bg-zinc-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs font-mono text-zinc-200" />
          </label>
          <button type="submit" className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs">
            Добавить
          </button>
          <label className="text-[11px] text-zinc-500 col-span-2 sm:col-span-5">
            Источник
            <input value={source} onChange={(e) => setSource(e.target.value)} className="mt-1 w-full bg-zinc-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-zinc-200" />
          </label>
        </form>
      </div>

      <section className="bg-[#0e0e13] border border-white/[0.07] rounded-2xl p-4">
        <h3 className="text-xs font-semibold text-zinc-200 mb-2">По каналам</h3>
        {byChannel.length === 0 ? (
          <p className="text-[11px] text-zinc-600">Доход ещё не вводился</p>
        ) : (
          <ul className="space-y-1.5">
            {byChannel.map((c) => (
              <li key={c.channelId} className="text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-300">{c.channelId ? nameOf(c.channelId) : 'Без канала'}</span>
                  <span className="font-mono text-emerald-300">${c.total}</span>
                </div>
                <div className="h-1 rounded-full bg-white/[0.06] mt-1 overflow-hidden">
                  <div className="h-full bg-emerald-400/70" style={{ width: `${Math.max(2, Math.round((c.total / Math.max(1, byChannel[0].total)) * 100))}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {sorted.length > 0 && (
        <section className="bg-[#0e0e13] border border-white/[0.07] rounded-2xl p-4">
          <h3 className="text-xs font-semibold text-zinc-200 mb-2">Записи</h3>
          <ul className="divide-y divide-white/5">
            {sorted.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-1.5 text-xs">
                <span className="text-zinc-400">
                  <span className="font-mono text-zinc-600 mr-2">{r.date}</span>
                  {r.channelId ? nameOf(r.channelId) : 'Без канала'}
                  {r.source ? <span className="text-zinc-600"> · {r.source}</span> : null}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-zinc-200">${r.amountUsd}</span>
                  <button title="Удалить" onClick={() => del(r)} className="p-1 rounded text-zinc-600 hover:text-rose-300">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
