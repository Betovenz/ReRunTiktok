/* Rerun Studio v11 — แถบบนหน้าต่าง (แบบ B) + sidebar
   sidebar ลอก inline style จาก mock-sections/sidebar.html และสูตรใน state.js แบบคำต่อคำ
   ({{ T.x }} → var(--x)) · แถบบนไม่มีใน mock — คงของเดิมไว้ แต่ใช้ token ชุดเดียวกับ sidebar ให้กลมกลืน
   ฟังก์ชัน/ตัวแปร/id ที่ไฟล์อื่นพึ่งพา: titlebar() sidebar() paintWindowState() onairElapsedText(acc)
   addAccount() updateChip() winMaximized · #tbOnairTime (อยู่ในปุ่ม ON AIR ของ sidebar) #curStatusText #tbMax */

var winMaximized = false;

/* กางแผงร้านครั้งถัดไปให้เล่น transition ตาม shopsPanelStyle ของ mock —
   mock เปลี่ยน style บน node เดิม แต่ของจริง re-render ทั้งหน้า จึงต้องวาดสถานะ "ก่อนกาง" ก่อน
   แล้วค่อยสลับเป็น "กางแล้ว" ในเฟรมถัดไป (double rAF) ให้ opacity/transform วิ่งจริง */
var shopsPanelEnter = false;

/* ---------- สูตร style จาก state.js (ลอกทั้งสองสถานะ) ---------- */
/* เมนูแบบ B (ผู้ใช้เลือก): ไม่มีก้อนทึบ — รายการที่เลือกมีแถบเรืองแสงด้านซ้าย + ตัวอักษร accentHi + พื้นจาง (--navOnBg แยกตามธีม) */
var NAV_ITEM_BASE = 'position:relative;display:flex;align-items:center;gap:12px;padding:0 14px 0 18px;height:44px;border-radius:12px;font-size:15px;cursor:pointer;transition:all .15s;user-select:none;';
var NAV_ITEM_ON = 'background:var(--navOnBg);color:var(--accentHi);font-weight:700';
var NAV_ITEM_OFF = 'color:var(--navText);font-weight:600';
var NAV_BAR = 'position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:99px;background:var(--accentHi);box-shadow:0 0 10px rgba(96,165,250,.6)';

/* ไอคอน SVG เส้นเดียวกันทั้งชุด (แนว Lucide) แทนตัวอักษร unicode เดิม */
var NAV_ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  setup: '<circle cx="12" cy="12" r="2.5"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/>',
  library: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9.5v5l4.5-2.5z" fill="currentColor" stroke="none"/>',
  perf: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
};
function navIcon(key) {
  var span = el('span', { style: 'width:20px;height:20px;display:grid;place-items:center;flex-shrink:0' });
  span.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (NAV_ICONS[key] || '') + '</svg>';
  return span;
}

var CUR_CARD_BASE = 'border-radius:16px;padding:12px;display:flex;flex-direction:column;gap:8px;flex-shrink:0;border:1px solid;';
var CUR_CARD_LIVE = 'background:linear-gradient(160deg,var(--redTint),var(--surface));border-color:rgba(255,77,79,.45);box-shadow:0 0 0 1px rgba(255,77,79,.15),0 10px 30px rgba(255,77,79,.15)';
var CUR_CARD_IDLE = 'background:linear-gradient(160deg,var(--tint),var(--surface));border-color:var(--primary);box-shadow:0 10px 30px rgba(var(--blueRgb),.18)';

var CUR_STATUS_BASE = 'display:flex;align-items:center;gap:8px;height:34px;padding:0 12px;border-radius:10px;font-size:13px;font-weight:700;';
var CUR_STATUS_LIVE = 'background:rgba(255,77,79,.15);color:var(--redText)';
var CUR_STATUS_IDLE = 'background:rgba(var(--greenRgb),.12);color:var(--green)';

var CUR_DOT_BASE = 'width:9px;height:9px;border-radius:99px;';
var CUR_DOT_LIVE = 'background:#FF4D4F;animation:livePulse 1.2s infinite;box-shadow:0 0 10px rgba(255,77,79,.8)';
var CUR_DOT_IDLE = 'background:var(--green);box-shadow:0 0 8px rgba(var(--greenRgb),.6)';

