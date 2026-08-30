import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { UserStats, TaskItem, Project, Reward, Boss } from '../types';

export interface CloudSyncState {
  enabled: boolean;
  syncCode: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  lastSyncedAt?: string;
  status: 'disconnected' | 'connecting' | 'synced' | 'error';
}

const CLOUD_SYNC_KEY = 'questflow_cloud_sync_config_v1';

export function loadCloudSyncConfig(): CloudSyncState {
  try {
    const data = localStorage.getItem(CLOUD_SYNC_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error(e);
  }
  // Generate random 6-digit sync code for instant device pairing
  const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
  return {
    enabled: false,
    syncCode: randomCode,
    status: 'disconnected',
  };
}

export function saveCloudSyncConfig(config: CloudSyncState) {
  try {
    localStorage.setItem(CLOUD_SYNC_KEY, JSON.stringify(config));
  } catch (e) {
    console.error(e);
  }
}

// Helper to get Supabase client if configured
let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(url?: string, key?: string): SupabaseClient | null {
  if (url && key) {
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

// Broadcast channel for real-time local sync across browser tabs / windows
let syncChannel: BroadcastChannel | null = null;

export function setupBroadcastSync(onRemoteUpdate: (payload: any) => void) {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    if (!syncChannel) {
      syncChannel = new BroadcastChannel('questflow_device_sync');
      syncChannel.onmessage = (event) => {
        if (event.data && event.data.type === 'STATE_UPDATE') {
          onRemoteUpdate(event.data.payload);
        }
      };
    }
  }
}

export function broadcastStateChange(payload: {
  stats?: UserStats;
  tasks?: TaskItem[];
  projects?: Project[];
  rewards?: Reward[];
  boss?: Boss;
}) {
  if (syncChannel) {
    syncChannel.postMessage({
      type: 'STATE_UPDATE',
      payload,
      timestamp: Date.now(),
    });
  }
}
