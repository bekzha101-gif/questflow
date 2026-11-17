-- ═══════════════════════════════════════════════════════════════════════════
-- QuestFlow 2.0 — новые таблицы (сайт и Telegram-бот пишут построчно).
-- Таблицы 001 не трогаются и не удаляются.
--
-- Общие правила для всех таблиц:
--   • user_id uuid not null → auth.users; ключи текстовые (id text / date / key);
--   • updated_at — метка версии строки; deleted — мягкое удаление (удаления синкаются);
--   • extra jsonb — поля приложения, для которых нет колонки (ничего не теряется);
--   • RLS: auth.uid() = user_id (using + with check); service-role сервера обходит RLS;
--   • Realtime включён;
--   • Конфликты «последний выигрывает построчно»: триггер qf2_guard_updated_at
--     игнорирует UPDATE, если новый updated_at не позже текущего.
--     Писатели (сайт, бот) обязаны присылать updated_at (ISO) при каждом изменении;
--     updated_at = null → ставится now().
-- Применять вручную (Supabase SQL editor) только с разрешения владельца.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Триггер версии строки ──────────────────────────────────────────────────
create or replace function public.qf2_guard_updated_at()
returns trigger
language plpgsql
as $$
begin
  if new.updated_at is null then
    new.updated_at := now();
    return new;
  end if;
  if tg_op = 'UPDATE' and new.updated_at <= old.updated_at then
    -- строка старее или равна той, что в базе: изменение игнорируется
    return null;
  end if;
  return new;
end;
$$;

-- ─── Задачи, проекты, награды ───────────────────────────────────────────────
create table if not exists public.tasks2 (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  title text,
  description text,
  type text check (type in ('habit', 'daily', 'todo')),
  kind text not null default 'task' check (kind in ('task', 'shopping')),
  priority text,
  project_id text,
  tags text[] default '{}',
  difficulty text,
  completed boolean default false,
  completed_at timestamptz,
  due_date date,
  due_time text,
  recurrence text,
  streak_count integer,
  habit_direction text,
  habit_counter numeric,
  subtasks jsonb default '[]',
  progress_pct numeric,
  drop_reason text,
  goal_step_id text,
  seed boolean default false,
  extra jsonb not null default '{}',
  updated_at timestamptz default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);
create index if not exists tasks2_due_idx on public.tasks2 (user_id, due_date);

create table if not exists public.projects2 (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text,
  color text,
  icon text,
  is_favorite boolean default false,
  seed boolean default false,
  extra jsonb not null default '{}',
  updated_at timestamptz default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);

create table if not exists public.rewards2 (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  title text,
  cost numeric default 0,
  type text,
  icon text,
  description text,
  times_purchased integer default 0,
  buff_effect text,
  tier text default 'small' check (tier in ('small', 'big')),
  seed boolean default false,
  extra jsonb not null default '{}',
  updated_at timestamptz default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);

-- ─── Геймификация ───────────────────────────────────────────────────────────
create table if not exists public.game_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  level integer default 1,
  exp numeric default 0,
  max_exp numeric default 100,
  hp numeric default 100,
  max_hp numeric default 100,
  gold numeric default 0,
  streak integer default 0,
  best_streak integer default 0,
  income_usd_total numeric default 0,
  extra jsonb not null default '{}',
  updated_at timestamptz default now(),
  deleted boolean not null default false
);

-- Журнал событий наград: только вставка
create table if not exists public.game_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  at timestamptz default now(),
  kind text,
  delta_exp numeric default 0,
  delta_gold numeric default 0,
  delta_hp numeric default 0,
  ref text,
  note text,
  extra jsonb not null default '{}',
  updated_at timestamptz default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);
create index if not exists game_events_at_idx on public.game_events (user_id, at);

create table if not exists public.achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  unlocked_at timestamptz default now(),
  extra jsonb not null default '{}',
  updated_at timestamptz default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);

-- ─── Цели: месяц → 4 недели → шаги ──────────────────────────────────────────
create table if not exists public.goals (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  month text check (month ~ '^\d{4}-\d{2}$'),
  title text,
  kind text default 'numeric' check (kind in ('numeric', 'percent')),
  target numeric,
  unit text,
  current numeric default 0,
  status text default 'active' check (status in ('active', 'done', 'failed', 'archived')),
  summary text,
  seed boolean default false,
  extra jsonb not null default '{}',
  updated_at timestamptz default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);
create index if not exists goals_month_idx on public.goals (user_id, month);

create table if not exists public.goal_weeks (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  goal_id text,
  week_index integer check (week_index between 1 and 4),
  target numeric,
  actual numeric,
  review text,
  extra jsonb not null default '{}',
  updated_at timestamptz default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);

create table if not exists public.goal_steps (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  goal_id text,
  week_index integer,
  title text,
  done boolean default false,
  progress_pct numeric,
  extra jsonb not null default '{}',
  updated_at timestamptz default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);

-- ─── Фокус и таймер 120/20 ─────────────────────────────────────────────────
create table if not exists public.focus_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  date date,
  block_index integer,
  started_at timestamptz,
  ended_at timestamptz,
  minutes numeric default 0,
  task_id text,
  result text check (result in ('done', 'partial', 'dropped')),
  progress_pct numeric,
  drop_reason text,
  extra jsonb not null default '{}',
  updated_at timestamptz default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);
