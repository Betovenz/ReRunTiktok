# Handoff: Rerun Studio — UI v11 (One-Screen Console · Dark/Light)

## Overview
UI ของ **Rerun Studio** เดสก์ท็อปแอปไลฟ์วนคลิปลง TikTok LIVE สำหรับแม่ค้าออนไลน์ เป้าหมาย: ใช้ง่ายสำหรับมือใหม่ ทุกหน้า**พอดีจอเดียว ไม่มี scroll** (ออกแบบที่ 1366×768, ขั้นต่ำ 1280 กว้าง) มี **โหมดมืด/สว่าง** สลับได้

## About the Design Files
ไฟล์ในโฟลเดอร์นี้เป็น **design reference ที่สร้างด้วย HTML** — prototype กดได้จริง แสดง look & behavior ที่ต้องการ **ไม่ใช่ production code ให้ copy ตรง ๆ** งานคือ **สร้าง UI นี้ขึ้นใหม่ใน codebase จริง** (Electron/Tauri + React/Vue ฯลฯ) ด้วย pattern และไลบรารีที่โปรเจกต์ใช้อยู่ ถ้ายังไม่มี ให้เลือก framework ที่เหมาะสมแล้ว implement ตาม spec นี้

เปิด `Rerun Studio v11.dc.html` ในเบราว์เซอร์ (ต้องมี `support.js` ข้าง ๆ) เพื่อดู state ทั้งหมด: เปลี่ยนหน้า, เลือกร้าน, เริ่ม/หยุดไลฟ์, แท็บ, toggle, สลับธีม

## Fidelity
**High-fidelity** — สี ฟอนต์ ขนาด ระยะ radius เป็นค่า final ให้ recreate ตาม spec โดยใช้ component library ของ codebase เป็นฐาน

## Design Tokens (มี 2 ชุด สลับตามธีม)
| Token | Dark | Light | ใช้กับ |
|---|---|---|---|
| bg | #0B0D12 | #F4F6FA | พื้นแอป |
| side | #0E1117 | #FFFFFF | พื้น sidebar |
| surface | #12151C | #FFFFFF | การ์ด |
| surface2 | #1A1F29 | #EEF2F7 | แถวรายการ / input / ปุ่มรอง |
| hover | #232C3A | #E4E9F1 | hover แถว |
| border | #262D3A | #DDE3EC | เส้นขอบ |
| borderHi | #3B475A | #C5CEDB | hover ขอบ |
| text | #F2F5F9 | #111827 | ตัวอักษรหลัก |
| muted | #8A94A6 | #5B6B85 | ตัวอักษรรอง |
| faint | #5B6678 | #8A96AA | hint |
| **primary** | **#1E3A8A** | **#1E3A8A** | ปุ่มหลัก · เมนูที่เลือก · แท็บ · กราฟ (กรมท่า) |
| primaryHover | #274BA8 | #274BA8 | hover ปุ่มหลัก |
| primaryDeep | #172554 | #172554 | gradient การ์ดยอดขาย |
| accentHi | #60A5FA | #1E3A8A | ลิงก์ · ตัวอักษรเน้น |
| tint | #152238 | #E3E9F5 | gradient การ์ด hero |
| green | #3DDC84 | #16A34A | สถานะพร้อม / จบปกติ |
| red | #FF4D4F (text #FF7875 / #DC2626) | | LIVE / หยุดไลฟ์ / ผิดพลาด |
| amber | #F5B83D | #B45309 | CPU สูง / ยังไม่เชื่อม |
- ตัวอักษรบนปุ่ม primary: #fff · ปุ่ม primary มีขอบ `1px rgba(255,255,255,.08)` + `inset 0 1px 0 rgba(255,255,255,.08)` + เงา `0 3px 10px rgba(primary,.28)`
- ฟอนต์: **IBM Plex Sans Thai** 400–700 · ตัวเลข/เวลา **IBM Plex Mono** 500–600
- Radius: การ์ดใหญ่ 22px · การ์ดย่อย 14–18px · ปุ่ม/input 10–14px · pill 999px
- ขนาด control: ปุ่มหลัก 54–64px · ปุ่มทั่วไป 38–44px · แถวรายการ ≥46px · sidebar 240px
- Scrollbar: 4px บาง ไม่มีราง/ลูกศร (`scrollbar-width:thin`)

## Layout หลัก (ทุกหน้า)
`display:flex; height:100vh` → **Sidebar 240px** + **Main (flex:1, padding 18px 22px)** ทุกหน้าใน main เป็น **CSS grid สูง 100%** ไม่มี scroll ระดับหน้า (scroll ได้เฉพาะภายในการ์ด เช่น แชท)

