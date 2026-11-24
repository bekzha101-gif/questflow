# Архитектура QuestFlow 2.0

Сводка границ модулей и соглашений. Подробные сигнатуры — в самих модулях; причины решений — в `docs/adr/` (0001–0010); слова предметной области — `CONTEXT.md`.

## Три слоя, одна база

- `shared/` — чистые правила без React, сети и DOM: `time`, `timer`, `goals`, `channels`, `bigdata`, `gamification`, `types`. Все функции детерминированы, `now` передаётся параметром.
- `src/` — сайт (React, PWA). Читает и пишет данные только через `src/store`.
- `server/` — домашний сервер (Node 22, CommonJS): AI-советник для сайта и ночной бэкап. Пишет в ту же базу под service-role ключом. Telegram-бота нет с 2026-11-24.
- Общая БД — Supabase, схема `supabase/migrations/002_questflow2.sql`; таблицы `*2`, `game_*`, `bigdata_*`, `kv` и др. Старые таблицы из `001_initial.sql` не удаляются.

## Поток данных на сайте

1. Компонент вызывает `useCollection` / `useRecord` (`src/store/index.ts`) — не `localStorage`, не `fetch` к Supabase.
2. `src/store/core.ts` пишет в кеш `qf2_<table>` и очередь `qf2_queue_<table>`, отправляет в облако через интерфейс `RemoteTable` (`src/store/remote.ts`), подписывается на Realtime.
3. Конфликт решает `updated_at`: побеждает более новая строка, построчно; триггер в БД отвергает устаревшую правку (ADR 0002).
4. `remove` — мягкое удаление (`deleted = true`), физически строки не удаляются (ADR 0010). Любой запрос обязан отфильтровывать `deleted`.
5. `src/components/AuthGate.tsx` монтирует приложение только после проверки входа и чтения облака этого пользователя; сиды (`src/store/seeds.ts`) создаются после чтения облака и только в пустые таблицы, помечены `seed: true`.
6. Старые данные из `questflow_*` ключей переносит `src/store/legacyImport.ts` один раз; сначала скачивается JSON-бэкап, маркер в облаке (kv `legacy_imported`) не даёт перенести повторно (ADR 0003).

## Геймификация

- Все числа и правила — `shared/gamification.ts` (`applyEvent`). Сайт вызывает его через `src/sections/progress/game.ts`.
- Журнал `game_events` — только вставка, id события `${kind}:${ref}`. Дедуп: сначала вставить событие, статы применять только если вставка прошла (ADR 0004). Иначе два устройства применят один день дважды.
- Сайт закрывает прошедшие дни (`day_close`) при открытии и раз в минуту.

## Таймер

- Логика — `shared/timer.ts` (блок 120 мин, отдых 20 мин, 3 блока — норма дня). Состояние — запись `timer_state` в облаке.
- Управляет таймером только сайт (`src/components/timer/`, `src/components/TogglTimerBar.tsx`). Уведомления — только на сайте (ADR 0009; серверные уведомления в Telegram убраны 2026-11-24).
- Вкладки синхронизируются через `BroadcastChannel` `questflow_timer_channel_v2` (`src/utils/timerStorage.ts`).
- Расширение `extensions/brainfm-bridge/` слушает атрибут `data-questflow-focus` и событие `questflow:focus`; контракт ломать нельзя.

## Разделы сайта

- Пять разделов `SectionType`: `today | goals | channels | health | progress`; код — `src/sections/<раздел>/index.tsx`.
- `src/sections/routes.ts` — единственное место, где старые id вкладок (`?tab=`) сводятся к новым разделам (`getSection`, `resolveTab`).
- Экран «Сегодня» (`src/sections/today/`) держит четыре колонки; новое добавляется поверх, раскладку не менять без макета и согласия.
- Корневой стейт и проводка — `src/App.tsx` (около 900 строк, править по якорям).

## Сервер

- `server/src/index.ts` собирает всё: `config` (чтение `server/.env`), `db` (`OWNER_USER_ID` владельца, `dumpAll` для бэкапа), `conversation/store.ts` и `conversation/context.ts` (чтение данных для советника), `advisor` (kv `ai_advisor`, опрос ~30 с), `ai`, `backup` (раз в сутки).
- `ai.ts`: `claude -p` в изоляции, запасной путь — Claude API, иначе `null` (ADR 0006).
- Telegram-бот, вечерний разговор, расписания и расшифровка голоса удалены 2026-11-24 (пользователь управляет через Claude напрямую); код — в истории git.
- Эксплуатация (установка, автозапуск, логи, бэкапы) — `server/docs/server.md`.
- Сервер обязан слать `updated_at` в каждой записи, иначе триггер БД её отбросит.

## Соглашения

- Весь код сервера импортирует `shared/` относительным путём (`../../shared/...`); на сайте — алиас `@shared/*` (`vite.config.ts`, `vitest.config.ts`, `tsconfig.app.json`).
- `shared/` компилируется сборкой сервера как строгий CommonJS: строгий TS, без DOM; ломается — смотреть `cd server && npm run build` (ADR 0008).
- «Сегодня» и даты — только через `shared/time.ts` (Asia/Bishkek). `toISOString().split('T')[0]` запрещён (ADR 0007).
- Данные пользователя — единственный источник правды: ничего не создавать и не воскрешать автоматически, кроме сидов.
- Новая таблица: колонки `user_id`, `updated_at`, `deleted`, `extra jsonb`, RLS по `auth.uid()`, Realtime; запись в `src/store/tables.ts`.
- Тесты лежат рядом с кодом (`*.test.ts`); Supabase в тестах подменяется (`src/store/testing.ts`), у сервера — подмена `db`/`ai` и хранилище в памяти (`server/src/conversation/testing.ts`).
- Интерфейс и комментарии по-русски, идентификаторы английские, тёмная тема, без эмодзи в UI.
- Графики — свой SVG (`src/components/BigDataChart.tsx`), новые библиотеки графиков не добавлять.

## Не трогать без явной нужды

`extensions/brainfm-bridge/`, `.github/workflows/deploy.yml`, `supabase/migrations/001_initial.sql`, `mcp_server.py`. Миграцию `002` к боевой базе без разрешения пользователя не применять.
