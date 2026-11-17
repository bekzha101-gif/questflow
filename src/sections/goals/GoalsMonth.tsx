import { useState } from 'react';
import { Plus, Target, ChevronRight } from 'lucide-react';
import { useCollection } from '../../store';
import type { Goal, GoalKind, GoalStep, GoalWeek } from '@shared/types';
import { goalProgress, monthLabel } from '@shared/goals';
import { monthKey, todayStr } from '@shared/time';
import { GoalDetail } from './GoalDetail';
import { FIELD, ProgressBar, TrackBadge } from './goalUi';

// «Цели»: цели месяца с прогрессом, постановка новой цели, страница цели
export function GoalsMonth({ openAdd = 0 }: { openAdd?: number }) {
  const { items: goals, upsert: upsertGoal } = useCollection<Goal>('goals');
  const { items: weeks, upsert: upsertWeek } = useCollection<GoalWeek>('goal_weeks');
  const { items: steps, upsert: upsertStep, remove: removeStep } = useCollection<GoalStep>('goal_steps');
  const today = todayStr();
  const month = monthKey(today);
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(openAdd > 0);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<GoalKind>('numeric');
  const [target, setTarget] = useState('');
  const [unit, setUnit] = useState('');

  const monthGoals = goals.filter((g) => g.month === month && g.status !== 'archived');
  const selectedGoal = selected ? goals.find((g) => g.id === selected) : undefined;

  const addGoal = () => {
    const t = title.trim();
    const n = kind === 'percent' ? 100 : Number(target);
    if (!t || !(n > 0)) return;
    upsertGoal({ id: `goal-${Date.now()}`, month, title: t, kind, target: n, unit: kind === 'percent' ? '%' : unit.trim() || undefined, current: 0, status: 'active' });
    setTitle('');
    setTarget('');
    setUnit('');
    setAdding(false);
  };

  if (selectedGoal) {
    return (
      <GoalDetail
        goal={selectedGoal}
        weeks={weeks.filter((w) => w.goalId === selectedGoal.id)}
        steps={steps.filter((s) => s.goalId === selectedGoal.id)}
        today={today}
        onBack={() => setSelected(null)}
        onSaveGoal={upsertGoal}
        onSaveWeek={upsertWeek}
        onSaveStep={upsertStep}
        onRemoveStep={removeStep}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Цели · {monthLabel(month)}</h2>
        <button onClick={() => setAdding((v) => !v)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 cursor-pointer">
          <Plus size={13} /> Поставить цель
        </button>
      </div>

      {adding && (
        <div className="p-3 space-y-2 border border-white/[0.07] rounded-2xl bg-[#0e0e13]">
          <input className={`${FIELD} w-full`} placeholder="Цель месяца" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Название цели" />
          <div className="flex flex-wrap gap-2 items-center">
            <select className={FIELD} value={kind} onChange={(e) => setKind(e.target.value as GoalKind)} aria-label="Тип цели">
              <option value="numeric">Число</option>
              <option value="percent">Проценты</option>
            </select>
            {kind === 'numeric' && (
              <>
                <input className={`${FIELD} w-24`} type="number" min={1} placeholder="Число" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Целевое число" />
                <input className={`${FIELD} w-28`} placeholder="Единица" value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Единица" />
              </>
            )}
            <button onClick={addGoal} className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-500 cursor-pointer">Добавить</button>
          </div>
          <p className="text-[11px] text-zinc-500">Числовая цель сама делится на 4 недели (например 50: 10, 20, 30, 40), точки можно поправить.</p>
        </div>
      )}

      {monthGoals.length === 0 && !adding && (
        <div className="border border-dashed border-white/10 rounded-2xl p-8 text-center space-y-3">
          <Target size={22} className="mx-auto text-zinc-600" />
          <p className="text-sm text-zinc-400">На этот месяц целей нет. Без целей таймер берёт задачи дня.</p>
          <button onClick={() => setAdding(true)} className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-500 cursor-pointer">Поставить цель</button>
        </div>
      )}

      <div className="space-y-2">
        {monthGoals.map((g) => {
          const p = goalProgress(g, weeks.filter((w) => w.goalId === g.id), steps, today);
          return (
            <button key={g.id} onClick={() => setSelected(g.id)} className="w-full text-left border border-white/[0.07] rounded-2xl bg-[#0e0e13] p-3 hover:border-white/20 transition-colors cursor-pointer">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white">{g.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 font-mono">
                    <span>{g.current ?? 0} / {g.target} {g.unit ?? ''}</span>
                    <span>· неделя {p.week.index || 1}: точка {p.week.target}</span>
                    {g.status === 'active' && <TrackBadge onTrack={p.onTrack} />}
                    {g.status === 'done' && <span className="text-emerald-400">выполнена</span>}
                    {g.status === 'failed' && <span className="text-rose-400">не выполнена</span>}
                  </div>
                </div>
                <span className="text-sm font-mono text-zinc-300">{p.pct}%</span>
                <ChevronRight size={14} className="text-zinc-600 mt-1" />
              </div>
              <div className="mt-2">
                <ProgressBar pct={p.pct} tone={g.status === 'done' ? 'emerald' : p.onTrack ? 'purple' : 'amber'} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
