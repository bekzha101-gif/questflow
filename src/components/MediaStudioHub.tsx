import React, { useState } from 'react';
import { Project, TaskItem } from '../types';
import { ContentProductionBoard } from './ContentProductionBoard';
import { IdeasPipeline } from './IdeasPipeline';
import { Film, Lightbulb } from 'lucide-react';

interface MediaStudioHubProps {
  projects: Project[];
  onAddTask: (task: Omit<TaskItem, 'id' | 'completed' | 'subtasks'>) => void;
}

// Медиа-Студия: Канбан Монтажа и Идеи. Flow Shorts и AI Сценарист убраны по просьбе пользователя.
export function MediaStudioHub({ projects, onAddTask }: MediaStudioHubProps) {
  const [studioTab, setStudioTab] = useState<'production' | 'ideas'>('production');

  return (
    <div className="space-y-4 max-w-7xl mx-auto py-2 px-2 sm:px-4 animate-fade-in select-none">
      <div className="bg-[#101014] border border-white/[0.07] rounded-2xl p-3 sm:p-4 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-pink-600/20 border border-pink-500/30 flex items-center justify-center text-pink-400">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">Медиа-Студия</h2>
            <p className="text-[11px] text-zinc-400 font-mono">Канбан съемок и Генерация Идей</p>
          </div>
        </div>

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
            onClick={() => setStudioTab('ideas')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              studioTab === 'ideas' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
            <span>Идеи</span>
          </button>
        </div>
      </div>

      {studioTab === 'production' && <ContentProductionBoard />}

      {studioTab === 'ideas' && <IdeasPipeline projects={projects} onConvertIdeaToTask={onAddTask} />}
    </div>
  );
}