var SYS_DOT_BASE = 'width:7px;height:7px;border-radius:99px;';

var CHEV_BASE = 'color:var(--faint);font-size:14px;transition:transform .3s;';

var PANEL_BASE = 'display:flex;flex-direction:column;overflow:hidden;min-height:0;transition:opacity .35s,transform .4s cubic-bezier(.22,1,.36,1);';
var PANEL_OPEN = 'flex:1;opacity:1;transform:translateY(0)';
var PANEL_ENTER = 'flex:1;opacity:0;transform:translateY(24px)';
var PANEL_CLOSED = 'height:0;opacity:0;transform:translateY(24px);pointer-events:none';

var ROW_BASE = 'display:flex;align-items:center;gap:12px;padding:10px 10px;border-radius:12px;cursor:pointer;flex-shrink:0;transition:background .15s;';
var AVATAR_BASE = 'width:34px;height:34px;border-radius:11px;display:grid;place-items:center;font-size:13px;font-weight:700;color:#fff;flex-shrink:0;';
var SHOP_ST_BASE = 'font-size:11px;font-weight:600;flex-shrink:0;';

/* ปุ่ม ON AIR ใต้เมนู (mock: liveHeaderPill = isLive && page !== 'control') */
var ONAIR_BTN = 'margin-top:14px; display:flex; align-items:center; justify-content:center; gap:8px; height:40px; border:1px solid rgba(255,77,79,.4); border-radius:12px; background:rgba(255,77,79,.12); color:var(--redText); font-size:12.5px; font-weight:700; cursor:pointer';
var ONAIR_DOT = 'width:8px; height:8px; border-radius:99px; background:#FF4D4F; animation:livePulse 1.2s infinite';

function sideAvatarStyle(i) {
  var n = AVATAR_COLORS.length;
  return AVATAR_BASE + 'background:' + AVATAR_COLORS[((i % n) + n) % n];
}
function sideInitial(name) { return String(name || 'ร').slice(0, 1); }

/* ===================================================================== */
/* แถบบนหน้าต่าง (แบบ B สูง 38px) — ไม่มีใน mock คงของเดิมไว้                */
/* ===================================================================== */
function titlebar() {
  var acc = curAcc();

  /* ปุ่มหน้าต่างเรียก API ผ่าน busy() ตามกติกา แต่ใช้ label เดิมของปุ่ม → ข้อความไม่เปลี่ยน กันกดซ้ำ + toast ตอนพลาด */
  var winBtn = function (props, hoverStyle, task, after) {
    var button = el('button', Object.assign({
      style: "width:44px; height:100%; border:none; background:none; color:var(--muted); font-family:'IBM Plex Mono',monospace; font-size:11px; cursor:pointer; display:grid; place-items:center; white-space:nowrap",
    }, props));
    button.addEventListener('click', function () {
      busy(button, button.textContent, task).then(function (r) { if (after) after(r); });
    });
    return hov(button, hoverStyle || 'background:var(--hover); color:var(--text)');
  };

  return el('div', {
    class: 'titlebar',
    style: 'height:38px; flex-shrink:0; display:flex; align-items:center; gap:10px; padding-left:12px; background:var(--side); border-bottom:1px solid var(--surface2); -webkit-app-region:drag; user-select:none',
  }, [
    el('div', { class: 'tb-mark', style: 'width:19px; height:19px; border-radius:6px; background:var(--primary); display:grid; place-items:center; color:#fff; font-weight:700; font-size:10px; flex-shrink:0', text: 'R' }),
    el('div', { class: 'tb-name', style: 'font-size:11.5px; font-weight:700; white-space:nowrap' }, ['Rerun ', el('span', { style: 'color:var(--accentHi)', text: 'Studio' })]),
    S.licensed && acc ? el('div', {
      class: 'tb-sub', title: acc.alias,
      style: 'font-size:11px; color:var(--faint); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0',
      text: '· ' + acc.alias,
    }) : null,
    updateChip(),
    el('div', { class: 'tb-ctrl', style: 'margin-left:auto; display:flex; height:100%; -webkit-app-region:no-drag; flex-shrink:0' }, [
      winBtn({ title: 'ย่อ', text: '─' }, null, function () { return API.minimizeWindow(); }),
      winBtn(
        { id: 'tbMax', title: winMaximized ? 'คืนขนาด' : 'ขยายเต็มจอ', text: winMaximized ? '❐' : '▢' },
        null,
        function () { return API.toggleMaximizeWindow(); },
        function (r) { if (r) winMaximized = Boolean(r.maximized); paintWindowState(); }
      ),
      winBtn({ class: 'x', title: 'ปิด', text: '✕' }, 'background:#e5484d; color:#fff', function () { return API.closeWindow(); }),
    ]),
  ]);
}

