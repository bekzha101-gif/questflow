import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { Channel as CloudChannel, Video as CloudVideo } from '@shared/types';
import { todayStr } from '@shared/time';
import { useCollection } from '../store';
import { applyGame } from '../sections/progress/game';
import {
  channelFromCloud,
  channelToCloud,
  videoFromCloud,
  videoToCloud,
  type Channel,
  type ProductionStage,
  type VideoItem,
  PRODUCTION_STAGES,
  CHANNEL_COLORS,
  allTags,
  channelScope,
  parseTags,
} from './legacyMedia';
import { useKanbanDrag } from './useKanbanDrag';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  X,
  Search,
  ChevronDown,
  Settings,
  Check,
  Calendar as CalendarIcon,
  LayoutGrid,
  Sparkles,
  ExternalLink,
  Film,
  User,
  Clock,
} from 'lucide-react';
import { playQuestCompleteSound, playCoinSound } from '../utils/sound';
import { triggerQuestConfetti } from '../utils/confetti';


export type { ProductionStage, VideoItem, Channel } from './legacyMedia';

export const ContentProductionBoard: React.FC = () => {
  // Channels State
  // Каналы и видео живут в облаке (channels2/videos2), здесь — старый вид
  const cloudChannels = useCollection<CloudChannel>('channels2');
  const cloudVideos = useCollection<CloudVideo>('videos2');
  const channels = useMemo(() => cloudChannels.items.map(channelFromCloud), [cloudChannels.items]);
  const videos = useMemo(() => cloudVideos.items.map(videoFromCloud), [cloudVideos.items]);

  // Active Selected Channel ID (по умолчанию — все каналы)
  const [selectedChannelId, setSelectedChannelId] = useState<string>(() => {
    return localStorage.getItem('questflow_selected_channel_id') || 'all';
  });

  // Dropdown open state
  const [isChannelDropdownOpen, setIsChannelDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadFilter, setUploadFilter] = useState<'all' | 'unuploaded' | 'uploaded'>('all');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [editingVideo, setEditingVideo] = useState<VideoItem | null>(null);

  // Form Video State
  const [formTitle, setFormTitle] = useState('');
  const [formChannelId, setFormChannelId] = useState('');
  const [formStage, setFormStage] = useState<ProductionStage>('editing');
  const [formIsUploaded, setFormIsUploaded] = useState(false);
  const [formMemberName, setFormMemberName] = useState('');
  const [formPublishDate, setFormPublishDate] = useState(todayStr());
  const [formPublishTime, setFormPublishTime] = useState('18:00');
  const [formPrice, setFormPrice] = useState(40);
  const [formScript, setFormScript] = useState('');
  const [formRefUrl, setFormRefUrl] = useState('');

  // Form Channel State
  const [chanFormName, setChanFormName] = useState('');
  const [chanFormHandle, setChanFormHandle] = useState('@');
  const [chanFormAvatar, setChanFormAvatar] = useState('🦫');
  const [chanFormDesc, setChanFormDesc] = useState('');
  const [chanFormColor, setChanFormColor] = useState(CHANNEL_COLORS[0]);
  const [chanFormTags, setChanFormTags] = useState('');

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsChannelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectChannel = (channelId: string) => {
    setSelectedChannelId(channelId);
    localStorage.setItem('questflow_selected_channel_id', channelId);
    setIsChannelDropdownOpen(false);
  };

  // Пишем в облако только изменённые записи, пропавшие — удаляем
  const saveVideosState = (items: VideoItem[]) => {
    const today = todayStr();
    const before = new Map(videos.map((v) => [v.id, JSON.stringify(v)]));
    for (const item of items) {
      if (before.get(item.id) === JSON.stringify(item)) continue;
      cloudVideos.upsert(videoToCloud(item, cloudVideos.items.find((v) => v.id === item.id), today));
    }
    const keep = new Set(items.map((v) => v.id));
    for (const v of videos) if (!keep.has(v.id)) cloudVideos.remove(v.id);
  };

  const saveChannelsState = (items: Channel[]) => {
    const before = new Map(channels.map((c) => [c.id, JSON.stringify(c)]));
    for (const item of items) {
      if (before.get(item.id) === JSON.stringify(item)) continue;
      cloudChannels.upsert(channelToCloud(item, cloudChannels.items.find((c) => c.id === item.id)));
    }
  };

  // Награда за видео — один раз на видео (ref = id), как во всей игре
  const rewardPublish = (vid: VideoItem) => {
    applyGame({ kind: 'video_published', ref: vid.id });
  };

  const openCreateModal = () => {
    // Видео привязано к каналу: без каналов сначала предлагаем создать канал
    if (channels.length === 0) {
      openNewChannelModal();
      return;
    }
    setEditingVideo(null);
    setFormTitle('');
    const targetChannel = channelScope(channels, selectedChannelId)?.[0] ?? channels[0]?.id ?? '';
    setFormChannelId(targetChannel);
    setFormStage('editing');
    setFormIsUploaded(false);
    setFormMemberName('');
    setFormPublishDate(todayStr());
    setFormPublishTime('18:00');
    setFormPrice(40);
    setFormScript('');
    setFormRefUrl('');
    setIsCreateModalOpen(true);
  };

  const openEditModal = (vid: VideoItem) => {
    setEditingVideo(vid);
    setFormTitle(vid.title);
    setFormChannelId(vid.channelId);
    setFormStage(vid.stage);
    setFormIsUploaded(vid.isUploaded);
    setFormMemberName(vid.assignedMemberName || '');
    setFormPublishDate(vid.publishDate || '');
    setFormPublishTime(vid.publishTime || '18:00');
    setFormPrice(vid.pricePerVideo || 40);
    setFormScript(vid.scriptSnippet || '');
    setFormRefUrl(vid.referenceUrl || '');
    setIsCreateModalOpen(true);
  };

  const openNewChannelModal = () => {
    setEditingChannel(null);
    setChanFormName('');
    setChanFormHandle('@');
    setChanFormAvatar('🎬');
    setChanFormDesc('');
    setChanFormColor(CHANNEL_COLORS[0]);
    setChanFormTags('');
    setIsChannelDropdownOpen(false);
    setIsChannelModalOpen(true);
  };

  const openEditChannelModal = (chan: Channel) => {
    setEditingChannel(chan);
    setChanFormName(chan.name);
    setChanFormHandle(chan.handle);
    setChanFormAvatar(chan.avatar);
    setChanFormDesc(chan.description || '');
    setChanFormColor(chan.color);
    setChanFormTags(chan.tags.join(', '));
    setIsChannelDropdownOpen(false);
    setIsChannelModalOpen(true);
  };

  const handleSaveChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chanFormName.trim()) return;

    if (editingChannel) {
      const updated = channels.map((c) =>
        c.id === editingChannel.id
          ? {
              ...c,
              name: chanFormName.trim(),
              handle: chanFormHandle.trim() || `@${chanFormName.trim().toLowerCase().replace(/\s+/g, '_')}`,
              avatar: chanFormAvatar.trim() || '🎬',
              description: chanFormDesc.trim(),
              color: chanFormColor,
              tags: parseTags(chanFormTags),
            }
          : c
      );
      saveChannelsState(updated);
    } else {
      const newChan: Channel = {
        id: `chan-${Date.now()}`,
        name: chanFormName.trim(),
        handle: chanFormHandle.trim() || `@${chanFormName.trim().toLowerCase().replace(/\s+/g, '_')}`,
        avatar: chanFormAvatar.trim() || '🎬',
        color: chanFormColor,
        description: chanFormDesc.trim(),
        tags: parseTags(chanFormTags),
      };
      const nextList = [...channels, newChan];
      saveChannelsState(nextList);
      handleSelectChannel(newChan.id);
    }

    setIsChannelModalOpen(false);
  };

  // Удаление канала вместе с его видео (мягкое: в облаке помечается deleted)
  const handleDeleteChannel = (chan: Channel) => {
    const own = videos.filter((v) => v.channelId === chan.id);
    const question = own.length
      ? `Удалить канал «${chan.name}» и его видео (${own.length} шт.)?`
      : `Удалить канал «${chan.name}»?`;
    if (!window.confirm(question)) return;
    for (const v of own) cloudVideos.remove(v.id);
    cloudChannels.remove(chan.id);
    if (selectedChannelId === chan.id) handleSelectChannel('all');
    setIsChannelModalOpen(false);
  };

  const handleSaveVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    if (editingVideo) {
      const updated = videos.map((v) =>
        v.id === editingVideo.id
          ? {
              ...v,
              title: formTitle.trim(),
              channelId: formChannelId,
              stage: formStage,
              isUploaded: formIsUploaded,
              assignedMemberName: formMemberName.trim(),
              publishDate: formPublishDate,
              publishTime: formPublishTime,
              pricePerVideo: formPrice,
              scriptSnippet: formScript.trim(),
              referenceUrl: formRefUrl.trim(),
            }
          : v
      );
      saveVideosState(updated);
    } else {
      const newVid: VideoItem = {
        id: `vid-${Date.now()}`,
        title: formTitle.trim(),
        channelId: formChannelId,
        stage: formStage,
        isUploaded: formIsUploaded,
        assignedMemberName: formMemberName.trim(),
        publishDate: formPublishDate,
        publishTime: formPublishTime,
        pricePerVideo: formPrice,
        scriptSnippet: formScript.trim(),
        referenceUrl: formRefUrl.trim(),
        aspectRatio: '9:16',
        expReward: 75,
        goldReward: 50,
      };
      saveVideosState([newVid, ...videos]);
    }

    setIsCreateModalOpen(false);
  };

  const handleDeleteVideo = (id: string) => {
    saveVideosState(videos.filter((v) => v.id !== id));
  };

  const handleToggleUploadStatus = (vid: VideoItem) => {
    const nextStatus = !vid.isUploaded;
    const nextStage: ProductionStage = nextStatus ? 'published' : vid.stage;

    const updated = videos.map((v) =>
      v.id === vid.id ? { ...v, isUploaded: nextStatus, stage: nextStage } : v
    );
    saveVideosState(updated);

    if (nextStatus) {
      playQuestCompleteSound();
      playCoinSound();
      triggerQuestConfetti();
      rewardPublish(vid);
    }
  };

  const handleMoveStage = (vid: VideoItem, nextStage: ProductionStage) => {
    const isNowUploaded = nextStage === 'published' ? true : vid.stage === 'published' ? false : vid.isUploaded;
    const updated = videos.map((v) =>
      v.id === vid.id ? { ...v, stage: nextStage, isUploaded: isNowUploaded } : v
    );
    saveVideosState(updated);

    if (nextStage === 'published' && !vid.isUploaded) {
      playQuestCompleteSound();
      playCoinSound();
      triggerQuestConfetti();
      rewardPublish(vid);
    }
  };

  // Перенос карточки мышкой или пальцем в другую колонку
  const { drag, onPointerDown } = useKanbanDrag((id, stage) => {
    const vid = videos.find((v) => v.id === id);
    const next = PRODUCTION_STAGES.find((st) => st.id === stage)?.id;
    if (vid && next && next !== vid.stage) handleMoveStage(vid, next);
  });
  const draggedVideo = drag ? videos.find((v) => v.id === drag.id) : undefined;

  // Выбор в меню: все каналы, один канал или тег ('tag:<тег>')
  const scopeIds = channelScope(channels, selectedChannelId);
  const selectedTag = selectedChannelId.startsWith('tag:') && scopeIds ? selectedChannelId.slice(4) : null;
  const activeChannel = !selectedTag ? channels.find((c) => c.id === selectedChannelId) : undefined;
  const isAll = scopeIds === null;
  const tags = allTags(channels);
  const channelColor = (id: string) => channels.find((c) => c.id === id)?.color ?? CHANNEL_COLORS[0];

  // Filtered videos: STRICTLY filters by selected channel if not 'all'
  const filteredVideos = videos.filter((v) => {
    if (scopeIds && !scopeIds.includes(v.channelId)) return false;
    if (uploadFilter === 'unuploaded' && v.isUploaded) return false;
    if (uploadFilter === 'uploaded' && !v.isUploaded) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = v.title.toLowerCase().includes(q);
      const matchScript = v.scriptSnippet?.toLowerCase().includes(q);
      const matchAuthor = v.assignedMemberName?.toLowerCase().includes(q);
      if (!matchTitle && !matchScript && !matchAuthor) return false;
    }
    return true;
  });

  const stages = PRODUCTION_STAGES.map((st, i) => ({ ...st, num: String(i + 1) }));

  // Channel Metrics
  const activeChannelVideos = videos.filter((v) => !scopeIds || scopeIds.includes(v.channelId));
  const totalChannelVideos = activeChannelVideos.length;
  const inProgressCount = activeChannelVideos.filter((v) => v.stage !== 'published').length;
  const publishedCount = activeChannelVideos.filter((v) => v.stage === 'published').length;
  const uploadedCount = activeChannelVideos.filter((v) => v.isUploaded).length;

  return (
    <div className="max-w-7xl mx-auto py-5 px-3 sm:px-6 space-y-5">
      
      {/* Top Header with ShortsFlow Channel Dropdown Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#111115] border border-white/[0.08] rounded-3xl p-3.5 sm:p-4 shadow-xl">
        
        {/* Left: ShortsFlow Channel Selector Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsChannelDropdownOpen(!isChannelDropdownOpen)}
            className="flex items-center gap-3 px-3.5 py-2 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 text-left transition-all group shadow-sm"
          >
            <div
              className="w-8 h-8 rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center text-lg shrink-0"
              style={activeChannel ? { backgroundColor: `${activeChannel.color}33`, borderColor: activeChannel.color } : undefined}
            >
              {isAll ? '📺' : selectedTag ? '#' : (activeChannel?.avatar || '🎬')}
            </div>

            <div className="min-w-0 pr-1">
              <p className="text-xs font-bold text-zinc-100 leading-tight truncate font-heading">
                {isAll ? 'Все каналы' : selectedTag ? `#${selectedTag}` : activeChannel?.name}
              </p>
              <p className="text-[10px] text-zinc-500 font-mono truncate">
                {isAll ? 'Глобальный контент-план' : selectedTag ? `Каналов: ${scopeIds?.length ?? 0}` : activeChannel?.handle}
              </p>
            </div>

            <ChevronDown className="w-4 h-4 text-zinc-400 group-hover:text-zinc-200 transition-transform ml-1" />
          </button>

          {/* ShortsFlow Dropdown Menu */}
          {isChannelDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-72 bg-[#141419] border border-white/10 rounded-2xl p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 space-y-1">
              
              {/* All Channels Option */}
              <div
                onClick={() => handleSelectChannel('all')}
                className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${
                  isAll ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-300 hover:bg-zinc-800/60'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center text-sm">
                  📺
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">Все каналы</p>
                  <p className="text-[10px] text-zinc-500">Глобальный контент-план</p>
                </div>
                {isAll && <Check className="w-3.5 h-3.5 text-zinc-200" />}
              </div>

              <div className="h-px bg-white/5 my-1" />

              {/* Individual Channels List */}
              <div className="max-h-60 overflow-y-auto space-y-0.5">
                {channels.map((c) => {
                  const isSelected = selectedChannelId === c.id;
                  const cCount = videos.filter((v) => v.channelId === c.id).length;

                  return (
                    <div
                      key={c.id}
                      onClick={() => handleSelectChannel(c.id)}
                      className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors ${
                        isSelected ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-300 hover:bg-zinc-800/60'
                      }`}
                    >
                      <div
                        className="w-7 h-7 rounded-lg border flex items-center justify-center text-base shrink-0"
                        style={{ backgroundColor: `${c.color}33`, borderColor: c.color }}
                      >
                        {c.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs truncate">{c.name}</p>
                        <p className="text-[10px] text-zinc-500 font-mono truncate">
                          {c.tags.length ? c.tags.map((t) => `#${t}`).join(' ') : c.handle}
                        </p>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500 px-1.5 py-0.2 rounded bg-zinc-900">
                        {cCount}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditChannelModal(c);
                        }}
                        className="p-1 rounded-md text-zinc-500 hover:text-white hover:bg-zinc-700"
                        title="Изменить канал"
                        aria-label={`Изменить канал ${c.name}`}
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="h-px bg-white/5 my-1" />

              {/* Теги: показать все каналы с тегом */}
              {tags.length > 0 && (
                <>
                  <p className="px-2 pt-1 text-[10px] uppercase tracking-wider text-zinc-500">Теги</p>
                  <div className="flex flex-wrap gap-1 px-1.5 pb-1">
                    {tags.map((t) => {
                      const on = selectedTag?.toLowerCase() === t.toLowerCase();
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => handleSelectChannel(`tag:${t}`)}
                          className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
                            on ? 'bg-zinc-100 text-zinc-950 border-zinc-100 font-semibold' : 'bg-zinc-900 text-zinc-300 border-white/10 hover:text-white'
                          }`}
                        >
                          #{t}
                        </button>
                      );
                    })}
                  </div>
                  <div className="h-px bg-white/5 my-1" />
                </>
              )}

              {/* New Channel Button */}
              <button
                onClick={openNewChannelModal}
                className="w-full flex items-center gap-2 p-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Создать новый канал</span>
              </button>
            </div>
          )}
        </div>

        {/* Right: Search, Filter & Add Video */}
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap justify-end">
          <div className="relative flex-1 sm:w-44">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Поиск..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div className="bg-zinc-900 border border-white/10 rounded-xl p-0.5 flex items-center gap-0.5 text-xs">
            <button
              onClick={() => setUploadFilter('all')}
              className={`px-2 py-1 rounded-lg transition-all ${
                uploadFilter === 'all' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Все
            </button>
            <button
              onClick={() => setUploadFilter('unuploaded')}
              className={`px-2 py-1 rounded-lg transition-all ${
                uploadFilter === 'unuploaded' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              ⏳ Не загружены
            </button>
            <button
              onClick={() => setUploadFilter('uploaded')}
              className={`px-2 py-1 rounded-lg transition-all ${
                uploadFilter === 'uploaded' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              ✓ Загружены
            </button>
          </div>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs shadow transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Добавить видео</span>
          </button>
        </div>
      </div>

      {/* ShortsFlow Active Channel Hero Card */}
      {activeChannel && (
        <div className="bg-[#111115] border border-white/[0.08] rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md">
          <div className="flex items-start sm:items-center gap-3.5">
            <div
              className="w-12 h-12 rounded-2xl border flex items-center justify-center text-2xl shrink-0"
              style={{ backgroundColor: `${activeChannel.color}33`, borderColor: activeChannel.color }}
            >
              {activeChannel.avatar}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-100">{activeChannel.name}</h2>
                <span className="text-[11px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded-md border border-white/5">
                  {activeChannel.handle}
                </span>
                <button
                  onClick={() => openEditChannelModal(activeChannel)}
                  className="p-1 text-zinc-500 hover:text-zinc-200 transition-colors"
                  title="Настройки канала"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>
              {activeChannel.description && (
                <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{activeChannel.description}</p>
              )}
              {activeChannel.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {activeChannel.tags.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleSelectChannel(`tag:${t}`)}
                      className="px-1.5 py-0.5 rounded-md text-[10px] bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white"
                    >
                      #{t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono bg-zinc-900/60 border border-white/5 px-3 py-2 rounded-2xl shrink-0">
            <div className="text-center px-2">
              <span className="text-zinc-500 text-[10px] block">Всего</span>
              <span className="font-bold text-zinc-200">{totalChannelVideos}</span>
            </div>
            <div className="w-px h-6 bg-white/5" />
            <div className="text-center px-2">
              <span className="text-zinc-500 text-[10px] block">В работе</span>
              <span className="font-bold text-zinc-200">{inProgressCount}</span>
            </div>
            <div className="w-px h-6 bg-white/5" />
            <div className="text-center px-2">
              <span className="text-zinc-500 text-[10px] block">Опубликовано</span>
              <span className="font-bold text-zinc-200">{publishedCount}</span>
            </div>
          </div>
        </div>
      )}

      {drag && draggedVideo && (
        <div
          className="fixed z-[60] pointer-events-none bg-[#18181f] border border-white/25 border-l-4 rounded-2xl p-3 shadow-2xl rotate-2"
          style={{
            left: drag.x - drag.dx,
            top: drag.y - drag.dy,
            width: drag.width,
            borderLeftColor: channelColor(draggedVideo.channelId),
          }}
        >
          <p className="text-[10px] text-zinc-400 truncate">{channels.find((c) => c.id === draggedVideo.channelId)?.name}</p>
          <p className="font-bold text-xs text-zinc-100 leading-snug">{draggedVideo.title}</p>
        </div>
      )}

      {/* Канбан: Монтаж → Обложка и заголовок → Проверка → Выкладка. Карточки перетаскиваются мышкой или пальцем */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
        {stages.map((stage) => {
          const stageVideos = filteredVideos.filter((v) => v.stage === stage.id);

          return (
            <div
              key={stage.id}
              data-stage={stage.id}
              className={`bg-[#0f0f13] border rounded-3xl p-3 flex flex-col min-h-[520px] transition-colors ${
                drag && drag.overStage === stage.id && draggedVideo?.stage !== stage.id
                  ? 'border-emerald-400/60 bg-emerald-500/[0.06]'
                  : drag
                    ? 'border-white/10'
                    : 'border-white/5'
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-white/5 px-1">
                <span className="text-xs font-semibold text-zinc-300">
                  {stage.num}. {stage.label}
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">
                  {stageVideos.length}
                </span>
              </div>

              {/* Cards List */}
              <div className="space-y-2.5 flex-1 overflow-y-auto pr-0.5">
                {stageVideos.length === 0 ? (
                  <div className="h-28 rounded-2xl border border-dashed border-white/5 flex items-center justify-center text-[11px] text-zinc-600 text-center px-2">
                    Нет видео
                  </div>
                ) : (
                  stageVideos.map((vid) => {
                    const channel = channels.find((c) => c.id === vid.channelId);

                    return (
                      <div
                        key={vid.id}
                        onPointerDown={(e) => onPointerDown(e, vid.id)}
                        onContextMenu={(e) => drag && e.preventDefault()}
                        className={`bg-[#141419] hover:bg-[#18181f] border border-white/[0.08] hover:border-white/20 border-l-4 rounded-2xl p-3 space-y-2 transition-all group shadow-sm select-none cursor-grab active:cursor-grabbing [-webkit-touch-callout:none] ${
                          drag?.id === vid.id ? 'opacity-30' : ''
                        }`}
                        style={{ borderLeftColor: channelColor(vid.channelId) }}
                      >
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-1.5">
                          {!activeChannel ? (
                            <span className="text-[10px] text-zinc-400 font-medium truncate flex items-center gap-1">
                              <span>{channel?.avatar}</span>
                              <span className="truncate">{channel?.name}</span>
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono text-zinc-500">
                              {vid.aspectRatio || '9:16'}
                            </span>
                          )}

                          <button
                            onClick={() => handleToggleUploadStatus(vid)}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border flex items-center gap-1 transition-colors ${
                              vid.isUploaded
                                ? 'bg-zinc-800 text-zinc-200 border-zinc-700'
                                : 'bg-transparent text-zinc-500 border-zinc-800 hover:text-zinc-300'
                            }`}
                          >
                            {vid.isUploaded ? '✓ Загружено' : 'Не загружено'}
                          </button>
                        </div>

                        {/* Title */}
                        <h3 className="font-bold text-xs text-zinc-200 leading-snug">
                          {vid.title}
                        </h3>


                        {/* Metadata */}
                        <div className="space-y-1 text-[10px] text-zinc-400 pt-1 border-t border-white/5 font-mono">
                          {vid.assignedMemberName && (
                            <div className="flex items-center justify-between text-zinc-400">
                              <span className="text-zinc-500">Автор:</span>
                              <span className="truncate max-w-[110px]">{vid.assignedMemberName}</span>
                            </div>
                          )}

                          {vid.publishDate && (
                            <div className="flex items-center justify-between text-zinc-500">
                              <span>Дата:</span>
                              <span>{vid.publishDate} {vid.publishTime || ''}</span>
                            </div>
                          )}

                          {vid.pricePerVideo && (
                            <div className="flex justify-between text-zinc-500">
                              <span>Оплата:</span>
                              <span className="text-zinc-300 font-bold">${vid.pricePerVideo}</span>
                            </div>
                          )}
                        </div>

                        {/* Footer Stage Control */}
                        <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => openEditModal(vid)}
                              className="p-1 rounded-lg bg-zinc-900 text-zinc-500 hover:text-zinc-200 cursor-pointer"
                              title="Редактировать"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteVideo(vid.id)}
                              className="p-1 rounded-lg bg-zinc-900 text-zinc-500 hover:text-red-400 cursor-pointer"
                              title="Удалить"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>


                          <select
                            value={vid.stage}
                            onChange={(e) => handleMoveStage(vid, e.target.value as ProductionStage)}
                            className="bg-zinc-900 border border-white/10 rounded px-1.5 py-0.5 text-[9px] text-zinc-400 focus:outline-none"
                          >
                            {stages.map((st) => (
                              <option key={st.id} value={st.id}>
                                {st.num}. {st.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Video Create / Edit Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121216] border border-white/10 rounded-3xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h2 className="font-bold text-sm text-zinc-100">
                {editingVideo ? 'Редактировать видео' : 'Новый проект видео'}
              </h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveVideo} className="space-y-3.5">
              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">Название видео / Тема</label>
                <input
                  type="text"
                  required
                  placeholder="3 секрета био-инженерии бобра..."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Канал</label>
                  <select
                    value={formChannelId}
                    onChange={(e) => setFormChannelId(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
                  >
                    {channels.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.avatar} {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Этап производства</label>
                  <select
                    value={formStage}
                    onChange={(e) => setFormStage(e.target.value as ProductionStage)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
                  >
                    {stages.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.num}. {st.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Ответственный</label>
                  <input
                    type="text"
                    placeholder="Имя исполнителя"
                    value={formMemberName}
                    onChange={(e) => setFormMemberName(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Оплата ($)</label>
                  <input
                    type="number"
                    min="0"
                    value={formPrice}
                    onChange={(e) => setFormPrice(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Дата публикации</label>
                  <input
                    type="date"
                    value={formPublishDate}
                    onChange={(e) => setFormPublishDate(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 [color-scheme:dark] focus:outline-none focus:border-zinc-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Время</label>
                  <input
                    type="time"
                    value={formPublishTime}
                    onChange={(e) => setFormPublishTime(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 [color-scheme:dark] focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">Ссылка на референс / Google Drive</label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={formRefUrl}
                  onChange={(e) => setFormRefUrl(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div className="flex items-center gap-2 p-2.5 bg-zinc-900/60 rounded-xl border border-white/5">
                <input
                  type="checkbox"
                  id="uploaded-check"
                  checked={formIsUploaded}
                  onChange={(e) => setFormIsUploaded(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-zinc-600 bg-zinc-800 border-zinc-700"
                />
                <label htmlFor="uploaded-check" className="text-xs text-zinc-300 font-medium cursor-pointer">
                  Отметить как загруженное на YouTube/TikTok
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-zinc-900 text-xs text-zinc-400 hover:text-white"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Channel Create / Edit Modal */}
      {isChannelModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121216] border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h2 className="font-bold text-sm text-zinc-100">
                {editingChannel ? 'Редактировать канал' : 'Создать новый канал'}
              </h2>
              <button
                onClick={() => setIsChannelModalOpen(false)}
                className="p-1 rounded-lg text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveChannel} className="space-y-3.5">
              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">Название Канала</label>
                <input
                  type="text"
                  required
                  placeholder="Название канала"
                  value={chanFormName}
                  onChange={(e) => setChanFormName(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Хэндл</label>
                  <input
                    type="text"
                    placeholder="@handle"
                    value={chanFormHandle}
                    onChange={(e) => setChanFormHandle(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Эмодзи / Аватар</label>
                  <input
                    type="text"
                    value={chanFormAvatar}
                    onChange={(e) => setChanFormAvatar(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 text-center focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">Описание канала</label>
                <textarea
                  rows={2}
                  placeholder="О чём этот канал..."
                  value={chanFormDesc}
                  onChange={(e) => setChanFormDesc(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">Цвет</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {CHANNEL_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setChanFormColor(color)}
                      aria-label={`Цвет ${color}`}
                      aria-pressed={chanFormColor === color}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        chanFormColor === color ? 'border-white scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <input
                    type="color"
                    value={chanFormColor}
                    onChange={(e) => setChanFormColor(e.target.value)}
                    aria-label="Свой цвет"
                    title="Свой цвет"
                    className="w-7 h-7 rounded-md bg-transparent border border-white/10 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">Теги (через запятую)</label>
                <input
                  type="text"
                  placeholder="военка, США, шортсы"
                  value={chanFormTags}
                  onChange={(e) => setChanFormTags(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
                />
                {tags.filter((t) => !parseTags(chanFormTags).some((x) => x.toLowerCase() === t.toLowerCase())).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {tags
                      .filter((t) => !parseTags(chanFormTags).some((x) => x.toLowerCase() === t.toLowerCase()))
                      .map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setChanFormTags(parseTags(`${chanFormTags},${t}`).join(', '))}
                          className="px-1.5 py-0.5 rounded-md text-[10px] bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white"
                        >
                          + #{t}
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                {editingChannel && (
                  <button
                    type="button"
                    onClick={() => handleDeleteChannel(editingChannel)}
                    className="mr-auto flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Удалить канал
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsChannelModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-zinc-900 text-xs text-zinc-400 hover:text-white"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

