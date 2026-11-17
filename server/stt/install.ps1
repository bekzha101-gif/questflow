# Установка распознавания голоса (faster-whisper) в server/stt/.venv.
# Запуск: powershell -ExecutionPolicy Bypass -File server\stt\install.ps1 [-Model medium]
# Модель (~1.5 ГБ для medium) скачивается один раз в кеш Hugging Face при первой проверке.
param([string]$Model = "medium")
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$venv = Join-Path $here ".venv"
if (-not (Test-Path $venv)) {
  Write-Host "Создаю окружение $venv"
  python -m venv $venv
}
$py = Join-Path $venv "Scripts\python.exe"
& $py -m pip install --upgrade pip
& $py -m pip install -r (Join-Path $here "requirements.txt")
# cuBLAS/cuDNN из pip лежат в site-packages\nvidia\*\bin — transcribe.py добавляет их в PATH сам
Write-Host "Проверка: загрузка модели $Model"
& $py -c "from faster_whisper import WhisperModel; WhisperModel('$Model', device='cuda', compute_type='float16'); print('Whisper готов')"
Write-Host "Готово. Сервер найдёт окружение сам (или задай WHISPER_PYTHON в server/.env)."
