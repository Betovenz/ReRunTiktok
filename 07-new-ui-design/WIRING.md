# UI v11 — สรุปการเชื่อม function กับ UI ใหม่

อัปเดต 2 ก.ย. 2569

## ทำอะไรไปบ้าง

1. **ลบ UI เดิมออกหมด** — React bundle เดิม (`index-BLJkgDnq.js` 292 KB + `index-CfzZVKyl.css` 61 KB + `index.html`) ถูกลบออกจาก `05-updated-source-from-asar/dist/`
   สำรองไว้ที่ `_old-ui-backup/dist-old-react/` และ asar ตัวเดิมที่ `_old-ui-backup/app.asar.before-ui-v11`
2. **เขียน renderer ใหม่ตามดีไซน์ v11** — ไม่มี build step (โปรเจกต์นี้ไม่มี source React เหลือแล้ว มีแต่ build output) จึงเขียนเป็น vanilla JS โหลดตรงจาก `file://`
3. **แพ็ก `app.asar` ใหม่** ลง `04-updated-packaged-app/resources/app.asar` — ทดสอบเปิดแอปจริงแล้วขึ้น UI ใหม่

4. **แถบบนหน้าต่างใหม่ (แบบ B)** — เอา title bar + เมนู `File / Edit / View / Window / Help` ของ Windows ออก
   แล้ววาดแถบเองสูง 38px: โลโก้ + ชื่อแอป + ชื่อร้านที่เลือก + ป้าย ON AIR (กดไปหน้าควบคุมไลฟ์ได้) + ปุ่ม ย่อ/ขยาย/ปิด
5. **ฝังฟอนต์จริงของ mock** — IBM Plex Sans Thai (400/500/600/700) + IBM Plex Mono (500/600) รวม 199 KB
   อยู่ใน `dist/assets/fonts/` ประกาศเป็น `@font-face` ใน `app.css` — ตรงกับดีไซน์ 100% และไม่ต้องต่อเน็ต

**main process / preload แก้เฉพาะเรื่องหน้าต่าง** — นอกนั้นใช้ `window.rerun` ชุดเดิมทั้งหมด
| ไฟล์ | ที่แก้ |
| --- | --- |
| `main.js` | `frame: false` + `autoHideMenuBar: true` · `backgroundColor` เป็นสีธีมมืด · `Menu.setApplicationMenu(null)` · IPC `window:minimize` `window:toggle-maximize` `window:close` `window:is-maximized` · ส่ง event `window:state` ตอน maximize/unmaximize |
| `preload.js` | เปิดช่อง `minimizeWindow` `toggleMaximizeWindow` `closeWindow` `isWindowMaximized` `onWindowState` |

ทดสอบในแอปจริงแล้ว: ปุ่มย่อ (iconic ✓) · ปุ่มขยาย/คืนขนาด (zoomed ✓) · ปุ่มปิด (✓) · ลากย้ายหน้าต่างจากแถบบน · ลากขอบย่อ-ขยายยังใช้ได้ปกติ

## ไฟล์ใหม่

```
05-updated-source-from-asar/dist/
├── index.html          โครงหน้า + โหลดสคริปต์ตามลำดับ core → actions → views/* → app
├── app.css             @font-face (IBM Plex) + design token v11 (dark/light) + keyframes + class พื้นฐาน
├── assets/fonts/       IBM Plex Sans Thai 400–700 · IBM Plex Mono 500/600 (woff2, subset ไทย+latin)
└── js/
    ├── core.js         API bridge (+ preview stub) · state S · helper (el/hov/toast/modal/busy/probeDuration/dropZone) · แปลง state → stream config
    ├── actions.js      action ที่หลายหน้าใช้ร่วม: เริ่ม/หยุดไลฟ์ · Preset · สถิติ · แชท
    ├── views/shell.js  แถบบนหน้าต่าง (แบบ B) + sidebar
    ├── views/login.js  เข้าสู่ระบบ (License)
    ├── views/home.js   หน้าแรก
    ├── views/setup.js  หน้าไลฟ์ 3 ขั้น + พรีวิว 9:16
    ├── views/control.js Live Control (แชท/สินค้า/ยอดขาย)
    ├── views/library.js คลัง + Preset
    ├── views/perf.js   ผลงาน + นำเข้า CSV
    ├── views/settings.js ตั้งค่า (ระบบ/LINE/แชท AI/แอดมิน)
    └── app.js          router · render · subscribe event · timer · bootstrap
```

