import React, { useState, useEffect } from 'react';
import { TaskItem, SubTask, Difficulty, Priority, TaskType } from '../types';
import { 
  X, 
  Calendar, 
  CheckSquare, 
  Square, 
  Plus, 
  Trash2, 
  AlertCircle, 
  Layers, 
  Tag, 
  Clock, 
  ChevronDown, 
  Check, 
  CheckCircle2
} from 'lucide-react';

interface TaskEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskItem | null;
  onSave: (updatedTask: TaskItem) => void;
  onDelete?: (taskId: string) => void;
}

export const TaskEditModal: React.FC<TaskEditModalProps> = ({
  isOpen,
  onClose,
  task,
  onSave,
  onDelete,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TaskType>('todo');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [priority, setPriority] = useState<Priority>('p2');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setType(task.type || 'todo');
      setDifficulty(task.difficulty || 'easy');
      setPriority(task.priority || 'p2');
      setDueDate(task.dueDate || '');
      setDueTime(task.dueTime || '');
      setSubtasks(task.subtasks ? [...task.subtasks] : []);
      setTags(task.tags ? [...task.tags] : []);
      setNewSubtaskText('');
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const completedCount = subtasks.filter((s) => s.completed).length;
  const progressPercent = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0;

  const handleToggleSubtask = (subId: string) => {
    setSubtasks((prev) =>
      prev.map((s) => (s.id === subId ? { ...s, completed: !s.completed } : s))
    );
  };

  const handleSubtaskTextChange = (subId: string, text: string) => {
    setSubtasks((prev) =>
      prev.map((s) => (s.id === subId ? { ...s, text } : s))
    );
  };

  const handleDeleteSubtask = (subId: string) => {
    setSubtasks((prev) => prev.filter((s) => s.id !== subId));
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskText.trim()) return;
    const newStep: SubTask = {
      id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: newSubtaskText.trim(),
      completed: false,
    };
    setSubtasks((prev) => [...prev, newStep]);
    setNewSubtaskText('');
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags((prev) => [...prev, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      ...task,
      title: title.trim(),
      description: description.trim() || undefined,
      type,
      difficulty,
      priority,
      dueDate: dueDate || undefined,
      dueTime: dueTime || undefined,
      subtasks,
      tags,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="bg-[#111116] border border-white/10 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* ── Top Header bar (Habitica style banner) ─────────────────────────── */}
        <div className="bg-gradient-to-r from-rose-900/80 via-rose-950/90 to-purple-950/80 px-5 py-3.5 border-b border-rose-500/20 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-base">
              {type === 'todo' ? 'Редактировать Задачу (To Do)' : type === 'habit' ? 'Редактировать Привычку' : 'Редактировать Ежедневную'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 rounded-xl bg-black/40 hover:bg-black/60 text-xs font-semibold text-zinc-300 hover:text-white transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!title.trim()}
              className="px-4 py-1 rounded-xl bg-white hover:bg-zinc-100 disabled:opacity-40 text-xs font-bold text-zinc-950 shadow transition-all cursor-pointer"
            >
              Сохранить
            </button>
          </div>
        </div>

        {/* ── Scrollable Form Body ────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs text-zinc-200">

          {/* Title */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
              Название цели / Задачи *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Название задачи (например: Мудрость - 20 видео)"
              className="w-full bg-[#181820] border border-white/10 focus:border-rose-500/60 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
            />
          </div>

          {/* Notes / Description */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
              Заметки / Описание (Notes)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Дополнительные заметки, ссылки, инструкции к выполнению..."
              className="w-full bg-[#181820] border border-white/10 focus:border-rose-500/60 rounded-xl px-3.5 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none transition-colors resize-none"
            />
          </div>

          {/* ── Checklist / Subtasks Section ─────────────────────────────────── */}
          <div className="bg-[#16161c] border border-white/[0.06] rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-purple-400" />
                <span className="font-bold text-white text-xs uppercase tracking-wider">
                  Чек-лист / Подзадачи
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-purple-300 font-semibold">
                  {completedCount}/{subtasks.length}
                </span>
              </div>
              {subtasks.length > 0 && (
                <span className="text-[10px] font-mono text-zinc-400">
                  {progressPercent}% выполнено
                </span>
              )}
            </div>

            {/* Progress Bar */}
            {subtasks.length > 0 && (
              <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}

            {/* Subtasks List */}
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {subtasks.map((sub, idx) => (
                <div
                  key={sub.id}
                  className={`group flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-all ${
                    sub.completed
                      ? 'bg-[#0e0e12] border-white/[0.03] opacity-60'
                      : 'bg-[#1a1a22] border-white/[0.05] hover:border-white/10'
                  }`}
                >
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={() => handleToggleSubtask(sub.id)}
                    className="shrink-0 cursor-pointer transition-transform active:scale-90 text-purple-400 hover:text-purple-300"
                  >
                    {sub.completed ? (
                      <CheckCircle2 className="w-4 h-4 fill-purple-500/20 text-purple-400" />
                    ) : (
                      <Square className="w-4 h-4 text-zinc-600 hover:text-zinc-400" />
                    )}
                  </button>

                  {/* Step Text Input */}
                  <input
                    type="text"
                    value={sub.text}
                    onChange={(e) => handleSubtaskTextChange(sub.id, e.target.value)}
                    className={`flex-1 min-w-0 bg-transparent text-xs focus:outline-none ${
                      sub.completed ? 'line-through text-zinc-500' : 'text-zinc-200'
                    }`}
                  />

                  {/* Delete step */}
                  <button
                    type="button"
                    onClick={() => handleDeleteSubtask(sub.id)}
                    className="shrink-0 p-1 text-zinc-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title="Удалить шаг"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add new step input */}
            <form onSubmit={handleAddSubtask} className="flex items-center gap-1.5 pt-1">
              <input
                type="text"
                value={newSubtaskText}
                onChange={(e) => setNewSubtaskText(e.target.value)}
                placeholder="+ Добавить новый шаг чек-листа..."
                className="flex-1 min-w-0 bg-[#121216] border border-dashed border-white/10 focus:border-purple-500/60 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={!newSubtaskText.trim()}
                className="shrink-0 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-30 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                + Добавить
              </button>
            </form>
          </div>

          {/* ── Difficulty & Priority Row ────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            {/* Difficulty */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                Сложность (Difficulty)
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                className="w-full bg-[#181820] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
              >
                <option value="trivial">⚡ Очень легко (Trivial)</option>
                <option value="easy">✦ Легко (Easy)</option>
                <option value="medium">✦✦ Средне (Medium)</option>
                <option value="hard">✦✦✦ Сложно (Hard)</option>
                <option value="epic">👑 Эпично (Epic)</option>
              </select>
            </div>

            {/* Priority */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                Приоритет
              </label>
              <div className="flex items-center gap-1.5 pt-0.5">
                {[
                  { id: 'p1' as Priority, label: '🔴 P1 Срочно' },
                  { id: 'p2' as Priority, label: '🟡 P2 Обычный' },
                  { id: 'p3' as Priority, label: '⚪ P3 Низкий' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPriority(p.id)}
                    className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                      priority === p.id
                        ? p.id === 'p1'
                          ? 'bg-rose-900/60 border border-rose-600 text-rose-200'
                          : p.id === 'p2'
                          ? 'bg-amber-900/60 border border-amber-600 text-amber-200'
                          : 'bg-zinc-700 border border-zinc-500 text-zinc-100'
                        : 'bg-[#181820] border border-white/5 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* ── Due Date (Дедлайн) ────────────────────────────────────────────── */}
          <div className="bg-[#16161c] border border-white/[0.06] rounded-2xl p-3.5 space-y-2">
            <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              Дедлайн (Due Date)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="flex-1 bg-[#181820] border border-white/10 focus:border-amber-500/60 rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer [color-scheme:dark]"
              />
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-24 bg-[#181820] border border-white/10 focus:border-amber-500/60 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none cursor-pointer [color-scheme:dark]"
              />
              {dueDate && (
                <button
                  type="button"
                  onClick={() => {
                    setDueDate('');
                    setDueTime('');
                  }}
                  className="px-2.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-xs cursor-pointer transition-colors"
                  title="Очистить дедлайн"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* ── Tags (Теги) ──────────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-zinc-400" />
              Теги
            </label>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-purple-950/60 border border-purple-500/30 text-purple-300 text-[11px] font-mono"
                >
                  #{t}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    className="text-purple-400 hover:text-white ml-0.5 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Введите тег и нажмите Enter (например: видео, цель, ютуб)"
              className="w-full bg-[#181820] border border-white/10 focus:border-purple-500/60 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none"
            />
          </div>

          {/* ── Delete Button Footer ─────────────────────────────────────────── */}
          {onDelete && (
            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Удалить задачу «${task.title}»?`)) {
                    onDelete(task.id);
                    onClose();
                  }
                }}
                className="flex items-center gap-1.5 text-rose-400 hover:text-rose-300 font-semibold text-xs cursor-pointer py-1.5 px-2 rounded-lg hover:bg-rose-950/30 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Удалить эту задачу</span>
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                className="px-5 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                Сохранить изменения
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
