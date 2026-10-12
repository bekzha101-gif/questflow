import React from 'react';
import {
  Zap,
  Film,
  CheckSquare,
  CalendarDays,
  Heart,
  ShoppingBag,
  Gift,
  Wallet,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { HideableSection, useHiddenSections } from '../utils/hiddenSections';

export type TabType =
  | 'today'
  | 'quests'
  | 'calendar'
  | 'health'
  | 'more'
  | 'shopping'
  | 'studio'
  | 'finances'
  | 'tavern'
  // Backwards compatibility / deep link aliases:
  | 'life'
  | 'shorts'
  | 'production'
  | 'ideas'
  | 'bigdata'
  | 'tasks'
  | 'habits'
  | 'team'
  | 'ai';

// Раздел приложения, к которому относится вкладка (алиасы сводятся к одному разделу)
export type SectionType =
  | 'today'
  | 'quests'
  | 'calendar'
  | 'health'
  | 'more'
  | 'shopping'
  | 'studio'
  | 'finances'
  | 'tavern';

export function getSection(tab: TabType): SectionType {
  switch (tab) {
    case 'tasks':
    case 'habits':
      return 'quests';
    case 'life':
    case 'bigdata':
      return 'health';
    case 'shorts':
    case 'production':
    case 'ideas':
    case 'ai':
      return 'studio';
    case 'team':
      return 'tavern';
    default:
      return tab;
  }
}

export interface NavItem {
  id: SectionType;
  label: string;
  icon: LucideIcon;
}

// Главные разделы: видны всегда (снизу на телефоне, сбоку на Mac)
export const PRIMARY_NAV: NavItem[] = [
  { id: 'today', label: 'Сегодня', icon: Zap },
  { id: 'quests', label: 'Задачи', icon: CheckSquare },
  { id: 'calendar', label: 'Календарь', icon: CalendarDays },
  { id: 'health', label: 'Здоровье', icon: Heart },
];

// Второстепенные разделы: на телефоне спрятаны в «Ещё»
export const SECONDARY_NAV: NavItem[] = [
  { id: 'shopping', label: 'Покупки', icon: ShoppingBag },
  { id: 'tavern', label: 'Награды', icon: Gift },
  { id: 'studio', label: 'Медиа', icon: Film },
  { id: 'finances', label: 'Финансы', icon: Wallet },
];

export const MORE_NAV: NavItem = { id: 'more', label: 'Ещё', icon: MoreHorizontal };

export const SECTION_TITLES: Record<SectionType, string> = {
  today: 'Сегодня',
  quests: 'Задачи',
  calendar: 'Календарь',
  health: 'Здоровье',
  more: 'Ещё',
  shopping: 'Покупки',
  tavern: 'Награды',
  studio: 'Медиа',
  finances: 'Финансы',
};

interface NavigationProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  dueTodayCount: number;
  shoppingCount?: number;
}

// Боковая навигация для Mac / широкого экрана
export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  dueTodayCount,
  shoppingCount = 0,
}) => {
  const section = getSection(activeTab);
  const hidden = useHiddenSections();
  const secondaryItems = SECONDARY_NAV.filter((item) => !hidden.includes(item.id as HideableSection));
  const badges: Partial<Record<SectionType, number>> = {
    today: dueTodayCount,
    shopping: shoppingCount,
  };

  const renderItem = (item: NavItem) => {
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
        {badge ? (
          <span className="text-[10px] font-mono text-zinc-500">{badge}</span>
        ) : null}
      </button>
    );
  };

  return (
    <nav className="hidden md:flex flex-col w-52 shrink-0 bg-[#09090b] border-r border-white/[0.06] px-2.5 py-3 select-none overflow-y-auto">
      <div className="flex items-center gap-2.5 px-2 pb-4">
        <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center">
          <Zap className="w-4 h-4 text-zinc-950" />
        </div>
        <span className="font-bold text-white text-sm tracking-tight">QuestFlow</span>
      </div>

      <div className="space-y-0.5">{PRIMARY_NAV.map(renderItem)}</div>

      <div className="mt-5 pt-3 border-t border-white/[0.06] space-y-0.5">
        {secondaryItems.map(renderItem)}
      </div>

      {/* «Ещё»: переключатели скрытых разделов */}
      <div className="mt-auto pt-3">{renderItem(MORE_NAV)}</div>
    </nav>
  );
};
