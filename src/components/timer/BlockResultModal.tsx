import { useState } from 'react';
import type { BlockResultInput } from './targets';

interface Props {
  blockLabel: string;
  workedLabel: string;
  title: string;
  /** Блок закончился, пока сайт был закрыт */
  whileClosed: boolean;
  onSave: (input: BlockResultInput) => void;
  onSkip: () => void;
}

type Choice = 'done' | 'partial' | 'dropped';

// Отметка после блока: готово / процент / бросил — почему (одной строкой).
export function BlockResultModal({ blockLabel, workedLabel, title, whileClosed, onSave, onSkip }: Props) {
  const [choice, setChoice] = useState<Choice>('done');
  const [pct, setPct] = useState('50');
  const [reason, setReason] = useState('');

  const canSave = choice !== 'dropped' || reason.trim().length > 0;
  const save = () => {
    if (!canSave) return;
    if (choice === 'done') onSave({ result: 'done' });
    else if (choice === 'partial') onSave({ result: 'partial', progressPct: Number(pct) || 0 });
    else onSave({ result: 'dropped', dropReason: reason.trim() });
  };

  const tab = (c: Choice, label: string) => (
    <button
      onClick={() => setChoice(c)}
      className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
        choice === c ? 'bg-zinc-100 text-zinc-950' : 'bg-white/[0.04] text-zinc-300 hover:bg-white/[0.07]'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur flex items-center justify-center p-4">
      <div role="dialog" aria-label="Итог блока" className="w-full max-w-md bg-[#101014] border border-white/[0.07] rounded-3xl shadow-2xl p-5 space-y-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">{blockLabel} закончен</div>
          <div className="text-lg font-semibold text-zinc-100 mt-1">Ты проработал {workedLabel}</div>
          <div className="text-xs text-zinc-400 mt-1 truncate">{title}</div>
          {whileClosed && <div className="text-[11px] text-zinc-500 mt-1">Блок закончился, пока сайт был закрыт: засчитано по факту.</div>}
        </div>

        <div className="flex gap-1.5">
          {tab('done', 'Готово')}
          {tab('partial', 'Процент')}
          {tab('dropped', 'Бросил')}
        </div>

        {choice === 'partial' && (
          <label className="flex items-center gap-3 text-xs text-zinc-400">
            Выполнено
            <input
              type="number"
              min={0}
              max={100}
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              className="w-20 bg-[#09090c] border border-white/[0.07] rounded-xl px-2.5 py-1.5 text-sm text-zinc-100 font-mono"
            />
            %
          </label>
        )}
        {choice === 'dropped' && (
          <input
            type="text"
            autoFocus
            placeholder="Почему (одной строкой)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            className="w-full bg-[#09090c] border border-white/[0.07] rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
          />
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={save}
            disabled={!canSave}
            className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-zinc-950 text-xs font-semibold"
          >
            Записать
          </button>
          <button onClick={onSkip} className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] text-xs text-zinc-400">
            Без отметки
          </button>
        </div>
      </div>
    </div>
  );
}
