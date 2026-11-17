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

## Выставлено таском 01 (факт)
- `shared/time`: APP_TZ, todayStr, dayOfWeek, isRecoveryDay, bishkekHM, addDays, weekStart, monthKey. `shared/types`: TableName + доменные типы всех таблиц §2.
- `src/store`: useCollection, useRecord(table, key='me'), useSyncStatus; сверх §3 — useCollectionState, useRecordState, writeCollection, connectCloud(client, userId), disconnectCloud, syncNow.
- RemoteTable {upsert(rows), select(), subscribe(onRow)}, createSupabaseRemote; Store(storage, now, isOnline, flushDelayMs). Подмена для тестов — `src/store/testing.ts`.
- runLegacyImport(opts?) → ImportReport {counts, alreadyImported, backupFile}; needsLegacyImport(); ensureSeeds(store?). Кеш: qf2_<table>, qf2_queue_<table>, qf2_order_<table>.
- В каждой таблице 002 есть `extra jsonb` для полей без колонки. Триггер игнорирует UPDATE, если `updated_at` не новее текущего; null → now(). **Сервер/бот обязан слать `updated_at`.**
- Перенесённые строки и сиды имеют updated_at 2000-01-01 (любая правка их перебивает). Старые questflow_* ключи — в kv как `legacy:<ключ>`; ключи с токенами не переносятся.
- Ремонт 01 (по ревью): `Store.writeRecord(table, fallback, action, key, item)` — на нём useRecordState. `FALLBACK_TS = '1999-01-01T00:00:00.000Z'` — метка записи из запасного значения, пока облако не прочитано (облако её всегда перебивает).
- `runLegacyImport` без подключённого и прочитанного облака отклоняется. Маркер в облаке kv `CLOUD_IMPORT_MARKER = 'legacy_imported'` → бэкап скачивается, строки не пишутся, отчёт `{alreadyImported:true, cloudAlreadyImported:true}`. `cloudHasLegacyImport(store)`.
- AuthGate монтирует приложение только после проверки входа и (если вошёл) чтения облака. Сиды — после чтения облака.

## Выставлено таском 02 (факт)
- `src/sections/routes`: SECTION_IDS, TabType, getSection, resolveTab(id|null), goalsViewFor/healthViewFor/progressViewFor. `?tab=<старый id>` при старте открывает нужный раздел.
- `src/sections/types`: SectionContext. Разделы: TodaySection{ctx} · GoalsSection{ctx,tab} · ChannelsSection{ctx} · HealthSection{ctx,tab} · ProgressSection{ctx,tab}. Подвкладки — `src/sections/SubTabs.tsx`.
- `src/sections/today/mainTask`: pickMainTask(tasks,today) (срок ≤ сегодня, затем p1..p4), focusHoursToday(logs,today), FOCUS_HOURS_NORM=6. Строка фокуса — `src/sections/today/FocusStrip.tsx` (читает timerStorage).
- `src/utils/taskFilters`: isShoppingTask (решает kind, без kind — старое правило), selectRegularTasks, selectShoppingTasks, makeTask(input,{id,projectId,kind}), KindedTask, TaskKind. Покупки отфильтрованы один раз в App (regularTasks).
- QuickAddModal `kind?`; ShoppingListView.onOpenQuickAdd('shopping'). «Ещё» удалён; «Календарь жизни» и «AI-помощники» — в меню настроек шапки. HP/EXP/уровень — в шапке.

