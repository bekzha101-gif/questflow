import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// ─── Supabase Dynamic Configuration ──────────────────────────────────────────
// Checks environment variables first, then localStorage fallback
export function getSupabaseCredentials() {
  const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  const localUrl = typeof window !== 'undefined' ? localStorage.getItem('questflow_supabase_url') : null;
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('questflow_supabase_anon_key') : null;

  const url = (envUrl && envUrl !== 'https://placeholder.supabase.co' ? envUrl : localUrl) || '';
  const anonKey = (envKey && !envKey.includes('placeholder') ? envKey : localKey) || '';

  return { url, anonKey };
}

export function setSupabaseCredentials(url: string, anonKey: string) {
  if (typeof window !== 'undefined') {
    if (url && anonKey) {
      localStorage.setItem('questflow_supabase_url', url.trim());
      localStorage.setItem('questflow_supabase_anon_key', anonKey.trim());
    } else {
      localStorage.removeItem('questflow_supabase_url');
      localStorage.removeItem('questflow_supabase_anon_key');
    }
  }
}

const { url: supabaseUrl, anonKey: supabaseAnonKey } = getSupabaseCredentials();

export const isSupabaseConfigured =
  !!supabaseUrl &&
  supabaseUrl.startsWith('https://') &&
  supabaseUrl.includes('.supabase.co') &&
  !!supabaseAnonKey &&
  supabaseAnonKey.length > 20;

export const supabase = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

export type SupabaseClient = typeof supabase;
