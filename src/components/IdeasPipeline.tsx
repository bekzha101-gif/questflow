import React, { useState } from 'react';
import { Project, TaskItem, Priority } from '../types';
import { 
  Lightbulb, 
  Plus, 
  Tag, 
  ExternalLink, 
  ArrowRight, 
  Trash2, 
  Edit3, 
  FileText,
  X,
  Play
} from 'lucide-react';
import { playCoinSound } from '../utils/sound';

export interface IdeaItem {
  id: string;
  title: string;
  status: 'new' | 'promising' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  notes: string;
  referenceLinks: { label: string; url: string }[];
  projectId: string;
  createdAt: string;
}

const initialIdeas: IdeaItem[] = [
  {
    id: 'idea-1',
    title: 'Shorts: Как Todoist + Habitica взламывают дофамин',
    status: 'in_progress',
    priority: 'high',
    tags: ['дофамин', 'shorts', 'фокус'],
    notes: 'Хук: Почему обычные списки задач не работают. Сравнение с прокачкой в RPG.',
    referenceLinks: [{ label: 'Референс', url: 'https://youtube.com/shorts/example' }],
    projectId: 'proj-shorts',
    createdAt: '2026-08-28',
  },
  {
    id: 'idea-2',
    title: '5 микро-привычек для быстрого фокуса за 2 минуты',
    status: 'promising',
    priority: 'medium',
    tags: ['привычки', 'фокус'],
    notes: 'Формат быстрых тезисов: таймер 25 мин, стакан воды, отключение уведомлений.',
    referenceLinks: [],
    projectId: 'proj-shorts',
    createdAt: '2026-08-27',
  },
  {
    id: 'idea-3',
    title: 'Разбор вирусных сценариев: структура хука 3 секунды',
    status: 'new',
    priority: 'high',
    tags: ['сценарий', 'аналитика'],
    notes: 'Собрать топ-10 хуков из трендов Shorts/Reels.',
    referenceLinks: [],
    projectId: 'proj-shorts',
    createdAt: '2026-08-29',
  },
  {
    id: 'idea-4',
    title: 'Интеграция Google Calendar с умными тайм-блоками',
    status: 'done',
    priority: 'medium',
    tags: ['google', 'календарь'],
    notes: 'Опубликовано видео с разбором 2-way sync.',
    referenceLinks: [],
    projectId: 'proj-code',
    createdAt: '2026-08-25',
  },
];

interface IdeasPipelineProps {
  projects: Project[];
  onConvertIdeaToTask: (task: Omit<TaskItem, 'id' | 'completed' | 'subtasks'>) => void;
}

