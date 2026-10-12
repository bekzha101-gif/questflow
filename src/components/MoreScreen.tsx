import React from 'react';
import { ChevronRight } from 'lucide-react';
import { TabType, SECONDARY_NAV } from './Navigation';
import {
  HIDEABLE_SECTIONS,
  HideableSection,
  setSectionHidden,
  useHiddenSections,
} from '../utils/hiddenSections';

interface MoreScreenProps {
  onSelectTab: (tab: TabType) => void;
  shoppingCount: number;
}

// Экран «Ещё»: разделы, которыми пользуются не каждый день, и переключатели скрытых разделов
export const MoreScreen: React.FC<MoreScreenProps> = ({ onSelectTab, shoppingCount }) => {
  const hidden = useHiddenSections();
  const visibleSections = SECONDARY_NAV.filter(
    (item) => !hidden.includes(item.id as HideableSection)
  );

  return (
    <div className="max-w-xl mx-auto px-3 sm:px-4 py-3 space-y-5">
      <div className="bg-[#101014] border border-white/[0.07] rounded-2xl divide-y divide-white/[0.06] overflow-hidden">
        {visibleSections.map((item) => {
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

      <div>
        <h2 className="px-1 pb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          Показывать разделы
        </h2>
        <div className="bg-[#101014] border border-white/[0.07] rounded-2xl divide-y divide-white/[0.06] overflow-hidden">
          {HIDEABLE_SECTIONS.map((section) => {
            const shown = !hidden.includes(section.id);
            return (
              <label
                key={section.id}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.04] transition-colors"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-zinc-200">{section.label}</span>
                  <span className="block text-xs text-zinc-500 truncate">{section.description}</span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={shown}
                  onChange={(e) => setSectionHidden(section.id, !e.target.checked)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`relative w-9 h-5 rounded-full transition-colors shrink-0 peer-focus-visible:ring-2 peer-focus-visible:ring-white/60 ${
                    shown ? 'bg-emerald-500' : 'bg-zinc-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      shown ? 'translate-x-4' : ''
                    }`}
                  />
                </span>
              </label>
            );
          })}
        </div>
        <p className="px-1 pt-2 text-xs text-zinc-500">
          Скрытый раздел только пропадает из меню. Его данные сохраняются.
        </p>
      </div>
    </div>
  );
};