## Выставлено таском 08 (факт)
- `server/src/db`: createDb(client, ownerUserId, {now}) → Db {getBotSettings, saveBotSettings(patch; шлёт updated_at), getTimerState, markTimerNotified(startedAt), listHealthAlarms/Tasks/Channels/Videos, listFocusSessions(date), getKv(key), dumpAll}.
- `server/src/bot`: createBotService({token, db, conversation, botInfo?}) → {bot, send(text, keyboard?): Promise<boolean>, start, stop}. /start — привязка чата или «Бот работает.»; чужим — «Этот бот приватный.».
- ConversationApi {startEvening, eveningReminder, weeklyReport, monthlyReport (date), handleUpdate(IncomingMessage{chatId,text?,voiceFileId?,photoFileId?,callbackData?})}. Сейчас — заглушка `server/src/conversationStub.ts`; таск 09 подключает себя в `server/src/index.ts`.
- `server/src/scheduler`: runTick(deps, now), startScheduler(deps) (cron каждые 30 с, Asia/Bishkek). `server/src/backup`: runBackup({dir, now, dumpAll, keepDays=60}). `server/src/setup`: runSetup(SetupDeps).
- kv `plan:<YYYY-MM-DD>` = {mainTask?, mainTaskId?, firstBlockTask?} — для утреннего сообщения. bot_settings.last_sent ключи: morning, evening, evening_reminder, thursday, weekly, monthly, backup, alarm:<id>, publications "дата|id,id", timer_last, timer_work_end.
- Таймер на сервере пока считает `server/src/timerWatch.ts` (120/20/3); `remindersFor` из `shared/channels` подгружается require в рантайме — таск 06 должен экспортировать его оттуда. **`shared/` компилируется сборкой сервера в strict CommonJS: код в shared/ — строгий TS без DOM, `cd server && npm run build` должен проходить.**

## Выставлено таском 04 (факт)
- `shared/goals`: splitTarget(target, weeks=4): number[] · goalProgress(goal, weeks, steps, today?) → {pct, onTrack, expected, week:{index,target,pct,stepsDone,stepsTotal}, dayNeed} · weeksFor(goal, savedWeeks): GoalWeek[] · currentWeekIndex(month, today): 0..4 · goalPct(goal, weeks?) · stepsForTimer(goals, steps, today?): GoalStepEx[] (шаги текущей недели активных целей, не сделанные и не предложенные) · acceptStep(step) · monthLabel('2026-11') → «Ноябрь 2026» · monthSummary(goals, weeks?).
- `GoalStepEx = GoalStep & {proposed?: boolean}`; `proposed` хранится в `extra` строки goal_steps. Итог месяца — `goal.summary`, итог недели — `week.review`: бот (таск 09) пишет в эти поля. Недели — строкой в базе только после правки, иначе считаются на лету.
- Раздел «Цели»: вкладки «Цели месяца» (по умолчанию), «Архив», «Задачи», «Покупки», «Календарь».

## Выставлено таском 06 (факт)
- `shared/channels`: effectiveStatus(channel, today): ChannelStatus · nextDueDates(channel, lastPublished|null, today, count=7): string[] (заброшен/архив → []) · channelTodo(channel, videos, today) → {step, label, dueDate|null, urgency: overdue|today|soon|later|none, videoId?} · remindersFor(channels, videos, today, limit=3): {channelId, text}[] (под server/src/publications.ts toReminder) · normalizeVideo, normalizeStage, canPublish(checklist), lastPublishedOf(channelId, videos), leadDays(channel) (монтаж >3 ч — за 2 дня, иначе за 1), cadenceLabel(n) · константы CHECKLIST_ITEMS, VIDEO_STAGES, CADENCES.
- ContentProductionBoard({onPublishReward?, channelId?}) — награда за публикацию пока 75 EXP + 50 золота (таск 07 привязывает к правилам). ChannelCard({channel, videos, today, onChange}). Команда — kv `team`, каналы — `channels2`. AiVideoStudioModal удалён.

