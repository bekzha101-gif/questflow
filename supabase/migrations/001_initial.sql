-- ============================================================
-- QuestFlow — Initial Database Schema
-- Run this in Supabase Dashboard → SQL Editor → New Query
-- Or: supabase db push (if using Supabase CLI)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── User Stats ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_stats (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level        INTEGER NOT NULL DEFAULT 1,
  exp          INTEGER NOT NULL DEFAULT 0,
  max_exp      INTEGER NOT NULL DEFAULT 100,
  hp           INTEGER NOT NULL DEFAULT 100,
  max_hp       INTEGER NOT NULL DEFAULT 100,
  gold         INTEGER NOT NULL DEFAULT 0,
  streak       INTEGER NOT NULL DEFAULT 0,
  title        TEXT NOT NULL DEFAULT 'Новичок',
  hero_class   TEXT NOT NULL DEFAULT 'Warrior'
               CHECK (hero_class IN ('Warrior', 'Mage', 'Rogue', 'Healer')),
  avatar_url   TEXT NOT NULL DEFAULT '',
  sound_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ─── Tasks ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tasks (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title                   TEXT NOT NULL,
  description             TEXT,
  type                    TEXT NOT NULL DEFAULT 'todo'
                          CHECK (type IN ('habit', 'daily', 'todo')),
  priority                TEXT NOT NULL DEFAULT 'p3'
                          CHECK (priority IN ('p1', 'p2', 'p3', 'p4')),
  project_id              TEXT NOT NULL DEFAULT 'proj-inbox',
  tags                    TEXT[] NOT NULL DEFAULT '{}',
  difficulty              TEXT NOT NULL DEFAULT 'medium'
                          CHECK (difficulty IN ('trivial', 'easy', 'medium', 'hard', 'epic')),
  exp_reward              INTEGER NOT NULL DEFAULT 20,
  gold_reward             INTEGER NOT NULL DEFAULT 10,
  completed               BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at            TIMESTAMPTZ,
  due_date                DATE,
  due_time                TEXT,
  duration_minutes        INTEGER,
  recurrence              TEXT CHECK (recurrence IN ('none', 'daily', 'weekdays', 'weekly', 'custom')),
  streak_count            INTEGER NOT NULL DEFAULT 0,
  habit_direction         TEXT CHECK (habit_direction IN ('positive', 'negative', 'both')),
  habit_counter           INTEGER NOT NULL DEFAULT 0,
  subtasks                JSONB NOT NULL DEFAULT '[]',
  google_calendar_event_id TEXT,
  in_focus_flow           BOOLEAN NOT NULL DEFAULT FALSE,
  stage                   TEXT CHECK (stage IN ('backlog', 'in_progress', 'review', 'done')),
  last_reset_date         DATE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Projects ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.projects (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#8B5CF6',
  icon        TEXT NOT NULL DEFAULT '📁',
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Rewards ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rewards (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  cost             INTEGER NOT NULL DEFAULT 100,
  type             TEXT NOT NULL DEFAULT 'real' CHECK (type IN ('real', 'game')),
  icon             TEXT NOT NULL DEFAULT '🎁',
  description      TEXT NOT NULL DEFAULT '',
  times_purchased  INTEGER NOT NULL DEFAULT 0,
  buff_effect      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Big Data Days ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.big_data_days (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  sleep_hours   DECIMAL(4,2),
  sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 10),
  sleep_start   TEXT,  -- "23:00"
  sleep_end     TEXT,  -- "07:30"
  daily_score   INTEGER CHECK (daily_score BETWEEN 1 AND 10),
  reason        TEXT,
  tags          TEXT[] NOT NULL DEFAULT '{}',
  supplements   JSONB NOT NULL DEFAULT '[]',
  biometrics    JSONB NOT NULL DEFAULT '{}',
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- ─── Content Videos (for ContentProductionBoard) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.content_videos (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id    TEXT NOT NULL,
  title         TEXT NOT NULL,
  stage         TEXT NOT NULL DEFAULT 'idea',
  idea_date     DATE,
  script_date   DATE,
  shoot_date    DATE,
  edit_date     DATE,
  publish_date  DATE,
  views         INTEGER NOT NULL DEFAULT 0,
  revenue       DECIMAL(10,2) NOT NULL DEFAULT 0,
  thumbnail_url TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Auto-update timestamps ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER big_data_days_updated_at
  BEFORE UPDATE ON big_data_days FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER content_videos_updated_at
  BEFORE UPDATE ON content_videos FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Row-Level Security (users see ONLY their own data) ──────────────────────
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.big_data_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_videos ENABLE ROW LEVEL SECURITY;

-- user_stats policies
CREATE POLICY "Users own their stats" ON public.user_stats
  FOR ALL USING (auth.uid() = user_id);

-- tasks policies
CREATE POLICY "Users own their tasks" ON public.tasks
  FOR ALL USING (auth.uid() = user_id);

-- projects policies
CREATE POLICY "Users own their projects" ON public.projects
  FOR ALL USING (auth.uid() = user_id);

-- rewards policies
CREATE POLICY "Users own their rewards" ON public.rewards
  FOR ALL USING (auth.uid() = user_id);

-- big_data_days policies
CREATE POLICY "Users own their big data" ON public.big_data_days
  FOR ALL USING (auth.uid() = user_id);

-- content_videos policies
CREATE POLICY "Users own their videos" ON public.content_videos
  FOR ALL USING (auth.uid() = user_id);

-- ─── Indexes for performance ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(user_id, type);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(user_id, completed);
CREATE INDEX IF NOT EXISTS idx_big_data_days_date ON big_data_days(user_id, date);
CREATE INDEX IF NOT EXISTS idx_content_videos_channel ON content_videos(user_id, channel_id);

-- ─── Auto Daily Reset Function ────────────────────────────────────────────────
-- Called by Supabase Edge Function cron (midnight every day)
CREATE OR REPLACE FUNCTION reset_daily_tasks()
RETURNS void AS $$
BEGIN
  UPDATE tasks
  SET completed = FALSE,
      last_reset_date = CURRENT_DATE
  WHERE type = 'daily'
    AND completed = TRUE
    AND (last_reset_date IS NULL OR last_reset_date < CURRENT_DATE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