/* แจ้งเตือนอัปเดตบนแถบบน — เดิมเป็นป้ายลอยมุมขวาบนซึ่งไปทับการ์ดสถิติ */
function updateChip() {
  var up = S.updateStatus || { state: 'none' };
  if (up.state === 'ready') {
    var chip = el('button', {
      class: 'tb-update ready', title: 'ติดตั้งเวอร์ชัน ' + (up.version || 'ใหม่') + ' แล้วเปิดแอปใหม่',
    }, [el('span', { text: '↓' }), 'อัปเดตพร้อมติดตั้ง']);
    chip.addEventListener('click', function () {
      if (anyLive()) { toast('กำลังไลฟ์อยู่ — หยุดไลฟ์ก่อนติดตั้งอัปเดต', 'err'); return; }
      confirmDialog({
        title: 'อัปเดตแล้วเปิดแอปใหม่',
        body: 'เวอร์ชัน ' + (up.version || 'ใหม่') + ' พร้อมติดตั้ง แอปจะปิดและเปิดขึ้นมาใหม่',
        ok: 'อัปเดตเลย · รีสตาร์ต',
      }).then(function (yes) {
        if (!yes) return;
        busy(chip, 'กำลังติดตั้ง…', function () { return API.installUpdate(); });
      });
    });
    return chip;
  }
  if (up.state === 'downloading') {
    return el('div', { class: 'tb-update busy', title: 'กำลังดาวน์โหลดเวอร์ชันใหม่' },
      [el('span', { class: 'spin', text: '◌' }), 'กำลังดาวน์โหลด ' + (up.percent || 0) + '%']);
  }
  if (up.state === 'available') {
    return el('div', { class: 'tb-update busy', text: 'พบเวอร์ชันใหม่ ' + (up.version || '') });
  }
  return null;
}

function paintWindowState() {
  var button = document.getElementById('tbMax');
  if (!button) return;
  button.textContent = winMaximized ? '❐' : '▢';
  button.title = winMaximized ? 'คืนขนาด' : 'ขยายเต็มจอ';
}

/* ===================================================================== */
/* บรรทัดสถานะระบบ — "● ระบบพร้อม · FFmpeg ✓ · เน็ต ✓ · ไหว N บัญชี"          */
/* FFmpeg/N จาก S.appInfo · เน็ตจาก navigator.onLine (อัปเดตทันทีตอน online/offline) */
/* ===================================================================== */
function sysLineInfo() {
  var info = S.appInfo || {};
  var ffmpeg = Boolean(info.ffmpegReady);
  var online = typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
  var max = info.maxConcurrentStreams || 1;
  var ok = ffmpeg && online;
  return {
    ok: ok,
    text: (ok ? 'ระบบพร้อม' : 'ยังไม่พร้อม') + ' · FFmpeg ' + (ffmpeg ? '✓' : '✗') + ' · เน็ต ' + (online ? '✓' : '✗') + ' · ไหว ' + max + ' บัญชี',
  };
}
/* โครงตาม mock: [จุด][text node] — text node ตรง ๆ ในกล่อง flex ไม่มี white-space/overflow (ยาวเกินก็ขึ้นบรรทัดใหม่) */
function paintSysLine() {
  var info = sysLineInfo();
  var line = document.getElementById('sysLine');
  if (!line) return;
  var dot = line.firstChild;
  if (dot && dot.nodeType === 1) dot.setAttribute('style', SYS_DOT_BASE + (info.ok ? 'background:var(--green)' : 'background:var(--amber)'));
  var textNode = line.lastChild;
  if (textNode && textNode.nodeType === 3) textNode.nodeValue = info.text;
  else line.appendChild(document.createTextNode(info.text));
}
window.addEventListener('online', paintSysLine);
window.addEventListener('offline', paintSysLine);

