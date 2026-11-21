import { useState } from 'react';
import { Plus, Sparkles, Pencil, Trash2, CalendarPlus } from 'lucide-react';
import { useCollection } from '../../store';
import type { Goal } from '@shared/types';
import { isSomeday, monthLabel } from '@shared/goals';
import { monthKey, todayStr } from '@shared/time';
import { FIELD } from './goalUi';

// «Без срока»: цели на потом (например «запустить канал, когда будет бюджет»).
// Хранятся в той же таблице целей с пустым месяцем; кнопкой переносятся в цели месяца.
export function GoalsSomeday({ onMovedToMonth }: { onMovedToMonth: () => void }) {
  const { items: goals, upsert, remove } = useCollection<Goal>('goals');
  const month = monthKey(todayStr());
  const list = goals.filter((g) => isSomeday(g) && g.status !== 'archived');

  const [editing, setEditing] = useState<string | null>(null); // id цели или 'new'
  const [title, setTitle] = useState('');
  const [condition, setCondition] = useState('');

  const open = (g?: Goal) => {
    setEditing(g ? g.id : 'new');
    setTitle(g?.title ?? '');
    setCondition(g?.condition ?? '');
  };
  const close = () => {
    setEditing(null);
    setTitle('');
    setCondition('');
  };

  const save = () => {
    const t = title.trim();
    if (!t) return;
    const old = editing && editing !== 'new' ? goals.find((g) => g.id === editing) : undefined;
    const base: Goal = old ?? { id: `goal-${Date.now()}`, month: '', title: t, kind: 'percent', target: 100, unit: '%', current: 0, status: 'active' };
    upsert({ ...base, title: t, condition: condition.trim() || undefined });
    close();
  };

  const toMonth = (g: Goal) => {
    if (!window.confirm(`Перенести «${g.title}» в цели на ${monthLabel(month)}?`)) return;
    upsert({ ...g, month, kind: 'percent', target: 100, unit: '%', current: g.current ?? 0, status: 'active' });
    onMovedToMonth();
  };

  const del = (g: Goal) => {
    if (window.confirm(`Удалить цель «${g.title}»?`)) remove(g.id);
  };

  const form = (
    <div className="p-3 space-y-2 border border-white/[0.07] rounded-2xl bg-[#0e0e13]">
      <input className={`${FIELD} w-full`} placeholder="Цель, например «Запустить канал про ИИ-автоматизацию»" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Название цели" autoFocus />
      <input className={`${FIELD} w-full`} placeholder="Когда начну (необязательно), например «когда будет бюджет»" value={condition} onChange={(e) => setCondition(e.target.value)} aria-label="Когда начну" />
      <div className="flex gap-2">
        <button onClick={save} className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-500 cursor-pointer">
          {editing === 'new' ? 'Добавить' : 'Сохранить'}
        </button>
        <button onClick={close} className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 cursor-pointer">Отмена</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Цели без срока</h2>
        <button onClick={() => open()} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 cursor-pointer">
          <Plus size={13} /> Добавить цель
        </button>
      </div>

      {editing === 'new' && form}

      {list.length === 0 && editing !== 'new' && (
        <div className="border border-dashed border-white/10 rounded-2xl p-8 text-center space-y-3">
          <Sparkles size={22} className="mx-auto text-zinc-600" />
          <p className="text-sm text-zinc-400">Здесь цели на потом: без месяца и без срока. Когда придёт время, перенесите цель в цели месяца.</p>
          <button onClick={() => open()} className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-500 cursor-pointer">Добавить цель</button>
        </div>
      )}

      <div className="space-y-2">
        {list.map((g) =>
          editing === g.id ? (
            <div key={g.id}>{form}</div>
          ) : (
            <div key={g.id} className="border border-white/[0.07] rounded-2xl bg-[#0e0e13] p-3 flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white">{g.title}</div>
                {g.condition && <div className="mt-1 text-[11px] text-zinc-500">Когда: {g.condition}</div>}
              </div>
              <button onClick={() => toMonth(g)} title="Перенести в цели месяца" className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 cursor-pointer">
                <CalendarPlus size={12} /> В этот месяц
              </button>
              <button onClick={() => open(g)} aria-label="Изменить" className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 cursor-pointer">
                <Pencil size={13} />
              </button>
              <button onClick={() => del(g)} aria-label="Удалить" className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-white/5 cursor-pointer">
                <Trash2 size={13} />
              </button>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
