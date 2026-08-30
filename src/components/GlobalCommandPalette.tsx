import React, { useState, useEffect, useMemo } from 'react';
import { Search, CheckCircle, Clock, Calendar, Film, Sparkles, ArrowRight, X, Command, Activity, DollarSign, Users, Shield } from 'lucide-react';
import { TaskItem, Project } from '../types';
import { TabType } from './Navigation';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: TaskItem[];
  projects: Project[];
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onToggleTask: (id: string) => void;
  onOpenQuickAdd: () => void;
  onOpenAiMaster: () => void;
  onExportData: () => void;
}

export function GlobalCommandPalette({
  isOpen,
  onClose,
  tasks,
  projects,
  onSelectTab,
  onToggleTask,
  onOpenQuickAdd,
  onOpenAiMaster,
  onExportData,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Close on Escape & handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        // Handled in App.tsx
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset query on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Navigation Items
  const navItems = useMemo(() => [
    { id: 'tab-shorts', type: 'nav', title: 'ShortsFlow — Фокус спринт', tab: 'shorts' as TabType, icon: Clock },
    { id: 'tab-prod', type: 'nav', title: 'Канбан Продакшн YouTube (Заметки бобра / Shorts)', tab: 'production' as TabType, icon: Film },
    { id: 'tab-bigdata', type: 'nav', title: 'Big Data Табличка (Сон, Ноотропы, Аналитика 31)', tab: 'bigdata' as TabType, icon: Activity },
    { id: 'tab-ideas', type: 'nav', title: 'Пайплайн Идей & Сценариев', tab: 'ideas' as TabType, icon: Sparkles },
    { id: 'tab-tasks', type: 'nav', title: 'Все Задачи (Todoist стиль)', tab: 'tasks' as TabType, icon: CheckCircle },
    { id: 'tab-habits', type: 'nav', title: 'Привычки & Ежедневные Квесты (Habitica)', tab: 'habits' as TabType, icon: Shield },
    { id: 'tab-fin', type: 'nav', title: 'Финансы & Доходы YouTube', tab: 'finances' as TabType, icon: DollarSign },
    { id: 'tab-cal', type: 'nav', title: 'Календарь & Time Blocking', tab: 'calendar' as TabType, icon: Calendar },
    { id: 'tab-team', type: 'nav', title: 'Команда & Роли монтажеров', tab: 'team' as TabType, icon: Users },
  ], []);

  // Quick Action Items
  const quickActions = useMemo(() => [
    { id: 'act-add', type: 'action', title: '⚡ Быстрое добавление задачи (Q)', action: onOpenQuickAdd, icon: Command },
    { id: 'act-ai', type: 'action', title: '🧙‍♂️ AI Генератор квестов и декомпозиция целей', action: onOpenAiMaster, icon: Sparkles },
    { id: 'act-export', type: 'action', title: '⬇ Экспорт всех данных в JSON бэкап', action: onExportData, icon: Activity },
  ], [onOpenQuickAdd, onOpenAiMaster, onExportData]);

  // Filtered Results
  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) {
      return [
        { group: 'Быстрые действия', items: quickActions },
        { group: 'Разделы приложения', items: navItems },
      ];
    }

    // Filter Tasks
    const filteredTasks = tasks
      .filter((t) => t.title.toLowerCase().includes(q) || t.tags?.some((tag) => tag.toLowerCase().includes(q)))
      .slice(0, 8)
      .map((t) => ({
        id: t.id,
        type: 'task',
        title: t.title,
        task: t,
        icon: t.completed ? CheckCircle : Clock,
      }));

    // Filter Navigation
    const filteredNav = navItems.filter((n) => n.title.toLowerCase().includes(q));

    // Filter Actions
    const filteredAct = quickActions.filter((a) => a.title.toLowerCase().includes(q));

    const groups: Array<{ group: string; items: any[] }> = [];
    if (filteredTasks.length > 0) groups.push({ group: 'Задачи & Квесты', items: filteredTasks });
    if (filteredNav.length > 0) groups.push({ group: 'Навигация', items: filteredNav });
    if (filteredAct.length > 0) groups.push({ group: 'Действия', items: filteredAct });

    return groups;
  }, [query, tasks, navItems, quickActions]);

  // Flattened list for keyboard selection
  const flatItems: any[] = useMemo(() => results.flatMap((g) => g.items), [results]);


  // Handle Enter
  const handleSelect = (item: any) => {
    if (!item) return;
    if (item.type === 'nav') {
      onSelectTab(item.tab);
      onClose();
    } else if (item.type === 'action') {
      item.action();
      onClose();
    } else if (item.type === 'task') {
      onToggleTask(item.task.id);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (flatItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + flatItems.length) % (flatItems.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelect(flatItems[selectedIndex]);
    }
  };

  if (!isOpen) return null;

  let globalIdx = 0;

  return (
    <div className="fixed inset-0 z-[99999] flex items-start justify-center pt-16 sm:pt-24 p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#111116] border border-white/15 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10 bg-white/[0.02]">
          <Search className="w-5 h-5 text-white/40 shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Поиск по задачам, видео, идеям, таблице сна или действиям..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none font-medium"
          />
          {query ? (
            <button onClick={() => setQuery('')} className="text-white/40 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          ) : (
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/10 text-white/40">
              ESC
            </span>
          )}
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-2 space-y-4 divide-y divide-white/5">
          {flatItems.length === 0 ? (
            <div className="py-12 text-center text-white/40 text-xs">
              Ничего не найдено по запросу «{query}»
            </div>
          ) : (
            results.map((group) => (
              <div key={group.group} className="pt-2 first:pt-0">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-white/30 uppercase tracking-wider">
                  {group.group}
                </div>
                <div className="space-y-0.5">
                  {group.items.map((item: any) => {
                    const isSelected = globalIdx === selectedIndex;
                    const thisIdx = globalIdx;
                    globalIdx += 1;

                    const Icon = item.icon;

                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setSelectedIndex(thisIdx)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-left text-xs transition-all ${
                          isSelected
                            ? 'bg-purple-600/30 text-white border border-purple-500/40 shadow-sm'
                            : 'text-white/70 hover:bg-white/5 hover:text-white border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`p-1.5 rounded-xl shrink-0 ${
                              isSelected ? 'bg-purple-500/20 text-purple-300' : 'bg-white/5 text-white/40'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="truncate font-medium">
                            {item.title}
                            {item.task?.priority && (
                              <span className="ml-2 text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/10 text-white/60">
                                {item.task.priority}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isSelected && (
                            <span className="text-[10px] text-purple-300 flex items-center gap-1 font-mono">
                              Выбрать <ArrowRight className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Shortcut Bar */}
        <div className="px-4 py-2.5 bg-black/40 border-t border-white/5 flex items-center justify-between text-[11px] text-white/40 font-mono">
          <div className="flex items-center gap-3">
            <span>↑↓ Навигация</span>
            <span>↵ Выбор</span>
          </div>
          <span>Cmd + K</span>
        </div>
      </div>
    </div>
  );
}
