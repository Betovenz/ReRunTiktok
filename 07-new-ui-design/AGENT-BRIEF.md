# Brief สำหรับงาน "ลอก mock ให้ตรงทุก element"

## เป้าหมาย
ทำให้ renderer จริง (`05-updated-source-from-asar/dist/js/views/<page>.js`) หน้าตา **ตรงกับ mock แบบ element ต่อ element**
โดย **ลอก inline style จาก mock มาใช้ตรง ๆ** (ไม่ตีความใหม่) และ **คงการเชื่อม function/IPC ที่มีอยู่แล้วทั้งหมด**
ผู้ใช้เทียบภาพหน้าจอแล้วบอกว่า "mock สวยกว่า ของจริงดูไม่มีคุณภาพ ฟังก์ชันไม่ครบ" — งานนี้ต้องปิดช่องว่างนั้นให้หมด

## ไฟล์ที่เกี่ยวข้อง (path เต็ม)
```
C:/Users/Betovenz/Documents/BMKODE/ProjectR/SPRR01/07-new-ui-design/mock-sections/<page>.html   ← mock ของหน้านั้น (template Claude Design)
C:/Users/Betovenz/Documents/BMKODE/ProjectR/SPRR01/07-new-ui-design/mock-sections/state.js       ← สูตร style ที่ mock คำนวณ (toggle, nav active, chip, แถวร้าน, bubble แชท ฯลฯ)
C:/Users/Betovenz/Documents/BMKODE/ProjectR/SPRR01/07-new-ui-design/mock-sections/README-spec.md ← สเปกดีไซน์ (token, ขนาด, พฤติกรรม)
C:/Users/Betovenz/Documents/BMKODE/ProjectR/SPRR01/05-updated-source-from-asar/dist/js/core.js    ← API bridge · state S · helper (อ่านอย่างเดียว ห้ามแก้)
C:/Users/Betovenz/Documents/BMKODE/ProjectR/SPRR01/05-updated-source-from-asar/dist/js/actions.js ← action ร่วม (อ่านอย่างเดียว ห้ามแก้)
C:/Users/Betovenz/Documents/BMKODE/ProjectR/SPRR01/05-updated-source-from-asar/dist/js/app.js     ← render()/go()/timer (อ่านอย่างเดียว ห้ามแก้)
C:/Users/Betovenz/Documents/BMKODE/ProjectR/SPRR01/05-updated-source-from-asar/dist/app.css       ← token + keyframes + class เดิม (อ่านอย่างเดียว ห้ามแก้)
C:/Users/Betovenz/Documents/BMKODE/ProjectR/SPRR01/07-new-ui-design/WIRING.md                     ← ปุ่มไหนเรียก IPC อะไร
```
**แก้ได้เฉพาะไฟล์ view ของตัวเอง** ที่ระบุใน task ห้ามแตะไฟล์อื่น (agent ตัวอื่นทำงานขนานอยู่)

## วิธีอ่าน mock
- template ใช้ `{{ T.token }}` → แปลงเป็น `var(--token)` เช่น `{{ T.surface }}` → `var(--surface)`
- `rgba({{ T.greenRgb }},.12)` → `rgba(var(--greenRgb),.12)` · `rgba({{ T.blueRgb }},.28)` → `rgba(var(--blueRgb),.28)`
- token ทั้งหมดมีใน `:root` ของ app.css แล้ว (bg side surface surface2 hover border borderHi text muted faint navText tint redTint redTint2 accentHi green redText amber greenRgb primary primaryDeep primaryHover blueRgb red)
- `style-hover="..."` → ใช้ helper `hov(node, 'สไตล์ตอน hover')` จาก core.js
- `<sc-for list="{{ xs }}" as="x">` → `.map(...)` · `<sc-if value="{{ cond }}">` → เงื่อนไข JS
- `onClick="{{ fn }}"` → `onClick: function(){...}` ใน props ของ `el()`
- style ที่ mock คำนวณใน `state.js` (เช่น `toggle(on)`, nav item active, chip on/off, แถวร้านที่เลือก, bubble แชท user/bot/ai, สถานะสินค้า pinning/queue/skip, จุดสถานะประวัติ) ให้ลอกสูตรมาทั้งสองสถานะ
- `'IBM Plex Mono',monospace` และ `'IBM Plex Sans Thai',sans-serif` ใช้ได้เลย (ฟอนต์ฝังไว้แล้ว) — หรือใช้ `var(--mono)` / `var(--font)`

