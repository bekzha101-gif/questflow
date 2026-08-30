import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured, getSupabaseCredentials } from '../lib/supabase';
import type { UserStats, TaskItem, Project, Reward } from '../types';

type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';

interface PulledData {
  stats?: UserStats;
  tasks?: TaskItem[];
  projects?: Project[];
  rewards?: Reward[];
}

interface UseSupabaseSyncReturn {
  userId: string | null;
  syncStatus: SyncStatus;
  pushStats: (stats: UserStats) => void;
  pushTasks: (tasks: TaskItem[]) => void;
  pushProjects: (projects: Project[]) => void;
  pushRewards: (rewards: Reward[]) => void;
  pullAll: () => Promise<PulledData>;
  exportAllData: () => Promise<string>;
}

// ─── Raw REST helper (bypasses typed client completely) ────────────────────
// Uses Supabase PostgREST API directly via fetch to avoid TypeScript generics issues
async function sbUpsert(table: string, rows: object | object[], onConflict?: string): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) return false;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;

  const { url: supabaseUrl, anonKey } = getSupabaseCredentials();
  if (!supabaseUrl || !anonKey) return false;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
    'apikey': anonKey,
    'Prefer': `resolution=merge-duplicates`,
  };

  if (onConflict) {
    headers['Prefer'] = `resolution=merge-duplicates,return=minimal`;
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(rows),
  });

  return res.ok;
}