### Sidebar (บน→ล่าง)
1. โลโก้ "R" กรมท่า + "Rerun **Studio**" / ไลฟ์วนคลิปอัตโนมัติ
2. เมนู 5 รายการ สูง 44px: หน้าแรก · ไลฟ์ · คลัง · ผลงาน · ตั้งค่า — ที่เลือก = ปุ่มกรมท่าเต็มก้อน ตัวขาวหนา; อื่น ๆ ตัว navText; ระหว่างไลฟ์ เมนู "ไลฟ์" มีป้าย LIVE แดงกะพริบ (คลิกไปหน้า Live Control)
3. (ระหว่างไลฟ์) ปุ่ม "ON AIR HH:MM:SS" แดงจาง
4. spacer
5. **การ์ดร้านที่เลือกอยู่** (สำคัญ ต้องเด่น): อวตารสี + "ร้านที่เลือกอยู่" + ชื่อร้าน 15px หนา + แถบสถานะ 34px — ว่าง = การ์ดขอบกรมท่า+เงา แถบเขียว "● พร้อมไลฟ์ · ว่างอยู่"; กำลังไลฟ์ = การ์ดโทนแดง แถบแดงกะพริบ "● กำลังไลฟ์อยู่ · 00:12:34" (นับจริง)
6. บรรทัดสถานะระบบ: "● ระบบพร้อม · FFmpeg ✓ · เน็ต ✓ · ไหว 2 บัญชี"
7. ปุ่มสลับธีม "☀️ โหมดสว่าง / 🌙 โหมดมืด" (ขอบ ไม่มีพื้น)
8. **การ์ด "กดดูร้านค้า" / 10 ร้าน** (พื้น surface ขอบ border ไอคอน ▤ ลูกศร ⌃)
   - กด → ข้อ 1–2, 5–7 ซ่อน; การ์ดนี้ขึ้นไปบนสุด เปลี่ยนเป็น "กดพับร้านค้า" (ลูกศรหมุน 180°) แล้วรายการร้านสไลด์ขึ้นเต็มความสูง (transition opacity .35s + translateY 24→0 .4s)
   - รายการร้าน (scroll ภายใน): แถว 10px padding radius 12 = อวตารสี่เหลี่ยมมุมมน 34px สี่ต่างกัน + ชื่อร้าน 13.5px หนา + @handle 11.5px faint + สถานะขวา "● ไลฟ์อยู่ (แดง) / ● พร้อม (เขียว) / ○ ยังไม่เชื่อม (faint)"; ร้านที่เลือกพื้น surface2; ท้ายรายการ "+ เพิ่มบัญชี"
   - **เลือกร้านแล้วแผงไม่พับ** จะพับเมื่อกด "กดพับร้านค้า" เท่านั้น; ชื่อร้านที่เลือกอัปเดตทั้ง sidebar, hero หน้าแรก, การ์ดบัญชีในหน้าไลฟ์
   - ข้อมูลร้านตัวอย่าง 10 ร้าน: ร้านหลัก @mystore.official สกินแคร์ (live) · บ้านสวนผลไม้ @baansuan.fruit · เสื้อผ้าแฟชั่นนุ่น @noon.fashion · ครัวคุณแม่ @mae.kitchen · กาแฟดอยช้าง @doichang.coffee · เครื่องสำอางพิม @pim.cosmetics (ยังไม่เชื่อม) · ของเล่นเด็กจอย @joy.toys · เคสมือถือบอส @boss.case · สมุนไพรไทยแท้ @thai.herb (ยังไม่เชื่อม) · รองเท้ากีฬาเอ็ม @m.sneaker

### หน้าแรก — grid `1.05fr 1fr`
- ซ้าย: การ์ด hero (gradient tint→surface): วันที่ (accentHi 12.5px) · หัว 34px "พร้อมไลฟ์รอบเย็น หรือยัง คุณเอ" · คำอธิบาย · กล่อง Preset (thumbnail 9:16 + "Preset · รอบเย็น" badge พร้อม + สรุป "{ร้าน} · 3 คลิป · 3 layer · ปักทุก 3 นาที · แชท AI เปิด" + chips รอบเย็น/รอบดึก) · spacer · **ปุ่ม "▶ เริ่มไลฟ์เลย" 64px** · hint + ปุ่ม ghost "+ ตั้งค่าใหม่จากศูนย์ (3 ขั้น)"
- ขวา: grid rows `auto 1fr 1.3fr` = สถิติ 3 ช่อง (ไลฟ์สัปดาห์นี้ 12 · ยอดขาย 7 วัน 128,400 เขียว · จบปกติ 11/12) / การ์ดกราฟแท่ง 7 วัน (แท่งเน้นวันเสาร์ = primary) / การ์ด "ไลฟ์ล่าสุด" 4 แถว (จุดสถานะ · วันที่ · ร้าน · ระยะเวลา · badge · ยอด)

