@echo off
setlocal enabledelayedexpansion
cd /d %~dp0

echo.
echo 🌸 Uruchamiam komunikator Miku...
echo.

if not exist node_modules (
  echo 📦 Instaluję zależności launchera...
  call npm install || goto :error
)

call npm run start:render
if errorlevel 1 goto :error

goto :eof

:error
echo.
echo ❌ Coś poszło nie tak. Wciśnij dowolny klawisz, aby zamknąć okno.
pause >nul
exit /b 1
