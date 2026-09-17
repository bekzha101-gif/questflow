import React, { useState } from "react";
import { TaskItem, Project, UserStats } from "../types";
import { 
  ShoppingBag, 
  CheckCircle2, 
  Circle, 
  Plus, 
  ExternalLink, 
  Sparkles, 
  Coins, 
  Check, 
  ChevronDown, 
  ChevronRight, 
  Trash2, 
  Pencil, 
  Tag, 
  Filter
} from "lucide-react";
import { renderFormattedText } from "../utils/textFormatter";
import { playQuestCompleteSound, playCoinSound } from "../utils/sound";
import { triggerQuestConfetti } from "../utils/confetti";

interface ShoppingListViewProps {
  tasks: TaskItem[];
  projects: Project[];
  stats: UserStats;
  onToggleTask: (taskId: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onAddSubtask: (taskId: string, text: string) => void;
  onDeleteTask: (taskId: string) => void;
  onEditTask?: (task: TaskItem) => void;
  onOpenQuickAdd: () => void;
}

export const ShoppingListView: React.FC<ShoppingListViewProps> = ({
  tasks,
  projects,
  stats,
  onToggleTask,
  onToggleSubtask,
  onAddSubtask,
  onDeleteTask,
  onEditTask,
  onOpenQuickAdd,
}) => {
  // Shopping project ID from Todoist
  const SHOPPING_PROJECT_ID = "6h5FPgJ74x5g685w";
  
  const [selectedCategory, setSelectedCategory] = useState<"all" | "nootropics" | "study" | "tech" | "health" | "completed">("all");
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({
    // Auto-expand items that have many subtasks for instant convenience
    "td-6h5FWpg787V9C32w": true,
    "td-6h5G2G6Cw6px6FCP": true,
  });
  const [newSubtaskInputs, setNewSubtaskInputs] = useState<Record<string, string>>({});

  // Filter tasks that belong to Shopping List or have shopping tags
  const shoppingTasks = tasks.filter(
    (t) => t.projectId === SHOPPING_PROJECT_ID || t.tags.includes("покупки") || t.tags.includes("желания")
  );

  const toggleExpand = (taskId: string) => {
    setExpandedTasks((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const handleComplete = (task: TaskItem) => {
    if (!task.completed) {
      if (stats.soundEnabled) {
        playQuestCompleteSound();
        playCoinSound();
      }
      triggerQuestConfetti();
    }
    onToggleTask(task.id);
  };

  const handleAddSubtaskSubmit = (taskId: string, e: React.FormEvent) => {
    e.preventDefault();
    const text = (newSubtaskInputs[taskId] || "").trim();
    if (text) {
      onAddSubtask(taskId, text);
      setNewSubtaskInputs((prev) => ({ ...prev, [taskId]: "" }));
    }
  };

  // Category classifier
  const filterByCategory = (task: TaskItem) => {
    const titleLower = task.title.toLowerCase();
    if (selectedCategory === "completed") return task.completed;
    if (task.completed) return false;

    if (selectedCategory === "nootropics") {
      return (
        titleLower.includes("мухомор") ||
        titleLower.includes("бад") ||
        titleLower.includes("ксимедон") ||
        titleLower.includes("миноксидил") ||
        task.subtasks.some((st) => st.text.toLowerCase().includes("capsules") || st.text.toLowerCase().includes("powder"))
      );
    }
    if (selectedCategory === "study") {
      return (
        titleLower.includes("учеба") ||
        titleLower.includes("курс") ||
        titleLower.includes("бусти") ||
        titleLower.includes("арсен")
      );
    }
    if (selectedCategory === "tech") {
      return (
        titleLower.includes("iphone") ||
        titleLower.includes("dolphin") ||
        titleLower.includes("obsidian") ||
        titleLower.includes("mod") ||
        titleLower.includes("sandcastle")
      );
    }
    if (selectedCategory === "health") {
      return (
        titleLower.includes("barefoot") ||
        titleLower.includes("анализ") ||
        titleLower.includes("мрт") ||
        titleLower.includes("обувь")
      );
    }

    return true;
  };

  const filteredTasks = shoppingTasks.filter(filterByCategory);
  const totalItemsCount = shoppingTasks.length;
  const completedItemsCount = shoppingTasks.filter((t) => t.completed).length;
  const totalSubtasksCount = shoppingTasks.reduce((acc, t) => acc + t.subtasks.length, 0);
  const completedSubtasksCount = shoppingTasks.reduce(
    (acc, t) => acc + t.subtasks.filter((s) => s.completed).length,
    0
  );

  return (
    <div className="max-w-4xl mx-auto py-4 px-3 sm:px-6 space-y-5 animate-fade-in">
      
      {/* 1. Flagship Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#18151f] via-[#121218] to-[#0c0c10] border border-amber-500/20 rounded-3xl p-5 sm:p-6 shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  СПИСОК ПОКУПОК
                </h1>
                <p className="text-[11px] text-zinc-400">
                  Точный перенос из Todoist: ноотропы, курсы, софт, гаджеты и биохакинг
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={onOpenQuickAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs shadow-lg shadow-amber-500/20 transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Добавить покупку</span>
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5 pt-4 border-t border-white/10">
          <div className="bg-black/30 rounded-xl p-2.5 border border-white/5">
            <span className="text-[10px] uppercase font-mono text-zinc-500">Всего позиций</span>
            <div className="text-base font-bold text-white mt-0.5">{totalItemsCount}</div>
          </div>
          <div className="bg-black/30 rounded-xl p-2.5 border border-white/5">
            <span className="text-[10px] uppercase font-mono text-zinc-500">Куплено</span>
            <div className="text-base font-bold text-emerald-400 mt-0.5">
              {completedItemsCount} / {totalItemsCount}
            </div>
          </div>
          <div className="bg-black/30 rounded-xl p-2.5 border border-white/5">
            <span className="text-[10px] uppercase font-mono text-zinc-500">Подзадачи & БАДы</span>
            <div className="text-base font-bold text-amber-300 mt-0.5">
              {completedSubtasksCount} / {totalSubtasksCount}
            </div>
          </div>
          <div className="bg-black/30 rounded-xl p-2.5 border border-white/5">
            <span className="text-[10px] uppercase font-mono text-zinc-500">Награда за чек</span>
            <div className="flex items-center gap-1.5 text-base font-bold text-purple-300 mt-0.5">
              <Coins className="w-4 h-4 text-amber-400" />
              <span>+XP & Золото</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-white/5">
        {[
          { id: "all", label: "Все покупки", icon: "🛒", count: shoppingTasks.filter((t) => !t.completed).length },
          { id: "nootropics", label: "🍄 Ноотропы & БАДы", count: 3 },
          { id: "study", label: "🎓 Учеба & Курсы", count: 1 },
          { id: "tech", label: "💻 Гаджеты & Софт", count: 5 },
          { id: "health", label: "🌿 Здоровье & Тело", count: 2 },
          { id: "completed", label: "✅ Куплено", count: completedItemsCount },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedCategory(tab.id as any)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
              selectedCategory === tab.id
                ? "bg-amber-500/15 border-amber-500/40 text-amber-300 shadow"
                : "bg-zinc-900/80 text-zinc-400 border-white/5 hover:text-white"
            }`}
          >
            <span>{tab.label}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 text-zinc-300">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* 3. Tasks List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="py-12 text-center bg-[#121216] border border-white/5 rounded-3xl p-6">
            <ShoppingBag className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-zinc-400 text-xs font-medium">Нет позиций в выбранной категории</p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isExpanded = !!expandedTasks[task.id];
            const completedSubCount = task.subtasks.filter((s) => s.completed).length;
            const progressPct = task.subtasks.length > 0 ? Math.round((completedSubCount / task.subtasks.length) * 100) : 0;

            return (
              <div
                key={task.id}
                className={`border rounded-2xl p-4 transition-all ${
                  task.completed
                    ? "bg-zinc-900/30 border-white/5 opacity-50"
                    : "bg-[#121216] hover:bg-[#15151c] border-white/[0.08] hover:border-amber-500/20 shadow-lg"
                }`}
              >
                {/* Main Item Row */}
                <div className="flex items-start gap-3">
                  
                  {/* Complete Checkbox */}
                  <button
                    onClick={() => handleComplete(task)}
                    className="mt-0.5 text-zinc-500 hover:text-amber-400 transition-colors shrink-0 cursor-pointer"
                    title={task.completed ? "Отменить покупку" : "Отметить купленным"}
                  >
                    {task.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Circle className="w-5 h-5 text-zinc-600 hover:text-amber-400" />
                    )}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className={`text-xs sm:text-sm font-semibold leading-relaxed ${
                        task.completed ? "line-through text-zinc-500" : "text-zinc-100"
                      }`}>
                        {renderFormattedText(task.title)}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {onEditTask && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditTask(task);
                            }}
                            className="p-1 rounded-lg text-zinc-500 hover:text-purple-300 hover:bg-white/5 transition-colors cursor-pointer"
                            title="Редактировать"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm("Удалить эту покупку из списка?")) {
                              onDeleteTask(task.id);
                            }
                          }}
                          className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Удалить"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Subtasks summary & tags */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap text-[11px]">
                      {task.subtasks.length > 0 && (
                        <button
                          onClick={() => toggleExpand(task.id)}
                          className="flex items-center gap-1 text-amber-400/90 hover:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-lg font-medium transition-colors cursor-pointer"
                        >
                          <span>{completedSubCount} / {task.subtasks.length} шагов</span>
                          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        </button>
                      )}

