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
      label: 'Сегодня',
      icon: Zap,
      badge: dueTodayCount > 0 ? dueTodayCount : undefined,
    },
    {
      id: 'quests' as TabType,
      label: 'Все задачи',
      icon: CheckSquare,
    },
    {
      id: 'studio' as TabType,
      label: 'Медиа',
      icon: Film,
      badge: focusCount > 0 ? focusCount : undefined,
    },
    {
      id: 'life' as TabType,
      label: 'Аналитика',
      icon: Compass,
    },
    {
      id: 'tavern' as TabType,
      label: 'Награды',
      icon: ShoppingBag,
    },
  ];

  const isTabActive = (tabId: TabType) => {
    if (activeTab === tabId) return true;
    if (tabId === 'studio' && (activeTab === 'shorts' || activeTab === 'production' || activeTab === 'ideas' || activeTab === 'ai')) return true;
    if (tabId === 'quests' && (activeTab === 'tasks' || activeTab === 'habits')) return true;
    if (tabId === 'life' && (activeTab === 'bigdata' || activeTab === 'calendar' || activeTab === 'finances')) return true;
    if (tabId === 'tavern' && activeTab === 'team') return true;
    return false;
  };

  return (
    <nav className="w-full bg-[#09090b]/80 border-b border-white/[0.06] px-3 sm:px-6 py-2 select-none sticky top-0 z-30 backdrop-blur-md">
      <div className="max-w-4xl mx-auto flex items-center justify-start sm:justify-center gap-1 overflow-x-auto">
        {primaryTabs.map((tab) => {
          const Icon = tab.icon;
          const active = isTabActive(tab.id);

          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-zinc-800 text-white shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-zinc-500'}`} />
              <span>{tab.label}</span>

              {tab.badge !== undefined && (
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${
                  active ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-900 text-zinc-500'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
