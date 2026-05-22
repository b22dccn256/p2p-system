@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo [1/4] Dang khoi dong Bootstrap Server...
start "Bootstrap Server" cmd /k "title Bootstrap Server && node bootstrap-server/server.js"

:: Đợi 2 giây cho Server chạy lên hẳn
timeout /t 2 /nobreak >nul

echo [2/4] Dang khoi dong Peer 1...
start "Peer A" cmd /k "title Peer A && node src/cli.js"

echo [3/4] Dang khoi dong Peer 2...
start "Peer B" cmd /k "title Peer B && node src/cli.js"

echo [4/4] Dang khoi dong Peer 3...
start "Peer C" cmd /k "title Peer C && node src/cli.js"

echo Hoan tat! Hay kiem tra cac cua so hien len.