## Выставлено таском 03 (факт)
- `shared/timer`: WORK_MIN, BREAK_MIN, BLOCKS_PER_DAY, IDLE_TIMER · computeTimer(s, nowMs) → {phase, elapsedSec, remainingSec, expired} · nextAfterExpire(s, now) · settleTimer(s, now) · startBlock(s, now, {today, taskId}) · pauseTimer · resumeTimer · cancelBlock(s) · canStartBlock(s, today) · nextBlockNumber(s, today) · dayNormDone(s, today) · blockRecord(s, now) → BlockRecord{id,date,blockIndex,startedAt,endedAt,minutes,taskId,full}|null · blockSessionId(s) = 'focus-<date>-b<N>' · formatWorked(sec) → '2ч 00м' · blockReward(min, full) → {exp, gold}.
- blockIndex — номер текущего/последнего блока дня (0 — блоков не было). timer_state.task_id и focus_sessions.task_id: id задачи | 'step:<id>' | 'goal:<id>'. В extra focus_sessions: mode, title, blockIndex, resultSkipped. Перерывы в focus_sessions не пишутся.
- `src/components/timer`: useTimerState() → [state, commit], useNow(ms), buildTargetGroups, parseTargetRef/targetRef, resultUpdates, pendingResultSession. timerStorage: legacyToTimerState, broadcastTimerState/subscribeTimerState (BroadcastChannel questflow_timer_channel_v2), claimTimerEvent(key). `src/sections/today/daySummary`: daySummary(sessions, today), isWorkSessionOf. Проп onDamageHp у таймера больше не используется.

## Выставлено таском 05 (факт)
- `shared/bigdata`: dayDelta(days, date): number|null · isDropDay · explainDrop(days, date, cfg): Reason[]{kind,label} · influenceFactors(days, cfg, minDays=14): Factor[] | 'not_enough_data' · monthDates(month) · shiftMonth(month, n) · formatSleep · DROP_THRESHOLD=1.5 · типы BigDataDayInput, BigDataCriterion{type:'number'|'boolean'|'scale'|'text'} (полный тип здесь: в shared/types у Criterion нет 'scale').
- bigdata_days.extra: habitsDoneIds, habitsRewardedIds, habitsDone, habitsTotal, habitsMissed: string[], fillRewarded; tags и supplements — подписи/названия текстом. Заметка дня — в bigdata_days (AI читает её в таске 09).
- `src/utils/bigDataTracker`: patchDay(date, patch) · useBigDataDays · useBigDataSettings · useHabitDay(tasks, date) · tapHabit · habitSnapshot · buildMonth · normalizeConfig + add/rename/remove для сфер, критериев, БАДов.
- `src/utils/recoveryCycle`: getDayCycleInfo(date) (пятница) · canAddWorkTask · toggleRecoveryActivity · useRecoveryDay(date) · kv `recovery:<date>` = {done, rewarded}. Старые экспорты оставлены для App и TogglTimerBar.
- `src/utils/healthTracker`: addFoodEntry(input, now, store) · foodForDay · useFoodLogs · useHealthAlarms · dueHealthAlarms(alarms, now, fired) · tickHealthAlarms(deps) · startHealthAlarmScanner() · useTodayStr. kv: `health_daily:<date>`, health_sleep, health_damage, health_recovery, health_ai_report, health_alarms_fired. Событие `questflow:health-alarm`.

## Выставлено таском 07 (факт)
- `shared/gamification`: RULES · ACHIEVEMENTS (7) · AchievementId · applyEvent(stats, ev: GameEventInput, ctx: {now, journal?, unlocked?, facts?: {publishedVideos?, activeChannels?}}) → {stats, events, unlocked, applied, rejected?: 'duplicate'|'shop_locked'|'not_enough_gold', leveledUp, hpZero} · dayOutcome(DayFacts{date, focusMin, blocks, habitsDone, habitsTotal, recoveryDone?}) · isFullDay · shopLocked · levelProgress · focusReward(min, full) · withRulesStart(stats, today) · pendingDayCloses(stats, today) · eveningReminderDue(now, {answered, reminded}, date?) · eveningMissedEvent(date) | null · dayCloseEvent(day).
- id события = `${kind}:${ref}` (day_close: ref = дата); производные: level_up:*, hp_zero:*, achievement:<id>. Новые поля game_stats в extra: rulesSince, lastClosedDate, shopLocked, incomeHundredsPaid.
- Сайт: `src/sections/progress/game`: applyGame(input, {store?, now?, facts?}), syncGameFacts(opts), dayFactsFor(date, store), factsOf(store), logSessionOnce(prev, entry); событие окна GAME_EVENT='questflow:game'. Сайт закрывает прошедшие дни сам (при открытии и раз в минуту) с rulesSince.
- **Правило для бота (таск 09):** закрытие дня / пропуск вечера / доход — только через applyEvent с теми же id. Дедуп через game_events (insert-only, ключ (user_id,id)): сначала вставить событие, применять статы только если вставка прошла (не дубль), иначе бот и сайт применят один день дважды.

