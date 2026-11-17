import React from 'react';
import { Zap, Target, Tv, Heart, TrendingUp, type LucideIcon } from 'lucide-react';
import { getSection, type SectionType, type TabType } from '../sections/routes';

export type { TabType, SectionType };
export { getSection };

export interface NavItem {
  id: SectionType;
  label: string;
  icon: LucideIcon;
}

// Ровно 5 разделов: и сбоку на Mac, и снизу на телефоне
export const PRIMARY_NAV: NavItem[] = [
  { id: 'today', label: 'Сегодня', icon: Zap },
  { id: 'goals', label: 'Цели', icon: Target },
  { id: 'channels', label: 'Каналы', icon: Tv },
  { id: 'health', label: 'Здоровье', icon: Heart },
  { id: 'progress', label: 'Прогресс', icon: TrendingUp },
];

export const SECTION_TITLES: Record<SectionType, string> = {
  today: 'Сегодня',
  goals: 'Цели',
  channels: 'Каналы',
  health: 'Здоровье',
  progress: 'Прогресс',
};

interface NavigationProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  dueTodayCount: number;
}

// Боковая навигация для Mac / широкого экрана
export const Navigation: React.FC<NavigationProps> = ({ activeTab, onSelectTab, dueTodayCount }) => {
  const section = getSection(activeTab);
  const badges: Partial<Record<SectionType, number>> = { today: dueTodayCount };

  return (
    <nav
      aria-label="Разделы"
      className="hidden md:flex flex-col w-52 shrink-0 bg-[#09090b] border-r border-white/[0.06] px-2.5 py-3 select-none overflow-y-auto"
    >
      <div className="flex items-center gap-2.5 px-2 pb-4">
        <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center">
          <Zap className="w-4 h-4 text-zinc-950" />
        </div>
        <span className="font-bold text-white text-sm tracking-tight">QuestFlow</span>
      </div>

      <div className="space-y-0.5">
        {PRIMARY_NAV.map((item) => {
          const Icon = item.icon;
          const active = section === item.id;
          const badge = badges[item.id];
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] transition-colors cursor-pointer ${
                active
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-zinc-500'}`} />
              <span className="flex-1 text-left truncate">{item.label}</span>
              {badge ? <span className="text-[10px] font-mono text-zinc-500">{badge}</span> : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
