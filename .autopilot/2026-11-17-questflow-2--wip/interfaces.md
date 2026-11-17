# Интерфейсы и правила проекта

Читать первым. Здесь границы модулей, решённые в спецификации, и правила, которые не обсуждаются.

## Правила проекта (из CLAUDE.md и брифинга)
- Интерфейс и комментарии по-русски; идентификаторы английские.
- Данные пользователя — единственный источник правды: не создавать задачи/привычки/демо-данные автоматически, не воскрешать удалённое (CLAUDE.md п.1, 7, 12). Исключение — стартовые данные из брифинга (цели ноября, 5 каналов, шаблон БАДов, награды, сферы), создаются **один раз** при пустых таблицах и помечены `seed: true`.
- Экран «Сегодня»: 4 колонки Привычки · Ежедневные · Задачи · Награды не перекраивать; новое — поверх (CLAUDE.md п.16).
- Тёмная тема, Linear/Raycast-минимализм, без эмодзи в UI. Классы и цвета — `notes.md` §14.
- Время: только через `shared/time.ts` (Asia/Bishkek). `toISOString().split('T')[0]` для «сегодня» запрещён.
- Перед коммитом `npm run build` 0 ошибок и `npm test` зелёный. Коммиты `feat(...)`/`fix(...)` по-русски. Не пушить.
- Секреты: только имена в `.env.example`; значения никогда не в репозитории. В сайт — только anon-ключ (он публичный).
- Не удалять service worker в `main.tsx` (CLAUDE.md п.17). Расширение Brain.fm: сохранить `data-questflow-focus` и событие `questflow:focus` (п.13).
- Файлы большие: править по якорям, не переписывать целиком без нужды.

