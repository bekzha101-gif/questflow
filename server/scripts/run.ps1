# QuestFlow сервер: запускает сервер и перезапускает его при падении (через 10 секунд).
# Запуск вручную:  powershell -ExecutionPolicy Bypass -File server\scripts\run.ps1
# Автозапуск ставит install-service.ps1 (задача Планировщика вызывает этот файл).
param(
  # Что запускать (для проверки можно подставить другой .js)
  [string]$Entry = "",
  # Пауза перед перезапуском, секунд (должна быть меньше минуты)
  [int]$RestartDelaySec = 10,
  # Для проверки: остановиться после N запусков (0 — бесконечно)
  [int]$MaxRuns = 0
)

$ErrorActionPreference = "Continue"
# Вывод node — UTF-8; без этого PowerShell 5.1 читает его как OEM (cp866) и русский текст в логах ломается
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ServerDir = Split-Path -Parent $PSScriptRoot
Set-Location $ServerDir

$LogDir = Join-Path $ServerDir "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Write-Log([string]$Text) {
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Text
  $file = Join-Path $LogDir ("run-{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))
  Add-Content -Path $file -Value $line -Encoding utf8
  Write-Host $line
}

$Node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $Node) { Write-Log "node не найден в PATH"; exit 1 }

if (-not $Entry) {
  $Entry = Join-Path $ServerDir "dist\server\src\index.js"
  if (-not (Test-Path $Entry)) {
    Write-Log "Сборки нет — собираю (npm run build)"
    & npm run build 2>&1 | ForEach-Object { Write-Log $_ }
  }
}

# Старые логи (старше 30 дней) удаляются
Get-ChildItem $LogDir -Filter "*.log" -ErrorAction SilentlyContinue |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
  Remove-Item -Force -ErrorAction SilentlyContinue

$runs = 0
while ($true) {
  $runs++
  Write-Log "Запуск #$runs"
  $outFile = Join-Path $LogDir ("server-{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))
  & $Node $Entry 2>&1 | ForEach-Object { Add-Content -Path $outFile -Value $_ -Encoding utf8 }
  $code = $LASTEXITCODE
  Write-Log "Процесс завершился (код $code). Перезапуск через $RestartDelaySec с"
  if ($MaxRuns -gt 0 -and $runs -ge $MaxRuns) { break }
  Start-Sleep -Seconds $RestartDelaySec
}
