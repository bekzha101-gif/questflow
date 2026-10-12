# QuestFlow — память проекта для Claude

Геймифицированный трекер продуктивности: гибрид Todoist (задачи), Habitica (RPG: HP/EXP/золото/квесты/босс) и ShortsFlow (фокус-спринты). Личное приложение владельца (Бакыт), работает local-first, PWA.
Проект перенесён из Antigravity (чат «Gamified Productivity App Plan», 29.08–12.10.2026). Полная история чата: `docs/antigravity/`.

## Как работать со мной
- Общайся и комментируй код **по-русски**.
- Простые ошибки чини сам (терминал, сборка), не отправляй пользователя исправлять.
- Ключи и токены не хардкодить: только `.env.local` / переменные окружения (шаблон `.env.example`).
- Пользователь любит, когда задают много уточняющих вопросов перед крупной фичей и составляют план (`/plan`). Для крупных изменений сначала вопросы и план, потом код.
- Перед коммитом: `npm run build` (0 ошибок). Коммит после каждой законченной фичи, сообщения в стиле `feat(...)` / `fix(...)`. Пуш в `master` (origin: github.com/bekzha101-gif/questflow) только когда пользователь попросил.
- Репозиторий уже на `master`, синхронизирован с origin на момент переноса (последний коммит `93c8f83`, режим «Слепой фокус»).

## Стек и команды
React 19 + TypeScript 6 + Vite 8, Tailwind 4, framer-motion, lucide-react, Supabase (опционально, облачная синхронизация), vite-plugin-pwa. Деплой: Vercel (`vercel.json`) и GitHub Actions (`.github/workflows/deploy.yml`).
```
npm install        # node_modules не копировались при переносе
npm run dev        # http://localhost:5173 (vite --host, доступно с телефона по Wi-Fi)
npm run build      # tsc -b && vite build
npm run lint       # oxlint
```
MCP-сервер задач для агентов: `mcp_server.py` (хранит данные в `~/.questflow_data.json`), подключён через `.mcp.json`.

## Карта кода (`src/`)
- `App.tsx` — корневой стейт, вкладки, общий сброс профиля.
- `components/TogglTimerBar.tsx` — таймер в стиле Toggl: фокус 120 мин / отдых 20 мин.
- `components/CommandCenterToday.tsx` — панель «Сегодня»; `ShoppingListView.tsx` — список покупок (отдельная вкладка).
- `components/LifeCalendarView.tsx`, `CalendarTimeBlocking.tsx`, `GoogleCalendarModal.tsx` — календарь, тайм-блокинг, Google Calendar.
- `components/BigDataLifeTracker.tsx` — таблица «Big Data самоконтроль» (31 день).
- `components/HealthBioTracker.tsx`, `LifeAnalyticsHub.tsx` — здоровье и аналитика.
- Прочее: `TavernHub`, `HeroTavern`, `BossRaid`, `QuestsHub`, `HabitsDailiesView`, `FlowShortsMode`, `FinancesTracker`, `IdeasPipeline`, `ContentProductionBoard`, `MediaStudioHub`, AI-модалки.
- `utils/`: `timerStorage.ts` (устойчивое хранилище таймера), `recoveryCycle.ts` (цикл 7+1), `bigDataTracker.ts`, `calendarSync.ts` / `googleCalendarApi.ts`, `storage.ts`, `cloudSync.ts`, `healthTracker.ts`, `sound.ts`.
- `data/initialData.ts`, `data/todoistImportData.ts` — стартовые данные (см. правило про «воскрешение» задач).
- `hooks/useSupabaseSync.ts`, `lib/supabase.ts`; миграция БД: `supabase/migrations/001_initial.sql`.

