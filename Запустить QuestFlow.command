#!/bin/bash
# Двойной клик: ставит зависимости (один раз), запускает QuestFlow и открывает его в браузере.
cd "$(dirname "$0")" || exit 1

if ! command -v npm >/dev/null 2>&1; then
  echo "Не найден Node.js/npm. Установи Node с https://nodejs.org и запусти файл снова."
  read -n 1 -s -r -p "Нажми любую клавишу, чтобы закрыть..."
  exit 1
fi

if [ ! -f node_modules/.mac-ready ]; then
  echo "Первый запуск: ставлю зависимости под этот Mac (1-2 минуты)..."
  rm -rf node_modules
  if npm install --no-audit --no-fund; then
    touch node_modules/.mac-ready
  else
    echo "Ошибка установки зависимостей."
    read -n 1 -s -r -p "Нажми любую клавишу, чтобы закрыть..."
    exit 1
  fi
fi

echo "Запускаю QuestFlow. Окно Терминала не закрывай, пока работаешь."
( sleep 4; open "http://localhost:5173" ) &
npm run dev
