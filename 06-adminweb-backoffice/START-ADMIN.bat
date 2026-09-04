@echo off
chcp 65001 >nul
title LiveBMKode AdminWEB
cd /d "%~dp0"

echo.
echo   ==========================================
echo      LiveBMKode AdminWEB
echo   ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 goto NO_NODE

if not exist ".env" goto COPY_ENV
:ENV_READY

if not exist "node_modules" goto INSTALL
:DEPS_READY

echo   Starting server...
echo.
node admin-server.js

echo.
echo   Server stopped.
echo.
pause
exit /b 0


:COPY_ENV
if not exist "..\rerun_tiktok_bmkode\.env" goto NO_ENV
copy "..\rerun_tiktok_bmkode\.env" ".env" >nul
echo   Copied .env from rerun_tiktok_bmkode
echo.
goto ENV_READY


:INSTALL
echo   First run - downloading packages, please wait 1-2 minutes
echo.
call npm install
if errorlevel 1 goto INSTALL_FAIL
echo.
goto DEPS_READY


:NO_NODE
echo   [ERROR] Node.js not found on this computer.
echo.
echo   Install the LTS version from https://nodejs.org
echo   then run this file again.
echo.
pause
exit /b 1


:NO_ENV
echo   [ERROR] .env file not found.
echo.
echo   Copy the .env file from the rerun_tiktok_bmkode folder
echo   into this folder, then run this file again.
echo.
pause
exit /b 1


:INSTALL_FAIL
echo.
echo   [ERROR] npm install failed.
echo   Check your internet connection and run this file again.
echo.
pause
exit /b 1
