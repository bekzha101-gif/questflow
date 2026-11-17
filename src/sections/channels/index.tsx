import { useMemo } from 'react';
import type { Channel, Video } from '@shared/types';
import { effectiveStatus, normalizeVideo } from '@shared/channels';
import { todayStr } from '@shared/time';
import { useCollection } from '../../store';
import { MediaStudioHub } from '../../components/MediaStudioHub';
import type { SectionContext } from '../types';
import { ChannelCard } from './ChannelCard';

// «Каналы»: карточки со статусом и шагом «сейчас», под ними канбан видео из 3 этапов.
export function ChannelsSection({ ctx }: { ctx: SectionContext }) {
  const today = todayStr();
  const { items: channels, upsert } = useCollection<Channel>('channels2');
  const { items: rawVideos } = useCollection<Video>('videos2');
  const videos = useMemo(() => rawVideos.map(normalizeVideo), [rawVideos]);
  const counts = useMemo(() => {
    const c = { active: 0, paused: 0, abandoned: 0, archived: 0 };
    for (const ch of channels) c[effectiveStatus(ch, today)]++;
    return c;
  }, [channels, today]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto py-2 px-2 sm:px-4 animate-fade-in">
      <div className="flex items-center gap-3 flex-wrap text-xs text-zinc-400">
        <span>Каналов: <span className="font-mono text-zinc-200">{channels.length}</span></span>
        <span className="text-emerald-400">Веду <span className="font-mono">{counts.active}</span></span>
        <span className="text-amber-400">Пауза <span className="font-mono">{counts.paused}</span></span>
        <span className="text-rose-400">Заброшен <span className="font-mono">{counts.abandoned}</span></span>
        <span className="text-zinc-500">Архив <span className="font-mono">{counts.archived}</span></span>
      </div>

      {channels.length === 0 ? (
        <p className="text-sm text-zinc-500">Каналов пока нет.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {channels.map((channel) => (
            <ChannelCard key={channel.id} channel={channel} videos={videos} today={today} onChange={upsert} />
          ))}
        </div>
      )}

      <MediaStudioHub onPublishReward={(exp, gold) => ctx.onAwardRewards(exp, gold)} />
    </div>
  );
}
