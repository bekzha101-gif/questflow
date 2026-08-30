import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  X
} from 'lucide-react';
import { Channel } from './ContentProductionBoard';

export interface TeamMember {
  id: string;
  name: string;
  role: 'Video Editor' | 'Script Writer' | 'Researcher' | 'Voice Actor' | 'Manager';
  email: string;
  avatar: string;
  pricePerVideo: number;
  assignedChannels: string[];
}

const initialTeam: TeamMember[] = [
  {
    id: 'team-1',
    name: 'Алексей Смирнов',
    role: 'Video Editor',
    email: 'alex.editor@gmail.com',
    avatar: '👨‍💻',
    pricePerVideo: 45,
    assignedChannels: ['chan-1', 'chan-2'],
  },
  {
    id: 'team-2',
    name: 'Дарья Кузнецова',
    role: 'Script Writer',
    email: 'daria.scripts@gmail.com',
    avatar: '✍️',
    pricePerVideo: 30,
    assignedChannels: ['chan-1'],
  },
  {
    id: 'team-3',
    name: 'Илья Мельников',
    role: 'Researcher',
    email: 'ilya.research@gmail.com',
    avatar: '🔍',
    pricePerVideo: 25,
    assignedChannels: ['chan-2', 'chan-3'],
  },
];

