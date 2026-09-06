import React, { useState } from 'react';
import { TaskItem, Project, Priority, UserStats } from '../types';
import { 
  CheckCircle2, 
  Circle, 
  Calendar, 
  Tag, 
  Plus, 
  Trash2, 
  ChevronRight, 
  ChevronDown, 
  Layers,
  Check,
  Pencil,
} from 'lucide-react';
import { playQuestCompleteSound, playCoinSound } from '../utils/sound';
import { triggerQuestConfetti } from '../utils/confetti';

interface TodoistTaskListProps {
  tasks: TaskItem[];
  projects: Project[];
  stats: UserStats;
  onToggleTask: (taskId: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onAddSubtask: (taskId: string, text: string) => void;
  onToggleFocus: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onEditTask?: (task: TaskItem) => void;
  onOpenQuickAdd: () => void;
}

export const TodoistTaskList: React.FC<TodoistTaskListProps> = ({
  tasks,
  projects,
  stats,
  onToggleTask,
  onToggleSubtask,
  onAddSubtask,
  onToggleFocus,
  onDeleteTask,
  onEditTask,
  onOpenQuickAdd,
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [filterView, setFilterView] = useState<'today' | 'upcoming' | 'all' | 'completed'>('all');
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
  const [newSubtaskInputs, setNewSubtaskInputs] = useState<Record<string, string>>({});

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
    const text = (newSubtaskInputs[taskId] || '').trim();
    if (text) {
      onAddSubtask(taskId, text);
      setNewSubtaskInputs((prev) => ({ ...prev, [taskId]: '' }));
    }
  };

  const nonHabitTasks = tasks.filter((t) => t.type !== 'habit');

  const filteredTasks = nonHabitTasks.filter((t) => {
    if (selectedProjectId !== 'all' && t.projectId !== selectedProjectId) return false;

    const todayStr = new Date().toISOString().split('T')[0];

    if (filterView === 'completed') return t.completed;
    if (t.completed) return false;

    if (filterView === 'today') {
      return t.dueDate === todayStr || t.priority === 'p1';
    }

    if (filterView === 'upcoming') {
      return !!t.dueDate && t.dueDate > todayStr;
    }

    return true;
  });

  return (
    <div className="max-w-4xl mx-auto py-5 px-3 sm:px-6 space-y-5">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#111115] border border-white/[0.08] rounded-3xl p-4 sm:p-5">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
            <span>Задачи & Проекты</span>
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">Структурируйте задачи с приоритетами, дедлайнами и наградами</p>
        </div>

        <button
          onClick={onOpenQuickAdd}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs shadow transition-all active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Добавить задачу</span>
        </button>
      </div>

      {/* Filter Views */}
      <div className="flex items-center gap-1.5 border-b border-white/5 pb-2.5 overflow-x-auto no-scrollbar">
        {[
          { id: 'all', label: 'Все активные' },
          { id: 'today', label: 'Сегодня & Срочные' },
          { id: 'upcoming', label: 'Предстоящие' },
          { id: 'completed', label: 'Выполненные' },
        ].map((view) => (
          <button
            key={view.id}
            onClick={() => setFilterView(view.id as any)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
              filterView === view.id
                ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {view.label}
          </button>
        ))}
      </div>

      {/* Projects Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setSelectedProjectId('all')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition-all border ${
            selectedProjectId === 'all'
              ? 'bg-zinc-800 text-white border-zinc-700'
              : 'bg-zinc-900 text-zinc-400 border-white/5 hover:text-white'
          }`}
        >
          <Layers className="w-3 h-3 text-zinc-500" />
          <span>Все проекты</span>
        </button>

        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedProjectId(p.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition-all border ${
              selectedProjectId === p.id
                ? 'bg-zinc-800 text-white border-zinc-700'
                : 'bg-zinc-900 text-zinc-400 border-white/5 hover:text-white'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
            <span>{p.name}</span>
          </button>
        ))}
      </div>

      {/* Task List */}
      <div className="space-y-2.5">
        {filteredTasks.length === 0 ? (
          <div className="py-12 text-center bg-[#111115] border border-white/5 rounded-3xl p-6">
            <p className="text-zinc-500 text-xs font-medium">Нет задач в этом списке</p>
            <button
              onClick={onOpenQuickAdd}
              className="mt-2 inline-flex items-center gap-1 text-xs text-zinc-300 hover:text-white font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Создать задачу
            </button>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isExpanded = !!expandedTasks[task.id];
            const project = projects.find((p) => p.id === task.projectId);
            const completedSubtasks = task.subtasks.filter((s) => s.completed).length;

            return (
              <div
                key={task.id}
                className={`border rounded-2xl p-3.5 transition-all ${
                  task.completed
                    ? 'bg-zinc-900/30 border-white/5 opacity-50'
                    : 'bg-[#111115] hover:bg-[#15151a] border-white/[0.08] hover:border-white/15'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => handleComplete(task)}
                    className="mt-0.5 text-zinc-500 hover:text-zinc-200 transition-colors"
                  >
                    {task.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-zinc-400" />
                    ) : (
                      <Circle className="w-4 h-4 text-zinc-600" />
                    )}
                  </button>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs sm:text-sm font-medium leading-snug ${
                        task.completed ? 'line-through text-zinc-500' : 'text-zinc-200'
                      }`}>
                        {task.title}
                      </p>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                          {task.priority}
                        </span>
                        {onEditTask && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditTask(task);
                            }}
                            className="p-1 rounded-lg text-zinc-600 hover:text-purple-300 hover:bg-white/5 transition-colors cursor-pointer"
                            title="Редактировать задачу, чек-лист и дедлайн"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Удалить задачу «${task.title}»?`)) {
                              onDeleteTask(task.id);
                            }
                          }}
                          className="p-1 rounded-lg text-zinc-700 hover:text-rose-400 hover:bg-rose-950/20 transition-colors cursor-pointer"
                          title="Удалить задачу"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {task.description && (
                      <p className="text-[11px] text-zinc-500 mt-1 line-clamp-1">
                        {task.description}
                      </p>
                    )}

                    {/* Metadata chips */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap text-[10px] text-zinc-500 font-mono">
                      {project && (
                        <span className="flex items-center gap-1 text-zinc-400">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: project.color }} />
                          <span>{project.name}</span>
                        </span>
                      )}

                      {task.dueDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-zinc-600" />
                          <span>{task.dueDate} {task.dueTime ? `(${task.dueTime})` : ''}</span>
                        </span>
                      )}

                      <span>+{task.expReward} EXP</span>
                      <span>+{task.goldReward}g</span>

                      {task.subtasks.length > 0 && (
                        <button
                          onClick={() => toggleExpand(task.id)}
                          className="text-zinc-400 hover:text-zinc-200 ml-auto flex items-center gap-0.5"
                        >
                          <span>{completedSubtasks}/{task.subtasks.length} шагов</span>
                          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        </button>
                      )}
                    </div>

                    {/* Subtasks Accordion */}
                    {isExpanded && (
                      <div className="mt-3 pt-2.5 border-t border-white/5 space-y-1.5 pl-2">
                        {task.subtasks.map((st) => (
                          <div
                            key={st.id}
                            onClick={() => onToggleSubtask(task.id, st.id)}
                            className="flex items-center gap-2 text-[11px] text-zinc-400 hover:text-zinc-200 cursor-pointer"
                          >
                            <div className={`w-3 h-3 rounded flex items-center justify-center border ${
                              st.completed ? 'bg-zinc-200 border-zinc-200 text-zinc-950' : 'border-zinc-700'
                            }`}>
                              {st.completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </div>
                            <span className={st.completed ? 'line-through text-zinc-600' : ''}>{st.text}</span>
                          </div>
                        ))}

                        <form onSubmit={(e) => handleAddSubtaskSubmit(task.id, e)} className="pt-1.5 flex gap-1.5">
                          <input
                            type="text"
                            placeholder="Добавить подзадачу..."
                            value={newSubtaskInputs[task.id] || ''}
                            onChange={(e) =>
                              setNewSubtaskInputs((prev) => ({ ...prev, [task.id]: e.target.value }))
                            }
                            className="flex-1 bg-zinc-900 border border-white/5 rounded-lg px-2.5 py-1 text-[11px] text-zinc-300 focus:outline-none"
                          />
                          <button
                            type="submit"
                            className="px-2.5 py-1 rounded-lg bg-zinc-800 text-[10px] text-zinc-300 hover:text-white"
                          >
                            +
                          </button>
                        </form>
                      </div>
                    )}
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={() => onDeleteTask(task.id)}
                    className="text-zinc-600 hover:text-red-400 p-1 transition-colors"
                    title="Удалить"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
