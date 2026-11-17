import React, { useState, useEffect, useCallback } from 'react';
import { UserStats, TaskItem, Project, Reward, NotificationItem, GoogleCalendarConfig, SubTask, TimeLogEntry } from './types';
import {
  loadNotifications, saveNotifications,
  loadCalendarConfig, saveCalendarConfig
} from './utils/storage';
import {
  loadCloudSyncConfig,
  saveCloudSyncConfig,
  setupBroadcastSync,
  CloudSyncState
} from './utils/cloudSync';
import { useAutoWritesAllowed, useCollectionState, useRecordState, syncNow, type Converter } from './store';
import { runDailyReset } from './sections/today/dailyReset';
import { timeLogConverter } from './store/adapters';
import { AuthGate } from './components/AuthGate';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useSupabaseSync } from './hooks/useSupabaseSync';
import { initialStats } from './data/initialData';


import { Header } from './components/Header';
import { Navigation, SECTION_TITLES } from './components/Navigation';
import { MobileBottomNav } from './components/MobileBottomNav';
import { getSection, resolveTab, type TabType } from './sections/routes';
import type { SectionContext } from './sections/types';
import { TodaySection } from './sections/today';
import { GoalsSection } from './sections/goals';
import { ChannelsSection } from './sections/channels';
import { HealthSection } from './sections/health';
import { ProgressSection } from './sections/progress';
import { QuickAddModal } from './components/QuickAddModal';
import { GoogleCalendarModal } from './components/GoogleCalendarModal';
import { DeviceSyncModal } from './components/DeviceSyncModal';
import { AiQuestMasterModal } from './components/AiQuestMasterModal';
import { LevelUpModal } from './components/LevelUpModal';
import { GlobalCommandPalette } from './components/GlobalCommandPalette';
import { UndoSnackbar, SnackbarAction } from './components/UndoSnackbar';
import { TogglTimerBar } from './components/TogglTimerBar';
import { HealthBioTracker } from './components/HealthBioTracker';
import { TaskEditModal } from './components/TaskEditModal';
import { playLevelUpSound } from './utils/sound';
import { triggerLevelUpConfetti } from './utils/confetti';
import { createGoogleCalendarTimeLogEvent } from './utils/googleCalendarApi';
import { selectRegularTasks, selectShoppingTasks, makeTask, type TaskKind } from './utils/taskFilters';
import { todayStr } from '@shared/time';
import { WORK_MIN } from '@shared/timer';
import { ACHIEVEMENTS, type ApplyResult } from '@shared/gamification';
import { applyGame, syncGameFacts, logSessionOnce, resetGameStats, GAME_EVENT } from './sections/progress/game';
import { 
  loadRecoveryCycleConfig, 
  getDayCycleInfo, 
  getTodayStr, 
  sendDesktopNotification 
} from './utils/recoveryCycle';




// Задачи из облака могут прийти без массивов (бот пишет только нужные поля) — подставляем пустые
const taskConverter: Converter<TaskItem, TaskItem> = {
  toApp: (t) => ({ ...t, tags: t.tags ?? [], subtasks: t.subtasks ?? [] }),
  fromApp: (t) => t,
};

/** Поля статов, которые меняют только правила (shared/gamification) */
const GAME_FIELDS = ['level', 'exp', 'maxExp', 'hp', 'maxHp', 'gold', 'streak', 'bestStreak', 'incomeUsdTotal', 'shopLocked'] as const;

