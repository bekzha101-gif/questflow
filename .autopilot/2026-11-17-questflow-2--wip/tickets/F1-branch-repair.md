# F1 — Ремонт ветки по общему код-ревью

**Требования:** R14, R15, R17, R27, R42, R43, R44, R45, R46, R55, R56, R57, R61, R67, R70i, R72i
**Зависит от:** —
**Зона:** `src/components/AuthGate.tsx` · `src/store/` · `src/App.tsx` · `supabase/migrations/002_questflow2.sql` · `src/sections/` · `src/components/CalendarTimeBlocking.tsx` · `src/components/BigDataLifeTracker.tsx` · `src/components/CommandCenterToday.tsx` · `src/components/MediaStudioHub.tsx` · `src/components/ContentProductionBoard.tsx` · `src/components/FinancesTracker.tsx` · `src/components/LifeAnalyticsHub.tsx` · `src/components/AiLifeAdvisorModal.tsx` · `src/components/HabitsDailiesView.tsx` · `src/utils/aiLifeAdvisor.ts` · `src/utils/bigDataTracker.ts` · `src/utils/storage.ts` · `src/utils/naturalLanguageParser.ts` · `src/utils/calendarSync.ts` · `src/utils/googleCalendarApi.ts` · `src/utils/googleFitApi.ts` · `server/src/scheduler.ts` · `server/src/timerWatch.ts` · `server/src/conversation/` · `server/src/ai.ts` · `server/src/index.ts` · `server/src/conversationStub.ts` · `docs/ai-and-costs.md` · тесты рядом
**Волна:** 6
**Ревью:** да — ремонт ветки
**Модель:** сильная

## Что должно заработать

Все находки «fix now» общего ревью закрыты. Каждая — условие ниже, дословно от ревьюеров. На каждую поведенческую — тест, который падает без фикса.

## Из брифа, дословно

> «Данные мои — не терять при переделке, сделать миграцию и бэкап.»
> «данные — в Supabase (сайт и бот видят одно и то же)»
> «часовой пояс под бишкек кыргызстан настрой»

## Критерии приёмки (находки ревью, дословно)

### Данные и фундамент
- [ ] `src/components/AuthGate.tsx:232` — Безопасность: пароль вшит в «быстрый вход» и уходит в публичный бандл. Условие: строки пароля нет ни в коде, ни в бандле, кнопка удалена; пароль владелец меняет сам.
- [ ] `src/components/AuthGate.tsx:274` — `setSession` и `setAuthResolved` срабатывают одним рендером, при этом `cloudState` ещё 'none' (или 'ready' от пользователя A). Children монтируются, и эффекты App (дневной сброс `App.tsx:107`, `syncGameFacts` `App.tsx:393`) пишут до чтения облака; дневной сброс с устаревшим кешем пишет `deleted:false` и воскрешает удалённые ежедневные задачи (CLAUDE.md п.1). Условие: при `userId!==null` приложение монтируется только при `cloudState` 'ready'/'failed' и только для того userId, чьё облако прочитано; есть тест на этот рендер.
- [ ] `src/store/core.ts:218` — закешированная запись до чтения облака (или при 'failed') получает метку «сейчас»; автозаписи перебивают свежие статы и задачи с другого устройства и бота. Условие: дневной сброс и `syncGameFacts` ничего не пишут, пока облако подключено, но не прочитано (`ready!==true`); есть тест «запись из старого кеша до чтения не перебивает более новую строку облака».
- [ ] `src/store/core.ts:218` — если записи нет и облако не прочитано, правка пользователя тоже получает `FALLBACK_TS`, и облако её затрёт. Условие: метку 1999 получают только автозаписи; явная правка пользователя пишется с обычной меткой.
- [ ] `supabase/migrations/002_questflow2.sql:395` + `src/sections/progress/game.ts:54` — у `game_events` политика `for all`, сайт делает upsert события поверх строки бота, дедуп бота по 23505 обходится. Условие: для `game_events` только insert+select; сайт шлёт события через insert с игнором дублей (`ignoreDuplicates`) и строку бота не перезаписывает.
- [ ] `src/App.tsx:714,717` (+ goals, health, today, CalendarTimeBlocking, LifeAnalyticsHub — 6 мест) — `bonus` с `ref` на `Date.now()`, журнал повтор не ловит, числа идут мимо RULES. Условие: у каждой награды стабильный ref от факта (например `fill:<дата>`), повтор того же факта даёт `rejected:'duplicate'`.
- [ ] `src/App.tsx:442-448` — окно подтверждения обещает сбросить только уровень, EXP и золото, а `setTasks([])` и `setRewards([])` мягко удаляют все задачи и награды в облаке и у бота. Условие: сброс трогает только статы.

