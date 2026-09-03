import React, { useState, useEffect, useCallback } from 'react';
import { UserStats, TaskItem, Project, Reward, NotificationItem, GoogleCalendarConfig } from './types';
import { 
  loadStats, saveStats,
  loadTasks, saveTasks,
  loadProjects, saveProjects,
  loadRewards, saveRewards,
  loadNotifications, saveNotifications,
  loadCalendarConfig, saveCalendarConfig
} from './utils/storage';
import { 
  loadCloudSyncConfig, 
  saveCloudSyncConfig, 
  setupBroadcastSync, 
  broadcastStateChange, 
  CloudSyncState 
} from './utils/cloudSync';
import { AuthGate } from './components/AuthGate';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useSupabaseSync } from './hooks/useSupabaseSync';
import { initialStats, initialTasks, initialRewards } from './data/initialData';


import { Header } from './components/Header';
import { Navigation, TabType } from './components/Navigation';
import { MobileBottomNav } from './components/MobileBottomNav';
import { CommandCenterToday } from './components/CommandCenterToday';
import { MediaStudioHub } from './components/MediaStudioHub';
import { QuestsHub } from './components/QuestsHub';
import { LifeAnalyticsHub } from './components/LifeAnalyticsHub';
import { TavernHub } from './components/TavernHub';
import { QuickAddModal } from './components/QuickAddModal';
import { GoogleCalendarModal } from './components/GoogleCalendarModal';
import { DeviceSyncModal } from './components/DeviceSyncModal';
import { AiQuestMasterModal } from './components/AiQuestMasterModal';
import { LevelUpModal } from './components/LevelUpModal';
import { GlobalCommandPalette } from './components/GlobalCommandPalette';
import { UndoSnackbar, SnackbarAction } from './components/UndoSnackbar';
import { PomodoroTimerWidget } from './components/PomodoroTimerWidget';
import { playLevelUpSound } from './utils/sound';
import { triggerLevelUpConfetti } from './utils/confetti';




