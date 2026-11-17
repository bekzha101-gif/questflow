import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus } from 'lucide-react';
import type { Channel, Video } from '@shared/types';
import { effectiveStatus, normalizeVideo, toggleChannelFilter } from '@shared/channels';
import { todayStr } from '@shared/time';
import { useCollection } from '../../store';
import { MediaStudioHub } from '../../components/MediaStudioHub';
import type { SectionContext } from '../types';
import { ChannelCard } from './ChannelCard';

const FILTER_KEY = 'questflow_channels_filter';

function loadFilter(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(FILTER_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

const CHIP = 'px-3 py-1 rounded-full border text-xs cursor-pointer transition-colors';
const CHIP_ON = 'bg-zinc-100 text-zinc-950 border-zinc-100 font-semibold';
const CHIP_OFF = 'bg-zinc-900 text-zinc-300 border-white/10 hover:text-white hover:border-white/25';
const FIELD =
  'bg-zinc-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/25';

// «Каналы»: фильтр-кнопки (все / один / несколько), карточки каналов, под ними канбан видео из 3 этапов.
export function ChannelsSection({ ctx }: { ctx: SectionContext }) {
  const today = todayStr();
  const { items: channels, upsert } = useCollection<Channel>('channels2');
  const { items: rawVideos } = useCollection<Video>('videos2');
  const videos = useMemo(() => rawVideos.map(normalizeVideo), [rawVideos]);
  const [filter, setFilter] = useState<string[]>(loadFilter);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNiche, setNewNiche] = useState('');

  const ids = useMemo(() => channels.map((c) => c.id), [channels]);
  // Каналы, удалённые на другом устройстве, в фильтре не держим
  const selected = useMemo(() => filter.filter((id) => ids.includes(id)), [filter, ids]);
  useEffect(() => {
    localStorage.setItem(FILTER_KEY, JSON.stringify(filter));
  }, [filter]);

  const shown = selected.length === 0 ? channels : channels.filter((c) => selected.includes(c.id));
  const counts = useMemo(() => {
    const c = { active: 0, paused: 0, abandoned: 0, archived: 0 };
    for (const ch of channels) c[effectiveStatus(ch, today)]++;
    return c;
  }, [channels, today]);
  const videoCount = (id: string) => videos.filter((v) => v.channelId === id).length;

  const addChannel = (e: FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    upsert({
      id: `chan-${Date.now()}`,
      name,
      niche: newNiche.trim() || undefined,
      status: 'active',
      cadencePerDay: 1,
    });
    setNewName('');
    setNewNiche('');
    setAdding(false);
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto py-2 px-2 sm:px-4 animate-fade-in">
      <div className="flex items-center gap-3 flex-wrap text-xs text-zinc-400">
        <span>Каналов: <span className="font-mono text-zinc-200">{channels.length}</span></span>
        <span className="text-emerald-400">Веду <span className="font-mono">{counts.active}</span></span>
        <span className="text-amber-400">Пауза <span className="font-mono">{counts.paused}</span></span>
        <span className="text-rose-400">Заброшен <span className="font-mono">{counts.abandoned}</span></span>
        <span className="text-zinc-500">Архив <span className="font-mono">{counts.archived}</span></span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Фильтр каналов">
        {channels.length > 0 && (
          <button
            type="button"
            aria-pressed={selected.length === 0}
            onClick={() => setFilter([])}
            className={`${CHIP} ${selected.length === 0 ? CHIP_ON : CHIP_OFF}`}
          >
            Все
          </button>
        )}
        {channels.map((c) => {
          const on = selected.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(toggleChannelFilter(selected, c.id, ids))}
              className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF}`}
            >
              {c.name} <span className="font-mono opacity-60">{videoCount(c.id)}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          aria-expanded={adding}
          className={`${CHIP} ${CHIP_OFF} flex items-center gap-1 border-dashed`}
        >
          <Plus className="w-3 h-3" /> Канал
        </button>
      </div>

      {adding && (
        <form onSubmit={addChannel} className="flex items-center gap-2 flex-wrap">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Название канала"
            aria-label="Название нового канала"
            className={`${FIELD} flex-1 min-w-[180px]`}
          />
          <input
            value={newNiche}
            onChange={(e) => setNewNiche(e.target.value)}
            placeholder="Ниша (необязательно)"
            aria-label="Ниша нового канала"
            className={`${FIELD} flex-1 min-w-[160px]`}
          />
          <button
            type="submit"
            disabled={!newName.trim()}
            className="px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white disabled:opacity-40 text-zinc-950 font-bold text-xs cursor-pointer"
          >
            Создать
          </button>
        </form>
      )}

      {channels.length === 0 ? (
        <p className="text-sm text-zinc-500">Каналов пока нет.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {shown.map((channel) => (
            <ChannelCard key={channel.id} channel={channel} videos={videos} today={today} onChange={upsert} />
          ))}
        </div>
      )}

      <MediaStudioHub channelIds={selected} />
    </div>
  );
}
