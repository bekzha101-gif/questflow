import React from 'react';
import { 
  Zap,
  Film,
  CheckSquare, 
  Compass, 
  ShoppingBag
} from 'lucide-react';

export type TabType = 
  | 'today'
  | 'studio' 
  | 'quests'
  | 'life'
  | 'tavern'
  // Backwards compatibility / deep link aliases:
  | 'shorts' 
  | 'production' 
  | 'ideas' 
  | 'bigdata'
  | 'tasks' 
  | 'habits' 
  | 'finances' 
  | 'calendar' 
  | 'team' 
  | 'ai';

interface NavigationProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  focusCount: number;
  dueTodayCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  focusCount,
  dueTodayCount,
}) => {
  const primaryTabs = [
    {
      id: 'today' as TabType,
      label: 'Сегодня (Фокус)',
      icon: Zap,
      badge: dueTodayCount > 0 ? dueTodayCount : undefined,
      color: 'text-amber-400',
    },
    {
      id: 'studio' as TabType,
      label: 'Медиа-Студия',
      icon: Film,
      badge: focusCount > 0 ? focusCount : undefined,
      color: 'text-pink-400',
    },
    {
      id: 'quests' as TabType,
      label: 'Задачи & Привычки',
      icon: CheckSquare,
      color: 'text-purple-400',
    },
    {
      id: 'life' as TabType,
      label: 'Жизнь & Аналитика',
      icon: Compass,
      color: 'text-emerald-400',
    },
    {
      id: 'tavern' as TabType,
      label: 'Таверна & Награды',
      icon: ShoppingBag,
      color: 'text-amber-400',
    },
  ];

  // Map deep link aliases to primary tabs for active state
  const isTabActive = (tabId: TabType) => {
    if (activeTab === tabId) return true;
    if (tabId === 'studio' && (activeTab === 'shorts' || activeTab === 'production' || activeTab === 'ideas' || activeTab === 'ai')) return true;
    if (tabId === 'quests' && (activeTab === 'tasks' || activeTab === 'habits')) return true;
    if (tabId === 'life' && (activeTab === 'bigdata' || activeTab === 'calendar' || activeTab === 'finances')) return true;
    if (tabId === 'tavern' && activeTab === 'team') return true;
    return false;
  };

  return (
    <nav className="w-full bg-[#0b0b0e] border-b border-white/[0.06] px-3 sm:px-6 py-2 select-none sticky top-0 z-30 backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          {primaryTabs.map((tab) => {
            const Icon = tab.icon;
            const active = isTabActive(tab.id);

            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  active
                    ? 'bg-zinc-800 text-white border border-zinc-700 shadow-md ring-1 ring-white/10'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? tab.color : 'text-zinc-500'}`} />
                <span>{tab.label}</span>

                {tab.badge !== undefined && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold ${
                    active ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-300'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
