import { useState } from 'react';
import { X } from 'lucide-react';
import type { TargetGroup } from './targets';

interface Props {
  title: string;
  groups: TargetGroup[];
  selectedRef: string | null;
  /** Свободное название блока, уже заданное пользователем (пусто — название из цели) */
  initialName?: string | null;
  /** Идёт блок: кнопка внизу сохраняет название, а не начинает блок */
  editing?: boolean;
  /** name — своё название блока; null — брать название выбранной цели */
  onPick: (ref: string | null, name: string | null) => void;
  onClose: () => void;
}

// Выбор, над чем работать в блоке: свободное название «Над чем вы работаете?» и цель —
// «Шаги недели», «Задачи дня», «Цели месяца». Покупок здесь нет. Пока название не переписано,
// блок называется по выбранной цели; переписанное название сохраняется и при смене цели.
export function TaskPicker({ title, groups, selectedRef, initialName, editing = false, onPick, onClose }: Props) {
  const [name, setName] = useState(initialName ?? '');
  const custom = name.trim() || null;
  const empty = groups.every((g) => g.items.length === 0);
  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="w-full max-w-md max-h-[80vh] flex flex-col bg-[#101014] border border-white/[0.07] rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/[0.06]">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Над чем работаем</div>
            <div className="text-sm font-semibold text-zinc-100 mt-0.5">{title}</div>
          </div>
          <button onClick={onClose} aria-label="Закрыть" className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pt-3">
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onPick(selectedRef, custom);
            }}
            placeholder="Над чем вы работаете?"
            aria-label="Над чем вы работаете?"
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-white/[0.2]"
          />
          <p className="mt-1 text-[11px] text-zinc-600">
            {custom ? 'Своё название останется и при выборе цели ниже.' : 'Пусто — блок назовётся по выбранной цели.'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {groups.map((g) => (
            <div key={g.key}>
              <div className="px-2 pb-1.5 text-[11px] font-medium text-zinc-500">{g.label}</div>
              {g.items.length === 0 ? (
                <div className="px-2 text-[11px] text-zinc-600">Пусто</div>
              ) : (
                <div className="space-y-0.5">
                  {g.items.map((it) => (
                    <button
                      key={it.ref}
                      onClick={() => onPick(it.ref, custom)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${
                        selectedRef === it.ref ? 'bg-emerald-500/15 text-emerald-200' : 'text-zinc-200 hover:bg-white/[0.04]'
                      }`}
                    >
                      <span className="block truncate">{it.title}</span>
                      {it.hint && <span className="block text-[11px] text-zinc-500 truncate">{it.hint}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {empty && <p className="px-2 text-xs text-zinc-500">Нет шагов недели, задач на сегодня и целей месяца. Можно начать блок без задачи.</p>}
        </div>

        <div className="px-5 py-3 border-t border-white/[0.06]">
          <button
            onClick={() => onPick(editing ? selectedRef : null, custom)}
            className={`w-full py-2 rounded-xl text-xs ${
              editing || custom ? 'bg-zinc-100 hover:bg-white font-semibold text-zinc-950' : 'bg-white/[0.04] hover:bg-white/[0.07] text-zinc-300'
            }`}
          >
            {editing ? 'Сохранить название' : custom ? 'Начать без цели' : 'Без задачи'}
          </button>
        </div>
      </div>
    </div>
  );
}
