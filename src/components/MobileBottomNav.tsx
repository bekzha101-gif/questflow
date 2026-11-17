import React from 'react';
import { Plus } from 'lucide-react';
import { TabType, getSection, PRIMARY_NAV } from './Navigation';

interface MobileBottomNavProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onOpenQuickAdd: () => void;
}

// Нижняя навигация телефона: 5 разделов и «+» над панелью справа (на 390 px пять пунктов
// влезают по 78 px, шестой кнопкой в ряду они бы стали уже 64 px и подписи обрезались)
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenQuickAdd,
}) => {
  const section = getSection(activeTab);

  return (
    <>
      <button
        onClick={onOpenQuickAdd}
        aria-label="Новая задача"
        className="md:hidden fixed right-3 z-40 w-12 h-12 rounded-2xl bg-white text-zinc-950 flex items-center justify-center shadow-lg shadow-black/50 active:scale-95 transition-transform cursor-pointer"
        style={{ bottom: 'calc(4.25rem + env(safe-area-inset-bottom))' }}
      >
        <Plus className="w-5 h-5 stroke-[2.5]" />
      </button>

      <nav
        aria-label="Разделы"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#09090b]/95 backdrop-blur-xl border-t border-white/[0.06] px-1 pt-1.5"
        style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center">
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
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
          })}
        </div>
      </nav>
    </>
  );
};