create index if not exists focus_sessions_date_idx on public.focus_sessions (user_id, date);

create table if not exists public.timer_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phase text default 'idle' check (phase in ('idle', 'work', 'break')),
  running boolean default false,
  started_at timestamptz,
  accumulated_sec numeric default 0,
  target_min numeric,
  block_index integer default 0,
  task_id text,
  date date,
  notified_end boolean default false,
  extra jsonb not null default '{}',
  updated_at timestamptz default now(),
  deleted boolean not null default false
);

-- ─── Big Data ───────────────────────────────────────────────────────────────
create table if not exists public.bigdata_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  sleep_min numeric,
  sleep_quality numeric,
  score numeric,
  why text,
  tags text[] default '{}',
  supplements text[] default '{}',
  criteria jsonb default '{}',
  note text,
  water_ok boolean,
  focus_min numeric,
  report_status text default 'none' check (report_status in ('none', 'partial', 'done', 'missed')),
  extra jsonb not null default '{}',
  updated_at timestamptz default now(),
  deleted boolean not null default false,
  primary key (user_id, date)
);

create table if not exists public.bigdata_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  spheres jsonb default '[]',      -- [{id,label,description}]
  criteria jsonb default '[]',     -- [{id,label,type,unit}]
  supplements jsonb default '[]',  -- [{id,name,dose}]
  seed boolean default false,
  extra jsonb not null default '{}',
  updated_at timestamptz default now(),
  deleted boolean not null default false
);

-- ─── Здоровье ───────────────────────────────────────────────────────────────
create table if not exists public.health_food (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  "timestamp" timestamptz,
  date date,
  time text,
  meal_type text,
  food text,
  feeling text,
  notes text,
  extra jsonb not null default '{}',
  updated_at timestamptz default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);

create table if not exists public.health_alarms (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  title text,
  time text,
  enabled boolean default true,
  type text,
  sound_enabled boolean default true,
  repeat_daily boolean default true,
  extra jsonb not null default '{}',
  updated_at timestamptz default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);

-- ─── Каналы, видео, доход ───────────────────────────────────────────────────
create table if not exists public.channels2 (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text,
  niche text,
  status text default 'active' check (status in ('active', 'paused', 'abandoned', 'archived')),
  paused_until date,
  cadence_per_day numeric default 1,   -- 2, 1, 0.5 (раз в 2 дня)
  edit_hours_min numeric,
  edit_hours_max numeric,
  abandon_reason text,
  color text,
  seed boolean default false,
  extra jsonb not null default '{}',
  updated_at timestamptz default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);

create table if not exists public.videos2 (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  channel_id text,
  title text,
  stage text default 'editing' check (stage in ('editing', 'review', 'published')),
  checklist jsonb default '{"plan":false,"title":false,"thumbnail":false,"edit":false,"upload":false}',
  publish_date date,
  published_at timestamptz,
  extra jsonb not null default '{}',
  updated_at timestamptz default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);
create index if not exists videos2_channel_idx on public.videos2 (user_id, channel_id);

create table if not exists public.income (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  date date,
  channel_id text,
  amount_usd numeric default 0,
  source text,
  extra jsonb not null default '{}',
  updated_at timestamptz default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);

-- ─── Бот и AI ───────────────────────────────────────────────────────────────
create table if not exists public.bot_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  chat_id text,
  morning_hm text default '08:00',
  evening_hm text default '21:00',
  reminder_limit integer default 3,
  last_sent jsonb default '{}',
  conversation jsonb,              -- состояние вечернего разговора
  extra jsonb not null default '{}',
  updated_at timestamptz default now(),
  deleted boolean not null default false
);

create table if not exists public.ai_memory (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  period text check (period in ('day', 'week', 'month')),
  period_key text,
  summary text,
  facts jsonb,
  extra jsonb not null default '{}',
  updated_at timestamptz default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);

-- Прочие настройки и копии старых ключей questflow_* (legacy:<ключ>)
create table if not exists public.kv (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb,
  extra jsonb not null default '{}',
  updated_at timestamptz default now(),
  deleted boolean not null default false,
  primary key (user_id, key)
);

-- ─── RLS, триггер версии и Realtime для всех таблиц ─────────────────────────
do $$
declare
  t text;
  tables text[] := array[
    'tasks2', 'projects2', 'rewards2', 'game_stats', 'game_events', 'achievements',
    'goals', 'goal_weeks', 'goal_steps', 'focus_sessions', 'timer_state',
    'bigdata_days', 'bigdata_config', 'health_food', 'health_alarms',
    'channels2', 'videos2', 'income', 'bot_settings', 'ai_memory', 'kv'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_owner', t);
    execute format(
      'create policy %I on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t || '_owner', t
    );

    execute format('drop trigger if exists %I on public.%I', t || '_guard_updated_at', t);
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function public.qf2_guard_updated_at()',
      t || '_guard_updated_at', t
    );

    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (
         select 1 from pg_publication_tables
         where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
       ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
