import React, { useState } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Plus, 
  Trash2, 
  X
} from 'lucide-react';
import { playCoinSound } from '../utils/sound';

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: 'editing' | 'scripting' | 'sponsorship' | 'revenue' | 'tools' | 'ads' | 'other';
  description: string;
  date: string;
  channelOrProject: string;
}

const initialTransactions: Transaction[] = [
  {
    id: 'tx-1',
    type: 'income',
    amount: 1200,
    category: 'sponsorship',
    description: 'Интеграция бренда в серию Shorts',
    date: '2026-08-25',
    channelOrProject: 'Shorts Основной',
  },
  {
    id: 'tx-2',
    type: 'income',
    amount: 650,
    category: 'revenue',
    description: 'Монетизация YouTube AdSense',
    date: '2026-08-22',
    channelOrProject: 'Shorts Основной',
  },
  {
    id: 'tx-3',
    type: 'expense',
    amount: 250,
    category: 'editing',
    description: 'Оплата монтажёру за 5 видео',
    date: '2026-08-24',
    channelOrProject: 'Shorts Основной',
  },
  {
    id: 'tx-4',
    type: 'expense',
    amount: 30,
    category: 'tools',
    description: 'Подписка на софт и AI',
    date: '2026-08-15',
    channelOrProject: 'Инструменты',
  },
];

interface FinancesTrackerProps {
  onAddGoldReward?: (gold: number) => void;
}

