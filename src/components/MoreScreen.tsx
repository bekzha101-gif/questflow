import React from 'react';
import { ChevronRight } from 'lucide-react';
import { TabType, SECONDARY_NAV } from './Navigation';

interface MoreScreenProps {
  onSelectTab: (tab: TabType) => void;
  shoppingCount: number;
}

// Экран «Ещё» (телефон): разделы, которыми пользуются не каждый день
export const MoreScreen: React.FC<MoreScreenProps> = ({ onSelectTab, shoppingCount }) => {
  return (
    <div className="max-w-xl mx-auto px-3 sm:px-4 py-3">
      <div className="bg-[#101014] border border-white/[0.07] rounded-2xl divide-y divide-white/[0.06] overflow-hidden">
        {SECONDARY_NAV.map((item) => {
          const Icon = item.icon;
          const count = item.id === 'shopping' ? shoppingCount : 0;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left text-sm text-zinc-200 hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <Icon className="w-4 h-4 text-zinc-500 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {count > 0 && <span className="text-xs font-mono text-zinc-500">{count}</span>}
              <ChevronRight className="w-4 h-4 text-zinc-600" />
            </button>
          );
        })}
      </div>
    </div>
  );
};