อ้างอิงดีไซน์: `07-new-ui-design/mock-sections/*.html` (แยกจาก mock ทีละหน้า) + `AGENT-BRIEF.md` (กติกาการลอก mock)

## ปุ่มในดีไซน์ → ฟังก์ชันจริง

| UI | เรียกอะไร |
| --- | --- |
| เข้าสู่ระบบ (รหัสลูกค้า/user/pass) | `license:login` · เช็คตอนเปิดแอปด้วย `license:status` · ออกจากระบบ `license:logout` |
| การ์ดร้านใน sidebar · เพิ่ม/ลบบัญชี | state ฝั่ง renderer (localStorage) + `tiktok:status` ต่อบัญชี |
| เชื่อม TikTok / เปิด TikTok | `tiktok:login` · `tiktok:open` |
| เปิด LIVE Manager | `tiktok:open-shop` |
| + เพิ่มคลิปจากเครื่อง | `media:choose-video` → `media:probe-clips` (ได้ความละเอียด/fps มาโชว์) |
| ▲▼ ✕ จัดคิวคลิป · สุ่มลำดับ | เก็บใน state → ส่งเข้า `stream:start` / `stream:apply-config` |
| ▶ ดูวิดีโอ | เปิด `<video>` จากไฟล์ในเครื่อง (modal) |
| + รูป | `media:choose-overlay` |
| + นาฬิกา / + ข้อความ | สร้าง layer ใน state (ตรง schema `clocks[]` / `texts[]` ของ main) |
| ลากวางบนพรีวิว 9:16 | อัปเดต x/y ในพิกัด 1080×1920 จริง |
| แผงปรับ layer (ขนาด/โปร่งใส/เอฟเฟกต์/ฟอนต์/สี/สไตล์/รูปแบบเวลา) | ค่าตรงกับ `sanitizeFont` / `sanitizeDesign` / `sanitizeClockFormat` / `sanitizeEffect` ใน main |
| ปรับกล้อง (ซูม/พลิก/รีเซ็ต) | `camera` ใน stream config |
| ตั้งค่าขั้นสูง (TikTok อัตโนมัติ / Manual RTMP / stream key / bitrate) | `targetMode` · `rtmpServer` · `streamKey` · `bitrateKbps` |
| ▶ เริ่มไลฟ์ตอนนี้ | `stream:start` |
| อัปเดตให้ไลฟ์นี้ | `stream:apply-config` |
| ⏹ หยุดไลฟ์ (ผ่าน modal ยืนยัน) | `stream:stop` |
| แถบ ON AIR (บิตเรต/เฟรม/ความเร็วเข้ารหัส) | event `stream:health` |
| คนดู / GMV / ออร์เดอร์ | `pin:live-stats` (ดึงทุก 60 วิ) |
| แท็บแชท · toggle ตอบอัตโนมัติ · เพิ่มกฎด่วน | `chat:get-config` / `chat:set-config` · ข้อความเข้าจาก event `chat:event` |
| แท็บสินค้า · ปักอัตโนมัติทุก N นาที · ดึงสินค้าจากไลฟ์ · ปักเลย · ข้าม/ใส่กลับ · ปักคูปอง | `pin:get-config` `pin:set-config` `pin:list-products` `pin:pin-now` `pin:coupon` |
| คลัง · เพิ่มวิดีโอ · ลบ · กดการ์ดเพื่อเข้าคิว | `library:list` `library:add` `library:remove` |
| ผลงาน · KPI · กราฟ · ประวัติ | `history:list` + event `history:changed` · `sales:list` |
| นำเข้ายอดขาย CSV | `sales:choose-file` → `sales:preview` (แม็ปคอลัมน์) → `sales:commit` · ลบชุด `sales:remove-batch` |
| ตั้งค่า → ระบบ | `app:info` · `update:*` · `system:benchmark` · `tiktok:scan-live-console` |
| ตั้งค่า → LINE | `line:get-config` `line:set-config` `line:test` `line:push-status` |
| ตั้งค่า → แชท AI | `chat:set-config` (provider/apiKey/model/context/useProducts + กฎคีย์เวิร์ด) |
| ตั้งค่า → แอดมิน 🔒 | `admin:unlock` `admin:list` `admin:issue-key` `admin:lookup` `admin:revoke` `admin:lock` |
| ชิปอัปเดตบนแถบบน | event `update:status` → `update:install` (ยืนยันก่อน · กันกดตอนกำลังไลฟ์) |
| ประกาศจากหลังบ้าน | `announcements:get` (เด้ง modal ครั้งเดียวต่อประกาศ) |