## Стек и команды
- Сайт: React 19, TypeScript ~6, Vite 8, Tailwind 4, lucide-react, @supabase/supabase-js (есть), vite-plugin-pwa. Новое: Vitest (таск 01). Графики — SVG своими руками (как `BigDataChart.tsx`), новую библиотеку графиков не тащить.
- Сервер (`server/`, таск 08): Node 22, TypeScript, grammY, node-cron, @supabase/supabase-js, dotenv, Vitest. Голос: Python + faster-whisper (CUDA). AI: CLI `claude` (уже установлен: `C:/Users/Administrator/.local/bin/claude.exe`).
- Установка: `npm install` (корень), `cd server && npm install`.
- Запуск: `npm run dev` (http://localhost:5173), сервер — `cd server && npm run dev`.
- **Одна проверка: `npm run check`** = `npm test` + `npm run build` + `npm run lint` (создаёт таск 01; lint — только ошибки, не предупреждения). Один файл тестов: `npx vitest run <путь>`. Сервер: `cd server && npm test && npm run build`.
- Не трогать: `extensions/brainfm-bridge/`, `docs/antigravity/`, `.github/workflows/deploy.yml` (кроме явной нужды), `supabase/migrations/001_initial.sql`, `mcp_server.py`.
- Миграцию `002` к боевой базе НЕ применять — только файл. Применение — с разрешения пользователя.
- Не пушить, не деплоить.

## Границы, решённые в спецификации

### 1. `shared/` — чистые правила (без React, без сети), общие для сайта и сервера
Импортируется сайтом (`src/…` через алиас `@shared/*`) и сервером (`server/…` через относительный путь/алиас). Только детерминированные функции с `now` параметром.

| Модуль | Владеет | Отдаёт |
|---|---|---|
| `shared/time.ts` | часовой пояс `APP_TZ = 'Asia/Bishkek'` | `todayStr(now?: Date): string` (YYYY-MM-DD по Бишкеку) · `dayOfWeek(dateStr): 0..6` · `isRecoveryDay(dateStr): boolean` (пятница) · `bishkekHM(now): {h,m}` · `addDays(dateStr, n)` · `weekStart(dateStr)` (понедельник) · `monthKey(dateStr): 'YYYY-MM'` |
| `shared/types.ts` | доменные типы | см. «Модель данных» ниже |
| `shared/timer.ts` | цикл 120/20 | `computeTimer(state: TimerState, now: number): {phase, elapsedSec, remainingSec, expired}` · `nextAfterExpire(state, now): TimerState` · константы `WORK_MIN=120`, `BREAK_MIN=20`, `BLOCKS_PER_DAY=3` |
| `shared/goals.ts` | декомпозиция | `splitTarget(target: number, weeks = 4): number[]` (k·target/(weeks+1), округление вверх; цель месяца = target — как в брифе 50 → 10/20/30/40 → 50) · `goalProgress(goal, weeks, steps): {pct, onTrack}` |
| `shared/channels.ts` | расписание | `nextDueDates(channel, lastPublished: string\|null, today): string[]` · `channelTodo(channel, videos, today): {step, dueDate, urgency}` · `remindersFor(channels, videos, today, limit=3)` |
| `shared/bigdata.ts` | аналитика дня | `dayDelta(days, date): number\|null` · `explainDrop(days, date, cfg): Reason[]` · `influenceFactors(days, cfg, minDays=14): Factor[] \| 'not_enough_data'` |
| `shared/gamification.ts` | все правила наград | `RULES` (таблица чисел) · `applyEvent(stats: GameStats, ev: GameEventInput): {stats, events: GameEvent[], unlocked: AchievementId[]}` · `ACHIEVEMENTS` · `dayOutcome(day): 'norm'\|'missed'\|'recovery'` · `shopLocked(stats): boolean` |

### 2. Supabase — `supabase/migrations/002_questflow2.sql`
Все таблицы: `user_id uuid not null references auth.users`, `id text` (где есть), `updated_at timestamptz default now()`, `deleted boolean default false` (мягкое удаление — чтобы удаления синкались), RLS `using (auth.uid() = user_id) with check (auth.uid() = user_id)`, Realtime включён.

| Таблица | Ключ | Поля (snake_case) |
|---|---|---|
| `tasks2` | (user_id,id) | title, description, type (habit\|daily\|todo), kind (task\|shopping), priority, project_id, tags text[], difficulty, completed, completed_at, due_date, due_time, recurrence, streak_count, habit_direction, habit_counter, subtasks jsonb, progress_pct, drop_reason, goal_step_id, seed |
| `projects2`, `rewards2` | (user_id,id) | как типы `Project`, `Reward` + `tier` (small\|big) у наград |
| `game_stats` | user_id | level, exp, max_exp, hp, max_hp, gold, streak, best_streak, income_usd_total |
| `game_events` | (user_id,id) | at, kind, delta_exp, delta_gold, delta_hp, ref, note — журнал, только вставка |
| `achievements` | (user_id,id) | unlocked_at |
| `goals` | (user_id,id) | month 'YYYY-MM', title, kind (numeric\|percent), target, unit, current, status (active\|done\|failed\|archived), summary |
| `goal_weeks` | (user_id,id) | goal_id, week_index 1..4, target, actual, review |
| `goal_steps` | (user_id,id) | goal_id, week_index, title, done, progress_pct |
| `focus_sessions` | (user_id,id) | date, block_index, started_at, ended_at, minutes, task_id, result (done\|partial\|dropped), progress_pct, drop_reason |
| `timer_state` | user_id | phase (idle\|work\|break), running, started_at, accumulated_sec, target_min, block_index, task_id, date, notified_end boolean |
| `bigdata_days` | (user_id,date) | sleep_min, sleep_quality, score, why, tags text[], supplements text[], criteria jsonb, note, water_ok, focus_min, report_status (none\|partial\|done\|missed) |
| `bigdata_config` | user_id | spheres jsonb [{id,label,description}], criteria jsonb [{id,label,type,unit}], supplements jsonb [{id,name,dose}] |
| `health_food`, `health_alarms` | (user_id,id) | как `FoodLogEntry`, `HealthAlarmConfig` (`notes.md` §3) |
| `channels2` | (user_id,id) | name, niche, status (active\|paused\|abandoned\|archived), paused_until, cadence_per_day numeric (2, 1, 0.5), edit_hours_min, edit_hours_max, abandon_reason, color, seed |
| `videos2` | (user_id,id) | channel_id, title, stage (editing\|review\|published), checklist jsonb {plan,title,thumbnail,edit,upload}, publish_date, published_at |
| `income` | (user_id,id) | date, channel_id, amount_usd, source |
| `bot_settings` | user_id | chat_id, morning_hm '08:00', evening_hm '21:00', reminder_limit 3, last_sent jsonb, conversation jsonb (состояние разговора) |
| `ai_memory` | (user_id,id) | period ('day'\|'week'\|'month'), period_key, summary, facts jsonb |
| `kv` | (user_id,key) | value jsonb — прочие настройки (hidden sections и т.п.) |

Старые таблицы 001 не удаляются.

### 3. `src/store/` — данные сайта
Владеет кешем localStorage (ключи `qf2_<table>`), очередью отправки, Realtime-подпиской, переносом.

| Отдаёт | Сигнатура |
|---|---|
| хук коллекции | `useCollection<T>(table: TableName): {items: T[], upsert(item: T), remove(id: string)}` — `remove` = мягкое удаление |
| хук записи | `useRecord<T>(table, key): {value: T\|null, save(v: T)}` |
| статус | `useSyncStatus(): 'synced'\|'pending'\|'offline'\|'error'` |
| перенос | `runLegacyImport(): Promise<ImportReport>` в `src/store/legacyImport.ts` — сначала скачивает JSON-бэкап, затем upsert; идемпотентен; флаг `qf2_legacy_imported` |
| сиды | `ensureSeeds(): Promise<void>` в `src/store/seeds.ts` — только при пустых таблицах |

Компоненты не трогают `localStorage` и `fetch` к Supabase напрямую — только через store. Hides: формат очереди, конфликт-резолв (`updated_at`, последний выигрывает построчно).

### 4. Сервер `server/` (Node 22 + TS)
| Модуль | Владеет | Отдаёт |
|---|---|---|
| `server/src/db.ts` | service-role клиент | типизированные `getX/saveX` для таблиц выше (`user_id` владельца из `.env` `OWNER_USER_ID`) |
| `server/src/bot.ts` | grammY, проверка chat id | `startBot()`, `send(text, keyboard?)` |
| `server/src/conversation/` | вечерний разговор (машина состояний в `bot_settings.conversation`) | `startEvening(date)`, `handleUpdate(msg)` — шаги: sleep → supplements → score → good_better → habits → tasks → channels → plan_tomorrow → ai |
| `server/src/scheduler.ts` | cron по `Asia/Bishkek` | утро, вечер, 22:00 напоминание, таймер (каждые 30 с), публикации, будильники здоровья, воскресенье/конец месяца, бэкап 03:00 |
| `server/src/ai.ts` | вызов Claude | `analyze(kind: 'day'\|'week'\|'month'\|'sleep_screenshot', payload): Promise<AiResult>` — `claude -p` → запасной API → `null` |
| `server/src/stt.ts` | Whisper | `transcribe(oggPath): Promise<string\|null>` — вызывает `server/stt/transcribe.py` |
| `server/src/setup.ts` | установщик | `npm run setup` — спрашивает в терминале токен/ключи, пишет `server/.env`, проверяет |
| `server/scripts/` | автозапуск | `install-service.ps1` (задача Планировщика), `run.ps1` (перезапуск при падении) |

### 5. Интерфейс сайта
Разделы (`SectionType`): `today | goals | channels | health | progress`. «Покупки» и «Календарь» — вкладки внутри `goals`. Старые id (`quests`, `tasks`, `shopping`, `calendar`, `studio`, `tavern`, `finances`, `bigdata`, `life`) сводятся `getSection` в новые.

## Тестовые швы
- `shared/*` — Vitest, чистые функции, `now` передаётся.
- `src/store` — Vitest с подменой Supabase-клиента (интерфейс `RemoteTable`).
- `server/src/conversation` — Vitest с подменой `send`, `db`, `ai`, `stt`.

## Что построили законченные таски
(заполняется по ходу)