### Сайт
- [ ] `src/components/CalendarTimeBlocking.tsx:520, 83-91` — галочки «Пятница — восстановление» открываются для любой пятницы и начисляют `bonus` с ref на `Date.now()` без предела. Условие: чек-лист с наградой только для сегодняшней пятницы; начисление через `applyGame({kind:'recovery_activity', ref:`${date}:${act.id}`})`, как в CommandCenterToday.tsx:489.
- [ ] `src/components/BigDataLifeTracker.tsx:144` + `src/sections/health/index.tsx:24` — награда за заполненный день идёт как `bonus` 20/15 мимо RULES и журнала; путь `bigdata_fill` (src/sections/progress/index.tsx:65) мёртвый. Условие: `applyGame({kind:'bigdata_fill', ref:<дата дня>})`, `onLogReward(20,15)` убран.
- [ ] Повтор в 3+ местах, `src/sections/{today,goals,health,channels}` → `ctx.onAwardRewards` / `onLogReward` / `onPublishReward` — «награда числами в обход правил». Мёртвые хвосты: CommandCenterToday.tsx:470, MediaStudioHub.tsx:5 → ContentProductionBoard.tsx:20, FinancesTracker.tsx:68 (`onAddGoldReward`). Условие: в разделах нет ни одного вызова `kind:'bonus'`; мёртвые пропы удалены из SectionContext и компонентов.
- [ ] Мёртвый код: `src/components/AiLifeAdvisorModal.tsx` + `src/utils/aiLifeAdvisor.ts`, `src/components/HabitsDailiesView.tsx`; в `src/utils/bigDataTracker.ts:26-110` BiometricsData, HormoneData, SleepCycleSyncConfig, createEmptyBigDataMonth (месяц 8), `initialBigDataMonth = 'Август'`, calculateMonthlyStats (нарушает R27.1 «без зашитого августа»); `CalendarTimeBlocking.tsx:71,133` (copiedFeed, handleCopyFeedUrl с выдуманным `feed-demo.ics`); `storage.ts:12` `loadTasks`. Условие: всё удалено, `npm run check` зелёный.
- [ ] «Сегодня» по UTC вместо Бишкека в 5 местах (R72i): CalendarTimeBlocking.tsx:429, utils/naturalLanguageParser.ts:74, utils/calendarSync.ts:8, utils/googleCalendarApi.ts:107, utils/googleFitApi.ts:125. Условие: везде `todayStr` / `addDays` из `@shared/time`, `toISOString().split('T')[0]` в src не осталось.
- [ ] `src/sections/today/mainTask.ts:14` + `FocusStrip.tsx:36` — вечерний план бота (kv `plan:<дата>.mainTaskId`) сайт не читает, утром в Telegram и на сайте разные главные задачи. Условие: сначала берётся `plan:<today>.mainTaskId`, если задача существует и не выполнена; `pickMainTask` — только запасной вариант.

### Сервер и бот
- [ ] `server/src/scheduler.ts:147,172,190,199,203` — отметка «отправлено» пишется до `send`, `false` не проверяется; при сбое Telegram/Supabase утро, публикации, будильники и четверг пропадают на день; упавший `startEvening` — ни разговора, ни напоминания в 22:00. Условие: при `send() === false` или ошибке отметка снимается, следующий тик в окне повторяет отправку.
- [ ] `server/src/conversation/index.ts:291` (вызов в `server/src/index.ts:155`) — повтор отложенного анализа шлёт «анализ с опозданием» и в пятницу. Условие: `retryPending` ничего не отправляет, если `isRecoveryDay(todayStr(now))`, и тест на это есть.
- [ ] `server/src/scheduler.ts:138` + `conversation/index.ts:196` — если месяц кончается в пятницу (2027-04-30, 2027-12-31), отчёт месяца и вопрос о желаниях не приходят никогда. Условие: субботний разговор ставит `flags.month` и шаг `wishes`, если вчерашняя пятница была последним днём месяца.
- [ ] `server/src/scheduler.ts:234` / `server/src/timerWatch.ts:204` — бот не «доводит» таймер, если сайт закрыт; «отдых закончился» не приходит. Условие: сначала `settleTimer` из `shared/timer`, потом `computeTimer`; `timerWatch.ts` удалить; тест «сайт закрыт → через 20 мин одно "Отдых закончился"».
- [ ] `server/src/ai.ts:228`, `server/src/conversation/telegram.ts:17` — `fetch` к Claude API и к файлу Telegram без таймаута; всё стоит в общем замке разговора (`index.ts:56`), планировщик ждёт замок (`scheduler.ts:204`). Условие: у обоих `fetch` есть `AbortSignal.timeout`, тик планировщика не ждёт разговор дольше заданного предела, таймер-уведомления выходят, пока идёт анализ.
- [ ] `server/src/ai.ts:204-207` — `claude -p` для текста тянет глобальный CLAUDE.md, скиллы и все MCP-серверы (~117 тыс. токенов, 40 с). Условие: для анализа инструменты и MCP отключены (проверь реальные флаги `claude --help`, например `--strict-mcp-config` с пустым конфигом, `--tools`/`--allowedTools`; `--bare` НЕ использовать). Расход проверить по `usage` в JSON-ответе одного настоящего вызова на безобидном тексте без личных данных, обновить цифры в `docs/ai-and-costs.md:34`.
- [ ] `server/src/index.ts:185` — текст ошибки при падении уходит в `logs/` без `redact`. Условие: сообщение проходит через `redact(…, config)`, если `config` уже прочитан.
- [ ] `server/src/conversationStub.ts` — не используется. Условие: удалить.
- [ ] `server/src/ai.ts:54` — `DEFAULT_API_MODEL = 'claude-sonnet-4-5'` устарел. Условие: `claude-sonnet-5-5`.