## ของที่ดีไซน์มี แต่ backend เดิมไม่มี — จัดการยังไง

| ของ | วิธีที่ทำ |
| --- | --- |
| **Preset (กดไลฟ์ซ้ำปุ่มเดียว)** | ไม่มี IPC รองรับ → เก็บใน `localStorage` ฝั่ง renderer ทั้งชุด (คลิป · layer · กล้อง · ชื่อไลฟ์ · bitrate) ใช้งานได้จริงครบ |
| **ตั้งเวลาเล่นคลิป (ทุกวัน)** | main ไม่มี API ควบคุม playlist ตามเวลา → renderer เช็คทุกนาที ถ้าถึงเวลาที่ตั้งไว้ **และบัญชีนั้นกำลังไลฟ์อยู่** จะดันคลิปนั้นขึ้นหัวคิวแล้วเรียก `stream:apply-config` ให้มีผลทันที (ภาพสะดุด 1–2 วิ ตามกลไกเดิมของ main) |
| **รายชื่อ 10 ร้านในดีไซน์** | เป็นข้อมูลตัวอย่างใน prototype — ของจริงคือบัญชีที่ผู้ใช้เพิ่มเอง เก็บใน localStorage เหมือนที่ UI เดิมทำ |
| **CPU %** | ไม่มีค่านี้จาก main → แสดง **ความเร็วเข้ารหัส (speed)** จาก `stream:health` แทน ซึ่งเป็นตัวเลขที่บอกได้จริงว่าเครื่องตามทันไหม |
| **ความยาวคลิป (duration)** | `media:probe-clips` คืนแค่ ความละเอียด/fps ไม่มี duration → แสดง label สเปกคลิปแทน |
| **"กำลังเล่นคลิปไหน · progress bar"** | main ไม่ได้ส่ง playback offset ออกมา → แสดงจำนวนคลิปในคิว + โหมดสุ่ม/ตามลำดับ แทนการเดา |

## หลักที่ยึดจาก brief

- ปุ่ม **ปักเลย / ปักคูปองเลย** อยู่เฉพาะใน Live Control เท่านั้น — กดได้จริงเสมอ ไม่มีปุ่ม disabled ให้งงเหมือนเดิม
- ปุ่มที่กดไม่ได้ทุกตัว **บอกเหตุผล** — เช็คลิสต์ก่อนไลฟ์กด "ดูรายละเอียด" เห็นว่าติดข้อไหนและต้องทำอะไร
- ปุ่มทำลาย (หยุดไลฟ์ · ลบบัญชี · ล้างประวัติ · ถอนสิทธิ์) **ยืนยันก่อนทุกครั้ง**
- ปุ่มที่เรียก API แสดงสถานะกำลังทำงานในตัวปุ่มเอง และกันกดซ้ำ
- ผลลัพธ์ทุกอย่างขึ้น toast รวมถึงเหตุผลตอนล้มเหลว

