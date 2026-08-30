import React, { useState } from 'react';
import { Project, TaskItem } from '../types';
import { decomposeTaskWithAi } from '../utils/aiQuestMaster';
import { 
  Wand2, 
  Loader2, 
  X
} from 'lucide-react';
import { playLevelUpSound } from '../utils/sound';
import { triggerQuestConfetti } from '../utils/confetti';

interface AiQuestMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialGoal?: string;
  projects: Project[];
  onAddQuests: (quests: Omit<TaskItem, 'id' | 'completed'>[]) => void;
}

export const AiQuestMasterModal: React.FC<AiQuestMasterModalProps> = ({
  isOpen,
  onClose,
  initialGoal = '',
  projects,
  onAddQuests,
}) => {
  const [goal, setGoal] = useState(initialGoal);
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id || 'proj-shorts');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuests, setGeneratedQuests] = useState<Omit<TaskItem, 'id' | 'completed'>[]>([]);

  if (!isOpen) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim()) return;

    setIsGenerating(true);
    try {
      const quests = await decomposeTaskWithAi(goal.trim());
      const mappedQuests: Omit<TaskItem, 'id' | 'completed'>[] = quests.map((q) => ({
        title: q.title,
        type: 'todo',
        priority: q.priority,
        projectId: selectedProjectId,
        tags: ['ai-квест', 'фокус'],
        subtasks: q.subtasks,
        difficulty: q.difficulty,
        expReward: q.expReward,
        goldReward: q.goldReward,
        durationMinutes: q.durationMinutes,
        description: q.rpgLore,
        inFocusFlow: true,
        stage: 'in_progress',
      }));
      setGeneratedQuests(mappedQuests);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAcceptAll = () => {
    if (generatedQuests.length > 0) {
      onAddQuests(generatedQuests);
      playLevelUpSound();
      triggerQuestConfetti();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#121216] border border-white/10 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <h2 className="font-bold text-sm text-zinc-100">AI Декомпозиция Задач</h2>
            <p className="text-[11px] text-zinc-500">Автоматическое разбиение сложной цели на 3 шага</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleGenerate} className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 font-medium block mb-1">Опишите цель или проект</label>
            <textarea
              rows={2}
              required
              placeholder="Например: Запустить серию из 5 Shorts про фокус и продуктивность"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div className="flex justify-between items-center pt-1">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-zinc-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-zinc-300 focus:outline-none"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <button
              type="submit"
              disabled={isGenerating}
              className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs shadow flex items-center gap-1.5"
            >
              {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              <span>{isGenerating ? 'Генерация...' : 'Разбить на шаги'}</span>
            </button>
          </div>
        </form>

        {generatedQuests.length > 0 && (
          <div className="pt-3 border-t border-white/5 space-y-3">
            <h3 className="text-xs font-bold text-zinc-300">Предложенные шаги:</h3>
            <div className="space-y-2">
              {generatedQuests.map((q, idx) => (
                <div key={idx} className="p-3 rounded-2xl bg-zinc-900/60 border border-white/5 text-xs space-y-1">
                  <p className="font-semibold text-zinc-200">{q.title}</p>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    {q.durationMinutes}м • +{q.expReward} EXP • +{q.goldReward}g
                  </p>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={handleAcceptAll}
                className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs shadow"
              >
                Принять все квесты в фокус
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