/* ===================================================================== */
/* Sidebar (อ้างอิง mock-sections/sidebar.html บน → ล่าง)                  */
/* ===================================================================== */
function sidebar() {
  var acc = curAcc();
  var live = acc ? isLive(acc) : false;
  var pageKey = S.page === 'control' ? 'setup' : S.page;
  var open = Boolean(S.shopsOpen);
  var enter = open && shopsPanelEnter;
  shopsPanelEnter = false;

  /* ---- 1. แบรนด์ ---- */
  var brand = el('div', { style: 'display:flex; align-items:center; gap:10px; padding:0 8px 18px' }, [
    el('div', { style: 'width:34px; height:34px; border-radius:10px; background:var(--primary); display:grid; place-items:center; color:#fff; font-weight:700; font-size:15px', text: 'R' }),
    el('div', {}, [
      el('div', { style: 'font-weight:700; font-size:15px; line-height:1.1' }, ['Rerun ', el('span', { style: 'color:var(--accentHi)', text: 'Studio' })]),
      el('div', { style: 'font-size:11px; color:var(--faint); margin-top:2px', text: 'ไลฟ์วนคลิปอัตโนมัติ' }),
    ]),
  ]);

  /* ---- 2. เมนู 5 รายการ (navItems ใน state.js — mock ไม่มี style-hover) ---- */
  var nav = el('nav', { style: 'display:flex; flex-direction:column; gap:6px' }, NAV.map(function (item) {
    var key = item[0];
    var active = pageKey === key;
    var row = el('div', {
      style: NAV_ITEM_BASE + (active ? NAV_ITEM_ON : NAV_ITEM_OFF),
      onClick: function () { go(key === 'setup' ? (live ? 'control' : 'setup') : key); },
    }, [
      active ? el('span', { style: NAV_BAR }) : null,
      navIcon(key),
      el('span', { style: 'flex:1', text: item[1] }),
      key === 'setup' && anyLive() ? el('span', {
        style: 'font-size:10.5px; font-weight:700; color:#fff; background:#FF4D4F; padding:1px 7px; border-radius:999px; animation:livePulse 1.2s infinite',
        text: 'LIVE',
      }) : null,
    ]);
    return active ? row : hov(row, 'background:var(--surface2);color:var(--text)');
  }));

  /* ---- 3. ปุ่ม ON AIR (liveHeaderPill = isLive && page !== 'control') — กดกลับหน้าควบคุมไลฟ์
     ข้อความอยู่ใน #tbOnairTime ให้ tick() ใน app.js อัปเดตเวลาทุกวินาที ---- */
  var onair = anyLive() && S.page !== 'control' ? el('button', {
    style: ONAIR_BTN,
    onClick: function () {
      var liveAcc = S.accounts.filter(isLive)[0];
      if (liveAcc) S.cur = accIndex(liveAcc.id);
      go('control');
    },
  }, [
    el('span', { style: ONAIR_DOT }),
    el('span', { id: 'tbOnairTime', text: 'ON AIR ' + onairElapsedText() }),
  ]) : null;

  /* sideTopStyle — ซ่อนทั้งก้อนตอนกางแผงร้าน */
  var top = el('div', { style: 'display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;' + (open ? 'display:none' : '') }, [
    brand,
    nav,
    onair,
    el('div', { style: 'flex:1' }),
  ]);

  /* ---- 5. การ์ดร้านที่เลือกอยู่ (curCardStyle / curStatusStyle / curDotStyle) ---- */
  var curCard = el('div', { style: CUR_CARD_BASE + (live ? CUR_CARD_LIVE : CUR_CARD_IDLE) }, acc ? [
    el('div', { style: 'display:flex; align-items:center; gap:10px' }, [
      el('span', { style: sideAvatarStyle(S.cur), text: sideInitial(acc.alias) }),
      el('div', { style: 'flex:1; min-width:0' }, [
        el('div', { style: 'font-size:11px; color:var(--muted); letter-spacing:.4px', text: 'ร้านที่เลือกอยู่' }),
        el('div', { style: 'font-size:15px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis', title: acc.alias, text: acc.alias }),
      ]),
    ]),
    el('div', { style: CUR_STATUS_BASE + (live ? CUR_STATUS_LIVE : CUR_STATUS_IDLE) }, [
      el('span', { style: CUR_DOT_BASE + (live ? CUR_DOT_LIVE : CUR_DOT_IDLE) }),
      el('span', { id: 'curStatusText', style: 'white-space:nowrap; overflow:hidden; text-overflow:ellipsis', text: live ? 'กำลังไลฟ์อยู่ · ' + onairElapsedText(acc) : 'พร้อมไลฟ์ · ว่างอยู่' }),
    ]),
  ] : [
    /* empty state ในกรอบเดิม — ไม่มีบัญชีให้เลือก */
    el('div', { style: 'display:flex; align-items:center; gap:10px' }, [
      el('span', { style: AVATAR_BASE + 'background:var(--surface2);color:var(--muted)', text: '?' }),
      el('div', { style: 'flex:1; min-width:0' }, [
        el('div', { style: 'font-size:11px; color:var(--muted); letter-spacing:.4px', text: 'ร้านที่เลือกอยู่' }),
        el('div', { style: 'font-size:15px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis', text: 'ยังไม่มีร้าน' }),
      ]),
    ]),
    el('div', { style: CUR_STATUS_BASE + 'background:var(--surface2);color:var(--muted)' }, [
      el('span', { style: CUR_DOT_BASE + 'background:var(--faint)' }),
      el('span', { id: 'curStatusText', style: 'white-space:nowrap; overflow:hidden; text-overflow:ellipsis', text: 'กดดูร้านค้า → + เพิ่มบัญชี' }),
    ]),
  ]);

  /* ---- 6. บรรทัดสถานะระบบ — ตรง mock: [จุด] + text node ตรง ๆ ---- */
  var sys = sysLineInfo();
  var sysLine = el('div', { id: 'sysLine', style: 'display:flex; align-items:center; gap:8px; padding:0 6px; font-size:11.5px; color:var(--muted); flex-shrink:0' }, [
    el('span', { style: SYS_DOT_BASE + (sys.ok ? 'background:var(--green)' : 'background:var(--amber)') }),
    sys.text,
  ]);

  /* bottomInfoStyle */
  var bottom = el('div', { style: 'display:flex;flex-direction:column;gap:8px;flex-shrink:0;' + (open ? 'display:none' : '') }, [curCard, sysLine]);

  /* ---- 7. ปุ่มสลับธีม (themeBtnStyle + style-hover) ---- */
  var themeBtn = hov(el('button', {
    style: 'margin-top:10px;height:38px;border:1px solid var(--border);border-radius:12px;background:none;color:var(--muted);font-size:12.5px;font-weight:600;cursor:pointer;flex-shrink:0;font-family:inherit;white-space:nowrap;' + (open ? 'display:none' : ''),
    text: S.theme === 'light' ? '🌙 โหมดมืด' : '☀️ โหมดสว่าง',
    onClick: function () { S.theme = S.theme === 'dark' ? 'light' : 'dark'; applyTheme(); saveStore(); render(); },
  }), 'border-color:var(--primary); color:var(--text)');

  /* ---- 8. การ์ด "กดดูร้านค้า / N ร้าน" + แผงรายการร้าน ---- */
  var chev = el('span', { style: CHEV_BASE + (open && !enter ? 'transform:rotate(180deg)' : ''), text: '⌃' });

  var shopToggle = hov(el('div', {
    style: 'display:flex; align-items:center; gap:12px; padding:9px 12px; border-radius:14px; cursor:pointer; user-select:none; background:var(--surface); border:1px solid var(--border); transition:border-color .15s',
    onClick: function () { S.shopsOpen = !S.shopsOpen; shopsPanelEnter = S.shopsOpen; render(); },
  }, [
    el('span', { style: 'width:34px; height:34px; border-radius:11px; background:var(--surface2); color:var(--muted); display:grid; place-items:center; font-size:15px; flex-shrink:0', text: '▤' }),
    el('div', { style: 'flex:1; min-width:0' }, [
      el('div', { style: 'font-size:14px; font-weight:700; color:var(--text)', text: open ? 'กดพับร้านค้า' : 'กดดูร้านค้า' }),
      el('div', { style: 'font-size:11.5px; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis', text: S.accounts.length + ' ร้าน' }),
    ]),
    chev,
  ]), 'border-color:var(--borderHi)');

  /* แถวร้าน (shops ใน state.js: rowStyle / avStyle / stStyle ตาม stM) — mock ไม่มี style-hover และไม่มีปุ่มลบ
     การลบบัญชี (ฟังก์ชันจริงที่ต้องมี) จึงใช้คลิกขวาที่แถว → confirmDialog เพื่อไม่เพิ่ม element/hover ที่ mock ไม่มี */
  var rows = S.accounts.map(function (account, i) {
    var tk = S.tiktok[account.id] || {};
    var accLive = isLive(account);
    var st = accLive ? ['● ไลฟ์อยู่', 'color:var(--redText)']
      : tk.connected ? ['● พร้อม', 'color:var(--green)']
      : ['○ ยังไม่เชื่อม', 'color:var(--faint)'];
    var selected = S.cur === i;

    return el('div', {
      style: ROW_BASE + (selected ? 'background:var(--surface2)' : ''),
      title: 'คลิกเพื่อเลือก · คลิกขวาเพื่อลบบัญชี',
      onClick: function () { S.cur = i; S.selLayer = null; saveStore(); render(); refreshAccount(account.id); },
      onContextmenu: function (e) { e.preventDefault(); sideRemoveAccount(account); },
    }, [
      el('span', { style: sideAvatarStyle(i), text: sideInitial(account.alias) }),
      el('div', { style: 'flex:1; min-width:0' }, [
        el('div', { style: 'font-size:13.5px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis', title: account.alias, text: account.alias }),
        el('div', { style: 'font-size:11.5px; color:var(--faint); white-space:nowrap; overflow:hidden; text-overflow:ellipsis', text: '@' + (account.handle || '') }),
      ]),
      el('span', { style: SHOP_ST_BASE + st[1], text: st[0] }),
    ]);
  });

  if (!rows.length) {
    rows = [el('div', { style: 'padding:18px 10px; text-align:center; font-size:12.5px; color:var(--faint); line-height:1.7' }, [
      el('div', { text: 'ยังไม่มีบัญชี' }),
      el('div', { text: 'กด + เพิ่มบัญชี ด้านล่างเพื่อเริ่ม' }),
    ])];
  }

  var addRow = hov(el('div', {
    style: 'height:44px; flex-shrink:0; margin-top:6px; border-radius:12px; display:flex; align-items:center; gap:12px; padding:0 10px; font-size:13px; color:var(--accentHi); font-weight:600; cursor:pointer; white-space:nowrap',
    onClick: function () { addAccount(); },
  }, [
    el('span', { style: 'width:34px; height:34px; border-radius:11px; border:1px dashed var(--borderHi); display:grid; place-items:center', text: '+' }),
    'เพิ่มบัญชี',
  ]), 'background:var(--surface)');

  var list = el('div', { style: 'display:flex; flex-direction:column; gap:2px; padding:4px 0 2px; flex:1; min-height:0; overflow:auto' }, rows.concat([addRow]));

  /* shopsPanelStyle — ตอนกางเริ่มที่ PANEL_ENTER แล้วสลับเป็น PANEL_OPEN เฟรมถัดไปเพื่อให้ transition วิ่ง */
  var panel = el('div', { style: PANEL_BASE + (open ? (enter ? PANEL_ENTER : PANEL_OPEN) : PANEL_CLOSED) }, [list]);
  if (enter) {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        panel.setAttribute('style', PANEL_BASE + PANEL_OPEN);
        chev.setAttribute('style', CHEV_BASE + 'transform:rotate(180deg)');
      });
    });
  }

  /* shopBlockStyle */
  var shopBlock = el('div', {
    style: 'display:flex;flex-direction:column;min-height:0;' + (open ? 'flex:1;order:1' : 'margin-top:10px;border-top:1px solid var(--surface2);padding-top:10px'),
  }, [shopToggle, panel]);

  return el('aside', {
    class: 'side',
    style: 'position:relative; width:240px; flex-shrink:0; display:flex; flex-direction:column; padding:20px 14px; border-right:1px solid var(--surface2); background:var(--side)',
  }, [top, bottom, themeBtn, shopBlock]);
}