## ข้อควรรู้

- **ฟอนต์** — ใช้ IBM Plex Sans Thai / IBM Plex Mono ตรงกับ mock โดยฝังไฟล์ `.woff2` ไว้ใน `dist/assets/fonts/`
  (เฉพาะ subset ไทย + latin + latin-ext รวม 199 KB) ไม่ผูก Google Fonts จึงใช้ได้ตอนออฟไลน์
  ตั้ง `font-synthesis-weight: none` เพื่อไม่ให้เบราว์เซอร์ปลอมตัวหนา — ความหนาที่เห็นคือของจริงทุกน้ำหนัก
- **สัญลักษณ์ที่ใช้ได้กับฟอนต์นี้** — subset ที่ฝังไว้ครอบคลุมแค่ ไทย + latin + latin-ext
  ตัวที่อยู่นอก subset (เช่น `⬇` U+2B07, `⏹` U+23F9) จะ fallback เพี้ยนเป็นขีดหรือ emoji สี
  จึงใช้ `↓` (U+2193) และ `■` (U+25A0) ที่อยู่ใน unicode-range ของ Plex แทน — **ถ้าจะเพิ่มไอคอนใหม่ ให้เช็ค unicode-range ก่อน**
- **ตัว updater** — แอปใน `04-updated-packaged-app` ยังชี้ feed เดิม (`panthilasii/rerun-studio-releases`) และมี 0.7.13 ดาวน์โหลดค้างอยู่ใน cache
  `electron-updater` ตั้ง `autoInstallOnAppQuit` เป็น true โดยปริยาย — **ถ้าปิดแอปแบบปกติ มันอาจติดตั้ง 0.7.13 ทับ clone นี้และ UI ใหม่จะหายไป**
  ถ้าจะเก็บ clone นี้ไว้ ควรปิด auto-update ในหน้าตั้งค่า หรือลบ `%LOCALAPPDATA%\rerun-studio-updater\pending\` ทิ้งก่อน

## วิธี build ซ้ำหลังแก้ UI

```bash
cd C:/Users/Betovenz/Documents/BMKODE/ProjectR/SPRR01
npx @electron/asar pack 05-updated-source-from-asar 04-updated-packaged-app/resources/app.asar --unpack-dir node_modules/ffmpeg-static
```

## รอบ "ลอก mock ให้ตรงทุก element" (3 ก.ย. 2569)

ผู้ใช้เทียบภาพแล้วบอกว่าของจริงด้อยกว่า mock — รอบนี้จึง **ลอก inline style จาก mock มาใช้ตรง ๆ** (แปลง `{{ T.x }}` → `var(--x)`) แทนการตีความผ่าน class ใน `app.css`
ทำโดย agent แยกไฟล์ต่อหน้า (`js/views/*.js`) แล้วมี agent อีกชุดตรวจแบบจับผิดเทียบ `mock-sections/*.html` + `state.js` ทีละ element และแก้ตามผลตรวจ

| หน้า | element ที่ลอกจาก mock | คะแนนตรง mock (0–100) หลังแก้ |
| --- | --- | --- |
| sidebar + แถบบน | 44 | 80 → เพิ่มปุ่ม ON AIR ใน sidebar และให้บรรทัดสถานะขึ้นบรรทัดใหม่ตาม mock แล้ว |
| หน้าแรก | 57 | 94 |
| ไลฟ์ (3 ขั้น + พรีวิว) | 96 | 88 → แก้กล่องบัญชีให้เขียวเสมอตาม mock แล้ว |
| Live Control | 101 | 86 → คืนปุ่ม "จัดการกฎ (N)" · เก็บ "คนดูสูงสุด" ฝั่ง renderer แล้ว |
| คลัง | — | 88 → ตัดปุ่มแก้ไขจากการ์ด Preset ใบแรก · แสดง "ใช้ล่าสุด" จาก `usedAt` แล้ว |
| ผลงาน | — | 92 |
| ตั้งค่า | — | 82 → ยืนยันก่อนอัปเดต/ลบกฎ · กันกดซ้ำที่ลิงก์ตรวจอัปเดต · น้ำหนักปุ่มขอบ 400 ตาม mock แล้ว |

**ของที่จงใจไม่ลอกตาม mock** (เพราะ mock เป็นข้อมูลตัวอย่าง / ผิดจากระบบจริง)
- ชื่อร้าน 10 ร้าน · promo-a.mp4 · ตัวเลข 12 ครั้ง / 128,400 / 214 คนดู → ใช้ข้อมูลจริงจาก `S`/API ทั้งหมด ไม่มีข้อมูลก็แสดง empty state ในกรอบเดิม
- "CPU 62%" → ไม่มีค่านี้จาก main จึงแสดง **ความเร็วเข้ารหัส** จาก `stream:health` ในตำแหน่งเดียวกัน
- "0:22 / 0:45" ในการ์ดกำลังเล่น → main ไม่ส่ง playback offset จึงแสดงจำนวนคลิป + ความยาวรวมแทน
- คำอธิบายแท็บแชท AI "ตั้งครั้งเดียว ใช้กับทุกไลฟ์" → ของจริงตั้ง **ต่อบัญชี** (`chat:set-config(acc.id)`) จึงเขียนให้ตรงความจริง
- ปุ่ม เชื่อม/เปิด TikTok ในกล่องบัญชี · ปุ่มลบ ✕ บนแถวร้าน/การ์ด Preset · ปุ่ม "จัดการกฎ (N)" → mock ไม่มี แต่เป็นทางเข้าเดียวของฟังก์ชันจริง จึงคงไว้แบบเล็กและกลมกลืน

**ความยาวคลิป** — main ไม่ส่ง duration มา จึงอ่านจาก metadata ของ `<video>` ในเครื่องด้วย `probeDuration()` (cache ต่อไฟล์) ใช้ทั้งแถวคลิปในหน้าไลฟ์ และการ์ด/ยอดรวมในคลัง
**ลากไฟล์วาง** — เพิ่ม `webUtils.getPathForFile` ใน preload (Electron 33 ไม่มี `File.path` แล้ว) + IPC `library:add-paths` ใน main → ช่อง "ลากไฟล์มาวางที่นี่" รับไฟล์จริงได้

ไฟล์อ้างอิง: `mock-sections/` (mock แยกรายหน้า) · `AGENT-BRIEF.md` (กติกาการลอก) · `views-before/` (view ก่อนรอบนี้ ใช้เทียบ regression)

## เมนู sidebar แบบ B (3 ก.ย. 2569)

ผู้ใช้เลือกจาก 4 แบบใน `nav-options.html` → **แถบชี้ด้านซ้ายโปร่ง**: รายการที่เลือกมีแถบเรืองแสง 3px ด้านซ้าย + ตัวอักษร `accentHi` + พื้นจาง `--navOnBg` (token ใหม่ แยกค่าตามธีม .22 มืด / .10 สว่าง) · hover = `surface2` · ไอคอนเปลี่ยนจาก unicode (⌂ ▶ ▤ ▥ ⚙) เป็น **SVG เส้นเดียวกันทั้งชุด** (`NAV_ICONS` ใน `views/shell.js`) ขนาด 20px
`index.html` ใส่ `?v=<stamp>` ท้าย css/js ทุกไฟล์กัน cache — **เวลาแก้ UI ให้เปลี่ยน stamp ด้วย**