## วิธีเขียน (ตาม convention ของ codebase)
- vanilla JS ไม่มี module — ทุกฟังก์ชันเป็น global โหลดผ่าน `<script>` ตามลำดับ core → actions → views → app
- สร้าง DOM ด้วย `el(tag, props, children)` — props: `class`, `style` (string), `text`, `html`, `onClick`/`onInput`/`onChange`, `title`, `value`, `checked`, `disabled`, attr อื่น ๆ
- **ใส่ style จาก mock เป็น inline string ใน prop `style`** ไม่ต้องพึ่ง class ใน app.css สำหรับ layout/สี (class เดิมยังใช้ได้ถ้าจำเป็น แต่ inline ชนะเสมอ)
- keyframes ที่มีให้แล้วใน app.css: `livePulse` `marquee` `eq` `spin` `toastIn` `floaty`
- helper ที่มีใน core.js: `el` `clear` `hov` `toast(msg, 'ok'|'err')` `openModal(build)` `confirmDialog({title,body,ok,cancel,danger})` `busy(button, label, task)` `pad2` `fmtClock` `fmtDur` `fmtMS(sec)` (m:ss) `fmtDate` `fmtMoney` `errText` `probeDuration(key, url)` (Promise<sec|null> มี cache) `fileUrl(path)` `dropZone(node, onPaths)` `layerList(acc)` `selectedLayer(acc)` `removeLayer` `clockText(format)` `designStyle(design,color)` `preflight(acc)` `buildStreamConfig(acc)` `isLive(acc)` `anyLive()` `curAcc()` `accById` `accIndex` `newAccount` `saveStore()` `applyTheme()`
- ค่าคงที่: `EFFECTS` `CLOCK_FORMATS` `FONTS` `DESIGNS` `CANVAS_W` `CANVAS_H` `AVATAR_COLORS` `NAV`
- action ร่วมใน actions.js: `startLive(acc, button)` `askStopLive(acc)` `pushLiveConfig(acc)` `savePreset(acc,name)` `applyPreset(acc,preset)` `presetSummary(preset)` `summarize(days)` `dailyBuckets(days)` `historyRow(h)` `selectBox(options,value,onPick)` `quickRuleDialog(acc)` `saveChatConfig(acc,patch)`
- state อยู่ใน `S` (ดู core.js) — เปลี่ยน state แล้วเรียก `render()` (re-render ทั้งหน้า) · **input ที่พิมพ์ต่อเนื่องให้แก้ state ใน onInput โดยไม่ render** แล้วค่อย `saveStore()` ตอน onChange
- API ทั้งหมดอยู่ใน `API.*` (ดูรายชื่อใน core.js บรรทัดต้น ๆ) คืน Promise เสมอ
- ปุ่มที่เรียก API ห่อด้วย `busy(button, 'ข้อความระหว่างทำ…', function(){ return API...; })`
- ปุ่มทำลายต้อง `confirmDialog` ก่อน · ผลลัพธ์ทุกอย่างขึ้น `toast`
- ห้ามใช้ emoji ที่เรนเดอร์เป็นกล่องดำ: `🗑` `⬇` `⏹` — ใช้ `✕` `↓` `■` แทน (emoji สีอย่าง 🖼 🕐 🅣 🎟 🔒 🌆 🌙 ☀️ ใช้ได้ mock ก็ใช้)
- ตัวเลข/เวลาใช้ `font-family:'IBM Plex Mono',monospace` ตาม mock

## ข้อมูลจริง vs ข้อมูลตัวอย่างใน mock
mock ใส่ตัวเลขตัวอย่าง (12 ครั้ง, 128,400 บาท, 214 คนดู, promo-a.mp4 ฯลฯ) — ของจริงต้องมาจาก `S` / API
- ถ้าไม่มีข้อมูล ให้แสดง empty state ที่ **วางในตำแหน่งและกรอบเดียวกับ mock** (ไม่ใช่ยุบการ์ดหาย) ข้อความ empty state ใช้จาก WIRING.md หัวข้อ "Empty / Loading / Error"
- ความยาวคลิป: main ไม่ส่งมา ให้ใช้ `probeDuration(clip.path, clip.mediaUrl)` แล้วเก็บผลใน `clip.durationSec` (ตอน resolve ให้ `render()` ครั้งเดียว — probeDuration มี cache จึงไม่วนลูป) แสดงด้วย `fmtMS`
- คนดู/GMV/ออร์เดอร์ มาจาก `S.liveStats[acc.id]` ({viewers,gmv,itemsSold} อาจเป็น null → แสดง `—`)
- บิตเรต/fps/speed จาก `S.health[acc.id]` · ไม่มี CPU% ให้แสดง "ความเร็วเข้ารหัส 1.01x" แทน (ตำแหน่งเดียวกับ CPU ใน mock)
- สถานะเน็ตใน sidebar ใช้ `navigator.onLine` (mock: "เน็ต ✓")

