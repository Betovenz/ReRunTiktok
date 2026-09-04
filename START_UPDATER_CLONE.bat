@echo off
chcp 65001 >nul
title BMK Live - Rerun Studio Updater Clone 0.7.6
cd /d "%~dp0"

start "BMK AdminWEB - Updater Clone" "%~dp0\06-adminweb-backoffice\START-ADMIN.bat"
timeout /t 3 /nobreak >nul

cd /d "%~dp0\04-updated-packaged-app"
start "Rerun Studio 0.7.6 Updater Clone" "Rerun Studio.exe"
