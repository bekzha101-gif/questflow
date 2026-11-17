import { useState } from 'react';
import { ArrowLeft, Check, Plus, X } from 'lucide-react';
import type { Goal, GoalStep, GoalWeek } from '@shared/types';
import { acceptStep, goalProgress, monthLabel, weeksFor, type GoalStepEx } from '@shared/goals';
import { FIELD, ProgressBar, TrackBadge } from './goalUi';

interface Props {
  goal: Goal;
  weeks: GoalWeek[];
  steps: GoalStep[];
  today: string;
  onBack: () => void;
  onSaveGoal: (g: Goal) => void;
  onSaveWeek: (w: GoalWeek) => void;
  onSaveStep: (s: GoalStep) => void;
  onRemoveStep: (id: string) => void;
}

// Страница цели: прогресс, 4 недели с контрольными точками, шаги и итоги недель и месяца
export function GoalDetail({ goal, weeks, steps, today, onBack, onSaveGoal, onSaveWeek, onSaveStep, onRemoveStep }: Props) {
  const [newStep, setNewStep] = useState<Record<number, string>>({});
  const p = goalProgress(goal, weeks, steps, today);
  const rows = weeksFor(goal, weeks);
  const isPercent = goal.kind === 'percent';

  const addStep = (weekIndex: number) => {
    const t = (newStep[weekIndex] ?? '').trim();
    if (!t) return;
    onSaveStep({ id: `step-${Date.now()}`, goalId: goal.id, weekIndex, title: t, done: false });
    setNewStep({ ...newStep, [weekIndex]: '' });
  };

  return (
    <div className="space-y-3">
      <button onClick={onBack} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white cursor-pointer">
        <ArrowLeft size={13} /> Все цели
      </button>

      <div className="border border-white/[0.07] rounded-2xl bg-[#0e0e13] p-4 space-y-3">
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <div className="text-[11px] text-zinc-500">{monthLabel(goal.month)}</div>
            <h2 className="text-base text-white font-semibold">{goal.title}</h2>
          </div>
          {goal.status === 'active' && <TrackBadge onTrack={p.onTrack} />}
          <span className="text-lg font-mono text-white">{p.pct}%</span>
        </div>
        <ProgressBar pct={p.pct} tone={goal.status === 'done' ? 'emerald' : p.onTrack ? 'purple' : 'amber'} />
        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
          <label className="flex items-center gap-1.5">
            {isPercent ? 'Выполнено, %' : `Сейчас (${goal.unit ?? 'шт'})`}
            <input
              type="number"
              min={0}
              className={`${FIELD} w-20`}
              value={goal.current ?? 0}
              onChange={(e) => onSaveGoal({ ...goal, current: Math.max(0, Number(e.target.value) || 0) })}
              aria-label="Текущее значение"
            />
          </label>
          <span className="font-mono">из {goal.target}</span>
          {goal.status === 'active' && p.dayNeed > 0 && <span>сегодня нужно +{p.dayNeed}</span>}
          <span className="ml-auto flex gap-1.5">
            {goal.status === 'active' ? (
              <>
                <button onClick={() => onSaveGoal({ ...goal, status: 'done' })} className="px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 cursor-pointer">
                  Выполнена
                </button>
                <button onClick={() => onSaveGoal({ ...goal, status: 'failed' })} className="px-2.5 py-1 rounded-lg bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 cursor-pointer">
                  Не выполнена
                </button>
              </>
            ) : (
              <button onClick={() => onSaveGoal({ ...goal, status: 'active' })} className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 cursor-pointer">
                Вернуть в работу
              </button>
            )}
            <button
              onClick={() => {
                onSaveGoal({ ...goal, status: 'archived' });
                onBack();
              }}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 cursor-pointer"
            >
              В архив
            </button>
          </span>
        </div>
      </div>

      {rows.map((w) => {
        const wSteps = (steps as GoalStepEx[]).filter((s) => s.weekIndex === w.weekIndex);
        const isNow = p.week.index === w.weekIndex;
        return (
          <section key={w.weekIndex} className={`border rounded-2xl bg-[#0e0e13] p-3 space-y-2 ${isNow ? 'border-purple-500/40' : 'border-white/[0.07]'}`}>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="text-white font-medium">
                Неделя {w.weekIndex}
                {isNow ? ' · сейчас' : ''}
              </span>
              <label className="flex items-center gap-1.5 text-zinc-400">
                Контрольная точка
                <input
                  type="number"
                  min={0}
                  className={`${FIELD} w-20`}
                  value={w.target}
                  onChange={(e) => onSaveWeek({ ...w, target: Math.max(0, Number(e.target.value) || 0) })}
                  aria-label={`Точка недели ${w.weekIndex}`}
                />
              </label>
              <label className="flex items-center gap-1.5 text-zinc-400">
                Факт
                <input
                  type="number"
                  min={0}
                  className={`${FIELD} w-20`}
                  value={w.actual ?? ''}
                  onChange={(e) => onSaveWeek({ ...w, actual: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0) })}
                  aria-label={`Факт недели ${w.weekIndex}`}
                />
              </label>
            </div>

            <ul className="space-y-1">
              {wSteps.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-sm">
                  {s.proposed ? (
                    <>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md border border-purple-500/30 text-purple-300">предложен</span>
                      <span className="flex-1 text-zinc-300">{s.title}</span>
                      <button onClick={() => onSaveStep(acceptStep(s))} className="text-xs px-2 py-0.5 rounded-md bg-purple-600 text-white hover:bg-purple-500 cursor-pointer">
                        Принять
                      </button>
                      <button onClick={() => onRemoveStep(s.id)} className="text-zinc-500 hover:text-white cursor-pointer" aria-label="Отклонить шаг">
                        <X size={13} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => onSaveStep({ ...s, done: !s.done })}
                        aria-label={s.done ? 'Снять отметку' : 'Отметить шаг'}
                        className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer ${s.done ? 'bg-emerald-600 border-emerald-600' : 'border-white/20'}`}
                      >
                        {s.done && <Check size={11} className="text-white" />}
                      </button>
                      <span className={`flex-1 ${s.done ? 'line-through text-zinc-600' : 'text-zinc-200'}`}>{s.title}</span>
                      <button onClick={() => onRemoveStep(s.id)} className="text-zinc-600 hover:text-white cursor-pointer" aria-label="Удалить шаг">
                        <X size={13} />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input
                className={`${FIELD} flex-1`}
                placeholder="Новый шаг (например, сделать контент-план)"
                value={newStep[w.weekIndex] ?? ''}
                onChange={(e) => setNewStep({ ...newStep, [w.weekIndex]: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && addStep(w.weekIndex)}
                aria-label={`Новый шаг недели ${w.weekIndex}`}
              />
              <button onClick={() => addStep(w.weekIndex)} className="px-2.5 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 cursor-pointer" aria-label="Добавить шаг">
                <Plus size={14} />
              </button>
            </div>

            <textarea
              className={`${FIELD} w-full text-xs`}
              rows={2}
              placeholder="Итог недели: что хорошо, что лучше (заполняет вечерний разговор)"
              value={w.review ?? ''}
              onChange={(e) => onSaveWeek({ ...w, review: e.target.value })}
              aria-label={`Итог недели ${w.weekIndex}`}
            />
          </section>
        );
      })}

      <section className="border border-white/[0.07] rounded-2xl bg-[#0e0e13] p-3 space-y-1.5">
        <div className="text-xs text-white font-medium">Итог месяца</div>
        <textarea
          className={`${FIELD} w-full text-xs`}
          rows={3}
          placeholder="Насколько приблизился, что сделал хорошо, что мог лучше"
          value={goal.summary ?? ''}
          onChange={(e) => onSaveGoal({ ...goal, summary: e.target.value })}
          aria-label="Итог месяца"
        />
      </section>
    </div>
  );
}
