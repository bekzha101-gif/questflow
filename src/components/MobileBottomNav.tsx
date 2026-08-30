import React from 'react';
import { TabType } from './Navigation';
import { 
  Zap, 
  Film,
  CheckSquare, 
  Compass, 
  ShoppingBag, 
  Plus
} from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onOpenQuickAdd: () => void;
  focusCount: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenQuickAdd,
  focusCount,
}) => {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#09090b]/95 backdrop-blur-xl border-t border-white/[0.08] px-3 py-2">
      <div className="flex items-center justify-around">
        
        {/* 1. Today */}
        <button
          onClick={() => onSelectTab('today')}
          className={`flex flex-col items-center gap-0.5 p-1 transition-all ${
            activeTab === 'today' ? 'text-amber-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Zap className="w-5 h-5" />
          <span className="text-[10px]">Сегодня</span>
        </button>

        {/* 2. Media Studio */}
        <button
          onClick={() => onSelectTab('studio')}
          className={`flex flex-col items-center gap-0.5 p-1 transition-all ${
            activeTab === 'studio' || activeTab === 'production' || activeTab === 'shorts' || activeTab === 'ideas'
              ? 'text-pink-400 font-bold'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <div className="relative">
            <Film className="w-5 h-5" />
            {focusCount > 0 && (
              <span className="absolute -top-1 -right-2 w-3.5 h-3.5 rounded-full bg-pink-500 text-[9px] font-bold text-white flex items-center justify-center">
                {focusCount}
              </span>
            )}
          </div>
          <span className="text-[10px]">Студия</span>
        </button>

        {/* 3. Central Plus (Quick Add) */}
        <button
          onClick={onOpenQuickAdd}
          className="w-10 h-10 -mt-3 rounded-2xl bg-white text-zinc-950 flex items-center justify-center shadow-lg active:scale-95 transition-transform cursor-pointer"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>

        {/* 4. Quests & Tasks */}
        <button
          onClick={() => onSelectTab('quests')}
          className={`flex flex-col items-center gap-0.5 p-1 transition-all ${
            activeTab === 'quests' || activeTab === 'tasks' || activeTab === 'habits'
              ? 'text-purple-400 font-bold'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <CheckSquare className="w-5 h-5" />
          <span className="text-[10px]">Задачи</span>
        </button>

        {/* 5. Life OS & Analytics */}
        <button
          onClick={() => onSelectTab('life')}
          className={`flex flex-col items-center gap-0.5 p-1 transition-all ${
            activeTab === 'life' || activeTab === 'bigdata' || activeTab === 'calendar' || activeTab === 'finances'
              ? 'text-emerald-400 font-bold'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[10px]">Жизнь</span>
        </button>
      </div>
    </div>
  );
};