/* ลบบัญชี — ปุ่มทำลายต้องยืนยันก่อน · กันลบตอนกำลังไลฟ์ · คงร้านที่เลือกอยู่ไว้ถ้ายังอยู่ */
function sideRemoveAccount(account) {
  if (isLive(account)) { toast('หยุดไลฟ์บัญชีนี้ก่อน', 'err'); return; }
  confirmDialog({ title: 'ลบบัญชี "' + account.alias + '"', body: 'ค่าตั้งค่า คลิป และ overlay ของบัญชีนี้จะหายไป', ok: 'ลบบัญชี', danger: true })
    .then(function (yes) {
      if (!yes) return;
      var keepId = curAcc() ? curAcc().id : null;
      S.accounts = S.accounts.filter(function (a) { return a.id !== account.id; });
      if (!S.accounts.length) S.accounts = [newAccount('ร้านหลัก')];
      var idx = keepId ? accIndex(keepId) : -1;
      S.cur = idx >= 0 ? idx : Math.min(Math.max(0, S.cur), S.accounts.length - 1);
      S.selLayer = null;
      saveStore();
      render();
      toast('ลบบัญชี "' + account.alias + '" แล้ว', 'ok');
    });
}

function addAccount() {
  openModal(function (close) {
    var alias = el('input', { class: 'inp', placeholder: 'เช่น ร้านหลัก', autofocus: 'autofocus' });
    var handle = el('input', { class: 'inp', placeholder: 'เช่น mystore.official (ไม่บังคับ)' });
    var category = el('input', { class: 'inp', placeholder: 'เช่น สกินแคร์ (ไม่บังคับ)' });
    var submit = function () {
      var name = alias.value.trim() || 'ร้านใหม่';
      var account = newAccount(name);
      account.handle = handle.value.trim().replace(/^@/, '');
      account.category = category.value.trim();
      S.accounts.push(account);
      S.cur = S.accounts.length - 1;
      S.selLayer = null;
      saveStore();
      close();
      toast('เพิ่มบัญชี "' + name + '" แล้ว', 'ok');
      go('setup');
      refreshAccount(account.id);
    };
    alias.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    return el('div', { class: 'modal' }, [
      el('div', { class: 'modal-t', text: 'เพิ่มบัญชีไลฟ์' }),
      el('div', { class: 'faint', style: 'font-size:12px', text: 'แต่ละบัญชีตั้งค่าและไลฟ์แยกกันได้อิสระ' }),
      el('label', { class: 'field-lbl' }, ['ชื่อบัญชีในแอป', alias]),
      el('label', { class: 'field-lbl' }, ['@handle TikTok', handle]),
      el('label', { class: 'field-lbl' }, ['หมวดสินค้า', category]),
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn', style: 'white-space:nowrap', text: 'ยกเลิก', onClick: close }),
        el('button', { class: 'btn btn-primary', style: 'white-space:nowrap', text: 'เพิ่มบัญชี', onClick: submit }),
      ]),
    ]);
  });
}

function onairElapsedText(acc) {
  var target = acc || S.accounts.filter(isLive)[0];
  if (!target) return '00:00:00';
  var start = S.liveStart[target.id];
  return fmtClock(start ? (Date.now() - start) / 1000 : 0);
}
