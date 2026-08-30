import React, { useState } from 'react';
import { TaskItem, Project, UserStats } from '../types';
import { ContentProductionBoard } from './ContentProductionBoard';
import { FlowShortsMode } from './FlowShortsMode';
import { IdeasPipeline } from './IdeasPipeline';
import { 
  Film, 
  PlaySquare, 
  Lightbulb, 
  Wand2, 
  Sparkles,
  Plus
} from 'lucide-react';

interface MediaStudioHubProps {
  tasks: TaskItem[];
  projects: Project[];
  stats: UserStats;
  onToggleTask: (taskId: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onSnoozeTask: (taskId: string, minutes: number) => void;
  onToggleFocus: (taskId: string) => void;
  onAddTask: (task: Omit<TaskItem, 'id' | 'completed' | 'subtasks'>) => void;
  onOpenAiDecompose: (title: string) => void;
  onPublishReward: (exp: number, gold: number) => void;
  onOpenAiMaster: () => void;
}

export function MediaStudioHub({
  tasks,
  projects,
  stats,
  onToggleTask,
  onToggleSubtask,
  onSnoozeTask,
  onToggleFocus,
  onAddTask,
  onOpenAiDecompose,
  onPublishReward,
  onOpenAiMaster,
}: MediaStudioHubProps) {
  const [studioTab, setStudioTab] = useState<'production' | 'shorts' | 'ideas' | 'ai'>('production');

  const focusCount = tasks.filter((t) => t.inFocusFlow && !t.completed).length;

  return (
    <div className="space-y-4 max-w-7xl mx-auto py-2 px-2 sm:px-4 animate-fade-in select-none">
      
      {/* ─── Studio Sub-Header & Switcher ──────────────────────────────────── */}
      <div className="bg-[#101014] border border-white/[0.07] rounded-2xl p-3 sm:p-4 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-pink-600/20 border border-pink-500/30 flex items-center justify-center text-pink-400">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">Медиа-Студия</h2>
            <p className="text-[11px] text-zinc-400 font-mono">Производство Shorts, Канбан съемок и Генерация Идей</p>
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="flex items-center gap-1.5 bg-black/50 border border-white/10 rounded-xl p-1 text-xs flex-wrap">
          <button
            onClick={() => setStudioTab('production')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              studioTab === 'production' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Канбан Монтажа</span>
          </button>

          <button
            onClick={() => setStudioTab('shorts')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              studioTab === 'shorts' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <PlaySquare className="w-3.5 h-3.5 text-pink-400" />
            <span>Flow Shorts</span>
            {focusCount > 0 && (
              <span className="text-[9px] font-mono px-1 rounded bg-pink-950 text-pink-300 border border-pink-800">
                {focusCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setStudioTab('ideas')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              studioTab === 'ideas' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
            <span>Идеи</span>
          </button>

          <button
            onClick={onOpenAiMaster}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium text-pink-300 hover:text-white hover:bg-pink-950/40 transition-all cursor-pointer"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>AI Сценарист</span>
          </button>
        </div>
      </div>

      {/* ─── Content Views ─────────────────────────────────────────────────── */}
      {studioTab === 'production' && (
        <ContentProductionBoard onPublishReward={onPublishReward} />
      )}

      {studioTab === 'shorts' && (
        <FlowShortsMode
          tasks={tasks}
          projects={projects}
          stats={stats}
          onCompleteTask={onToggleTask}
          onToggleSubtask={onToggleSubtask}
          onSnoozeTask={onSnoozeTask}
          onOpenAiDecompose={onOpenAiDecompose}
          onToggleFocus={onToggleFocus}
        />
      )}

      {studioTab === 'ideas' && (
        <IdeasPipeline
          projects={projects}
          onConvertIdeaToTask={onAddTask}
        />
      )}
    </div>
  );
}
