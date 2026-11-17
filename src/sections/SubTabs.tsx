import React from 'react';

export interface SubTabItem<T extends string> {
  id: T;
  label: string;
  badge?: number;
}

// Переключатель вкладок внутри раздела (Задачи · Покупки · Календарь и т.п.)
export function SubTabs<T extends string>({
  items,
  active,
  onChange,
  label,
}: {
  items: SubTabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex items-center gap-1 bg-zinc-900 border border-white/10 rounded-xl p-0.5 text-xs">
      {items.map((item) => (
        <button
          key={item.id}
          role="tab"
          aria-selected={active === item.id}
          onClick={() => onChange(item.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
            active === item.id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <span>{item.label}</span>
          {item.badge ? (
            <span className="text-[9px] font-mono px-1 rounded bg-zinc-700 text-zinc-300">{item.badge}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
