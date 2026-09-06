import React, { useState, useEffect } from 'react';
import { Project, TaskItem, SubTask } from '../types';
import { parseNaturalLanguageTask } from '../utils/naturalLanguageParser';
import { 
  Plus, 
  Calendar, 
  Tag, 
  Layers, 
  X,
  CheckSquare,
  Trash2
} from 'lucide-react';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  onAddTask: (task: Omit<TaskItem, 'id' | 'completed'> & { subtasks?: SubTask[] }) => void;
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onClose,
  projects,
  onAddTask,
}) => {
  const [input, setInput] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id || 'proj-inbox');
  const [customDueDate, setCustomDueDate] = useState('');
  const [subtaskInput, setSubtaskInput] = useState('');
  const [subtasks, setSubtasks] = useState<string[]>([]);

  const parsed = parseNaturalLanguageTask(input || 'Название квеста');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subtaskInput.trim()) return;
    setSubtasks((prev) => [...prev, subtaskInput.trim()]);
    setSubtaskInput('');
  };

  const handleRemoveStep = (indexToRemove: number) => {
    setSubtasks((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const parsedData = parseNaturalLanguageTask(input);
    const finalDueDate = customDueDate || parsedData.dueDate;

    onAddTask({
      title: parsedData.title,
      type: parsedData.type,
      priority: parsedData.priority,
      projectId: selectedProjectId,
      tags: parsedData.tags,
      dueDate: finalDueDate,
      dueTime: parsedData.dueTime,
      durationMinutes: parsedData.durationMinutes,
      difficulty: parsedData.difficulty,
      expReward: parsedData.expReward,
      goldReward: parsedData.goldReward,
      inFocusFlow: parsedData.priority === 'p1',
      stage: 'backlog',
      subtasks: subtasks.map((text, idx) => ({
        id: `st-${Date.now()}-${idx}`,
        text,
        completed: false,
      })),
    });

    setInput('');
    setCustomDueDate('');
    setSubtasks([]);
    setSubtaskInput('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#121216] border border-white/10 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3 shrink-0">
          <div>
            <h2 className="font-bold text-sm text-zinc-100">Новая задача или большая цель</h2>
            <p className="text-[11px] text-zinc-500">Умный ввод или добавление шагов/дедлайна вручную</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-500 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="space-y-3.5 overflow-y-auto pr-1">
          <div>
            <input
              type="text"
              autoFocus
              required
              placeholder="Что нужно сделать? (например: Мудрость 20 видео)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* NLP Live Preview Chips */}
          <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-white/5 space-y-1.5">
            <div className="text-[10px] text-zinc-500 font-semibold uppercase">Распознанные параметры:</div>
            <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                Приоритет: {parsed.priority.toUpperCase()}
              </span>

              {(customDueDate || parsed.dueDate) && (
                <span className="px-2 py-0.5 rounded bg-zinc-800 text-amber-300 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-amber-400" />
                  Дедлайн: {customDueDate || parsed.dueDate}
                </span>
              )}

              {parsed.tags.map((t) => (
                <span key={t} className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                  #{t}
                </span>
              ))}

              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                +{parsed.expReward} EXP • +{parsed.goldReward}g
              </span>
            </div>
          </div>

          {/* Date Picker row */}
          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-medium flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              Дедлайн (дата завершения)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customDueDate || parsed.dueDate || ''}
                onChange={(e) => setCustomDueDate(e.target.value)}
                className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 [color-scheme:dark] cursor-pointer"
              />
              {(customDueDate || parsed.dueDate) && (
                <button
                  type="button"
                  onClick={() => setCustomDueDate('')}
                  className="px-2.5 py-2 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Checklist / Subtasks Section */}
          <div className="bg-zinc-900/50 border border-white/[0.06] rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                <CheckSquare className="w-3.5 h-3.5 text-purple-400" />
                <span>Чек-лист / Подзадачи</span>
                {subtasks.length > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 font-bold">
                    {subtasks.length}
                  </span>
                )}
              </div>
            </div>

            {/* Subtasks list */}
            {subtasks.length > 0 && (
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {subtasks.map((step, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/5 text-xs text-zinc-300"
                  >
                    <span className="truncate">{step}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveStep(idx)}
                      className="text-zinc-600 hover:text-rose-400 p-0.5 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add step input */}
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={subtaskInput}
                onChange={(e) => setSubtaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (subtaskInput.trim()) {
                      setSubtasks((prev) => [...prev, subtaskInput.trim()]);
                      setSubtaskInput('');
                    }
                  }
                }}
                placeholder="+ Добавить подзадачу/видео (нажмите Enter)..."
                className="flex-1 bg-zinc-950 border border-dashed border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500"
              />
              <button
                type="button"
                onClick={handleAddStep}
                disabled={!subtaskInput.trim()}
                className="px-2.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-30 text-white font-semibold text-xs cursor-pointer transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* Project Selector */}
          <div>
            <label className="text-xs text-zinc-400 font-medium block mb-1">Проект</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500 cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl bg-zinc-900 text-xs text-zinc-400 hover:text-white cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs shadow cursor-pointer active:scale-95 transition-all"
            >
              Добавить квест
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
