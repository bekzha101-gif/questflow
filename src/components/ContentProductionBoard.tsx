import React, { useState, useRef, useEffect } from 'react';
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
  Wand2
} from 'lucide-react';
import { AiVideoStudioModal } from './AiVideoStudioModal';
import { playQuestCompleteSound, playCoinSound } from '../utils/sound';
import { triggerQuestConfetti } from '../utils/confetti';


export type ProductionStage = 'scripting' | 'voiceover' | 'editing' | 'review' | 'scheduled' | 'published';

export interface VideoItem {
  id: string;
  title: string;
  channelId: string;
  stage: ProductionStage;
  isUploaded: boolean;
  assignedMemberName?: string;
  assignedMemberRole?: string;
  publishDate?: string;
  publishTime?: string;
  pricePerVideo?: number;
  scriptSnippet?: string;
  referenceUrl?: string;
  aspectRatio?: '9:16' | '16:9';
  expReward: number;
  goldReward: number;
}

export interface Channel {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  color: string;
  description?: string;
}

const defaultChannels: Channel[] = [
  { 
    id: 'chan-bobr', 
    name: 'Заметки бобра', 
    handle: '@bobr_notes', 
    avatar: '🦫', 
    color: '#71717a',
    description: 'Инженерия природы, био-хаки и продуктивность от лесных архитекторов' 
  },
  { 
    id: 'chan-1', 
    name: 'Shorts Основной', 
    handle: '@shorts_main', 
    avatar: '🎬', 
    color: '#71717a',
    description: 'Главный канал с вирусными короткими видео и лайфхаками' 
  },
  { 
    id: 'chan-2', 
    name: 'AI & Бизнес', 
    handle: '@ai_productflow', 
    avatar: '⚡', 
    color: '#71717a',
    description: 'Нейросети, автоматизация процессов и AI-инструменты' 
  },
  { 
    id: 'chan-3', 
    name: 'Gaming Hacks', 
    handle: '@gaming_hacks', 
    avatar: '🎮', 
    color: '#71717a',
    description: 'Геймификация жизни, обзоры механик и пасхалки' 
  },
];