### หน้าไลฟ์ — **3 ขั้นรวมหน้าเดียว** grid `1fr 1fr 300px`
- ① เตรียมของ: หัว (วงกลม primary "1") · การ์ดบัญชี (เขียวจาง) แสดง **ชื่อร้านที่เลือก · @handle** + "TikTok เชื่อมแล้ว · หมวด · พร้อมไลฟ์" (ร้านยังไม่เชื่อม → amber "ยังไม่เชื่อม TikTok · กดเชื่อมต่อ") — ไม่มีปุ่มเปลี่ยน · "คลิปที่จะวน" 3 การ์ด: แถวบน = ⠿ · เลข · ชื่อไฟล์ · duration · **ปุ่ม "▶ ดูวิดีโอ"** (เปิด modal พรีวิว 9:16) · ▲▼✕; แถวล่าง = **toggle "ตั้งเวลาเล่น"** + `<input type=time>` (เปิด: "คลิปนี้จะเริ่มเล่นตอนนี้ทุกวัน", ปิด: "วนตามลำดับปกติ") · ปุ่ม "+ เพิ่มคลิปจากเครื่อง" (เส้นประ) + "จากคลัง" · ล่างสุด toggle "สุ่มลำดับทุกรอบ"
- ② แต่งหน้าจอ: ปุ่ม + รูป / + นาฬิกา / + ข้อความ · รายการ layer 3 แถว (เลือก = surface2 + ring primary; ปุ่ม ซ่อน/ลบ) · กล่อง "ปรับ · {layer}" (slider ขนาด 64–900, โปร่งใส 0–100, chips เอฟเฟกต์ ไม่มี/กะพริบ/จางเข้า-ออก/ลอยขึ้น-ลง) · ล่างสุด "▸ ปรับกล้อง · ตั้งค่าขั้นสูง"
- ③ ยิงไลฟ์: หัว · **พรีวิวโทรศัพท์ 9:16 สูงเต็มคอลัมน์** (จอมืดเสมอทั้ง 2 ธีม: gradient #1B2A4A→#0F1320, เส้นประ safe area, โลโก้ลากได้ ring primary, นาฬิกาจริง HH:MM, ข้อความวิ่ง marquee 8s) · input ชื่อ LIVE · แถว "✓ ตรวจแล้ว 6/6 · TikTok อัตโนมัติ · 6 Mbps" + checkbox บันทึก Preset · **ปุ่ม "▶ เริ่มไลฟ์ตอนนี้" 54px** · hint "ห้อง LIVE จริงจะถูกสร้างเมื่อกดปุ่มนี้เท่านั้น"

### กำลังไลฟ์ (Live Control) — grid rows `auto 1fr`
- แถบ ON AIR (gradient redTint2→surface): จุดแดงเรืองแสง · "ON AIR" · เวลา 28px Mono · equalizer 6 แถบ (keyframes scaleY) · คนดู 214 / บิตเรต 6.0 Mbps / เฟรม 30 / CPU 62% amber / สถานะปกติ เขียว · ปุ่ม "เปิด LIVE Manager" · **"⏹ หยุดไลฟ์" แดง 44px**
- ซ้าย 300px: การ์ดกำลังเล่น (ชื่อไฟล์ + progress primary + 0:22/0:45 · สุ่มลำดับ) · การ์ด GMV gradient primaryDeep→primary "18,240 ฿ · 96 ออร์เดอร์" · การ์ด "พรีวิวหยุดไว้ระหว่างไลฟ์เพื่อลดภาระเครื่อง / ดูภาพจริงบน TikTok →"
- ขวา: การ์ดแท็บ (active = pill primary): **แชท** (toggle ตอบอัตโนมัติ + "+ เพิ่มกฎด่วน"; bubble ผู้ใช้ซ้าย surface2 / บอทขวา primary / AI ขวาพื้น text) · **สินค้า** (ปักอัตโนมัติทุก [3] นาที · แถวสินค้า ● กำลังปัก/○ รอคิว/⊘ ข้ามไว้ + ปุ่ม ปักเลย(primary)/ใส่กลับ · คูปอง) · **ยอดขาย** (GMV/ออร์เดอร์/คนดูสูงสุด + กราฟต่อนาที 20 แท่ง)
- Modal ยืนยันหยุดไลฟ์: "หยุดไลฟ์ตอนนี้เลยไหม" + คำเตือนผู้ชม 214 คน · ปุ่ม กลับไปไลฟ์ต่อ / ⏹ หยุดไลฟ์ (แดง 48px)

### คลัง — grid `1fr 340px`
ซ้าย: หัว "คลิปในคลัง" + ค้นหา + "+ เพิ่มวิดีโอ" (ปุ่มพื้น text) · grid 4×2 การ์ดคลิป (duration มุมขวาบน, ชื่อไฟล์ล่าง) + ช่อง "ลากไฟล์มาวางที่นี่" · ขวา: "PRESET · กดใช้ไลฟ์ได้ทันที" → การ์ดรอบเย็น (gradient primary, ปุ่มขาว "▶ ใช้ไลฟ์เลย") · การ์ดรอบดึก (แก้ไข / ใช้ไลฟ์) · กล่องเส้นประอธิบาย

### ผลงาน — grid rows `auto auto 1fr`
หัว + segmented 7 วัน/30 วัน/ทั้งหมด (active พื้น text) + "นำเข้ายอดขาย CSV" · KPI 4 ช่อง (ช่องยอดขาย gradient primary) · ล่างแบ่งครึ่ง: กราฟ 14 วัน | ตารางประวัติไลฟ์

### ตั้งค่า — grid `240px 1fr`
เมนูซ้าย (ระบบ / แจ้งเตือน LINE / แชท AI / แอดมิน 🔒; active surface2 + accentHi) · เนื้อหา: ระบบ = การ์ด 2×2 (เวอร์ชัน 0.8.0 · FFmpeg พร้อม NVENC · เครื่องไหว 2 บัญชี+ทดสอบใหม่ · อัปเดตอัตโนมัติ toggle) · LINE = token + ปลายทาง + checkbox 3 เหตุการณ์ + บันทึก/ส่งทดสอบ · AI = Gemini/Claude + API key + textarea บริบทร้าน + checkbox · แอดมิน = ADMIN TOKEN + ปลดล็อก

## Interactions & Behavior
- เริ่มไลฟ์ (หน้าแรก / ขั้น ③ / Preset ในคลัง) → หน้า Live Control ทันที, ตัวจับเวลาเริ่ม 00:00:00 นับทุก 1 วิ, การ์ดร้านใน sidebar เปลี่ยนเป็นสถานะแดง, เมนูไลฟ์ขึ้นป้าย LIVE
- หยุดไลฟ์ต้องผ่าน modal เสมอ → กลับหน้าแรก
- ออกจากหน้า Live Control ระหว่างไลฟ์ → ปุ่ม ON AIR ค้างใน sidebar (กดกลับ)
- Toggle: transition .15s (bg + translateX knob) · hover ปุ่ม primary → primaryHover · hover ปุ่มขอบ → borderHi · hover แถว → hover token
- Animation: `livePulse` opacity 1→.3 1.2s · `marquee` 8s linear · `eq` scaleY .25→1 (delay ต่างกันต่อแถบ)
- ธีม: state `themeOverride` มาก่อน prop `theme` (default dark) · เปลี่ยนแล้ว re-render ทุก token; พรีวิวโทรศัพท์ไม่เปลี่ยน
- ไม่มี responsive/mobile: เดสก์ท็อป ≥1280 กว้าง; ถ้าจอเตี้ยกว่า ~600px คอลัมน์ในหน้าไลฟ์ scroll ภายในการ์ด

## State Management
`page` (home/setup/control/library/perf/settings) · `shop` (index 0–9) · `shopsOpen` · `isLive` + `liveSec` · `confirmStop` · `liveTab` (chat/pin/sales) · `setTab` (system/line/ai/admin) · `selLayer` · `selEffect` · `preset` · `shuffle` · `autoReply` · `savePreset` · `sched` (map clipIndex→bool) · `previewOpen`/`previewName` · `themeOverride`

ข้อมูลจริงที่ต้อง bind: รายชื่อร้าน + สถานะเชื่อม/ไลฟ์, คลิป (ชื่อ, duration, เวลาตั้งเล่น), Preset, layer overlay, สถิติไลฟ์สด (viewer/bitrate/fps/CPU), แชท stream, สินค้า + สถานะปัก, GMV/ออร์เดอร์, ประวัติไลฟ์, ค่าตั้ง LINE/AI

## Assets
- Google Fonts: IBM Plex Sans Thai (400–700), IBM Plex Mono (500,600)
- ไอคอนใน prototype เป็น unicode/emoji ชั่วคราว (⌂ ▶ ▤ ▥ ⚙ ⠿ ▲ ▼ ✕ ⌃ 🖼 🕐 🅣 🎟 🔒) — production ใช้ icon set ของ codebase (Lucide/Phosphor) 16–20px
- ไม่มีรูปจริง thumbnail เป็น gradient placeholder

## Files
- `Rerun Studio v11.dc.html` — interactive prototype (เปิดในเบราว์เซอร์ได้ ต้องมี `support.js` ข้าง ๆ)
- `support.js` — runtime ของ prototype เท่านั้น ไม่เกี่ยวกับ production