## ข้อผิดพลาดที่เห็นจากภาพจริง ต้องหายทั้งหมด
1. **แถวคลิป (setup)**: ชื่อไฟล์หายไป ป้ายสเปก "720x1280 · 30fps · เสียง aac" ยาวจนดันปุ่ม ▲▼✕ ตกขอบ และ "▶ ดูวิดีโอ" ตัดเป็น 2 บรรทัด
   → ต้องเป็นแบบ mock: `⠿ [เลข] ชื่อไฟล์(ตัดด้วย ellipsis) 1:20 [▶ ดูวิดีโอ] ▲ ▼ ✕` บรรทัดเดียว ปุ่ม `white-space:nowrap`
2. **ช่องเวลา** `<input type=time>` ต้องขนาดเดียวกับ mock (height 26 · font mono 12px) ไม่ล้น
3. **บรรทัดตรวจ (setup ขั้น 3)**: "✓ ตรวจแล้ว 6/6 · TikTok อัตโนมัติ · 6 Mbps" กับ "☐ บันทึก Preset" ต้องอยู่บรรทัดเดียว `white-space:nowrap` ไม่มีปุ่ม "ดูรายละเอียด" ที่ตัดคำ — ให้กดที่ข้อความ "ตรวจแล้ว x/y" เพื่อเปิดรายละเอียดแทน (cursor:pointer)
   ช่องชื่อ Preset ให้ถามใน modal ตอนกดเริ่มไลฟ์ถ้าติ๊กไว้ (ไม่ต้องมี input ในแถวนี้)
4. **ช่องชื่อ LIVE** ใช้ placeholder แบบ mock ("ไลฟ์สินค้ารอบเย็น 🔥 ส่งฟรี 2 ชิ้น") ค่าเริ่มต้นว่าง ไม่ใช่ "Rerun LIVE" (ถ้าว่างตอนเริ่มไลฟ์ค่อยใช้ชื่อร้านแทน)
5. **การ์ดคลิปในคลัง**: การ์ดยืดสูงเต็มจอเมื่อมีคลิปเดียว → ใช้ grid แบบ mock `grid-template-columns:repeat(4,1fr); grid-template-rows:1fr 1fr` การ์ดจึงสูงครึ่งหนึ่งเสมอ · ป้ายมุมขวาบนเป็น **ความยาวคลิป** (mono) ไม่ใช่ "MP4" · ปุ่มลบเป็น `✕` เล็ก ๆ โปร่งใสโผล่ตอน hover ไม่ใช่กล่องดำ · ช่องเส้นประ "ลากไฟล์มาวางที่นี่" ต้องรับลากไฟล์จริงด้วย `dropZone(node, paths => API.addLibraryPaths(paths).then(...))`
6. **หัวคลัง**: "4 คลิป · รวม 5:20" (รวมความยาวจริงจาก durationSec ที่ probe ได้)
7. **sidebar**: บรรทัดสถานะระบบต้องมี "เน็ต ✓" ตาม mock · การ์ดร้านที่เลือก/แผงร้าน/ปุ่มธีม/ปุ่ม "กดดูร้านค้า" ต้องตรง mock ทั้งขนาดและ transition
8. **ทุกหน้า**: ตัวหนังสือห้ามตัดคำแบบผิด ๆ ในปุ่ม (ใส่ `white-space:nowrap` ทุกปุ่ม) · ไม่มี element ของ mock หายไป · ไม่มี element ส่วนเกินที่ mock ไม่มี (ยกเว้นที่จำเป็นต่อฟังก์ชันจริงและระบุไว้ใน task)

## สิ่งที่ห้ามทำ
- ห้ามลบ/เปลี่ยนชื่อฟังก์ชันที่ไฟล์อื่นเรียก (ระบุใน task ของแต่ละหน้า)
- ห้ามแก้ core.js / actions.js / app.js / app.css / index.html
- ห้ามเปิดเบราว์เซอร์หรือรันแอป (ผู้ประสานงานจะทดสอบเอง) — ตรวจแค่ `node --check <ไฟล์>` ให้ผ่าน
- ห้ามใส่ข้อมูลตัวอย่างของ mock ลงไปเป็นค่าจริง (ชื่อร้าน 10 ร้าน, promo-a.mp4, 128,400 ฯลฯ)
