# BMK Live Updater Clone - Rerun Studio 0.7.6

โฟลเดอร์นี้เป็น clone แยกของตัวอัปเดตที่ `electron-updater` ดาวน์โหลดไว้ใน cache `rerun-studio-updater`

## โครงสร้าง

- `01-update-feed-and-config/` เก็บ `app-update.yml` จากแอปเดิม ระบุ GitHub feed และ cache name
- `02-updater-cache/` สำเนา cache updater เดิมจาก `C:\Users\user\AppData\Local\rerun-studio-updater`
- `03-update-installer-payload/` payload ภายใน installer update `Rerun-Studio-0.7.6-x64.exe`
- `04-updated-packaged-app/` แอป Rerun Studio 0.7.6 ที่แตกออกมาแบบ runnable และ patch แล้ว
- `05-updated-source-from-asar/` source/build ที่ extract จาก `resources/app.asar` ของ 0.7.6
- `06-adminweb-backoffice/` AdminWEB ที่ patch ให้รองรับ login แบบ `รหัสลูกค้า + Username + Password`

## วิธีเปิดตัว updater clone

รันไฟล์:

```text
C:\BMK\_Live\Rerun-Studio-Updater-0.7.6-clone\START_UPDATER_CLONE.bat
```

ไฟล์นี้จะเปิด AdminWEB ก่อน แล้วเปิด Rerun Studio 0.7.6 ที่แตกจากตัวอัปเดตตามหลัง

## จุดที่ patch แล้ว

- `04-updated-packaged-app/resources/app.asar` ถูกแพ็กใหม่จาก source ที่แก้แล้ว
- `LICENSE_API_BASE` เปลี่ยนเป็น `http://localhost:4140`
- หน้า login เปลี่ยนเป็น `รหัสลูกค้า`, `Username`, `Password`
- renderer ส่ง `customerCode` และส่ง `licenseKey` ค่าเดียวกันเพื่อรองรับชื่อ field เดิม
- main process รับทั้ง `customerCode` และ `licenseKey`
- `ffmpeg.exe` ยังอยู่แบบ `app.asar.unpacked` ตามโครงสร้าง Electron เดิม

## Updater เดิมทำงานอย่างไร

- ใช้ dependency `electron-updater`
- อ่าน feed จาก `resources/app-update.yml`
- provider คือ GitHub
- owner คือ `panthilasii`
- repo คือ `rerun-studio-releases`
- cache dir คือ `rerun-studio-updater`
- event ที่ส่งเข้า UI: checking, available, downloading, ready, error
- เมื่อผู้ใช้กด `อัปเดตเลย · รีสตาร์ต` จะเรียก `autoUpdater.quitAndInstall()`

หมายเหตุ: installer ใน `02-updater-cache` เป็น artifact เดิมที่ดาวน์โหลดมา ยังไม่ได้ rebuild เป็น installer ใหม่ ส่วนตัว runnable ที่ patch แล้วคือ `04-updated-packaged-app\Rerun Studio.exe`