export const IdeasPipeline: React.FC<IdeasPipelineProps> = ({
  projects,
  onConvertIdeaToTask,
}) => {
  const [ideas, setIdeas] = useState<IdeaItem[]>(() => {
    try {
      const saved = localStorage.getItem('questflow_ideas_v1');
      return saved ? JSON.parse(saved) : initialIdeas;
    } catch {
      return initialIdeas;
    }
  });

  const [editingIdea, setEditingIdea] = useState<IdeaItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formStatus, setFormStatus] = useState<IdeaItem['status']>('new');
  const [formPriority, setFormPriority] = useState<IdeaItem['priority']>('medium');
  const [formTags, setFormTags] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formProjectId, setFormProjectId] = useState(projects[0]?.id || 'proj-shorts');
  const [formLinkUrl, setFormLinkUrl] = useState('');

  const saveIdeasState = (newIdeas: IdeaItem[]) => {
    setIdeas(newIdeas);
    try {
      localStorage.setItem('questflow_ideas_v1', JSON.stringify(newIdeas));
    } catch (e) {
      console.error(e);
    }
  };

  const openCreateModal = () => {
    setEditingIdea(null);
    setFormTitle('');
    setFormStatus('new');
    setFormPriority('medium');
    setFormTags('');
    setFormNotes('');
    setFormProjectId(projects[0]?.id || 'proj-shorts');
    setFormLinkUrl('');
    setIsModalOpen(true);
  };

  const openEditModal = (idea: IdeaItem) => {
    setEditingIdea(idea);
    setFormTitle(idea.title);
    setFormStatus(idea.status);
    setFormPriority(idea.priority);
    setFormTags(idea.tags.join(', '));
    setFormNotes(idea.notes);
    setFormProjectId(idea.projectId);
    setFormLinkUrl(idea.referenceLinks[0]?.url || '');
    setIsModalOpen(true);
  };

  const handleSaveIdea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    const parsedTags = formTags
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    const refLinks = formLinkUrl.trim() ? [{ label: 'Ссылка', url: formLinkUrl.trim() }] : [];

    if (editingIdea) {
      const updated = ideas.map((item) =>
        item.id === editingIdea.id
          ? {
              ...item,
              title: formTitle.trim(),
              status: formStatus,
              priority: formPriority,
              tags: parsedTags,
              notes: formNotes.trim(),
              projectId: formProjectId,
              referenceLinks: refLinks,
            }
          : item
      );
      saveIdeasState(updated);
    } else {
      const newIdea: IdeaItem = {
        id: `idea-${Date.now()}`,
        title: formTitle.trim(),
        status: formStatus,
        priority: formPriority,
        tags: parsedTags,
        notes: formNotes.trim(),
        projectId: formProjectId,
        referenceLinks: refLinks,
        createdAt: new Date().toISOString().split('T')[0],
      };
      saveIdeasState([newIdea, ...ideas]);
    }

    setIsModalOpen(false);
  };

  const handleDeleteIdea = (id: string) => {
    saveIdeasState(ideas.filter((i) => i.id !== id));
  };

  const handleMoveStatus = (id: string, nextStatus: IdeaItem['status']) => {
    const updated = ideas.map((item) =>
      item.id === id ? { ...item, status: nextStatus } : item
    );
    saveIdeasState(updated);
  };

  const handleConvertToTask = (idea: IdeaItem) => {
    let pLevel: Priority = 'p2';
    if (idea.priority === 'high') pLevel = 'p1';
    if (idea.priority === 'low') pLevel = 'p3';

    onConvertIdeaToTask({
      title: idea.title,
      type: 'todo',
      priority: pLevel,
      projectId: idea.projectId,
      tags: [...idea.tags, 'из-идей'],
      difficulty: idea.priority === 'high' ? 'hard' : 'medium',
      expReward: idea.priority === 'high' ? 75 : 45,
      goldReward: idea.priority === 'high' ? 50 : 25,
      durationMinutes: 45,
      inFocusFlow: true,
      stage: 'in_progress',
    });

    handleMoveStatus(idea.id, 'in_progress');
    playCoinSound();
  };

  const columns: { id: IdeaItem['status']; label: string }[] = [
    { id: 'new', label: 'Новые Идеи' },
    { id: 'promising', label: 'Перспективные' },
    { id: 'in_progress', label: 'В Производстве' },
    { id: 'done', label: 'Опубликовано' },
  ];

  return (
    <div className="max-w-7xl mx-auto py-5 px-3 sm:px-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#111115] border border-white/[0.08] rounded-3xl p-4 sm:p-5">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
            <span>Идеи & Сценарии</span>
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Банк тем, хуков и референсов для контента
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs shadow transition-all active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Добавить идею</span>
        </button>
      </div>

      {/* Kanban Board Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {columns.map((col) => {
          const colIdeas = ideas.filter((i) => i.status === col.id);

          return (
            <div key={col.id} className="bg-[#0f0f13] border border-white/5 rounded-3xl p-3.5 flex flex-col min-h-[480px]">
              
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/5 px-1">
                <span className="text-xs font-semibold text-zinc-300">{col.label}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">
                  {colIdeas.length}
                </span>
              </div>

              {/* Idea Cards */}
              <div className="space-y-2.5 flex-1 overflow-y-auto pr-0.5">
                {colIdeas.length === 0 ? (
                  <div className="h-28 rounded-2xl border border-dashed border-white/5 flex items-center justify-center text-xs text-zinc-600">
                    Нет идей
                  </div>
                ) : (
                  colIdeas.map((idea) => {
                    return (
                      <div
                        key={idea.id}
                        className="bg-[#141419] hover:bg-[#18181f] border border-white/[0.08] hover:border-white/20 rounded-2xl p-3.5 transition-all group space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-xs text-zinc-200 leading-snug">
                            {idea.title}
                          </h3>

                          <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono shrink-0">
                            {idea.priority}
                          </span>
                        </div>

                        {idea.notes && (
                          <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                            {idea.notes}
                          </p>
                        )}

                        {/* Tags */}
                        {idea.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {idea.tags.map((tg) => (
                              <span key={tg} className="text-[9px] text-zinc-500 bg-zinc-900 px-1.5 py-0.2 rounded font-mono">
                                #{tg}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Card Actions */}
                        <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditModal(idea)}
                              className="p-1 rounded bg-zinc-900 text-zinc-500 hover:text-zinc-200"
                              title="Редактировать"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteIdea(idea.id)}
                              className="p-1 rounded bg-zinc-900 text-zinc-500 hover:text-red-400"
                              title="Удалить"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>

                          {idea.status !== 'done' && (
                            <button
                              onClick={() => handleConvertToTask(idea)}
                              className="px-2 py-0.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-[10px] flex items-center gap-1 transition-all"
                            >
                              <Play className="w-2.5 h-2.5" />
                              <span>В работу</span>
                            </button>
                          )}
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121216] border border-white/10 rounded-3xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h2 className="font-bold text-sm text-zinc-100">
                {editingIdea ? 'Редактировать идею' : 'Новая идея контента'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveIdea} className="space-y-3.5">
              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">Заголовок / Тема</label>
                <input
                  type="text"
                  required
                  placeholder="Сравнение 3 приложений продуктивности..."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Статус</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
                  >
                    <option value="new">Новая идея</option>
                    <option value="promising">Перспективная</option>
                    <option value="in_progress">В производстве</option>
                    <option value="done">Опубликовано</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-zinc-400 font-medium block mb-1">Приоритет</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as any)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
                  >
                    <option value="high">Высокий (High)</option>
                    <option value="medium">Средний (Medium)</option>
                    <option value="low">Низкий (Low)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">Теги</label>
                <input
                  type="text"
                  placeholder="shorts, youtube, фокус"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">Хук / Сценарий</label>
                <textarea
                  rows={3}
                  placeholder="Первые 3 секунды, идеи для визуалов..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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
