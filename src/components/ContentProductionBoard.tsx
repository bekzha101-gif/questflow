import React, { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import type { Channel, Video, VideoStage } from '@shared/types';
import { CHECKLIST_ITEMS, VIDEO_STAGES, canPublish, normalizeVideo } from '@shared/channels';
import { todayStr } from '@shared/time';
import { useCollection } from '../store';
import { playCoinSound, playQuestCompleteSound } from '../utils/sound';
import { triggerQuestConfetti } from '../utils/confetti';
import { applyGame } from '../sections/progress/game';


const LANE_DOT: Record<VideoStage, string> = {
  editing: 'bg-purple-500',
  review: 'bg-amber-500',
  published: 'bg-emerald-500',
};

interface ContentProductionBoardProps {
  /** Показывать видео только одного канала */
  channelId?: string | null;
}

/** Канбан видео: Монтаж → Проверка → Опубликовано, в карточке чек-лист из 5 пунктов */
export const ContentProductionBoard: React.FC<ContentProductionBoardProps> = ({ channelId = null }) => {
  const { items: channels } = useCollection<Channel>('channels2');
  const { items: rawVideos, upsert, remove } = useCollection<Video>('videos2');
  const [newTitle, setNewTitle] = useState('');
  const [newChannelId, setNewChannelId] = useState('');

  // Старые этапы (Сценарий/Озвучка/Запланировано) сводятся к трём, видео не пропадают
  const videos = useMemo(
    () => rawVideos.map(normalizeVideo).filter((v) => !channelId || v.channelId === channelId),
    [rawVideos, channelId],
  );
  const activeChannels = channels.filter((c) => c.status !== 'archived');
  const channelName = (id: string) => channels.find((c) => c.id === id)?.name ?? 'Без канала';
  const targetChannel = channelId ?? (newChannelId || activeChannels[0]?.id || '');

  const addVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !targetChannel) return;
    upsert(
      normalizeVideo({
        id: `video-${Date.now()}`,
        channelId: targetChannel,
        title: newTitle.trim(),
        stage: 'editing',
      }),
    );
    setNewTitle('');
  };

  const toggleItem = (video: Video, key: (typeof CHECKLIST_ITEMS)[number]['key']) => {
    // Опубликованное видео не правим: чек-лист закрыт вместе с этапом
    if (video.stage === 'published') return;
    upsert({ ...video, checklist: { ...video.checklist!, [key]: !video.checklist![key] } });
  };

  const moveTo = (video: Video, stage: VideoStage) => {
    if (stage === 'published') {
      if (!canPublish(video.checklist)) return;
      upsert({ ...video, stage, publishedAt: todayStr(), publishDate: video.publishDate ?? todayStr() });
      playQuestCompleteSound();
      playCoinSound();
      triggerQuestConfetti();
      // Одно видео награждается один раз (ref = id видео)
      applyGame({ kind: 'video_published', ref: video.id });
      return;
    }
    const { publishedAt: _drop, ...rest } = video;
    void _drop;
    upsert({ ...rest, stage });
  };

  return (
    <div className="space-y-3">
      <form onSubmit={addVideo} className="flex flex-wrap items-center gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Новое видео: рабочее название"
          className="flex-1 min-w-[200px] bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/25"
        />
        {!channelId && (
          <select
            value={targetChannel}
            onChange={(e) => setNewChannelId(e.target.value)}
            aria-label="Канал нового видео"
            className="bg-zinc-900 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-zinc-200"
          >
            {activeChannels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          disabled={!newTitle.trim() || !targetChannel}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-white disabled:opacity-40 text-zinc-950 font-bold text-xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Добавить видео
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 items-start">
        {VIDEO_STAGES.map((lane, laneIndex) => {
          const laneVideos = videos.filter((v) => v.stage === lane.id);
          return (
            <section key={lane.id} className="bg-[#0e0e13] border border-white/[0.07] rounded-2xl p-2" aria-label={lane.label}>
              <h3 className="flex items-center gap-2 px-2 py-1.5 text-[13px] font-semibold text-zinc-200">
                <span className={`w-1.5 h-1.5 rounded-full ${LANE_DOT[lane.id]}`} />
                {lane.label}
                <span className="ml-auto text-[10px] font-mono text-zinc-500">{laneVideos.length}</span>
              </h3>
              <div className="space-y-1.5">
                {laneVideos.map((video) => {
                  const done = CHECKLIST_ITEMS.filter((i) => video.checklist![i.key]).length;
                  const locked = video.stage === 'published';
                  const prev = VIDEO_STAGES[laneIndex - 1];
                  const next = VIDEO_STAGES[laneIndex + 1];
                  const publishBlocked = next?.id === 'published' && !canPublish(video.checklist);
                  return (
                    <article key={video.id} className="bg-[#121218] border border-white/[0.07] rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[11px] text-zinc-500 truncate">{channelName(video.channelId)}</p>
                          <p className="text-[13px] font-semibold text-zinc-100 leading-snug break-words">{video.title}</p>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-400 shrink-0">{done}/5</span>
                      </div>
                      <ul className="mt-2 space-y-0.5">
                        {CHECKLIST_ITEMS.map((item) => {
                          const checked = !!video.checklist![item.key];
                          return (
                            <li key={item.key}>
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={checked}
                                disabled={locked}
                                onClick={() => toggleItem(video, item.key)}
                                className="flex items-center gap-2 w-full text-left py-1 text-[12.5px] cursor-pointer disabled:cursor-default"
                              >
                                <span
                                  className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                                    checked ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-white/20'
                                  }`}
                                >
                                  {checked && <Check className="w-3 h-3" />}
                                </span>
                                <span className={checked ? 'text-zinc-500 line-through' : 'text-zinc-200'}>{item.label}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      <div className="mt-2 flex items-center gap-1.5">
                        {prev && (
                          <button
                            type="button"
                            onClick={() => moveTo(video, prev.id)}
                            title={`Вернуть: ${prev.label}`}
                            className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white cursor-pointer"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {next && (
                          <button
                            type="button"
                            disabled={publishBlocked}
                            onClick={() => moveTo(video, next.id)}
                            title={publishBlocked ? 'Отметь все 5 пунктов чек-листа' : undefined}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 text-[11px] text-zinc-200 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            {next.label} <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => remove(video.id)}
                          aria-label="Удалить видео"
                          className="ml-auto p-1.5 rounded-lg text-zinc-600 hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </article>
                  );
                })}
                {laneVideos.length === 0 && <p className="px-2 py-3 text-[11px] text-zinc-600">Пусто</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
