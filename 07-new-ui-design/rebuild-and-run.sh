#!/usr/bin/env bash
# แพ็ก renderer ล่าสุดเข้า app.asar แล้วเปิดแอปจริง (ใช้จาก Git Bash)
set -e
ROOT="C:/Users/Betovenz/Documents/BMKODE/ProjectR/SPRR01"
cd "$ROOT"
for f in 05-updated-source-from-asar/dist/js/*.js 05-updated-source-from-asar/dist/js/views/*.js 05-updated-source-from-asar/dist-electron/main.js 05-updated-source-from-asar/dist-electron/preload.js; do node --check "$f"; done
if powershell -NoProfile -Command "exit @(Get-Process -Name 'Rerun Studio' -ErrorAction SilentlyContinue).Count"; then :; else
  echo "แอปกำลังเปิดอยู่ — ปิดก่อน (kill เพื่อไม่ให้ updater ติดตั้ง 0.7.13 ทับ)"; powershell -NoProfile -Command "Get-Process -Name 'Rerun Studio' -ErrorAction SilentlyContinue | Stop-Process -Force"; sleep 1
fi
npx --yes @electron/asar@3 pack 05-updated-source-from-asar 04-updated-packaged-app/resources/app.asar --unpack-dir node_modules/ffmpeg-static
ls -la 04-updated-packaged-app/resources/app.asar
if [ "$1" != "--no-run" ]; then
  cd 04-updated-packaged-app && (./"Rerun Studio.exe" > "$ROOT/07-new-ui-design/last-run.log" 2>&1 &) && echo "เปิดแอปแล้ว (log: 07-new-ui-design/last-run.log)"
fi