const defaultVideos: VideoItem[] = [
  {
    id: 'vid-bobr-1',
    title: 'Почему бобры строят плотины именно так? 3 секрета природной инженерии',
    channelId: 'chan-bobr',
    stage: 'editing',
    isUploaded: false,
    assignedMemberName: 'Алексей (Монтажёр)',
    assignedMemberRole: 'Video Editor',
    publishDate: '2026-08-30',
    publishTime: '19:00',
    pricePerVideo: 45,
    scriptSnippet: 'Хук 0-3 сек: Вы думали, бобры просто грызут деревья? Они рассчитывают гидродинамику реки лучше инженеров...',
    referenceUrl: 'https://youtube.com/shorts/bobr-demo',
    aspectRatio: '9:16',
    expReward: 85,
    goldReward: 50,
  },
  {
    id: 'vid-bobr-2',
    title: 'Топ-5 привычек ультра-фокуса: как успевать строить "плотины" в делах',
    channelId: 'chan-bobr',
    stage: 'scripting',
    isUploaded: false,
    assignedMemberName: 'Дарья (Сценарист)',
    assignedMemberRole: 'Script Writer',
    publishDate: '2026-08-31',
    publishTime: '18:00',
    pricePerVideo: 35,
    scriptSnippet: 'План: 1. Не распыляться на ветки. 2. Закладывать монолитную базу с утра. 3. 25 минут полного погружения...',
    referenceUrl: '',
    aspectRatio: '9:16',
    expReward: 65,
    goldReward: 40,
  },
  {
    id: 'vid-bobr-3',
    title: 'Анатомия зубов бобра: железо в эмали и почему они никогда не тупятся',
    channelId: 'chan-bobr',
    stage: 'published',
    isUploaded: true,
    assignedMemberName: 'Алексей (Монтажёр)',
    assignedMemberRole: 'Video Editor',
    publishDate: '2026-08-27',
    publishTime: '17:30',
    pricePerVideo: 40,
    scriptSnippet: 'Разбор биохимии эмали и визуальный ряд микроструктуры зуба.',
    referenceUrl: 'https://youtube.com/shorts/bobr-published',
    aspectRatio: '9:16',
    expReward: 100,
    goldReward: 70,
  },
  {
    id: 'vid-1',
    title: 'Как Todoist + Habitica взламывают дофамин (Разбор)',
    channelId: 'chan-1',
    stage: 'editing',
    isUploaded: false,
    assignedMemberName: 'Алексей (Монтажёр)',
    assignedMemberRole: 'Video Editor',
    publishDate: '2026-08-30',
    publishTime: '18:00',
    pricePerVideo: 45,
    scriptSnippet: 'Хук 0-3 сек: Ты никогда не сможешь доделать список дел, если делаешь это как 99% людей...',
    referenceUrl: 'https://youtube.com/shorts/ref-1',
    aspectRatio: '9:16',
    expReward: 80,
    goldReward: 50,
  },
  {
    id: 'vid-2',
    title: '5 микро-привычек для быстрого фокуса за 2 минуты',
    channelId: 'chan-1',
    stage: 'review',
    isUploaded: false,
    assignedMemberName: 'Дарья (Сценарист)',
    assignedMemberRole: 'Script Writer',
    publishDate: '2026-08-31',
    publishTime: '15:00',
    pricePerVideo: 30,
    scriptSnippet: 'План: 1. Стакан воды 2. Таймер на 25м 3. Полный дофаминовый детокс на 10 минут...',
    referenceUrl: '',
    aspectRatio: '9:16',
    expReward: 60,
    goldReward: 35,
  },
  {
    id: 'vid-3',
    title: 'Топ-3 нейросети для автоматического монтажа видео в 2026',
    channelId: 'chan-2',
    stage: 'scripting',
    isUploaded: false,
    assignedMemberName: 'Илья (Researcher)',
    assignedMemberRole: 'Researcher',
    publishDate: '2026-09-02',
    publishTime: '19:00',
    pricePerVideo: 40,
    scriptSnippet: 'Сравнение CapCut AI, Opus Clip и Descript. Тест скорости создания субтитров.',
    referenceUrl: '',
    aspectRatio: '9:16',
    expReward: 70,
    goldReward: 40,
  },
  {
    id: 'vid-4',
    title: 'Секретная фишка Google Calendar, о которой никто не знает',
    channelId: 'chan-2',
    stage: 'published',
    isUploaded: true,
    assignedMemberName: 'Алексей (Монтажёр)',
    assignedMemberRole: 'Video Editor',
    publishDate: '2026-08-28',
    publishTime: '17:00',
    pricePerVideo: 50,
    scriptSnippet: 'Полный обзор 2-Way Time-Boxing интеграции.',
    referenceUrl: 'https://youtube.com/shorts/published-demo',
    aspectRatio: '9:16',
    expReward: 100,
    goldReward: 70,
  },
];

interface ContentProductionBoardProps {
  onPublishReward?: (exp: number, gold: number) => void;
}