export const TeamChannelsManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'team' | 'channels'>('team');

  const [team, setTeam] = useState<TeamMember[]>(() => {
    try {
      const saved = localStorage.getItem('questflow_team_v1');
      return saved ? JSON.parse(saved) : initialTeam;
    } catch {
      return initialTeam;
    }
  });

  const [channels, setChannels] = useState<Channel[]>(() => {
    try {
      const saved = localStorage.getItem('questflow_channels_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.some((c: Channel) => c.id === 'chan-bobr')) {
          return [{ id: 'chan-bobr', name: 'Заметки бобра', handle: '@bobr_notes', avatar: '🦫', color: '#71717a' }, ...parsed];
        }
        return parsed;
      }
      return [
        { id: 'chan-bobr', name: 'Заметки бобра', handle: '@bobr_notes', avatar: '🦫', color: '#71717a' },
        { id: 'chan-1', name: 'Shorts Основной', handle: '@shorts_main', avatar: '🎬', color: '#71717a' },
        { id: 'chan-2', name: 'AI & Бизнес', handle: '@ai_productflow', avatar: '⚡', color: '#71717a' },
        { id: 'chan-3', name: 'Gaming Hacks', handle: '@gaming_hacks', avatar: '🎮', color: '#71717a' },
      ];
    } catch {
      return [];
    }
  });

  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);

  // Form Member
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState<TeamMember['role']>('Video Editor');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberPrice, setMemberPrice] = useState(40);

  // Form Channel
  const [channelName, setChannelName] = useState('');
  const [channelHandle, setChannelHandle] = useState('@');
  const [channelAvatar, setChannelAvatar] = useState('🎬');

  const saveTeam = (items: TeamMember[]) => {
    setTeam(items);
    localStorage.setItem('questflow_team_v1', JSON.stringify(items));
  };

  const saveChannels = (items: Channel[]) => {
    setChannels(items);
    localStorage.setItem('questflow_channels_v1', JSON.stringify(items));
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim()) return;

    const newM: TeamMember = {
      id: `team-${Date.now()}`,
      name: memberName.trim(),
      role: memberRole,
      email: memberEmail.trim(),
      avatar: memberRole === 'Video Editor' ? '👨‍💻' : memberRole === 'Script Writer' ? '✍️' : '🔍',
      pricePerVideo: memberPrice,
      assignedChannels: ['chan-1'],
    };

    saveTeam([newM, ...team]);
    setIsMemberModalOpen(false);
  };

  const handleAddChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelName.trim()) return;

    const newC: Channel = {
      id: `chan-${Date.now()}`,
      name: channelName.trim(),
      handle: channelHandle.trim(),
      avatar: channelAvatar,
      color: '#71717a',
    };

    saveChannels([...channels, newC]);
    setIsChannelModalOpen(false);
  };

  return (
    <div className="max-w-6xl mx-auto py-5 px-3 sm:px-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#111115] border border-white/[0.08] rounded-3xl p-4 sm:p-5">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
            <span>Команда & Каналы</span>
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Управление участниками команды, ставками и каналами
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="bg-zinc-900 border border-white/10 rounded-xl p-1 flex items-center gap-1 text-xs">
          <button
            onClick={() => setActiveTab('team')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'team' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Участники Команды
          </button>
          <button
            onClick={() => setActiveTab('channels')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'channels' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Каналы ({channels.length})
          </button>
        </div>
      </div>

      {activeTab === 'team' ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-sm text-zinc-200">Список Команды</h2>
            <button
              onClick={() => setIsMemberModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs shadow"
            >
              <Plus className="w-3.5 h-3.5" /> Добавить участника
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {team.map((member) => (
              <div
                key={member.id}
                className="bg-[#111115] border border-white/[0.08] rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center text-xl">
                      {member.avatar}
                    </div>
                    <div>
                      <h3 className="font-bold text-xs text-zinc-200">{member.name}</h3>
                      <p className="text-[10px] text-zinc-500 font-mono">{member.role}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => saveTeam(team.filter((m) => m.id !== member.id))}
                    className="p-1 rounded bg-zinc-900 text-zinc-500 hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1 text-[11px] text-zinc-500 pt-2 border-t border-white/5 font-mono">
                  <div className="flex justify-between">
                    <span>Ставка за видео:</span>
                    <span className="font-bold text-zinc-300">${member.pricePerVideo}</span>
                  </div>
                  {member.email && (
                    <div className="flex justify-between">
                      <span>Email:</span>
                      <span className="text-zinc-400 truncate max-w-[150px]">{member.email}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-sm text-zinc-200">Каналы</h2>
            <button
              onClick={() => setIsChannelModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs shadow"
            >
              <Plus className="w-3.5 h-3.5" /> Добавить канал
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {channels.map((c) => (
              <div
                key={c.id}
                className="bg-[#111115] border border-white/[0.08] rounded-2xl p-4 space-y-2 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{c.avatar}</span>
                  <div>
                    <h3 className="font-bold text-xs text-zinc-200">{c.name}</h3>
                    <p className="text-[10px] text-zinc-500 font-mono">{c.handle}</p>
                  </div>
                </div>

                <button
                  onClick={() => saveChannels(channels.filter((ch) => ch.id !== c.id))}
                  className="p-1 rounded bg-zinc-900 text-zinc-500 hover:text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {isMemberModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121216] border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h2 className="font-bold text-sm text-zinc-100">Добавить участника</h2>
              <button
                onClick={() => setIsMemberModalOpen(false)}
                className="p-1 rounded-lg text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-3.5">
              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">Имя</label>
                <input
                  type="text"
                  required
                  placeholder="Алексей"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">Роль</label>
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value as any)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
                >
                  <option value="Video Editor">Монтажёр</option>
                  <option value="Script Writer">Сценарист</option>
                  <option value="Researcher">Исследователь</option>
                  <option value="Voice Actor">Диктор</option>
                  <option value="Manager">Менеджер</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Ставка ($)</label>
                  <input
                    type="number"
                    min="0"
                    value={memberPrice}
                    onChange={(e) => setMemberPrice(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="alex@..."
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsMemberModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-zinc-900 text-xs text-zinc-400 hover:text-white"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs"
                >
                  Добавить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Channel Modal */}
      {isChannelModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121216] border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h2 className="font-bold text-sm text-zinc-100">Новый канал</h2>
              <button
                onClick={() => setIsChannelModalOpen(false)}
                className="p-1 rounded-lg text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddChannel} className="space-y-3.5">
              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">Название Канала</label>
                <input
                  type="text"
                  required
                  placeholder="Shorts & Reels Pro"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Хэндл</label>
                  <input
                    type="text"
                    value={channelHandle}
                    onChange={(e) => setChannelHandle(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Иконка</label>
                  <input
                    type="text"
                    value={channelAvatar}
                    onChange={(e) => setChannelAvatar(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 text-center focus:outline-none focus:border-zinc-500"
                  />
                </div>
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
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