export function App() {
  // Core State — хранилище src/store (локальный кеш + очередь в Supabase + Realtime)
  const [stats, setStats] = useRecordState<UserStats>('game_stats', initialStats);
  const [tasks, setTasks] = useCollectionState<TaskItem>('tasks2', taskConverter);
  const [projects, setProjects] = useCollectionState<Project>('projects2');
  const [rewards, setRewards] = useCollectionState<Reward>('rewards2');
  const [notifications, setNotifications] = useState<NotificationItem[]>(loadNotifications);
  const [calendarConfig, setCalendarConfig] = useState<GoogleCalendarConfig>(loadCalendarConfig);
  const [syncConfig, setSyncConfig] = useState<CloudSyncState>(loadCloudSyncConfig);

  // Time Tracking State (Toggl Track Style)
  const [timeLogs, setTimeLogs] = useCollectionState('focus_sessions', timeLogConverter);

  // Active Navigation Tab (Defaults to Today Command Center)
  // Старые ссылки (?tab=shopping, ?tab=bigdata) открывают новое место; удалённые разделы открывают «Сегодня»
  const [activeTab, setActiveTab] = useState<TabType>(() => resolveTab(new URLSearchParams(window.location.search).get('tab')));

  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddKind, setQuickAddKind] = useState<TaskKind>('task');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isDeviceSyncOpen, setIsDeviceSyncOpen] = useState(false);
  const [isAiMasterOpen, setIsAiMasterOpen] = useState(false);
  const [isLevelUpModalOpen, setIsLevelUpModalOpen] = useState(false);
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [snackbarAction, setSnackbarAction] = useState<SnackbarAction | null>(null);

  // Окно добавления: без аргумента — задача, 'shopping' — покупка (вкладка «Покупки»)
  const openQuickAdd = useCallback((kind: TaskKind = 'task') => {
    setQuickAddKind(kind);
    setIsQuickAddOpen(true);
  }, []);


  // ─── Статус облачной синхронизации (сам синк — в src/store) ────────────────
  const { syncStatus } = useSupabaseSync();

  // ─── Auto Daily Reset at Midnight ────────────────────────────────────────
  // Автозапись: ждёт, пока облако прочитано (иначе старый кеш воскресил бы удалённые задачи)
  const autoWritesAllowed = useAutoWritesAllowed();
  useEffect(() => {
    if (!autoWritesAllowed) return;
    const LAST_RESET_KEY = 'questflow_last_daily_reset';
    const today = todayStr();
    const lastReset = localStorage.getItem(LAST_RESET_KEY);

    if (runDailyReset(today, lastReset)) {
      // Серию считает итог дня (shared/gamification), а не открытие сайта
      localStorage.setItem(LAST_RESET_KEY, today);
      setNotifications((prev) => [
        {
          id: `auto-reset-${Date.now()}`,
          title: '🌅 Новый День!',
          message: 'Ежедневные задачи сброшены автоматически.',
          time: new Date().toLocaleTimeString(),
          type: 'reminder',
          read: false,
        },
        ...prev,
      ]);
    }
  }, [autoWritesAllowed]);

  // ─── Safe 1-Click Export & Backup ─────────────────────────────────────────
  const handleExportData = useCallback(() => {
    const backupData: Record<string, unknown> = {
      source: 'questflow_full_backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      stats,
      tasks,
      projects,
      rewards,
      notifications,
      calendarConfig,
      timeLogs,
      localStorage: {} as Record<string, string | null>,
    };
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('questflow_'))
        .forEach((k) => {
          (backupData.localStorage as Record<string, string | null>)[k] = localStorage.getItem(k);
        });
    } catch {
      // ignore
    }
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `questflow-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [stats, tasks, projects, rewards, notifications, calendarConfig, timeLogs]);

  // ─── Safe 1-Click Import & Restore ────────────────────────────────────────
  const handleImportData = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);

        if (parsed.stats) {
          setStats(parsed.stats);
        }
        if (Array.isArray(parsed.tasks)) {
          setTasks(parsed.tasks);
        }
        if (Array.isArray(parsed.projects)) {
          setProjects(parsed.projects);
        }
        if (Array.isArray(parsed.rewards)) {
          setRewards(parsed.rewards);
        }
        if (Array.isArray(parsed.notifications)) {
          setNotifications(parsed.notifications);
          saveNotifications(parsed.notifications);
        }
        if (Array.isArray(parsed.timeLogs)) {
          setTimeLogs(parsed.timeLogs);
        }
        if (parsed.calendarConfig) {
          setCalendarConfig(parsed.calendarConfig);
          saveCalendarConfig(parsed.calendarConfig);
        }

        if (parsed.localStorage && typeof parsed.localStorage === 'object') {
          Object.entries(parsed.localStorage).forEach(([k, v]) => {
            if (typeof v === 'string') localStorage.setItem(k, v);
          });
        } else if (parsed.questflow_tasks_v1) {
          Object.entries(parsed).forEach(([k, v]) => {
            if (k.startsWith('questflow_')) {
              localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
            }
          });
          if (Array.isArray(parsed.questflow_tasks_v1)) setTasks(parsed.questflow_tasks_v1);
          if (parsed.questflow_stats_v1) setStats(parsed.questflow_stats_v1);
          if (Array.isArray(parsed.questflow_projects_v1)) setProjects(parsed.questflow_projects_v1);
          if (Array.isArray(parsed.questflow_rewards_v1)) setRewards(parsed.questflow_rewards_v1);
        }

        alert('✅ Резервная копия успешно загружена! Все задачи, проекты и статистика восстановлены.');
      } catch (err) {
        console.error('Failed to import backup:', err);
        alert('❌ Ошибка при чтении файла резервной копии. Проверьте правильность файла .json.');
      }
    };
    reader.readAsText(file);
  }, []);

  // Задачи, статы, проекты, награды и записи таймера сохраняет src/store (и вкладки синхронизирует он же)
  useEffect(() => { saveNotifications(notifications); }, [notifications]);
  useEffect(() => { saveCalendarConfig(calendarConfig); }, [calendarConfig]);
  useEffect(() => { saveCloudSyncConfig(syncConfig); }, [syncConfig]);

  // Setup live BroadcastChannel for multi-device / multi-tab synchronization
  useEffect(() => {
    setupBroadcastSync(() => {
      // Данные между вкладками синхронизирует src/store; канал остаётся для кода сопряжения
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
        openQuickAdd();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openQuickAdd]);


  // Настройки профиля (звук и т.п.). Игровые числа здесь не меняются: только через applyGame и правила.
  const handleUpdateStats = (newStats: Partial<UserStats>) => {
    const patch: Record<string, unknown> = { ...newStats };
    for (const k of GAME_FIELDS) delete patch[k];
    if (Object.keys(patch).length === 0) return;
    setStats((prev) => ({ ...prev, ...patch }));
  };

  // ─── 7+1 Active Recovery Cycle Notification Check ──────────────────────────
  useEffect(() => {
    const today = getTodayStr();
    const config = loadRecoveryCycleConfig();
    const cycle = getDayCycleInfo(today, config);

    // 1. Advance notification (24 hours before recovery day, on day 7)
    if (cycle.isTomorrowRecovery && !cycle.isRecoveryDay) {
      const lastAlert = localStorage.getItem('questflow_last_recovery_24h_alert');
      if (lastAlert !== today) {
        localStorage.setItem('questflow_last_recovery_24h_alert', today);
        sendDesktopNotification(
          '🧖‍♂️ Завтра День Активного Восстановления!',
          'Подготовьтесь к дню без интернета и гаджетов: сауна с бассейном, природа и медитация.'
        );
        setNotifications((prev) => [
          {
            id: `notif-recovery-24h-${today}`,
            title: '🧖‍♂️ Завтра День Активного Восстановления!',
            message: 'Завтра полный цифровой детокс без гаджетов. Завершите срочные дела и запланируйте сауну, бассейн, прогулку в парке и медитацию.',
            time: new Date().toLocaleTimeString(),
            type: 'reminder',
            read: false,
          },
          ...prev,
        ]);
      }
    }

    // 2. Day 8 Active Recovery Morning Alert
    if (cycle.isRecoveryDay) {
      const lastAlert = localStorage.getItem('questflow_last_recovery_today_alert');
      if (lastAlert !== today) {
        localStorage.setItem('questflow_last_recovery_today_alert', today);
        sendDesktopNotification(
          '🛑 Сегодня День Активного Восстановления (Цифровой Детокс)!',
          'Уберите гаджеты и идите в баню! Закройте экраны: только сауна, бассейн, природа и медитация.'
        );
        setNotifications((prev) => [
          {
            id: `notif-recovery-today-${today}`,
            title: '🛑 День активного восстановления (Детокс)!',
            message: 'Сегодня день без интернета и гаджетов. Таймер заблокирован. Уберите экраны и посвятите день здоровью, сауне, бассейну и природе.',
            time: new Date().toLocaleTimeString(),
            type: 'reminder',
            read: false,
          },
          ...prev,
        ]);
      }
    }
  }, []);

  // Награды и штрафы считает shared/gamification через applyGame (src/sections/progress/game.ts).
  // Классов героя с множителями больше нет. Ответ на событие (уровень, HP 0, ачивки) — здесь.
  useEffect(() => {
    const onGame = (e: Event) => {
      const r = (e as CustomEvent<ApplyResult>).detail;
      if (!r) return;
      if (r.leveledUp > 0) {
        if (stats.soundEnabled) playLevelUpSound();
        triggerLevelUpConfetti();
        setIsLevelUpModalOpen(true);
      }
      const notes: NotificationItem[] = [];
      if (r.hpZero) {
        notes.push({
          id: `hp-zero-${Date.now()}`,
          title: 'HP 0',
          message: 'Сгорела часть золота, прогресс уровня обнулён, серия сброшена. Магазин закрыт до полного дня.',
          time: new Date().toLocaleTimeString(),
          type: 'damage',
          read: false,
        });
      }
      for (const id of r.unlocked) {
        const a = ACHIEVEMENTS.find((x) => x.id === id);
        notes.push({
          id: `ach-${id}`,
          title: `Ачивка: ${a?.title ?? id}`,
          message: a?.description ?? '',
          time: new Date().toLocaleTimeString(),
          type: 'reward',
          read: false,
        });
      }
      if (notes.length) setNotifications((prev) => [...notes, ...prev]);
    };
    window.addEventListener(GAME_EVENT, onGame);
    return () => window.removeEventListener(GAME_EVENT, onGame);
  }, [stats.soundEnabled]);

  // Итоги прошедших дней, цели, публикации, ачивки по фактам — при открытии и раз в минуту
  // Автозапись: syncGameFacts сам ничего не пишет, пока облако не прочитано; после чтения — сразу
  useEffect(() => {
    if (!autoWritesAllowed) return;
    syncGameFacts();
    const t = window.setInterval(() => syncGameFacts(), 60_000);
    return () => window.clearInterval(t);
  }, [autoWritesAllowed]);

  // Handle Session Logged from Toggl Timer
  const handleLogSession = async (entry: TimeLogEntry) => {
    // Тот же id (блок уже записан другой вкладкой) заменяет строку, а не добавляет дубль
    setTimeLogs((prev) => logSessionOnce(prev, entry));

    // Награда за блок — по правилам; повтор того же блока ничего не начисляет
    if (entry.mode === 'work' && entry.actualMinutes > 0) {
      applyGame({
        kind: 'focus_block',
        ref: entry.id,
        minutes: entry.actualMinutes,
        full: entry.actualMinutes >= (entry.targetMinutes || WORK_MIN),
      });
    }

    // Direct Google Calendar Sync if connected & active
    if (calendarConfig.connected && calendarConfig.accessToken && calendarConfig.autoSync) {
      try {
        const gEventId = await createGoogleCalendarTimeLogEvent(entry, calendarConfig.accessToken);
        if (gEventId) {
          setTimeLogs((prev) =>
            prev.map((l) => (l.id === entry.id ? { ...l, googleCalendarEventId: gEventId } : l))
          );
        }
      } catch (err) {
        console.error('Error auto-syncing time log to Google Calendar:', err);
      }
    }

    setNotifications((prev) => [
      {
        id: `timelog-${Date.now()}`,
        title: entry.mode === 'work' ? '⚔️ Фокус-сессия записана в календарь!' : '☕ Перерыв завершён',
        message: `${entry.title} (${entry.actualMinutes} мин)${entry.expEarned ? ` • +${entry.expEarned} EXP, +${entry.goldEarned}G` : ''}`,
        time: new Date().toLocaleTimeString(),
        type: 'reward',
        read: false,
      },
      ...prev,
    ]);
  };

  // Reset All Farmed Stats & Progress (Fresh Start)
  const handleResetAllProgress = () => {
    const freshStats: UserStats = { ...initialStats };

    // Сбрасываются только статы (уровень, EXP, золото), как обещает окно подтверждения.
    // Задачи и награды не трогаем: они в облаке и у бота (задачи пользователя — единственный источник правды)
    resetGameStats(freshStats);
    localStorage.removeItem('questflow_stats_v1');

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
        return {
          ...t,
          completed: willComplete,
          completedAt: willComplete ? new Date().toISOString() : undefined,
          stage: willComplete ? 'done' : 'in_progress',
        };
      })
    );

    // Награда вне апдейтера; одна задача награждается один раз (ref = id задачи)
    if (willComplete && target) applyGame({ kind: 'task', ref: taskId });

    if (willComplete && target) {
      setSnackbarAction({
        id: `undo-comp-${Date.now()}`,
        message: `Завершено: «${target.title.slice(0, 28)}»`,
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
      // Привычка награждается один раз за день
      applyGame({ kind: 'habit', ref: `${todayStr()}:${taskId}` });
    } else {
      const r = applyGame({ kind: 'bad_habit', ref: `${taskId}:${Date.now()}` });
      const damageTaken = -(r.events[0]?.deltaHp ?? 0);
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
    const target = tasks.find((t) => t.id === taskId);
    // Ежедневное награждается один раз за день, вне апдейтера
    if (target && !target.completed) applyGame({ kind: 'daily', ref: `${todayStr()}:${taskId}` });
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const willComplete = !t.completed;
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
    setNotifications((prev) => [
      {
        id: `streak-${Date.now()}`,
        title: '🔥 Новый День!',
        message: 'Статус ежедневных квестов обновлен.',
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


  // Add Task / Shopping item
  const handleAddTask = (newTask: Partial<TaskItem> & { title: string; kind?: TaskKind }) => {
    const { kind, ...fields } = newTask;
    setTasks((prev) => [
      makeTask(fields, { id: `task-${Date.now()}`, projectId: projects[0]?.id || 'proj-inbox', kind }),
      ...prev,
    ]);
  };

  // Update Task fields (dueDate, priority, title, notes, etc.)
  const handleUpdateTask = (taskId: string, patch: Partial<TaskItem>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t))
    );
  };

  // Add Batch of Quests from AI
  const handleAddQuestsBatch = (newQuests: Omit<TaskItem, 'id' | 'completed'>[]) => {
    const tasksToAdd: TaskItem[] = newQuests.map((q, idx) => {
      const { inFocusFlow: _removed, ...quest } = q; // поле Flow Shorts больше не пишем
      return { ...quest, id: `task-ai-${Date.now()}-${idx}`, completed: false };
    });
    setTasks((prev) => [...tasksToAdd, ...prev]);
    setActiveTab('goals');
  };

  // Buy Reward from Shop
  const handleBuyReward = (reward: Reward): boolean => {
    // Магазин закрыт после HP 0 до полного дня; золото списывают правила
    const r = applyGame({ kind: 'purchase', ref: `${reward.id}:${Date.now()}`, cost: reward.cost });
    if (!r.applied) return false;

    setRewards((prev) =>
      prev.map((r) => (r.id === reward.id ? { ...r, timesPurchased: (r.timesPurchased || 0) + 1 } : r))
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

  // Покупки отделены один раз здесь: все экраны, кроме вкладки «Покупки», получают только обычные задачи
  const today = todayStr();
  const regularTasks = selectRegularTasks(tasks);
  const shoppingTasks = selectShoppingTasks(tasks);
  const dueTodayCount = regularTasks.filter((t) => !t.completed && (t.dueDate === today || t.type === 'daily')).length;
  const shoppingCount = shoppingTasks.filter((t) => !t.completed).length;

  const section = getSection(activeTab);

  const sectionContext: SectionContext = {
    tasks: regularTasks,
    shoppingTasks,
    projects,
    stats,
    rewards,
    timeLogs,
    calendarConfig,
    shoppingCount,
    onToggleTask: handleToggleTask,
    onToggleSubtask: handleToggleSubtask,
    onAddSubtask: handleAddSubtask,
    onTriggerHabit: handleTriggerHabit,
    onToggleDaily: handleToggleDaily,
    onAddTask: handleAddTask,
    onUpdateTask: handleUpdateTask,
    onEditTask: (task) => setEditingTask(task),
    onDeleteTask: handleDeleteTask,
    onBuyReward: handleBuyReward,
    onAddReward: handleAddReward,
    onUpdateStats: handleUpdateStats,
    onAddNotification: (n) => setNotifications((prev) => [n, ...prev]),
    onSyncCalendar: () => {
      setCalendarConfig((prev) => ({ ...prev, lastSyncedAt: new Date().toLocaleTimeString() }));
    },
    onOpenCalendarModal: () => setIsCalendarModalOpen(true),
    onOpenQuickAdd: openQuickAdd,
    onOpenHealthModal: () => setIsHealthModalOpen(true),
    onOpenTab: setActiveTab,
  };

  return (
    <div className="h-screen bg-[#09090c] text-white flex font-sans selection:bg-purple-500 selection:text-white overflow-hidden">

      {/* 1. Боковая навигация (Mac / широкий экран): 5 разделов */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        dueTodayCount={dueTodayCount}
      />

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden pb-16 md:pb-0">

      {/* 2. Шапка: название раздела, строка прогресса, синхронизация, настройки */}
      <Header
        title={SECTION_TITLES[section]}
        syncStatus={syncStatus}
        stats={stats}
        onUpdateStats={handleUpdateStats}
        onOpenQuickAdd={() => openQuickAdd()}
        onOpenSearch={() => setIsCommandPaletteOpen(true)}
        onOpenCalendarModal={() => setIsCalendarModalOpen(true)}
        onOpenDeviceSyncModal={() => setIsDeviceSyncOpen(true)}
        onResetProgress={handleResetAllProgress}
        onExportData={handleExportData}
        onImportData={handleImportData}
        notifications={notifications}
        onMarkNotificationsRead={handleMarkNotificationsRead}
        calendarConfig={calendarConfig}
      />

      {/* 2.5 Toggl Track Style Time Tracker Bar (Focus 120m / Break 20m) */}
      <TogglTimerBar
        tasks={regularTasks}
        projects={projects}
        onLogSession={handleLogSession}
        onCompleteTask={handleToggleTask}
        isCalendarConnected={Boolean(calendarConfig.connected && calendarConfig.accessToken)}
      />

      {/* 3. Разделы: каждый живёт в своей папке src/sections/<id>/ */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {section === 'today' && <TodaySection ctx={sectionContext} />}
        {section === 'goals' && (
          <div className="flex-1 overflow-y-auto">
            <GoalsSection ctx={sectionContext} tab={activeTab} />
          </div>
        )}
        {section === 'channels' && (
          <div className="flex-1 overflow-y-auto">
            <ChannelsSection ctx={sectionContext} />
          </div>
        )}
        {section === 'health' && (
          <div className="flex-1 overflow-y-auto">
            <HealthSection ctx={sectionContext} tab={activeTab} />
          </div>
        )}
        {section === 'progress' && (
          <div className="flex-1 overflow-y-auto">
            <ProgressSection ctx={sectionContext} tab={activeTab} />
          </div>
        )}
      </main>

      </div>

      {/* 4. Нижняя навигация (телефон) */}
      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenQuickAdd={() => openQuickAdd()}
      />

      {/* 5. Modals */}
      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        projects={projects}
        onAddTask={handleAddTask}
        kind={quickAddKind}
        blockedMessage={
          isQuickAddOpen && getDayCycleInfo(getTodayStr(), loadRecoveryCycleConfig()).isRecoveryDay
            ? 'Сегодня день отдыха. Уберите гаджеты и идите в баню!'
            : undefined
        }
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
          void syncNow();
        }}
      />

      <AiQuestMasterModal
        isOpen={isAiMasterOpen}
        onClose={() => setIsAiMasterOpen(false)}
        initialGoal=""
        projects={projects}
        onAddQuests={handleAddQuestsBatch}
      />

      <LevelUpModal
        isOpen={isLevelUpModalOpen}
        onClose={() => setIsLevelUpModalOpen(false)}
        stats={stats}
      />

      {/* Bio-Health & Alarm Center Modal */}
      {isHealthModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#101014] border border-rose-500/30 rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-zinc-900/60">
              <div className="flex items-center gap-2">
                <span className="text-xl">❤️</span>
                <span className="font-bold text-sm text-white">Центр Био-Здоровья & Ресурса HP</span>
              </div>
              <button
                onClick={() => setIsHealthModalOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <HealthBioTracker
                stats={stats}
                onUpdateStats={handleUpdateStats}
                onAddNotification={(n) => setNotifications((prev) => [n, ...prev])}
              />
            </div>
          </div>
        </div>
      )}

      {/* Habitica-Style Task Edit Modal (Title, Notes, Checklist with Subtasks & Deadlines) */}
      <TaskEditModal
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        task={editingTask}
        onSave={(updatedTask) => {
          handleUpdateTask(updatedTask.id, updatedTask);
          setEditingTask(null);
        }}
        onDelete={(taskId) => {
          handleDeleteTask(taskId);
          setEditingTask(null);
        }}
      />

      {/* Global Command Palette (Cmd + K) */}
      <GlobalCommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        tasks={regularTasks}
        projects={projects}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onToggleTask={handleToggleTask}
        onOpenQuickAdd={() => openQuickAdd()}
        onOpenAiMaster={() => setIsAiMasterOpen(true)}
        onExportData={handleExportData}
      />

      {/* Floating Undo Snackbar */}
      <UndoSnackbar
        action={snackbarAction}
        onClose={() => setSnackbarAction(null)}
      />
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


