// ─── QuestFlow Database Schema Types ────────────────────────────────────────
// Matches the SQL in supabase/migrations/001_initial.sql
// ─────────────────────────────────────────────────────────────────────────────

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      user_stats: {
        Row: {
          id: string;
          user_id: string;
          level: number;
          exp: number;
          max_exp: number;
          hp: number;
          max_hp: number;
          gold: number;
          streak: number;
          title: string;
          hero_class: 'Warrior' | 'Mage' | 'Rogue' | 'Healer';
          avatar_url: string;
          sound_enabled: boolean;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_stats']['Row'], 'updated_at'>;
        Update: Partial<Database['public']['Tables']['user_stats']['Insert']>;
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          type: 'habit' | 'daily' | 'todo';
          priority: 'p1' | 'p2' | 'p3' | 'p4';
          project_id: string;
          tags: string[];
          difficulty: 'trivial' | 'easy' | 'medium' | 'hard' | 'epic';
          exp_reward: number;
          gold_reward: number;
          completed: boolean;
          completed_at: string | null;
          due_date: string | null;
          due_time: string | null;
          duration_minutes: number | null;
          recurrence: 'none' | 'daily' | 'weekdays' | 'weekly' | 'custom' | null;
          streak_count: number;
          habit_direction: 'positive' | 'negative' | 'both' | null;
          habit_counter: number;
          subtasks: Json;
          google_calendar_event_id: string | null;
          in_focus_flow: boolean;
          stage: 'backlog' | 'in_progress' | 'review' | 'done' | null;
          last_reset_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['tasks']['Row'],
          'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>;
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          icon: string;
          is_favorite: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['projects']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['projects']['Insert']>;
      };
      rewards: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          cost: number;
          type: 'real' | 'game';
          icon: string;
          description: string;
          times_purchased: number;
          buff_effect: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['rewards']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['rewards']['Insert']>;
      };
      big_data_days: {
        Row: {
          id: string;
          user_id: string;
          date: string; // YYYY-MM-DD
          sleep_hours: number | null;
          sleep_quality: number | null; // 1-10
          sleep_start: string | null;
          sleep_end: string | null;
          daily_score: number | null; // 1-10
          reason: string | null;
          tags: string[];
          supplements: Json; // {name, dose, time}[]
          biometrics: Json; // {weight, waist, arms, calves, thighs, body_fat}
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['big_data_days']['Row'],
          'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['big_data_days']['Insert']>;
      };
      content_videos: {
        Row: {
          id: string;
          user_id: string;
          channel_id: string;
          title: string;
          stage: string;
          idea_date: string | null;
          script_date: string | null;
          shoot_date: string | null;
          edit_date: string | null;
          publish_date: string | null;
          views: number;
          revenue: number;
          thumbnail_url: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['content_videos']['Row'],
          'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['content_videos']['Insert']>;
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
