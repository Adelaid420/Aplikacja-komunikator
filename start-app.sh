#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

printf '\n🌸 Uruchamiam komunikator Miku...\n\n'
if [ ! -d "node_modules" ]; then
  printf '📦 Instaluję zależności launchera...\n'
  npm install
fi

npm run start:netlify
