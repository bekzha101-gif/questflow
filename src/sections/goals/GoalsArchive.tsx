import { useMemo } from 'react';
import { useCollection } from '../../store';
import type { Goal, GoalWeek } from '@shared/types';
import { goalPct, isSomeday, monthLabel, monthSummary } from '@shared/goals';
import { monthKey, todayStr } from '@shared/time';
import { ProgressBar } from './goalUi';

const STATUS_LABEL: Record<Goal['status'], string> = { active: 'в работе', done: 'выполнена', failed: 'не выполнена', archived: 'в архиве' };

// Архив: прошлые месяцы с целями, процентом выполнения и выводом
export function GoalsArchive({ onSetGoal }: { onSetGoal: () => void }) {
  const { items: goals } = useCollection<Goal>('goals');
  const { items: weeks } = useCollection<GoalWeek>('goal_weeks');
  const current = monthKey(todayStr());

  const months = useMemo(() => {
    const by = new Map<string, Goal[]>();
    for (const g of goals) {
      if (isSomeday(g)) continue; // цели без срока живут на своей вкладке
      // текущий месяц попадает в архив только отправленными туда целями; прошлые месяцы — целиком
      if (g.month >= current && g.status !== 'archived') continue;
      by.set(g.month, [...(by.get(g.month) ?? []), g]);
    }
    return [...by.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [goals, current]);

  if (months.length === 0) {
    return (
      <div className="border border-dashed border-white/10 rounded-2xl p-8 text-center space-y-3">
        <p className="text-sm text-zinc-400">В архиве пока пусто. Прошлые месяцы появятся здесь с итогами.</p>
        <button onClick={onSetGoal} className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-500 cursor-pointer">
          Поставить цель
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {months.map(([month, list]) => {
        const s = monthSummary(list, weeks);
        return (
          <section key={month} className="border border-white/[0.07] rounded-2xl bg-[#0e0e13] p-3 space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm text-white font-medium flex-1">{monthLabel(month)}</h3>
              <span className="text-[11px] text-zinc-500">
                выполнено {s.done} из {s.total}
              </span>
              <span className="text-sm font-mono text-zinc-200">{s.pct}%</span>
            </div>
            <ProgressBar pct={s.pct} />
            <ul className="space-y-1.5">
              {list.map((g) => (
                <li key={g.id} className="text-sm">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-zinc-200">{g.title}</span>
                    <span className="text-[11px] text-zinc-500">{STATUS_LABEL[g.status]}</span>
                    <span className="font-mono text-xs text-zinc-400">{goalPct(g, weeks.filter((w) => w.goalId === g.id))}%</span>
                  </div>
                  {g.summary && <p className="text-xs text-zinc-500 mt-0.5">Вывод: {g.summary}</p>}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