export function App() {
  // Core State
  const [stats, setStats] = useState<UserStats>(loadStats);
  const [tasks, setTasks] = useState<TaskItem[]>(loadTasks);
  const [projects, setProjects] = useState<Project[]>(loadProjects);
  const [rewards, setRewards] = useState<Reward[]>(loadRewards);
  const [notifications, setNotifications] = useState<NotificationItem[]>(loadNotifications);
  const [calendarConfig, setCalendarConfig] = useState<GoogleCalendarConfig>(loadCalendarConfig);
  const [syncConfig, setSyncConfig] = useState<CloudSyncState>(loadCloudSyncConfig);

  // Active Navigation Tab (Defaults to Today Command Center)
  const [activeTab, setActiveTab] = useState<TabType>('today');

  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isDeviceSyncOpen, setIsDeviceSyncOpen] = useState(false);
  const [isAiMasterOpen, setIsAiMasterOpen] = useState(false);
  const [aiGoalDraft, setAiGoalDraft] = useState('');
  const [isLevelUpModalOpen, setIsLevelUpModalOpen] = useState(false);
  const [snackbarAction, setSnackbarAction] = useState<SnackbarAction | null>(null);


  // ─── Supabase Cloud Sync ──────────────────────────────────────────────────
  const { pushStats, pushTasks, pushProjects, pushRewards, pullAll, exportAllData, syncStatus } = useSupabaseSync();

  // On mount: pull from cloud if logged in (cloud data overrides localStorage)
  useEffect(() => {
    pullAll().then((cloudData) => {
      if (cloudData.stats) setStats(cloudData.stats);
      if (cloudData.tasks?.length) setTasks(cloudData.tasks);
      if (cloudData.projects?.length) setProjects(cloudData.projects);
      if (cloudData.rewards?.length) setRewards(cloudData.rewards);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // ─── Auto Daily Reset at Midnight ────────────────────────────────────────
  useEffect(() => {
    const LAST_RESET_KEY = 'questflow_last_daily_reset';
    const today = new Date().toISOString().split('T')[0];
    const lastReset = localStorage.getItem(LAST_RESET_KEY);

    if (lastReset !== today) {
      // Reset daily tasks
      setTasks((prev) =>
        prev.map((t) => (t.type === 'daily' && t.completed ? { ...t, completed: false } : t))
      );
      setStats((prev) => ({ ...prev, streak: prev.streak + 1 }));
      localStorage.setItem(LAST_RESET_KEY, today);
      setNotifications((prev) => [
        {
          id: `auto-reset-${Date.now()}`,
          title: '🌅 Новый День!',
          message: `Ежедневные задачи сброшены автоматически. Стрик продолжается! 🔥`,
          time: new Date().toLocaleTimeString(),
          type: 'reminder',
          read: false,
        },
        ...prev,
      ]);
    }
  }, []);

  // ─── Export All Data ──────────────────────────────────────────────────────
  const handleExportData = useCallback(async () => {
    const json = await exportAllData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `questflow-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportAllData]);

  // Persistent sync to local storage & broadcast to other tabs/devices
  // Also push to Supabase cloud
  useEffect(() => { 
    saveStats(stats); 
    broadcastStateChange({ stats });
    pushStats(stats);
  }, [stats]); // eslint-disable-line

  useEffect(() => { 
    saveTasks(tasks); 
    broadcastStateChange({ tasks });
    pushTasks(tasks);
  }, [tasks]); // eslint-disable-line

  useEffect(() => { 
    saveProjects(projects); 
    broadcastStateChange({ projects });
    pushProjects(projects);
  }, [projects]); // eslint-disable-line

  useEffect(() => { 
    saveRewards(rewards); 
    broadcastStateChange({ rewards });
    pushRewards(rewards);
  }, [rewards]); // eslint-disable-line

  useEffect(() => { saveNotifications(notifications); }, [notifications]);
  useEffect(() => { saveCalendarConfig(calendarConfig); }, [calendarConfig]);
  useEffect(() => { saveCloudSyncConfig(syncConfig); }, [syncConfig]);

  // Setup live BroadcastChannel for multi-device / multi-tab synchronization
  useEffect(() => {
    setupBroadcastSync((payload) => {

      if (payload.stats) setStats(payload.stats);
      if (payload.tasks) setTasks(payload.tasks);
      if (payload.projects) setProjects(payload.projects);
      if (payload.rewards) setRewards(payload.rewards);
    });

    // Check URL parameters for instant sync pairing code (e.g. ?syncCode=123456)
    const urlParams = new URLSearchParams(window.location.search);
    const codeParam = urlParams.get('syncCode');
    if (codeParam && codeParam !== syncConfig.syncCode) {
      setSyncConfig((prev) => ({
        ...prev,
        enabled: true,
        syncCode: codeParam,
        status: 'synced',
      }));
      setNotifications((prev) => [
        {
          id: `sync-conn-${Date.now()}`,
          title: '📱 Устройство сопряжено!',
          message: `QuestFlow успешно подключен к облачной комнате ${codeParam}`,
          time: new Date().toLocaleTimeString(),
          type: 'sync',
          read: false,
        },
        ...prev,
      ]);
    }
  }, []);

  // Global Keyboard shortcuts: Cmd+K (Palette), Q (QuickAdd)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      } else if (!isInput && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        setIsQuickAddOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);


  // Update Stats Helper
  const handleUpdateStats = (newStats: Partial<UserStats>) => {
    setStats((prev) => ({ ...prev, ...newStats }));
  };

  // Gamification Engine: EXP / Level / Gold award
  const awardRewards = (exp: number, gold: number) => {
    let finalExp = exp;
    let finalGold = gold;

    if (stats.heroClass === 'Mage') finalExp = Math.round(exp * 1.25);
    if (stats.heroClass === 'Rogue') finalGold = Math.round(gold * 1.35);
    if (stats.heroClass === 'Warrior') {
      finalExp = Math.round(exp * 1.35);
      finalGold = Math.round(gold * 1.35);
    }

    let newExp = stats.exp + finalExp;
    let newGold = stats.gold + finalGold;
    let newLevel = stats.level;
    let maxExp = stats.maxExp;
    let leveledUp = false;

    // Check Level Up
    while (newExp >= maxExp) {
      newExp -= maxExp;
      newLevel += 1;
      maxExp = Math.round(maxExp * 1.3);
      leveledUp = true;
    }

    if (leveledUp) {
      if (stats.soundEnabled) playLevelUpSound();
      triggerLevelUpConfetti();
      setIsLevelUpModalOpen(true);
      setStats((prev) => ({
        ...prev,
        level: newLevel,
        exp: newExp,
        maxExp,
        hp: prev.maxHp, // Restore HP on level up
        gold: newGold + 50,
      }));
    } else {
      setStats((prev) => ({
        ...prev,
        exp: newExp,
        gold: newGold,
      }));
    }
  };

  // Reset All Farmed Stats & Progress (Fresh Start)
  const handleResetAllProgress = () => {
    const freshStats: UserStats = { ...initialStats };

    setStats(freshStats);
    setTasks(initialTasks);
    setRewards(initialRewards);
    
    // Clear localStorage
    localStorage.removeItem('questflow_stats_v1');
    localStorage.removeItem('questflow_tasks_v1');
    localStorage.removeItem('questflow_rewards_v1');
    localStorage.removeItem('questflow_bigdata_entries_v1');
    localStorage.removeItem('questflow_content_videos_v1');

    // Push fresh state to Supabase
    pushStats(freshStats);
    pushTasks(initialTasks);
    pushRewards(initialRewards);

    setNotifications((prev) => [
      {
        id: `reset-${Date.now()}`,
        title: '🧹 Прогресс сброшен!',
        message: 'Статистика сброшена: 1 Уровень, 0 EXP, 0 Золота, 100 HP. Начните с чистого листа!',
        time: new Date().toLocaleTimeString(),
        type: 'sync',
        read: false,
      },
      ...prev,
    ]);
  };

  // Complete / Toggle Task
  const handleToggleTask = (taskId: string) => {
    const target = tasks.find((t) => t.id === taskId);
    const willComplete = !target?.completed;

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        if (willComplete) {
          awardRewards(t.expReward, t.goldReward);
        }
        return {
          ...t,
          completed: willComplete,
          completedAt: willComplete ? new Date().toISOString() : undefined,
          stage: willComplete ? 'done' : 'in_progress',
        };
      })
    );

    if (willComplete && target) {
      setSnackbarAction({
        id: `undo-comp-${Date.now()}`,
        message: `Завершено: «${target.title.slice(0, 28)}» (+${target.expReward} EXP)`,
        onUndo: () => {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === taskId
                ? { ...t, completed: false, completedAt: undefined, stage: 'in_progress' }
                : t
            )
          );
        },
        durationMs: 4500,
      });
    }
  };


  // Habits Action
  const handleTriggerHabit = (taskId: string, direction: 'positive' | 'negative') => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const currentCounter = t.habitCounter || 0;
        return {
          ...t,
          habitCounter: direction === 'positive' ? currentCounter + 1 : Math.max(0, currentCounter - 1),
        };
      })
    );

    const habit = tasks.find((t) => t.id === taskId);
    if (!habit) return;

    if (direction === 'positive') {
      awardRewards(habit.expReward, habit.goldReward);
    } else {
      const damageTaken = 15;
      setStats((prev) => ({
        ...prev,
        hp: Math.max(0, prev.hp - damageTaken),
      }));
      setNotifications((prev) => [
        {
          id: `dmg-${Date.now()}`,
          title: '💔 Получен урон по HP',
          message: `Вредная привычка отняла -${damageTaken} HP!`,
          time: new Date().toLocaleTimeString(),
          type: 'damage',
          read: false,
        },
        ...prev,
      ]);
    }
  };

  // Daily Action
  const handleToggleDaily = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const willComplete = !t.completed;
        if (willComplete) {
          awardRewards(t.expReward, t.goldReward);
        }
        return {
          ...t,
          completed: willComplete,
          streakCount: willComplete ? (t.streakCount || 0) + 1 : Math.max(0, (t.streakCount || 1) - 1),
        };
      })
    );
  };

  // Reset Dailies for new day
  const handleResetDailies = () => {
    setTasks((prev) =>
      prev.map((t) => (t.type === 'daily' ? { ...t, completed: false } : t))
    );
    setStats((prev) => ({ ...prev, streak: prev.streak + 1 }));
    setNotifications((prev) => [
      {
        id: `streak-${Date.now()}`,
        title: '🔥 Новый День!',
        message: 'Статус ежедневных квестов обновлен. Ваш стрик продолжается!',
        time: new Date().toLocaleTimeString(),
        type: 'reminder',
        read: false,
      },
      ...prev,
    ]);
  };

  // Subtask Toggle
  const handleToggleSubtask = (taskId: string, subtaskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          subtasks: t.subtasks.map((st) =>
            st.id === subtaskId ? { ...st, completed: !st.completed } : st
          ),
        };
      })
    );
  };

  // Add Subtask
  const handleAddSubtask = (taskId: string, text: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          subtasks: [...t.subtasks, { id: `st-${Date.now()}`, text, completed: false }],
        };
      })
    );
  };

  // Toggle Focus in ShortsFlow
  const handleToggleFocus = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, inFocusFlow: !t.inFocusFlow } : t))
    );
  };

  // Snooze Task
  const handleSnoozeTask = (taskId: string, minutes: number) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        return { ...t, durationMinutes: (t.durationMinutes || 25) + minutes };
      })
    );
  };

  // Delete Task
  const handleDeleteTask = (taskId: string) => {
    const taskToDelete = tasks.find((t) => t.id === taskId);
    if (!taskToDelete) return;

    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setSnackbarAction({
      id: `undo-del-${Date.now()}`,
      message: `Удалена задача «${taskToDelete.title.slice(0, 24)}...»`,
      onUndo: () => {
        setTasks((prev) => [taskToDelete, ...prev]);
      },
      durationMs: 6000,
    });
  };


  // Add Task
  const handleAddTask = (newTask: Omit<TaskItem, 'id' | 'completed' | 'subtasks'>) => {
    const task: TaskItem = {
      ...newTask,
      id: `task-${Date.now()}`,
      completed: false,
      subtasks: [],
    };
    setTasks((prev) => [task, ...prev]);
  };

  // Add Batch of Quests from AI
  const handleAddQuestsBatch = (newQuests: Omit<TaskItem, 'id' | 'completed'>[]) => {
    const tasksToAdd: TaskItem[] = newQuests.map((q, idx) => ({
      ...q,
      id: `task-ai-${Date.now()}-${idx}`,
      completed: false,
    }));
    setTasks((prev) => [...tasksToAdd, ...prev]);
    setActiveTab('shorts');
  };

  // Buy Reward from Shop
  const handleBuyReward = (reward: Reward): boolean => {
    if (stats.gold < reward.cost) return false;

    setStats((prev) => {
      let hp = prev.hp;
      if (reward.id === 'rew-item-1') {
        const healAmt = prev.heroClass === 'Healer' ? 50 : 35;
        hp = Math.min(prev.maxHp, prev.hp + healAmt);
      }
      return {
        ...prev,
        gold: prev.gold - reward.cost,
        hp,
      };
    });

    setRewards((prev) =>
      prev.map((r) => (r.id === reward.id ? { ...r, timesPurchased: r.timesPurchased + 1 } : r))
    );
    return true;
  };

  // Add Custom Reward
  const handleAddReward = (reward: Omit<Reward, 'id' | 'timesPurchased'>) => {
    const newRew: Reward = {
      ...reward,
      id: `rew-custom-${Date.now()}`,
      timesPurchased: 0,
    };
    setRewards((prev) => [...prev, newRew]);
  };

  // Mark all notifications read
  const handleMarkNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  // Focus and Due Today counts
  const focusCount = tasks.filter((t) => (t.inFocusFlow || t.priority === 'p1') && !t.completed).length;
  const todayStr = new Date().toISOString().split('T')[0];
  const dueTodayCount = tasks.filter((t) => !t.completed && (t.dueDate === todayStr || t.type === 'daily')).length;

  return (
    <div className="h-screen bg-[#09090c] text-white flex flex-col font-sans selection:bg-purple-500 selection:text-white overflow-hidden pb-16 md:pb-0">
      
      {/* 1. Header with Hero Sheet, Sync & Currencies */}
      <Header
        stats={stats}
        onUpdateStats={handleUpdateStats}
        onOpenQuickAdd={() => setIsQuickAddOpen(true)}
        onOpenSearch={() => setIsCommandPaletteOpen(true)}
        onOpenCalendarModal={() => setIsCalendarModalOpen(true)}
        onOpenDeviceSyncModal={() => setIsDeviceSyncOpen(true)}
        onResetProgress={handleResetAllProgress}
        notifications={notifications}
        onMarkNotificationsRead={handleMarkNotificationsRead}
        calendarConfig={calendarConfig}
      />


      {/* 2. Top Navigation Tabs (Desktop) */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        focusCount={focusCount}
        dueTodayCount={dueTodayCount}
      />

      {/* 3. Main Views (5 Clean Flagship Hubs) */}
      <main className="flex-1 overflow-hidden flex flex-col">
        
        {/* 1. TODAY (Command Center / Home Focus) */}
        {activeTab === 'today' && (
          <CommandCenterToday
            tasks={tasks}
            projects={projects}
            stats={stats}
            rewards={rewards}
            onToggleTask={handleToggleTask}
            onToggleSubtask={handleToggleSubtask}
            onTriggerHabit={handleTriggerHabit}
            onToggleDaily={handleToggleDaily}
            onAddTask={handleAddTask}
            onDeleteTask={handleDeleteTask}
            onAddSubtask={handleAddSubtask}
            onBuyReward={handleBuyReward}
            onOpenQuickAdd={() => setIsQuickAddOpen(true)}
            onOpenStudioTab={() => setActiveTab('studio')}
            onOpenLifeTab={() => setActiveTab('life')}
          />
        )}

        {/* 2. MEDIA STUDIO (Shorts, Production Kanban, Ideas, AI) */}
        {(activeTab === 'studio' || activeTab === 'production' || activeTab === 'shorts' || activeTab === 'ideas' || activeTab === 'ai') && (
          <div className="flex-1 overflow-y-auto">
            <MediaStudioHub
              tasks={tasks}
              projects={projects}
              stats={stats}
              onToggleTask={handleToggleTask}
              onToggleSubtask={handleToggleSubtask}
              onSnoozeTask={handleSnoozeTask}
              onToggleFocus={handleToggleFocus}
              onAddTask={handleAddTask}
              onOpenAiDecompose={(title) => {
                setAiGoalDraft(title);
                setIsAiMasterOpen(true);
              }}
              onPublishReward={(exp, gold) => awardRewards(exp, gold)}
              onOpenAiMaster={() => setIsAiMasterOpen(true)}
            />
          </div>
        )}

        {/* 3. QUESTS & HABITS BACKLOG */}
        {(activeTab === 'quests' || activeTab === 'tasks' || activeTab === 'habits') && (
          <div className="flex-1 overflow-y-auto">
            <QuestsHub
              tasks={tasks}
              projects={projects}
              stats={stats}
              rewards={rewards}
              onToggleTask={handleToggleTask}
              onToggleSubtask={handleToggleSubtask}
              onAddSubtask={handleAddSubtask}
              onToggleFocus={handleToggleFocus}
              onDeleteTask={handleDeleteTask}
              onTriggerHabit={handleTriggerHabit}
              onToggleDaily={handleToggleDaily}
              onResetDailies={handleResetDailies}
              onUpdateStats={handleUpdateStats}
              onBuyReward={handleBuyReward}
              onAddReward={handleAddReward}
              onOpenQuickAdd={() => setIsQuickAddOpen(true)}
            />
          </div>
        )}

        {/* 4. LIFE OS & ANALYTICS */}
        {(activeTab === 'life' || activeTab === 'bigdata' || activeTab === 'calendar' || activeTab === 'finances') && (
          <div className="flex-1 overflow-y-auto">
            <LifeAnalyticsHub
              tasks={tasks}
              projects={projects}
              calendarConfig={calendarConfig}
              onSyncCalendar={() => {
                setCalendarConfig((prev) => ({
                  ...prev,
                  lastSyncedAt: new Date().toLocaleTimeString(),
                }));
              }}
              onOpenCalendarModal={() => setIsCalendarModalOpen(true)}
              onOpenQuickAdd={() => setIsQuickAddOpen(true)}
              onToggleTask={handleToggleTask}
              onAddGoldReward={(gold) => setStats((prev) => ({ ...prev, gold: prev.gold + gold }))}
              onLogReward={(exp, gold) => awardRewards(exp, gold)}
            />
          </div>
        )}

        {/* 5. TAVERN & REWARDS */}
        {(activeTab === 'tavern' || activeTab === 'team') && (
          <div className="flex-1 overflow-y-auto">
            <TavernHub
              stats={stats}
              rewards={rewards}
              onUpdateStats={handleUpdateStats}
              onBuyReward={handleBuyReward}
              onAddReward={handleAddReward}
            />
          </div>
        )}
      </main>

      {/* 4. Mobile Bottom Floating Nav (TikTok/ShortsFlow style) */}
      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenQuickAdd={() => setIsQuickAddOpen(true)}
        focusCount={focusCount}
      />

      {/* 5. Modals */}
      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        projects={projects}
        onAddTask={handleAddTask}
      />

      <GoogleCalendarModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        config={calendarConfig}
        onSaveConfig={setCalendarConfig}
      />

      <DeviceSyncModal
        isOpen={isDeviceSyncOpen}
        onClose={() => setIsDeviceSyncOpen(false)}
        syncConfig={syncConfig}
        onSaveConfig={setSyncConfig}
        onTriggerSync={() => {
          broadcastStateChange({ stats, tasks, projects, rewards });
        }}
      />

      <AiQuestMasterModal
        isOpen={isAiMasterOpen}
        onClose={() => setIsAiMasterOpen(false)}
        initialGoal={aiGoalDraft}
        projects={projects}
        onAddQuests={handleAddQuestsBatch}
      />

      <LevelUpModal
        isOpen={isLevelUpModalOpen}
        onClose={() => setIsLevelUpModalOpen(false)}
        stats={stats}
      />

      {/* Global Command Palette (Cmd + K) */}
      <GlobalCommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        tasks={tasks}
        projects={projects}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onToggleTask={handleToggleTask}
        onOpenQuickAdd={() => setIsQuickAddOpen(true)}
        onOpenAiMaster={() => setIsAiMasterOpen(true)}
        onExportData={handleExportData}
      />

      {/* Floating Undo Snackbar */}
      <UndoSnackbar
        action={snackbarAction}
        onClose={() => setSnackbarAction(null)}
      />

      {/* Interactive Pomodoro Focus Sprint Widget with Ambient Soundscapes */}
      <PomodoroTimerWidget
        onSprintComplete={awardRewards}
      />



      {/* 6. Cloud Sync Status + Export Button (floating, top-right area) */}
      <div className="fixed top-2 right-2 z-40 flex items-center gap-2">
        {/* Sync status dot */}
        <div
          className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium transition-all
            ${syncStatus === 'synced' ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/40' :
              syncStatus === 'syncing' ? 'bg-blue-950/80 text-blue-300 border border-blue-800/40' :
              syncStatus === 'error' ? 'bg-red-950/80 text-red-400 border border-red-800/40' :
              'bg-white/5 text-white/25 border border-white/10'
            }`}
          title={syncStatus === 'synced' ? 'Данные сохранены в облако' :
                 syncStatus === 'syncing' ? 'Синхронизация...' :
                 syncStatus === 'error' ? 'Ошибка синхронизации' : 'Локальный режим'}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${
            syncStatus === 'synced' ? 'bg-emerald-400' :
            syncStatus === 'syncing' ? 'bg-blue-400 animate-pulse' :
            syncStatus === 'error' ? 'bg-red-400' : 'bg-white/20'
          }`} />
          {syncStatus === 'synced' ? '☁️' :
           syncStatus === 'syncing' ? 'синхр...' :
           syncStatus === 'error' ? '⚠️ ошибка' : '💾 локально'}
        </div>

        {/* Export button */}
        <button
          onClick={handleExportData}
          className="px-2 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-white/40 hover:text-white/70 transition-all"
          title="Экспортировать все данные в JSON"
        >
          ⬇ бэкап
        </button>
      </div>
    </div>
  );
}

// Wrap the entire app in ErrorBoundary and AuthGate for cloud auth & stability
function AppWithAuth() {
  return (
    <ErrorBoundary>
      <AuthGate>
        <App />
      </AuthGate>
    </ErrorBoundary>
  );
}

export default AppWithAuth;


