# Сервер QuestFlow на этом компьютере

Node 22 + TypeScript, папка `server/`. Работает 24/7 на этом компьютере. Делает две вещи:

- **AI-советник:** раз в ~30 с проверяет запрос с сайта (kv `ai_advisor`), разбирает месяц через Claude (`claude -p`, запасной путь — Claude API) и пишет ответ обратно на сайт.
- **Бэкап:** раз в сутки пишет `server\backups\questflow-ГГГГ-ММ-ДД.json` со всеми таблицами. Хранится 60 дней.

Telegram-бот, вечерний разговор, напоминания и расшифровка голоса убраны 2026-11-24 по просьбе владельца: управление идёт через Claude напрямую. Старый код — в истории git (до коммита с этим текстом).

## Установка (один раз)

1. Миграция `supabase/migrations/002_questflow2.sql` должна быть применена к базе Supabase.
2. Скопировать `server/.env.example` в `server/.env` и вписать значения: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (только на этом компьютере), `OWNER_USER_ID`, по желанию `ANTHROPIC_API_KEY`.
3. `cd server; npm install; npm run build`.
4. Автозапуск, PowerShell **от имени администратора**:
   ```
   powershell -ExecutionPolicy Bypass -File server\scripts\install-service.ps1 -StartNow
   ```
   Задача Планировщика «QuestFlow Server» запускает `scripts\run.ps1` при включении компьютера. Упавший сервер поднимается через 10 секунд.

## Каждый день

- Логи: `server\logs\server-ГГГГ-ММ-ДД.log` (вывод сервера) и `run-ГГГГ-ММ-ДД.log` (перезапуски). Хранятся 30 дней.

## Перезапуск и остановка

```
Stop-ScheduledTask  -TaskName "QuestFlow Server"
Start-ScheduledTask -TaskName "QuestFlow Server"
```
После обновления кода: `cd server; npm install; npm run build`, затем остановить и запустить задачу.

Удалить автозапуск: `powershell -ExecutionPolicy Bypass -File server\scripts\install-service.ps1 -Uninstall` (от администратора).