## Выставлено таском 09 (факт)
- `server/src/conversation`: createConversation(ConversationDeps{store, send(text, Keyboard?), ai, stt, files?, now?, log?}) → ConversationApi + tick(now?) · createSupabaseStore(client, ownerId, now?) → ConversationStore · toInlineKeyboard, createTelegramFiles. Подключён в `server/src/index.ts` вместо заглушки; повтор отложенного анализа — setInterval 5 мин.
- `server/src/ai`: createAi({runCli?, claudePath?, apiKey?, model?, fetch?, timeoutMs?, log?}).analyze(kind, payload) → AiResult{source, summary, good, better, boost, facts, steps, sleep?} | null. Основной путь — `claude -p` (читает картинку), запасной — API (DEFAULT_API_MODEL).
- `server/src/stt`: createStt({python?, model?, device?, run?}).transcribe(path) → string | null; `server/stt/transcribe.py` (faster-whisper, звук через ffmpeg), установка `server/stt/install.ps1` в `server/stt/.venv`.
- Кнопки: `qf:<seq>:<действие>`, `qa:<stepId>`, `qA:<неделя>`. kv `plan:<дата>` += videos, reminders; `onboarding:new_channels`; `wishes:<YYYY-MM>`. ai_memory id `day:/week:/month:<ключ>`. goal_steps.extra {proposed, proposedFor}; channels2.extra {planned, plan, stallReason}; bigdata_days.extra goodBetter. env: ANTHROPIC_MODEL, WHISPER_PYTHON, WHISPER_MODEL, WHISPER_DEVICE.
- Бот сам закрывает прошедшие дни (day_close) через applyEvent, дедуп — вставкой в game_events.

## Изменено ремонтом F1 (факт)
- Store.writeRecord(..., opts?: {auto?}) — метка 1999 только при auto; Store.autoWritesAllowed(); useAutoWritesAllowed(). TableDef.insertOnly (game_events: insert с ignoreDuplicates, политика insert+select).
- AuthGate: canMountApp(authResolved, userId, CloudGate), CloudGate/CloudState — приложение монтируется только после чтения облака этого userId. Быстрый вход с паролем удалён.
- `src/sections/today/dailyReset`: runDailyReset(today, lastReset, store?). mainTaskFor(tasks, today, plan), DayPlan — сначала kv `plan:<today>.mainTaskId`.
- `src/sections/progress/game`: GameOptions.auto; resetGameStats(fresh, opts) (сброс только статов); rewardBigDataFill(date, opts); rewardRecoveryActivity(date, actId, opts) → ApplyResult|null. В разделах нет `bonus`; удалены SectionContext.onAwardRewards/onAddGoldReward и пропы onLogReward/onPublishReward.
- Сервер: SchedulerDeps.conversationWaitMs, CONVERSATION_WAIT_MS; таймер — settleTimer → computeTimer, timerWatch.ts удалён; CLI_ISOLATION_ARGS для `claude -p` (≈3,1K токенов, 5 с); AiOptions.apiTimeoutMs; createTelegramFiles(..., timeoutMs); crashLine(e, config, at); ConvState.flags.monthDate; conversationStub.ts удалён; DEFAULT_API_MODEL claude-sonnet-5-5.