                      <span className="text-[10px] text-zinc-500 bg-white/5 px-2 py-0.5 rounded-md font-mono">
                        +{task.expReward} XP | +{task.goldReward} 🪙
                      </span>

                      {task.subtasks.length > 0 && (
                        <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden hidden sm:block">
                          <div
                            className="h-full bg-amber-400 rounded-full transition-all duration-300"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Expandable Subtasks List */}
                    {isExpanded && task.subtasks.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
                        <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                          Состав / Детали покупки ({task.subtasks.length}):
                        </div>
                        <div className="grid grid-cols-1 gap-1.5 pl-1">
                          {task.subtasks.map((st) => (
                            <div
                              key={st.id}
                              onClick={() => onToggleSubtask(task.id, st.id)}
                              className="flex items-start gap-2.5 p-2 rounded-xl bg-black/40 hover:bg-white/[0.03] border border-white/[0.04] transition-colors cursor-pointer text-xs"
                            >
                              <div className={`w-3.5 h-3.5 rounded mt-0.5 flex items-center justify-center border shrink-0 transition-colors ${
                                st.completed ? "bg-amber-400 border-amber-400 text-black" : "border-zinc-600 hover:border-zinc-400"
                              }`}>
                                {st.completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </div>
                              <div className={`flex-1 leading-snug ${
                                st.completed ? "line-through text-zinc-500" : "text-zinc-200"
                              }`}>
                                {renderFormattedText(st.text)}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Add subtask input */}
                        <form onSubmit={(e) => handleAddSubtaskSubmit(task.id, e)} className="pt-2 flex gap-2">
                          <input
                            type="text"
                            placeholder="Добавить позицию в этот список..."
                            value={newSubtaskInputs[task.id] || ""}
                            onChange={(e) =>
                              setNewSubtaskInputs((prev) => ({ ...prev, [task.id]: e.target.value }))
                            }
                            className="flex-1 bg-zinc-900/90 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
                          />
                          <button
                            type="submit"
                            className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-colors"
                          >
                            Добавить
                          </button>
                        </form>
                      </div>
                    )}

                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