async function sbSelect(table: string, userId: string): Promise<unknown[]> {
  if (!supabase || !isSupabaseConfigured) return [];

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];

  const { url: supabaseUrl, anonKey } = getSupabaseCredentials();
  if (!supabaseUrl || !anonKey) return [];

  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?user_id=eq.${userId}&select=*`, {
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': anonKey,
    },
  });

  if (!res.ok) return [];
  return res.json();
}


async function sbSelectSingle(table: string, userId: string): Promise<unknown | null> {
  const rows = await sbSelect(table, userId);
  return rows[0] ?? null;
}
// ──────────────────────────────────────────────────────────────────────────────

/**
 * useSupabaseSync — bridge between app state and Supabase.
 * Uses raw fetch to REST API to avoid TypeScript generic conflicts.
 * Falls back to no-op if Supabase is not configured (localStorage-only mode).
 */
export function useSupabaseSync(): UseSupabaseSyncReturn {
  const [userId, setUserId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) return;

    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const debounce = useCallback((fn: () => Promise<void>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSyncStatus('syncing');
      try {
        await fn();
        setSyncStatus('synced');
      } catch {
        setSyncStatus('error');
      }
    }, 800);
  }, []);

  // ─── Push Stats ──────────────────────────────────────────────────────────
  const pushStats = useCallback((stats: UserStats) => {
    if (!isSupabaseConfigured || !userId) return;
    debounce(async () => {
      await sbUpsert('user_stats', {
        user_id: userId,
        level: stats.level,
        exp: stats.exp,
        max_exp: stats.maxExp,
        hp: stats.hp,
        max_hp: stats.maxHp,
        gold: stats.gold,
        streak: stats.streak,
        title: stats.title,
        hero_class: stats.heroClass,
        avatar_url: stats.avatarUrl,
        sound_enabled: stats.soundEnabled,
      }, 'user_id');
    });
  }, [userId, debounce]);

  // ─── Push Tasks ───────────────────────────────────────────────────────────
  const pushTasks = useCallback((tasks: TaskItem[]) => {
    if (!isSupabaseConfigured || !userId) return;
    debounce(async () => {
      const rows = tasks.map(t => ({
        id: t.id,
        user_id: userId,
        title: t.title,
        description: t.description ?? null,
        type: t.type,
        priority: t.priority,
        project_id: t.projectId,
        tags: t.tags,
        difficulty: t.difficulty,
        exp_reward: t.expReward,
        gold_reward: t.goldReward,
        completed: t.completed,
        completed_at: t.completedAt ?? null,
        due_date: t.dueDate ?? null,
        due_time: t.dueTime ?? null,
        duration_minutes: t.durationMinutes ?? null,
        recurrence: t.recurrence ?? null,
        streak_count: t.streakCount ?? 0,
        habit_direction: t.habitDirection ?? null,
        habit_counter: t.habitCounter ?? 0,
        subtasks: t.subtasks,
        google_calendar_event_id: t.googleCalendarEventId ?? null,
        in_focus_flow: t.inFocusFlow ?? false,
        stage: t.stage ?? null,
      }));
      await sbUpsert('tasks', rows, 'id');
    });
  }, [userId, debounce]);

  // ─── Push Projects ────────────────────────────────────────────────────────
  const pushProjects = useCallback((projects: Project[]) => {
    if (!isSupabaseConfigured || !userId) return;
    debounce(async () => {
      const rows = projects.map(p => ({
        id: p.id,
        user_id: userId,
        name: p.name,
        color: p.color,
        icon: p.icon,
        is_favorite: p.isFavorite ?? false,
      }));
      await sbUpsert('projects', rows, 'id');
    });
  }, [userId, debounce]);

  // ─── Push Rewards ─────────────────────────────────────────────────────────
  const pushRewards = useCallback((rewards: Reward[]) => {
    if (!isSupabaseConfigured || !userId) return;
    debounce(async () => {
      const rows = rewards.map(r => ({
        id: r.id,
        user_id: userId,
        title: r.title,
        cost: r.cost,
        type: r.type,
        icon: r.icon,
        description: r.description,
        times_purchased: r.timesPurchased,
        buff_effect: r.buffEffect ?? null,
      }));
      await sbUpsert('rewards', rows, 'id');
    });
  }, [userId, debounce]);

  // ─── Pull All (initial load from cloud) ───────────────────────────────────
  const pullAll = useCallback(async (): Promise<PulledData> => {
    if (!isSupabaseConfigured || !userId) return {};

    setSyncStatus('syncing');

    const [sRow, taskRows, projectRows, rewardRows] = await Promise.all([
      sbSelectSingle('user_stats', userId),
      sbSelect('tasks', userId),
      sbSelect('projects', userId),
      sbSelect('rewards', userId),
    ]);

    setSyncStatus('synced');

    const result: PulledData = {};

    if (sRow) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = sRow as any;
      result.stats = {
        level: s.level, exp: s.exp, maxExp: s.max_exp,
        hp: s.hp, maxHp: s.max_hp, gold: s.gold,
        streak: s.streak, title: s.title, heroClass: s.hero_class,
        avatarUrl: s.avatar_url, soundEnabled: s.sound_enabled,
      };
    }

    if (taskRows.length) {
      result.tasks = taskRows.map((t) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = t as any;
        return {
          id: r.id, title: r.title, description: r.description ?? undefined,
          type: r.type, priority: r.priority, projectId: r.project_id,
          tags: r.tags ?? [], difficulty: r.difficulty,
          expReward: r.exp_reward, goldReward: r.gold_reward,
          completed: r.completed, completedAt: r.completed_at ?? undefined,
          dueDate: r.due_date ?? undefined, dueTime: r.due_time ?? undefined,
          durationMinutes: r.duration_minutes ?? undefined,
          recurrence: r.recurrence ?? undefined,
          streakCount: r.streak_count ?? 0, habitDirection: r.habit_direction ?? undefined,
          habitCounter: r.habit_counter ?? 0,
          subtasks: (r.subtasks as Array<{ id: string; text: string; completed: boolean }>) ?? [],
          googleCalendarEventId: r.google_calendar_event_id ?? undefined,
          inFocusFlow: r.in_focus_flow ?? false, stage: r.stage ?? undefined,
        } as TaskItem;
      });
    }

    if (projectRows.length) {
      result.projects = projectRows.map((p) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = p as any;
        return { id: r.id, name: r.name, color: r.color, icon: r.icon, isFavorite: r.is_favorite ?? false } as Project;
      });
    }

    if (rewardRows.length) {
      result.rewards = rewardRows.map((rw) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = rw as any;
        return {
          id: r.id, title: r.title, cost: r.cost, type: r.type,
          icon: r.icon, description: r.description, timesPurchased: r.times_purchased,
          buffEffect: r.buff_effect ?? undefined,
        } as Reward;
      });
    }

    return result;
  }, [userId]);

  // ─── Export All Data as JSON ──────────────────────────────────────────────
  const exportAllData = useCallback(async (): Promise<string> => {
    if (!isSupabaseConfigured || !userId) {
      const allKeys = Object.keys(localStorage).filter(k => k.startsWith('questflow_'));
      const data: Record<string, unknown> = { source: 'localStorage', exportedAt: new Date().toISOString() };
      for (const key of allKeys) {
        try { data[key] = JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { /* skip */ }
      }
      return JSON.stringify(data, null, 2);
    }

    const [stats, tasks, projects, rewards, bigData] = await Promise.all([
      sbSelect('user_stats', userId),
      sbSelect('tasks', userId),
      sbSelect('projects', userId),
      sbSelect('rewards', userId),
      sbSelect('big_data_days', userId),
    ]);

    return JSON.stringify({
      source: 'supabase', exportedAt: new Date().toISOString(), userId,
      stats, tasks, projects, rewards, bigDataDays: bigData,
    }, null, 2);
  }, [userId]);

  return { userId, syncStatus, pushStats, pushTasks, pushProjects, pushRewards, pullAll, exportAllData };
}