export const FinancesTracker: React.FC<FinancesTrackerProps> = ({ onAddGoldReward }) => {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem('questflow_finances_v1');
      return saved ? JSON.parse(saved) : initialTransactions;
    } catch {
      return initialTransactions;
    }
  });

  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form
  const [formType, setFormType] = useState<'income' | 'expense'>('income');
  const [formAmount, setFormAmount] = useState<number>(100);
  const [formCategory, setFormCategory] = useState<Transaction['category']>('sponsorship');
  const [formDesc, setFormDesc] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formChannel, setFormChannel] = useState('Shorts Основной');

  const saveTxState = (items: Transaction[]) => {
    setTransactions(items);
    try {
      localStorage.setItem('questflow_finances_v1', JSON.stringify(items));
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAmount || formAmount <= 0) return;

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      type: formType,
      amount: formAmount,
      category: formCategory,
      description: formDesc.trim() || (formType === 'income' ? 'Доход' : 'Расход'),
      date: formDate,
      channelOrProject: formChannel.trim() || 'Проект',
    };

    saveTxState([newTx, ...transactions]);

    if (formType === 'income') {
      const goldBonus = Math.round(formAmount * 0.1);
      if (onAddGoldReward) {
        onAddGoldReward(goldBonus);
      }
      playCoinSound();
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    saveTxState(transactions.filter((t) => t.id !== id));
  };

  // Metrics
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  const netProfit = totalIncome - totalExpense;

  const categoryLabels: Record<Transaction['category'], string> = {
    sponsorship: 'Спонсорство',
    revenue: 'Монетизация платформы',
    editing: 'Монтаж',
    scripting: 'Сценарии',
    tools: 'Софт & AI',
    ads: 'Реклама',
    other: 'Прочее',
  };

  const filteredTx = transactions.filter((t) => {
    if (typeFilter === 'income') return t.type === 'income';
    if (typeFilter === 'expense') return t.type === 'expense';
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto py-5 px-3 sm:px-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#111115] border border-white/[0.08] rounded-3xl p-4 sm:p-5">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
            <span>Финансы & Аналитика</span>
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Учёт доходов каналов, затрат на монтаж и чистой прибыли
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs shadow transition-all active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Добавить операцию</span>
        </button>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Income */}
        <div className="bg-[#111115] border border-white/[0.08] rounded-3xl p-5">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Общий Доход</span>
          <p className="text-2xl font-bold font-mono text-zinc-100 mt-2">
            ${totalIncome.toLocaleString()}
          </p>
          <p className="text-[11px] text-zinc-500 mt-1 font-mono">
            +{Math.round(totalIncome * 0.1)} золота начислено
          </p>
        </div>

        {/* Expenses */}
        <div className="bg-[#111115] border border-white/[0.08] rounded-3xl p-5">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Общие Расходы</span>
          <p className="text-2xl font-bold font-mono text-zinc-100 mt-2">
            ${totalExpense.toLocaleString()}
          </p>
          <p className="text-[11px] text-zinc-500 mt-1">
            Монтаж, сценарии, софт
          </p>
        </div>

        {/* Net Profit */}
        <div className="bg-[#111115] border border-white/[0.08] rounded-3xl p-5">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Чистая Прибыль</span>
          <p className="text-2xl font-bold font-mono text-zinc-100 mt-2">
            ${netProfit.toLocaleString()}
          </p>
          <p className="text-[11px] text-zinc-500 mt-1 font-mono">
            Рентабельность: {totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0}%
          </p>
        </div>
      </div>

      {/* Monthly Target Milestone Goal */}
      <div className="bg-gradient-to-r from-purple-950/40 via-[#111115] to-indigo-950/40 border border-purple-500/20 rounded-3xl p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-xs">
              🎯
            </div>
            <div>
              <h3 className="text-xs font-bold text-white">Цель по доходу на август: $5,000 / мес</h3>
              <p className="text-[11px] text-white/40">Пайплайн Shorts + Спонсорские интеграции каналов</p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-sm font-bold font-mono text-purple-300">${totalIncome.toLocaleString()}</span>
            <span className="text-xs text-white/40 font-mono"> / $5,000</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 w-full bg-black/50 rounded-full overflow-hidden border border-white/10">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.round((totalIncome / 5000) * 100))}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] text-white/40 font-mono">
          <span>Старт ($0)</span>
          <span>{Math.min(100, Math.round((totalIncome / 5000) * 100))}% выполнено</span>
          <span>Цель ($5,000)</span>
        </div>
      </div>


      {/* Transactions */}
      <div className="bg-[#111115] border border-white/[0.08] rounded-3xl p-5 space-y-4">
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
          <h2 className="font-bold text-sm text-zinc-200">История Операций</h2>

          <div className="bg-zinc-900 border border-white/10 rounded-xl p-1 flex items-center gap-1 text-xs">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1 rounded-lg transition-all ${typeFilter === 'all' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Все
            </button>
            <button
              onClick={() => setTypeFilter('income')}
              className={`px-3 py-1 rounded-lg transition-all ${typeFilter === 'income' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Доходы
            </button>
            <button
              onClick={() => setTypeFilter('expense')}
              className={`px-3 py-1 rounded-lg transition-all ${typeFilter === 'expense' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Расходы
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {filteredTx.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-6">Операций не найдено</p>
          ) : (
            filteredTx.map((tx) => (
              <div
                key={tx.id}
                className="bg-[#141419] hover:bg-[#18181f] border border-white/5 hover:border-white/10 rounded-2xl p-3 flex items-center justify-between gap-3 transition-all"
              >
                <div className="truncate">
                  <p className="font-semibold text-xs text-zinc-200 truncate">
                    {tx.description}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-0.5 font-mono">
                    {categoryLabels[tx.category]} • {tx.channelOrProject} • {tx.date}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className={`font-mono font-bold text-xs ${
                    tx.type === 'income' ? 'text-zinc-100' : 'text-zinc-400'
                  }`}>
                    {tx.type === 'income' ? '+' : '-'}${tx.amount.toLocaleString()}
                  </span>

                  <button
                    onClick={() => handleDelete(tx.id)}
                    className="p-1 rounded bg-zinc-900 text-zinc-500 hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121216] border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h2 className="font-bold text-sm text-zinc-100">Добавить операцию</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddTransaction} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-900 border border-white/10 rounded-xl">
                <button
                  type="button"
                  onClick={() => setFormType('income')}
                  className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    formType === 'income' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500'
                  }`}
                >
                  Доход (+)
                </button>
                <button
                  type="button"
                  onClick={() => setFormType('expense')}
                  className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    formType === 'expense' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500'
                  }`}
                >
                  Расход (-)
                </button>
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">Сумма ($ USD)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formAmount}
                  onChange={(e) => setFormAmount(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">Категория</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as any)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
                >
                  <option value="sponsorship">Спонсорство</option>
                  <option value="revenue">Монетизация</option>
                  <option value="editing">Монтаж</option>
                  <option value="scripting">Сценарии</option>
                  <option value="tools">Софт & Инструменты</option>
                  <option value="ads">Реклама</option>
                  <option value="other">Прочее</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">Описание</label>
                <input
                  type="text"
                  placeholder="Оплата за видео..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Канал</label>
                  <input
                    type="text"
                    value={formChannel}
                    onChange={(e) => setFormChannel(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Дата</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 [color-scheme:dark] focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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
