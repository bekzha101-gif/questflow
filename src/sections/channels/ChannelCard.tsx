import React, { useState } from 'react';
import { CalendarDays, Check, Pencil } from 'lucide-react';
import type { Channel, ChannelStatus, Video } from '@shared/types';
import { CADENCES, cadenceLabel, channelTodo, effectiveStatus, lastPublishedOf, nextDueDates } from '@shared/channels';
import type { Urgency } from '@shared/channels';
import { addDays } from '@shared/time';

const STATUS_VIEW: Record<ChannelStatus, { label: string; pill: string; dot: string }> = {
  active: { label: 'Веду', pill: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10', dot: 'bg-emerald-500' },
  paused: { label: 'Пауза', pill: 'text-amber-400 border-amber-500/30 bg-amber-500/10', dot: 'bg-amber-500' },
  abandoned: { label: 'Заброшен', pill: 'text-rose-400 border-rose-500/30 bg-rose-500/10', dot: 'bg-rose-500' },
  archived: { label: 'Архив', pill: 'text-zinc-400 border-white/10 bg-white/[0.04]', dot: 'bg-zinc-500' },
};

const URGENCY_TEXT: Record<Urgency, string> = {
  overdue: 'text-rose-400',
  today: 'text-amber-400',
  soon: 'text-amber-300',
  later: 'text-zinc-400',
  none: 'text-zinc-500',
};

const FIELD =
  'bg-zinc-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/25';

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
/** 2026-11-19 → «19 ноября» */
function dateRu(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

interface ChannelCardProps {
  channel: Channel;
  videos: Video[];
  today: string;
  onChange: (channel: Channel) => void;
}

export const ChannelCard: React.FC<ChannelCardProps> = ({ channel, videos, today, onChange }) => {
  const status = effectiveStatus(channel, today);
  const view = STATUS_VIEW[status];
  const todo = channelTodo(channel, videos, today);
  const last = lastPublishedOf(channel.id, videos);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(channel.name);
  const [showSchedule, setShowSchedule] = useState(false);
  const [statusMenu, setStatusMenu] = useState(false);
  const [pauseDate, setPauseDate] = useState(addDays(today, 2));
  const [reason, setReason] = useState(channel.abandonReason ?? '');

  const saveName = () => {
    const next = name.trim();
    setEditingName(false);
    if (next && next !== channel.name) onChange({ ...channel, name: next });
    else setName(channel.name);
  };

  const setStatus = (next: ChannelStatus) => {
    const patch: Channel = { ...channel, status: next };
    if (next === 'paused') patch.pausedUntil = pauseDate;
    else delete patch.pausedUntil;
    if (next === 'abandoned') patch.abandonReason = reason.trim() || undefined;
    onChange(patch);
    setStatusMenu(false);
  };

  const statusLabel = status === 'paused' && channel.pausedUntil ? `Пауза до ${dateRu(channel.pausedUntil)}` : view.label;
  const dueText = todo.dueDate
    ? todo.urgency === 'overdue'
      ? `просрочено с ${dateRu(todo.dueDate)}`
      : todo.dueDate === today
        ? 'сегодня'
        : dateRu(todo.dueDate)
    : null;

  return (
    <article className="bg-[#0e0e13] border border-white/[0.07] rounded-2xl p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        {editingName ? (
          <input
            autoFocus
            value={name}
            aria-label="Название канала"
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveName();
              if (e.key === 'Escape') {
                setName(channel.name);
                setEditingName(false);
              }
            }}
            className={`${FIELD} flex-1 min-w-0 font-semibold`}
          />
        ) : (
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="text-[13.5px] font-semibold text-zinc-100 truncate">{channel.name}</h3>
            <button
              type="button"
              onClick={() => setEditingName(true)}
              aria-label="Изменить название"
              className="p-1 rounded text-zinc-600 hover:text-white cursor-pointer"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setStatusMenu((v) => !v)}
          aria-expanded={statusMenu}
          className={`shrink-0 flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border cursor-pointer ${view.pill}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${view.dot}`} />
          {statusLabel}
        </button>
      </div>

      {statusMenu && (
        <div className="bg-zinc-900 border border-white/10 rounded-xl p-2.5 space-y-2 text-xs">
          <button type="button" onClick={() => setStatus('active')} className="block w-full text-left px-2 py-1 rounded text-emerald-400 hover:bg-white/5 cursor-pointer">
            Веду
          </button>
          <div className="flex items-center gap-2 px-2">
            <button type="button" onClick={() => setStatus('paused')} className="text-amber-400 hover:underline cursor-pointer">
              Пауза до
            </button>
            <input type="date" value={pauseDate} min={today} onChange={(e) => setPauseDate(e.target.value)} aria-label="Пауза до даты" className={FIELD} />
          </div>
          <div className="flex items-center gap-2 px-2">
            <button type="button" onClick={() => setStatus('abandoned')} className="text-rose-400 hover:underline cursor-pointer">
              Заброшен
            </button>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Почему" aria-label="Причина" className={`${FIELD} flex-1 min-w-0`} />
          </div>
          <button type="button" onClick={() => setStatus('archived')} className="block w-full text-left px-2 py-1 rounded text-zinc-400 hover:bg-white/5 cursor-pointer">
            В архив
          </button>
        </div>
      )}

      <p className="text-[11px] text-zinc-500">
        {channel.niche ? `${channel.niche} · ` : ''}
        {cadenceLabel(channel.cadencePerDay)}
        {channel.editHoursMin != null && channel.editHoursMax != null
          ? ` · монтаж ${channel.editHoursMin === channel.editHoursMax ? channel.editHoursMax : `${channel.editHoursMin}–${channel.editHoursMax}`} ч`
          : ''}
      </p>

      {status === 'abandoned' && channel.abandonReason && (
        <p className="text-[11px] text-rose-400/80">Причина: {channel.abandonReason}</p>
      )}

      <dl className="text-[12px] space-y-1">
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-500">Последняя публикация</dt>
          <dd className="text-zinc-300 font-mono">{last ? dateRu(last) : '—'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-500">Следующее видео</dt>
          <dd className={`font-mono ${URGENCY_TEXT[todo.urgency]}`}>{dueText ?? '—'}</dd>
        </div>
      </dl>

      <p className={`text-[12.5px] font-medium ${URGENCY_TEXT[todo.urgency]}`} data-testid="channel-todo">
        Сейчас: {todo.label}
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={channel.cadencePerDay}
          aria-label="Частота публикаций"
          onChange={(e) => onChange({ ...channel, cadencePerDay: Number(e.target.value) })}
          className={FIELD}
        >
          {CADENCES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowSchedule((v) => !v)}
          aria-expanded={showSchedule}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-900 border border-white/10 text-[11px] text-zinc-300 hover:text-white cursor-pointer"
        >
          <CalendarDays className="w-3.5 h-3.5" /> Расписание
        </button>
      </div>

      {showSchedule && (
        <ul className="text-[12px] text-zinc-300 flex flex-wrap gap-1.5" aria-label="Ближайшие даты">
          {nextDueDates(channel, last, today, 6).map((d) => (
            <li key={d} className="px-2 py-0.5 rounded-md bg-white/[0.05] font-mono text-[11px] flex items-center gap-1">
              {d === today && <Check className="w-3 h-3 text-amber-400" />}
              {dateRu(d)}
              {channel.cadencePerDay >= 2 ? ' ×2' : ''}
            </li>
          ))}
          {nextDueDates(channel, last, today, 1).length === 0 && <li className="text-zinc-500">Канал не ведётся</li>}
        </ul>
      )}
    </article>
  );
};
