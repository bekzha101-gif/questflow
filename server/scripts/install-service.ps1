# Ставит автозапуск QuestFlow-сервера: задача Планировщика Windows «при запуске системы»
# под текущим пользователем (нужен его вход в Claude CLI). Запускать от администратора:
#   powershell -ExecutionPolicy Bypass -File server\scripts\install-service.ps1
# Удалить:  powershell -ExecutionPolicy Bypass -File server\scripts\install-service.ps1 -Uninstall
param(
  [switch]$Uninstall,
  # Сразу запустить задачу после установки
  [switch]$StartNow
)

$ErrorActionPreference = "Stop"
$TaskName = "QuestFlow Server"
$RunScript = Join-Path $PSScriptRoot "run.ps1"
$ServerDir = Split-Path -Parent $PSScriptRoot

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host "Нужны права администратора: открой PowerShell «от имени администратора» и запусти снова."
  exit 1
}

if ($Uninstall) {
  if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Задача «$TaskName» удалена."
  } else {
    Write-Host "Задачи «$TaskName» нет."
  }
  exit 0
}

if (-not (Test-Path (Join-Path $ServerDir ".env"))) {
  Write-Host "Нет server\.env — сначала: cd server; npm install; npm run setup"
  exit 1
}

$user = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$RunScript`"" `
  -WorkingDirectory $ServerDir
$trigger = New-ScheduledTaskTrigger -AtStartup
# S4U: задача идёт без входа в систему и без хранения пароля, под текущим пользователем
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType S4U -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal `
  -Settings $settings -Description "QuestFlow: AI-советник и бэкап (server\scripts\run.ps1)" -Force | Out-Null

Write-Host "Задача «$TaskName» создана: запуск при включении компьютера под $user."
Write-Host "run.ps1 перезапускает сервер через 10 с после падения; если упал сам run.ps1 — Планировщик поднимет его через 1 мин."
if ($StartNow) {
  Start-ScheduledTask -TaskName $TaskName
  Write-Host "Задача запущена. Логи: $ServerDir\logs"
}
