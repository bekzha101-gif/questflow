import React, { useState, useEffect } from 'react';
import { Project, TaskItem } from '../types';
import { parseNaturalLanguageTask } from '../utils/naturalLanguageParser';
import { 
  Plus, 
  Calendar, 
  Tag, 
  Layers, 
  X
} from 'lucide-react';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  onAddTask: (task: Omit<TaskItem, 'id' | 'completed' | 'subtasks'>) => void;
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onClose,
  projects,
  onAddTask,
}) => {
  const [input, setInput] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id || 'proj-inbox');

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const parsedData = parseNaturalLanguageTask(input);
    onAddTask({
      title: parsedData.title,
      type: parsedData.type,
      priority: parsedData.priority,
      projectId: selectedProjectId,
      tags: parsedData.tags,
      dueDate: parsedData.dueDate,
      dueTime: parsedData.dueTime,
      durationMinutes: parsedData.durationMinutes,
      difficulty: parsedData.difficulty,
      expReward: parsedData.expReward,
      goldReward: parsedData.goldReward,
      inFocusFlow: parsedData.priority === 'p1',
      stage: 'backlog',
    });

    setInput('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#121216] border border-white/10 rounded-3xl max-w-lg w-full p-6 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
          <div>
            <h2 className="font-bold text-sm text-zinc-100">Новая задача</h2>
            <p className="text-[11px] text-zinc-500">Умный ввод: "завтра в 18:00 #фокус p1 30м"</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <input
              type="text"
              autoFocus
              required
              placeholder="Что нужно сделать?"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>

          {/* NLP Live Preview Chips */}
          <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5 space-y-2">
            <div className="text-[10px] text-zinc-500 font-semibold uppercase">Распознанные параметры:</div>
            <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                Приоритет: {parsed.priority.toUpperCase()}
              </span>

              {parsed.dueDate && (
                <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-zinc-500" />
                  {parsed.dueDate} {parsed.dueTime || ''}
                </span>
              )}

              {parsed.durationMinutes && (
                <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                  {parsed.durationMinutes} мин
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

          {/* Project Selector */}
          <div>
            <label className="text-xs text-zinc-400 font-medium block mb-1">Проект</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
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
              className="px-3.5 py-1.5 rounded-xl bg-zinc-900 text-xs text-zinc-400 hover:text-white"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs shadow"
            >
              Добавить квест
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