export const ContentProductionBoard: React.FC<ContentProductionBoardProps> = ({ onPublishReward }) => {
  // Channels State
  const [channels, setChannels] = useState<Channel[]>(() => {
    try {
      const saved = localStorage.getItem('questflow_channels_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.some((c: Channel) => c.id === 'chan-bobr')) {
          return [{ id: 'chan-bobr', name: 'Заметки бобра', handle: '@bobr_notes', avatar: '🦫', color: '#71717a', description: 'Инженерия природы, био-хаки и продуктивность' }, ...parsed];
        }
        return parsed;
      }
      return defaultChannels;
    } catch {
      return defaultChannels;
    }
  });

  // Active Selected Channel ID (Defaults strictly to 'chan-bobr')
  const [selectedChannelId, setSelectedChannelId] = useState<string>(() => {
    return localStorage.getItem('questflow_selected_channel_id') || 'chan-bobr';
  });

  // Dropdown open state
  const [isChannelDropdownOpen, setIsChannelDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Videos State
  const [videos, setVideos] = useState<VideoItem[]>(() => {
    try {
      const saved = localStorage.getItem('questflow_videos_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.some((v: VideoItem) => v.channelId === 'chan-bobr')) {
          return [...defaultVideos.filter(v => v.channelId === 'chan-bobr'), ...parsed];
        }
        return parsed;
      }
      return defaultVideos;
    } catch {
      return defaultVideos;
    }
  });

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadFilter, setUploadFilter] = useState<'all' | 'unuploaded' | 'uploaded'>('all');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [editingVideo, setEditingVideo] = useState<VideoItem | null>(null);
  const [aiStudioVideo, setAiStudioVideo] = useState<VideoItem | null>(null);
  const [isAiStudioOpen, setIsAiStudioOpen] = useState(false);

  const handleOpenAiStudio = (vid: VideoItem) => {
    setAiStudioVideo(vid);
    setIsAiStudioOpen(true);
  };

  const handleSaveScript = (videoId: string, newScript: string) => {
    setVideos((prev) => {
      const updated = prev.map((v) => (v.id === videoId ? { ...v, scriptSnippet: newScript } : v));
      try {
        localStorage.setItem('questflow_videos_v1', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };


  // Form Video State
  const [formTitle, setFormTitle] = useState('');
  const [formChannelId, setFormChannelId] = useState(selectedChannelId === 'all' ? (channels[0]?.id || 'chan-bobr') : selectedChannelId);
  const [formStage, setFormStage] = useState<ProductionStage>('scripting');
  const [formIsUploaded, setFormIsUploaded] = useState(false);
  const [formMemberName, setFormMemberName] = useState('Алексей (Монтажёр)');
  const [formPublishDate, setFormPublishDate] = useState(new Date().toISOString().split('T')[0]);
  const [formPublishTime, setFormPublishTime] = useState('18:00');
  const [formPrice, setFormPrice] = useState(40);
  const [formScript, setFormScript] = useState('');
  const [formRefUrl, setFormRefUrl] = useState('');

  // Form Channel State
  const [chanFormName, setChanFormName] = useState('');
  const [chanFormHandle, setChanFormHandle] = useState('@');
  const [chanFormAvatar, setChanFormAvatar] = useState('🦫');
  const [chanFormDesc, setChanFormDesc] = useState('');

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

  const saveVideosState = (items: VideoItem[]) => {
    setVideos(items);
    try {
      localStorage.setItem('questflow_videos_v1', JSON.stringify(items));
    } catch (e) {
      console.error(e);
    }
  };

  const saveChannelsState = (items: Channel[]) => {
    setChannels(items);
    try {
      localStorage.setItem('questflow_channels_v1', JSON.stringify(items));
    } catch (e) {
      console.error(e);
    }
  };

  const openCreateModal = () => {
    setEditingVideo(null);
    setFormTitle('');
    const targetChannel = selectedChannelId !== 'all' ? selectedChannelId : (channels[0]?.id || 'chan-bobr');
    setFormChannelId(targetChannel);
    setFormStage('scripting');
    setFormIsUploaded(false);
    setFormMemberName('Алексей (Монтажёр)');
    setFormPublishDate(new Date().toISOString().split('T')[0]);
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
    setIsChannelDropdownOpen(false);
    setIsChannelModalOpen(true);
  };

  const openEditChannelModal = (chan: Channel) => {
    setEditingChannel(chan);
    setChanFormName(chan.name);
    setChanFormHandle(chan.handle);
    setChanFormAvatar(chan.avatar);
    setChanFormDesc(chan.description || '');
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
        color: '#71717a',
        description: chanFormDesc.trim(),
      };
      const nextList = [...channels, newChan];
      saveChannelsState(nextList);
      handleSelectChannel(newChan.id);
    }

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
      if (onPublishReward) {
        onPublishReward(vid.expReward, vid.goldReward);
      }
    }
  };

  const handleMoveStage = (vid: VideoItem, nextStage: ProductionStage) => {
    const isNowUploaded = nextStage === 'published' ? true : vid.isUploaded;
    const updated = videos.map((v) =>
      v.id === vid.id ? { ...v, stage: nextStage, isUploaded: isNowUploaded } : v
    );
    saveVideosState(updated);

    if (nextStage === 'published' && !vid.isUploaded) {
      playQuestCompleteSound();
      playCoinSound();
      triggerQuestConfetti();
      if (onPublishReward) {
        onPublishReward(vid.expReward, vid.goldReward);
      }
    }
  };

  // Find Active Channel object
  const activeChannel = channels.find((c) => c.id === selectedChannelId) || channels[0];

  // Filtered videos: STRICTLY filters by selected channel if not 'all'
  const filteredVideos = videos.filter((v) => {
    if (selectedChannelId !== 'all' && v.channelId !== selectedChannelId) {
      return false;
    }
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

  const stages: { id: ProductionStage; label: string; num: string }[] = [
    { id: 'scripting', label: 'Сценарий', num: '1' },
    { id: 'voiceover', label: 'Озвучка', num: '2' },
    { id: 'editing', label: 'Монтаж', num: '3' },
    { id: 'review', label: 'Проверка', num: '4' },
    { id: 'scheduled', label: 'Запланировано', num: '5' },
    { id: 'published', label: 'Опубликовано', num: '6' },
  ];

  // Channel Metrics
  const activeChannelVideos = videos.filter((v) => selectedChannelId === 'all' || v.channelId === selectedChannelId);
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
            <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center text-lg shrink-0">
              {selectedChannelId === 'all' ? '📺' : (activeChannel?.avatar || '🎬')}
            </div>

            <div className="min-w-0 pr-1">
              <p className="text-xs font-bold text-zinc-100 leading-tight truncate font-heading">
                {selectedChannelId === 'all' ? 'Все каналы' : activeChannel?.name}
              </p>
              <p className="text-[10px] text-zinc-500 font-mono truncate">
                {selectedChannelId === 'all' ? 'Глобальный контент-план' : activeChannel?.handle}
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
                  selectedChannelId === 'all' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-300 hover:bg-zinc-800/60'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center text-sm">
                  📺
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">Все каналы</p>
                  <p className="text-[10px] text-zinc-500">Глобальный контент-план</p>
                </div>
                {selectedChannelId === 'all' && <Check className="w-3.5 h-3.5 text-zinc-200" />}
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
                      <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center text-base">
                        {c.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs truncate">{c.name}</p>
                        <p className="text-[10px] text-zinc-500 font-mono truncate">{c.handle}</p>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500 px-1.5 py-0.2 rounded bg-zinc-900">
                        {cCount}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="h-px bg-white/5 my-1" />

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
      {selectedChannelId !== 'all' && activeChannel && (
        <div className="bg-[#111115] border border-white/[0.08] rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center text-2xl shrink-0">
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

      {/* 6 Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {stages.map((stage) => {
          const stageVideos = filteredVideos.filter((v) => v.stage === stage.id);

          return (
            <div
              key={stage.id}
              className="bg-[#0f0f13] border border-white/5 rounded-3xl p-3 flex flex-col min-h-[520px]"
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
                        className="bg-[#141419] hover:bg-[#18181f] border border-white/[0.08] hover:border-white/20 rounded-2xl p-3 space-y-2 transition-all group shadow-sm"
                      >
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-1.5">
                          {selectedChannelId === 'all' ? (
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

                        {/* Script Snippet */}
                        {vid.scriptSnippet && (
                          <p className="text-[10px] text-zinc-500 line-clamp-2 italic bg-black/25 p-1.5 rounded-lg border border-white/[0.02]">
                            "{vid.scriptSnippet}"
                          </p>
                        )}

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
                              onClick={() => handleOpenAiStudio(vid)}
                              className="p-1 px-1.5 rounded-lg bg-purple-950/60 hover:bg-purple-900/80 border border-purple-500/30 text-purple-300 hover:text-white flex items-center gap-1 text-[10px] font-semibold transition-all cursor-pointer shadow-sm"
                              title="AI Студия Сценариев & Хуков"
                            >
                              <Wand2 className="w-3 h-3 text-purple-400" />
                              <span>AI Студия</span>
                            </button>

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
                            <option value="scripting">1. Сценарий</option>
                            <option value="voiceover">2. Озвучка</option>
                            <option value="editing">3. Монтаж</option>
                            <option value="review">4. Проверка</option>
                            <option value="scheduled">5. Запланировано</option>
                            <option value="published">6. Опубликовано</option>
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
                    <option value="scripting">1. Сценарий</option>
                    <option value="voiceover">2. Озвучка</option>
                    <option value="editing">3. Монтаж</option>
                    <option value="review">4. Проверка</option>
                    <option value="scheduled">5. Запланировано</option>
                    <option value="published">6. Опубликовано</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Ответственный</label>
                  <input
                    type="text"
                    placeholder="Алексей (Монтажёр)"
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
                <label className="text-xs text-zinc-400 font-medium block mb-1">Хук / Сценарий (Первые 3 секунды)</label>
                <textarea
                  rows={2}
                  placeholder="Вступление, хук..."
                  value={formScript}
                  onChange={(e) => setFormScript(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
                />
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
                  placeholder="Заметки бобра"
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
                    placeholder="@bobr_notes"
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

              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
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

      {/* AI Viral Hook & Script Studio Modal */}
      <AiVideoStudioModal
        isOpen={isAiStudioOpen}
        onClose={() => setIsAiStudioOpen(false)}
        video={aiStudioVideo}
        onSaveScript={handleSaveScript}
      />
    </div>
  );
};

