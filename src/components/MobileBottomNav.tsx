import React from 'react';
import { Plus } from 'lucide-react';
import {
  TabType,
  NavItem,
  getSection,
  PRIMARY_NAV,
  SECONDARY_NAV,
  MORE_NAV,
} from './Navigation';

interface MobileBottomNavProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onOpenQuickAdd: () => void;
}

// Нижняя навигация для телефона: 4 главных раздела, «+» по центру и «Ещё»
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenQuickAdd,
}) => {
  const section = getSection(activeTab);
  const isMoreActive = section === 'more' || SECONDARY_NAV.some((item) => item.id === section);

  const renderItem = (item: NavItem, active: boolean) => {
    const Icon = item.icon;
    return (
      <button
        key={item.id}
        onClick={() => onSelectTab(item.id)}
        aria-current={active ? 'page' : undefined}
        className={`flex-1 min-w-0 flex flex-col items-center gap-0.5 py-1 transition-colors cursor-pointer ${
          active ? 'text-white font-semibold' : 'text-zinc-500'
        }`}
      >
        <Icon className="w-5 h-5" />
        <span className="text-[10px] truncate max-w-full">{item.label}</span>
      </button>
    );
  };

  return (
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#09090b]/95 backdrop-blur-xl border-t border-white/[0.06] px-1 pt-1.5"
      style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-center">
        {PRIMARY_NAV.slice(0, 2).map((item) => renderItem(item, section === item.id))}

        <div className="flex-1 flex justify-center">
          <button
            onClick={onOpenQuickAdd}
            aria-label="Новая задача"
            className="w-10 h-10 rounded-2xl bg-white text-zinc-950 flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {PRIMARY_NAV.slice(2).map((item) => renderItem(item, section === item.id))}
        {renderItem(MORE_NAV, isMoreActive)}
      </div>
    </div>
  );
};