## Решения и требования пользователя (не ломать)
1. **Задачи пользователя — единственный источник правды.** Нельзя «восстанавливать» удалённые/выполненные задачи из старых данных, памяти или seed-файлов. Был инцидент: старые задачи вернулись после правок. Коммит `c8fc0ad` вычистил «зомби-задачи». Не добавляй старые задачи обратно в `initialData.ts` / `todoistImportData.ts` и не пиши логику, которая воскрешает удалённое.
2. **Список покупок** живёт только на своей вкладке и не показывается в панели задач/целей дня.
3. **Таймер:** фокус 120 мин, отдых 20 мин (настраиваемо). После 120 мин автопереход на отдых независимо от кнопки «Стоп»; отработанное время (например 1ч 30м) пишется в календарь с EXP и золотом. Отдых после окончания не стартует работу сам, ждёт ручного старта.
4. **Таймер переживает закрытие вкладки:** считается по `Date.now()`, сессия хранится в localStorage каждую секунду, офлайн-first, `BroadcastChannel` `questflow_timer_channel_v1` синхронизирует вкладки. Если 2 часа истекли, пока вкладка была закрыта, показывается окно подтверждения. Фоновый звук возобновляется по первому клику (политика Autoplay).
5. **«Слепой глубокий фокус»:** во время работы цифры скрыты, виден статус «Работает» с пульсирующей точкой, иконка глаза временно показывает время; на кнопке просто «Фокус» (без «120м»). В отдыхе отсчёт виден. По окончании плашка «Отработано: 2ч 00м».
6. **Цикл восстановления 7+1:** 7 рабочих дней + 1 день активного восстановления (на календаре ячейки: изумрудный фон для работы, рубиновый для детокса, красный квадрат в день восстановления). Старт можно поставить вручную кликом по любой дате. В день детокса фокус-таймер и добавление рабочих задач блокируются сообщением «Сегодня день отдыха. Уберите гаджеты и идите в баню!». Активности: баня/бассейн+сауна, прогулка (10 000+ шагов), медитация 20–30 мин, массаж/МФР/растяжка. Напоминание за 24 часа + системные Web Push (macOS). Награда за соблюдение: +100 HP, +150 EXP, +50 золота, трофей «Мастер перезагрузки»; за нарушение — штраф.
7. **Big Data (CleverMind v2.0):** таблица стартует полностью пустой (БАДы `(ничего)`, сон `—`, оценка `—`, теги не выбраны). Версионная миграция `questflow_bigdata_v3_cleaned` чистит старый кеш `questflow_bigdata_v1`; кнопка «Сбросить всё» в шапке таблицы. Не возвращай демо-данные.
8. **Синхронизация:** Google Calendar (двусторонне), экспорт `.ICS`, Supabase-синхронизация, быстрый бэкап/восстановление JSON, режим гостя (`questflow_guest_mode`).
9. **Bio-Health:** HP не регенерируется сам, есть будильники, журнал еды и сна, AI-советы.
10. Интерфейс: минималистичный (Linear/Raycast), карточки с тактильными элементами. Пользователь недоволен «ерундой» в дизайне, перед редизайном показывай план.

Ключи localStorage (все с префиксом `questflow_`): `tasks_v1`, `stats_v1`, `rewards_v1`, `timelogs`, `timer_*` (work_duration, break_duration, title, selected_task_id), `recovery_cycle_config`, `recovery_completed_activities`, `last_recovery_24h_alert`, `last_recovery_today_alert`, `bigdata_v1`, `bigdata_v3_cleaned`, `channels_v1`, `videos_v1`, `ideas_v1`, `finances_v1`, `team_v1`, `supabase_url`, `supabase_anon_key`, `guest_mode`.

## Где лежит контекст из Antigravity
- `docs/antigravity/user-requests.md` — все 65 запросов пользователя по порядку (начни отсюда).
- `docs/antigravity/chat-transcript.md` — весь диалог (ответы целиком, инструменты кратко).
- `docs/antigravity/checkpoints.md` — 19 сводок контекста от Antigravity.
- `docs/antigravity/raw/transcript_full.jsonl` — полный оригинал без сокращений.
- `docs/antigravity/artifacts/` — `implementation_plan.md` (устойчивый таймер), `blind_focus_timer_plan.md`, `task.md`, `walkthrough.md`; `screenshots/`; `scratch-scripts/` (импорт Todoist).
- `docs/antigravity/global-rules/` — глобальные правила Antigravity (в основном про YouTube-каналы, не про QuestFlow).
- `docs/antigravity/skills-other-inactive/` — скилы не по теме проекта (VidIQ, trend-radar и др.).
- `docs/antigravity/` в `.gitignore`: там личные данные, на GitHub не пушить.

## Скилы (`.claude/skills/`)
UI/дизайн: `ui-ux-pro-max`, `design`, `design-system`, `ui-styling`, `brand`, `banner-design`, `slides`. Используй для редизайна интерфейса.

## Текущий план и устройства
Приоритеты: редизайн интерфейса и чистка кода. Пользуются на Mac и телефоне (PWA), значит mobile-first. План по этапам: `docs/ROADMAP.md`. Для редизайна сначала предложи 2–3 направления и дождись выбора.

## Запуск на Mac
Двойной клик по файлу «Запустить QuestFlow.command» в корне проекта. При первом запуске он пересоздаёт `node_modules` под macOS (папка, поставленная из Linux-окружения при переносе, на Mac не подходит), затем запускает `npm run dev` и открывает http://localhost:5173.
Когда отвечаешь пользователю, не пиши пути в блоках кода: они не кликаются. Файлы отправляй карточками (SendUserFile), а запуск делай через этот файл.

Запись разговора о переносе проекта (вопросы пользователя и ответы): docs/CONVERSATION-CONTEXT.md (в .gitignore).
