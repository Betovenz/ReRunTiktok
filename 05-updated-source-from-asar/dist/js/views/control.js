/* Rerun Studio v11 — Live Control — แถบ ON AIR + แชท/สินค้า/ยอดขาย
   ลอก inline style จาก mock-sections/control.html + สูตรใน state.js (toggle / liveTabs / chatMsgs / stMap / eqBars / salesBars)
   ฟังก์ชันที่ไฟล์อื่นเรียก: viewControl nowPlayingCard tabChat chatBubble tabPin movePinProduct savePinConfig tabSales salesTile
   id ที่ app.js อัปเดตเอง: #onairTime (ทุกวินาที) · ไฟล์นี้อัปเดต #onairBitrate #onairFps #onairSpeed เองตอน stream:health มา */

/* ===================================================================== */
/* สูตร style ที่ใช้ซ้ำ (ลอกจาก state.js ของ mock)                           */
/* ===================================================================== */
var CTL = {
  mono: "font-family:'IBM Plex Mono',monospace",
  /* ปุ่มขอบ 40px บนแถบ ON AIR */
  barBtn: 'height:40px; padding:0 14px; border:1px solid var(--border); border-radius:12px; background:none; color:var(--text); font-size:13px; cursor:pointer; white-space:nowrap; flex-shrink:0',
  /* ปุ่มขอบ 34px (แถบบนของแท็บ) */
  smBtn: 'height:34px; padding:0 14px; border:1px solid var(--border); border-radius:10px; background:none; color:var(--text); font-size:12.5px; font-weight:600; cursor:pointer; white-space:nowrap; flex-shrink:0',
  /* ปุ่มในแถวสินค้า 36px — primary / outline (stMap btnStyle ใน state.js) */
  pinPrimary: 'height:36px; padding:0 14px; border-radius:10px; font-size:12.5px; font-weight:700; cursor:pointer; font-family:inherit; white-space:nowrap; flex-shrink:0; border:1px solid rgba(255,255,255,.08); background:var(--primary); color:#fff; box-shadow:inset 0 1px 0 rgba(255,255,255,.12)',
  pinOutline: 'height:36px; padding:0 14px; border-radius:10px; font-size:12.5px; font-weight:700; cursor:pointer; font-family:inherit; white-space:nowrap; flex-shrink:0; border:1px solid var(--border); background:none; color:var(--text)',
  /* ปุ่มคูปอง 36px (mock: font-weight 600) */
  couponBtn: 'height:36px; padding:0 14px; border:1px solid var(--border); border-radius:10px; background:none; color:var(--text); font-size:12.5px; font-weight:600; cursor:pointer; white-space:nowrap; flex-shrink:0',
  /* ปุ่มไอคอนเล็กโปร่ง (▲ ▼ ⊘ ✕) — โผล่เฉพาะตอนชี้แถว (แบบเดียวกับ ✕ บนการ์ดคลัง) */
  iconBtn: 'width:28px; height:28px; border:none; background:none; border-radius:8px; cursor:pointer; color:var(--muted); font-size:11px; display:grid; place-items:center; flex-shrink:0; padding:0; white-space:nowrap',
  /* ปุ่มข้อความเล็กโปร่ง (ใช้ในกลุ่มที่โผล่ตอนชี้แถว) */
  ghostBtn: 'height:28px; padding:0 8px; border:none; background:none; border-radius:8px; cursor:pointer; color:var(--muted); font-size:11.5px; font-weight:600; flex-shrink:0; white-space:nowrap',
  /* กลุ่มปุ่มที่ซ่อนไว้จนกว่าจะชี้แถว */
  rowActions: 'display:flex; align-items:center; gap:2px; flex-shrink:0; opacity:0; transition:opacity .15s',
  /* toggle(on) ใน state.js */
  toggleTrack: function (on) {
    return 'width:44px; height:26px; border-radius:99px; padding:3px; cursor:pointer; transition:background .15s; flex-shrink:0; ' + (on ? 'background:var(--primary)' : 'background:var(--border)');
  },
  toggleKnob: function (on) {
    return 'width:20px; height:20px; border-radius:99px; background:#fff; transition:transform .15s; ' + (on ? 'transform:translateX(18px)' : '');
  },
  /* liveTabs ใน state.js */
  tab: function (on) {
    return 'height:36px; padding:0 18px; border:none; border-radius:10px; font-size:13.5px; cursor:pointer; font-family:inherit; white-space:nowrap; ' + (on ? 'background:var(--primary); color:#fff; font-weight:700' : 'background:none; color:var(--muted)');
  },
  /* eqBars ใน state.js */
  eqBar: function (i) {
    return 'width:4px; height:100%; border-radius:99px; background:var(--accentHi); transform-origin:bottom; animation:eq ' + (0.7 + i * 0.13).toFixed(2) + 's ease-in-out infinite; animation-delay:' + (i * 0.1).toFixed(1) + 's';
  },
  /* salesBars ใน state.js: แท่งสุดท้าย accentHi ที่เหลือ border */
  salesBar: function (height, last) {
    return 'flex:1; height:' + height + '; border-radius:4px 4px 0 0; background:' + (last ? 'var(--accentHi)' : 'var(--border)');
  },
};

/* stMap ใน state.js: [ข้อความสถานะ, สี, ป้ายปุ่มหลัก] */
var CTL_ST = {
  pinning: ['● กำลังปัก', 'color:var(--green)', 'ปักเลย'],
  queue: ['○ รอคิว', 'color:var(--muted)', 'ปักเลย'],
  skip: ['⊘ ข้ามไว้', 'color:var(--faint)', 'ใส่กลับ'],
};

function ctlToggle(on, onClick, title) {
  return el('div', { style: CTL.toggleTrack(on), title: title || null, onClick: onClick }, [el('div', { style: CTL.toggleKnob(on) })]);
}

/* แถวที่มีกลุ่มปุ่มซ่อน: ชี้แถวแล้วกลุ่มปุ่มค่อยโผล่ (ตำแหน่งปุ่มหลัก/สถานะไม่ขยับ จึงหน้าตาเท่ากับ mock ตอนพัก) */
function ctlHoverRow(row, actions) {
  row.addEventListener('mouseenter', function () { actions.style.opacity = '1'; });
  row.addEventListener('mouseleave', function () { actions.style.opacity = '0'; });
  return row;
}

/* ---------- ตัวเลขบนแถบ ON AIR (จาก stream:health {speed,fps,bitrateKbps}) ---------- */
function ctlBitrateText(h) { return typeof h.bitrateKbps === 'number' && h.bitrateKbps > 0 ? (h.bitrateKbps / 1000).toFixed(1) + ' Mbps' : '—'; }
function ctlFpsText(h) { return typeof h.fps === 'number' && h.fps > 0 ? String(Math.round(h.fps)) : '—'; }
function ctlSpeedText(h) { return typeof h.speed === 'number' ? h.speed.toFixed(2) + 'x' : '—'; }
/* main ไม่ส่ง CPU% → ใช้ความเร็วเข้ารหัสแทนในตำแหน่งเดียวกัน · ต่ำกว่า 0.9x = เครื่องตามไม่ทัน (amber เหมือน CPU สูงใน mock) */
function ctlSpeedColor(h) { return typeof h.speed === 'number' && h.speed < 0.9 ? 'var(--amber)' : 'var(--text)'; }

/* stream:health มาทุก ~1 วิ แต่ app.js จะ render ทั้งหน้าเฉพาะตอนสถิติ/แชทมา
   จึงฟัง event นี้เพิ่มอีกหนึ่งตัว (preload ใช้ ipcRenderer.on → ฟังซ้อนกันได้) แล้วเขียนแค่ตัวเลข 3 ช่อง */
var ctlHealthBound = false;
function ctlBindHealthPainter() {
  if (ctlHealthBound || typeof API.onStreamHealth !== 'function') return;
  ctlHealthBound = true;
  API.onStreamHealth(function (payload) {
    if (!payload || S.page !== 'control') return;
    var acc = curAcc();
    if (!acc || acc.id !== payload.accountId) return;
    var h = payload.health || S.health[acc.id] || {};
    var b = document.getElementById('onairBitrate');
    if (b) b.textContent = ctlBitrateText(h);
    var f = document.getElementById('onairFps');
    if (f) f.textContent = ctlFpsText(h);
    var s = document.getElementById('onairSpeed');
    if (s) { s.textContent = ctlSpeedText(h); s.style.color = ctlSpeedColor(h); }
  });
}

/* สินค้าที่กด "ปักเลย" สำเร็จล่าสุดในไลฟ์นี้ → แสดง "● กำลังปัก"
   (main ไม่รายงานว่ารอบวนอัตโนมัติกำลังปักตัวไหน จึงรู้ได้เฉพาะที่ผู้ใช้กดเอง) */
var ctlLastPinned = {};   /* accountId -> { id, liveStart } */
function ctlPinnedId(acc) {
  var last = ctlLastPinned[acc.id];
  return last && last.liveStart === S.liveStart[acc.id] ? last.id : null;
}

/* คนดูสูงสุดในไลฟ์นี้ — main ส่งมาแค่ค่าปัจจุบัน (pin:live-stats ทุก 60 วิ) จึงเก็บค่า max ไว้ฝั่ง renderer
   รีเซ็ตเมื่อเริ่มไลฟ์รอบใหม่ (liveStart เปลี่ยน) · อัปเดตทุกครั้งที่ render หน้านี้ ไม่ว่าอยู่แท็บไหน */
var ctlPeakViewers = {};  /* accountId -> { liveStart, max } */
function ctlTrackPeakViewers(acc, stats) {
  var start = S.liveStart[acc.id] || null;
  var p = ctlPeakViewers[acc.id];
  if (!p || p.liveStart !== start) p = ctlPeakViewers[acc.id] = { liveStart: start, max: null };
  if (typeof stats.viewers === 'number' && (p.max === null || stats.viewers > p.max)) p.max = stats.viewers;
  return p.max;
}

/* ===================================================================== */
/* Live Control                                                          */
/* ===================================================================== */
function viewControl() {
  var acc = curAcc();
  if (!acc) {
    return el('div', { style: 'height:100%; display:grid; place-items:center; background:var(--surface); border:1px solid var(--border); border-radius:22px' }, [
      el('div', { style: 'text-align:center; color:var(--faint); font-size:12.5px; line-height:1.7; padding:16px', text: 'ยังไม่มีบัญชี — กดดูร้านค้า → + เพิ่มบัญชี' }),
    ]);
  }
  if (!isLive(acc)) {
    /* ไม่ได้ไลฟ์: empty state กลางการ์ดเต็มหน้า + ปุ่มไปตั้งค่า */
    return el('div', { style: 'height:100%; display:grid; place-items:center; background:var(--surface); border:1px solid var(--border); border-radius:22px' }, [
      el('div', { style: 'display:grid; place-items:center; text-align:center; color:var(--faint); font-size:12.5px; line-height:1.7; padding:16px' }, [
        el('div', { style: 'font-size:30px', text: '📺' }),
        el('div', { style: 'font-size:15px; font-weight:700; color:var(--text); margin-top:8px', text: 'บัญชี "' + acc.alias + '" ยังไม่ได้ไลฟ์' }),
        el('div', { style: 'margin-top:4px', text: 'ไปหน้าไลฟ์เพื่อตั้งค่าและกดเริ่ม' }),
        hov(el('button', {
          style: 'margin-top:14px; height:44px; padding:0 20px; border:1px solid rgba(255,255,255,.08); border-radius:12px; background:var(--primary); color:#fff; font-size:14px; font-weight:700; cursor:pointer; white-space:nowrap; box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 3px 10px rgba(var(--blueRgb),.28)',
          text: 'ไปตั้งค่าไลฟ์', onClick: function () { go('setup'); },
        }), 'background:var(--primaryHover)'),
      ]),
    ]);
  }

  ctlBindHealthPainter();

  var health = S.health[acc.id] || {};
  var stats = S.liveStats[acc.id] || {};
  var status = S.status[acc.id] || {};
  var elapsed = S.liveStart[acc.id] ? Math.floor((Date.now() - S.liveStart[acc.id]) / 1000) : 0;
  ctlTrackPeakViewers(acc, stats);
  var st = status.state === 'live' ? ['ปกติ ✓', 'var(--green)']
    : status.state === 'starting' ? ['กำลังเริ่ม…', 'var(--amber)']
      : status.state === 'stopping' ? ['กำลังหยุด…', 'var(--amber)']
        : [status.message || status.state || '—', 'var(--amber)'];

  var metric = function (label, value, color, id) {
    return el('span', { style: 'white-space:nowrap' }, [label + ' ', el('b', { id: id || null, style: 'color:' + (color || 'var(--text)') + '; ' + CTL.mono, text: value })]);
  };

  /* ---------- แถบ ON AIR ---------- */
  var bar = el('div', { style: 'display:flex; align-items:center; gap:18px; padding:14px 22px; border-radius:18px; background:linear-gradient(180deg,var(--redTint2),var(--surface)); border:1px solid var(--border)' }, [
    el('span', { style: 'width:12px; height:12px; border-radius:99px; background:#FF4D4F; animation:livePulse 1.2s infinite; box-shadow:0 0 12px rgba(255,77,79,.8); flex-shrink:0' }),
    el('span', { style: 'font-size:13px; font-weight:700; color:var(--redText); letter-spacing:2px; white-space:nowrap', text: 'ON AIR' }),
    el('span', { id: 'onairTime', style: 'font-size:28px; font-weight:600; white-space:nowrap; ' + CTL.mono, text: fmtClock(elapsed) }),
    el('div', { style: 'display:flex; align-items:flex-end; gap:3px; height:22px; flex-shrink:0' }, [0, 1, 2, 3, 4, 5].map(function (i) {
      return el('div', { style: CTL.eqBar(i) });
    })),
    el('div', { style: 'width:1px; height:26px; background:var(--border); flex-shrink:0' }),
    el('div', { style: 'display:flex; gap:18px; font-size:13px; color:var(--muted)' }, [
      metric('คนดู', typeof stats.viewers === 'number' ? String(stats.viewers) : '—'),
      metric('บิตเรต', ctlBitrateText(health), null, 'onairBitrate'),
      metric('เฟรม', ctlFpsText(health), null, 'onairFps'),
      metric('ความเร็วเข้ารหัส', ctlSpeedText(health), ctlSpeedColor(health), 'onairSpeed'),
      el('span', { style: 'white-space:nowrap' }, ['สถานะ ', el('b', { style: 'color:' + st[1], text: st[0] })]),
    ]),
    el('div', { style: 'flex:1' }),
    hov(el('button', { style: CTL.barBtn, text: 'เปิด LIVE Manager', onClick: function () { API.openTikTokShop(acc.id); } }), 'border-color:var(--borderHi)'),
    hov(el('button', {
      style: 'height:44px; padding:0 20px; border:none; border-radius:12px; background:#FF4D4F; color:#fff; font-size:14px; font-weight:700; cursor:pointer; white-space:nowrap; flex-shrink:0',
      text: '■ หยุดไลฟ์', onClick: function () { askStopLive(acc); },
    }), 'background:#E03E40'),
  ]);

  /* ---------- ซ้าย 300px ---------- */
  var left = el('div', { style: 'display:grid; grid-template-rows:auto auto 1fr; gap:12px; min-height:0' }, [
    nowPlayingCard(acc),
    el('div', { style: 'background:linear-gradient(145deg,var(--primaryDeep),var(--primary)); border-radius:18px; padding:16px 18px; color:#fff' }, [
      el('div', { style: 'font-size:12px; opacity:.85', text: 'ยอดขายไลฟ์นี้ (GMV)' }),
      el('div', { style: 'font-size:30px; font-weight:600; margin-top:2px; ' + CTL.mono, text: typeof stats.gmv === 'number' ? fmtMoney(stats.gmv) + ' ฿' : '—' }),
      el('div', { style: 'font-size:11.5px; opacity:.8; margin-top:2px', text: (typeof stats.itemsSold === 'number' ? stats.itemsSold + ' ออร์เดอร์' : '— ออร์เดอร์') + ' · อัปเดตทุก 1 นาที' }),
    ]),
    el('div', { style: 'background:var(--surface); border:1px solid var(--border); border-radius:18px; display:grid; place-items:center; text-align:center; padding:20px; color:var(--faint); font-size:12px; line-height:1.7; min-height:0' }, [
      el('div', {}, [
        'พรีวิวหยุดไว้ระหว่างไลฟ์', el('br'),
        'เพื่อลดภาระเครื่อง', el('br'),
        el('a', { href: '#', text: 'ดูภาพจริงบน TikTok →', onClick: function (e) { e.preventDefault(); API.openTikTok(acc.id); } }),
      ]),
    ]),
  ]);

  /* ---------- ขวา: การ์ดแท็บ ---------- */
  var liveTab = S.liveTab === 'pin' || S.liveTab === 'sales' ? S.liveTab : 'chat';
  var tabs = el('div', { style: 'display:flex; gap:6px; padding:10px 12px; border-bottom:1px solid var(--surface2); flex-shrink:0' },
    [['chat', 'แชท'], ['pin', 'สินค้า'], ['sales', 'ยอดขาย']].map(function (t) {
      return el('button', { style: CTL.tab(liveTab === t[0]), text: t[1], onClick: function () { S.liveTab = t[0]; render(); } });
    }));

  var body = liveTab === 'pin' ? tabPin(acc) : liveTab === 'sales' ? tabSales(acc) : tabChat(acc);

  return el('div', { style: 'height:100%; display:grid; grid-template-rows:auto 1fr; gap:16px; min-height:0' }, [
    bar,
    el('div', { style: 'display:grid; grid-template-columns:300px 1fr; gap:16px; min-height:0' }, [
      left,
      el('div', { style: 'background:var(--surface); border:1px solid var(--border); border-radius:18px; display:flex; flex-direction:column; min-height:0; overflow:hidden' }, [tabs, body]),
    ]),
  ]);
}

/* ===================================================================== */
/* การ์ดกำลังเล่น — main ไม่ส่ง playback offset/รอบ จึงแสดงหัวคิว + bar เต็ม + ความยาวรวม */
/* ===================================================================== */
/* คลิปที่กำลัง probe อยู่ (path -> true) — กัน render ซ้ำระหว่างรอ (สูงสุด 8 วิ) ไม่ให้สร้าง <video> ใหม่ probe ไฟล์เดิม */
var ctlProbing = {};
function nowPlayingCard(acc) {
  var round = S.playRound[acc.id];
  var clips = acc.clips || [];
  var first = clips.length ? clips[0].name : '—';

  /* ความยาวคลิป: probe จาก <video> ในเครื่อง (มี cache) แล้ว render ครั้งเดียวเมื่อได้ค่าใหม่
     คลิปที่กำลัง probe อยู่ (in-flight) ไม่เริ่มซ้ำ — ตอนตัวแรกได้ค่าจะ render ให้เอง */
  var pending = clips.filter(function (c) { return c.path && typeof c.durationSec !== 'number' && !ctlProbing[c.path]; });
  if (pending.length) {
    pending.forEach(function (c) { ctlProbing[c.path] = true; });
    Promise.all(pending.map(function (c) {
      return probeDuration(c.path, c.mediaUrl).then(function (d) {
        delete ctlProbing[c.path];
        if (typeof d === 'number' && d > 0) { c.durationSec = d; return true; }
        return false;
      }, function () { delete ctlProbing[c.path]; return false; });
    })).then(function (got) {
      if (got.some(Boolean) && S.page === 'control') render();
    });
  }
  var known = clips.filter(function (c) { return typeof c.durationSec === 'number'; });
  var total = known.reduce(function (s, c) { return s + c.durationSec; }, 0);
  var totalText = known.length ? ' · รวม ' + (known.length < clips.length ? '≥ ' : '') + fmtMS(total) : '';

  return el('div', { style: 'background:var(--surface); border:1px solid var(--border); border-radius:18px; padding:14px 16px' }, [
    el('div', { style: 'font-size:11.5px; color:var(--muted)', text: 'กำลังเล่น' + (round ? ' · รอบที่ ' + round : ' · คิวคลิป') }),
    el('div', {
      style: 'font-size:14px; font-weight:600; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap',
      title: clips.map(function (c) { return c.name; }).join('\n'),
      text: clips.length ? (acc.shuffle ? 'สุ่มจาก ' + clips.length + ' คลิป' : first) : 'ยังไม่มีคลิปในคิว',
    }),
    el('div', { style: 'height:6px; background:var(--surface2); border-radius:99px; margin-top:10px; overflow:hidden' }, [
      el('div', { style: 'width:100%; height:100%; background:var(--primary); border-radius:99px' }),
    ]),
    el('div', { style: 'display:flex; justify-content:space-between; font-size:11px; color:var(--faint); margin-top:5px; ' + CTL.mono }, [
      el('span', { text: clips.length + ' คลิป' + totalText }),
      el('span', { text: acc.shuffle ? 'สุ่มลำดับ' : 'ตามลำดับ' }),
    ]),
  ]);
}

/* ===================================================================== */
/* แท็บแชท                                                               */
/* ===================================================================== */
function tabChat(acc) {
  var cfg = S.chat[acc.id] || defaultChatConfig();
  var log = S.chatLog[acc.id] || [];
  var rules = (cfg.rules || []).length;

  var list = el('div', { id: 'chatList', style: 'flex:1; overflow:auto; padding:14px 18px; display:flex; flex-direction:column; gap:10px; min-height:0' },
    log.length ? log.map(chatBubble) : [
      el('div', { style: 'margin:auto; text-align:center; color:var(--faint); font-size:12.5px; line-height:1.7', text: 'กำลังรอคอมเมนต์จากผู้ชม…' }),
    ]);
  setTimeout(function () { list.scrollTop = list.scrollHeight; }, 0);

  return el('div', { style: 'flex:1; min-height:0; display:flex; flex-direction:column; overflow:hidden' }, [
    el('div', { style: 'display:flex; align-items:center; gap:12px; padding:10px 18px; border-bottom:1px solid var(--surface2); flex-shrink:0' }, [
      ctlToggle(Boolean(cfg.enabled), function () { saveChatConfig(acc, { enabled: !cfg.enabled }); }, cfg.enabled ? 'กดเพื่อปิดตอบอัตโนมัติ' : 'กดเพื่อเปิดตอบอัตโนมัติ'),
      el('span', { style: 'font-size:13.5px; font-weight:600; white-space:nowrap', text: cfg.enabled ? 'ตอบอัตโนมัติ เปิดอยู่' : 'ตอบอัตโนมัติ ปิดอยู่' }),
      el('span', { style: 'font-size:12px; color:var(--faint); white-space:nowrap; overflow:hidden; text-overflow:ellipsis', text: 'คีย์เวิร์ดตอบทันที · AI ตอบเมื่อไม่ตรงกฎ' }),
      el('div', { style: 'flex:1' }),
      hov(el('button', {
        style: 'height:34px; padding:0 14px; border:1px solid var(--border); border-radius:10px; background:none; color:var(--accentHi); font-size:12.5px; font-weight:600; cursor:pointer; white-space:nowrap; flex-shrink:0',
        text: '+ เพิ่มกฎด่วน', onClick: function () { quickRuleDialog(acc); },
      }), 'border-color:var(--primary)'),
      /* ทางไปจัดการกฎทั้งหมด (ตั้งค่า → แชท AI) — ฟังก์ชันเดิมที่ผู้ใช้ต้องหาเจอจากหน้านี้ (mock ไม่มี แต่ระบุใน task) */
      hov(el('button', {
        style: CTL.smBtn, text: 'จัดการกฎ (' + rules + ')', title: 'ดู/แก้กฎคีย์เวิร์ดทั้งหมดในตั้งค่า → แชท AI',
        onClick: function () { S.setTab = 'ai'; go('settings'); },
      }), 'border-color:var(--borderHi)'),
    ]),
    list,
  ]);
}

/* bubble: user ซ้าย surface2 / bot ขวา primary / ai ขวา พื้น text (สูตร chatMsgs ใน state.js)
   event จาก chat-engine: {kind:'incoming'|'reply'|'system', user, text, via:'rule'|'ai', at} */
function chatBubble(event) {
  var at = typeof event.at === 'number' ? new Date(event.at) : null;
  var clock = at ? pad2(at.getHours()) + ':' + pad2(at.getMinutes()) : '';
  if (event.kind === 'system') {
    return el('div', { style: 'display:flex; justify-content:center' }, [
      el('div', { style: 'max-width:100%; padding:7px 14px; border-radius:16px; border:1px dashed var(--border); color:var(--muted); font-size:12px' }, [
        el('div', { style: 'font-size:12px; word-break:break-word', text: event.text || '' }),
      ]),
    ]);
  }
  var out = event.kind === 'reply';
  var ai = out && (event.via === 'ai' || event.source === 'ai');
  var kind = !out ? 'user' : ai ? 'ai' : 'bot';
  var rowStyle = 'display:flex; ' + (kind === 'user' ? 'justify-content:flex-start' : 'justify-content:flex-end');
  var bubbleStyle = 'max-width:70%; padding:9px 14px; border-radius:16px; ' + (
    kind === 'user' ? 'background:var(--surface2); border-bottom-left-radius:4px'
      : kind === 'bot' ? 'background:var(--primary); color:#fff; border-bottom-right-radius:4px'
        : 'background:var(--text); color:var(--bg); border-bottom-right-radius:4px');
  var who = out ? (ai ? 'AI ตอบ' : 'ตอบแล้ว') : (event.user || 'ผู้ชม');
  var meta = event.meta || (out ? [event.user ? 'ถึง ' + event.user : '', clock].filter(Boolean).join(' · ') : clock);
  return el('div', { style: rowStyle }, [
    el('div', { style: bubbleStyle }, [
      el('div', { style: 'font-size:11px; font-weight:700; opacity:.7', text: who + (meta ? ' · ' + meta : '') }),
      el('div', { style: 'font-size:13.5px; margin-top:2px; word-break:break-word', text: event.text || '' }),
    ]),
  ]);
}

/* ===================================================================== */
/* แท็บสินค้า (ปักสินค้า)                                                  */
/* ===================================================================== */
function tabPin(acc) {
  var cfg = S.pin[acc.id] || { enabled: false, intervalMinutes: 5, includeCoupon: false, products: [] };
  var products = cfg.products || [];
  var live = isLive(acc);
  var pinnedId = ctlPinnedId(acc);

  /* stMap ใน state.js: สถานะ width 84 · pinning เขียว / queue muted / skip faint */
  var stSpan = function (key) {
    return el('span', { style: 'font-size:12px; font-weight:600; width:84px; flex-shrink:0; white-space:nowrap; ' + CTL_ST[key][1], text: CTL_ST[key][0] });
  };
  /* ปุ่มที่บันทึก config ผ่าน IPC → ห่อ busy กันกดซ้ำระหว่างรอ (savePinConfig จะ render ใหม่เมื่อเสร็จ) */
  var saveBtn = function (button, label, patchFn) {
    button.addEventListener('click', function (e) {
      busy(e.currentTarget, label, function () { return savePinConfig(acc, patchFn()); });
    });
    return button;
  };
  var iconBtn = function (label, title, disabled) {
    var b = el('button', { style: CTL.iconBtn + (disabled ? '; opacity:.35; cursor:not-allowed' : ''), text: label, title: title, disabled: disabled });
    return disabled ? b : hov(b, 'background:var(--border); color:var(--text)');
  };

  var rows = products.map(function (product, i) {
    var key = product.enabled === false ? 'skip' : (pinnedId && pinnedId === product.id) ? 'pinning' : 'queue';
    var withEnabled = function (on) {
      return { products: products.map(function (p) { return p.id === product.id ? Object.assign({}, p, { enabled: on }) : p; }) };
    };
    /* กลุ่มปุ่มจัดการ (โผล่ตอนชี้แถว): ▲ ▼ ⊘ ✕ — ตอนพักแถวจึงเป็น [เลข][ชื่อ][สถานะ][ปุ่มเดียว] ตาม mock */
    var actions = el('div', { style: CTL.rowActions }, [
      i === 0 ? iconBtn('▲', 'ปักก่อน', true) : saveBtn(iconBtn('▲', 'ปักก่อน', false), '…', function () { return { products: ctlSwapped(products, i, -1) }; }),
      i === products.length - 1 ? iconBtn('▼', 'ปักทีหลัง', true) : saveBtn(iconBtn('▼', 'ปักทีหลัง', false), '…', function () { return { products: ctlSwapped(products, i, 1) }; }),
      key === 'skip' ? null : saveBtn(iconBtn('⊘', 'ข้ามไว้ (ไม่ปักในรอบวน)', false), '…', function () { return withEnabled(false); }),
      hov(el('button', {
        style: CTL.iconBtn, text: '✕', title: 'ลบออกจากรายการ',
        onClick: function (e) {
          var btn = e.currentTarget;
          confirmDialog({
            title: 'ลบ "' + product.name + '" ออกจากรายการ?',
            body: 'สินค้าจะหายจากรอบวนปักอัตโนมัติ · ดึงกลับมาได้ด้วย "ดึงสินค้าจากไลฟ์"',
            ok: 'ลบออก', danger: true,
          }).then(function (yes) {
            if (!yes) return;
            busy(btn, '…', function () {
              return savePinConfig(acc, { products: products.filter(function (p) { return p.id !== product.id; }) });
            });
          });
        },
      }), 'background:rgba(255,90,82,.15); color:#ff5a52'),
    ]);
    var main = key === 'skip'
      ? saveBtn(hov(el('button', { style: CTL.pinOutline, text: CTL_ST.skip[2] }), 'border-color:var(--borderHi)'), 'กำลังบันทึก…', function () { return withEnabled(true); })
      : hov(el('button', {
        style: CTL.pinPrimary, text: CTL_ST[key][2],
        onClick: function (e) {
          busy(e.currentTarget, 'กำลังปัก…', function () {
            return API.pinProductNow(acc.id, product.name).then(function (r) {
              if (r && r.ok) {
                ctlLastPinned[acc.id] = { id: product.id, liveStart: S.liveStart[acc.id] };
                toast('ปัก "' + product.name + '" สำเร็จ', 'ok');
                render();
              } else {
                toast('ปักไม่สำเร็จ (' + ((r && r.reason) || 'ไม่ทราบสาเหตุ') + ')', 'err');
              }
            });
          });
        },
      }), 'background:var(--primaryHover)');
    return ctlHoverRow(el('div', { style: 'display:flex; align-items:center; gap:14px; min-height:54px; border-bottom:1px solid var(--surface2)' }, [
      el('span', { style: 'width:18px; color:var(--faint); font-size:13px; flex-shrink:0', text: (i + 1) + '.' }),
      el('span', { style: 'flex:1; font-size:14px; font-weight:500; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap', title: product.name, text: product.name }),
      actions,
      stSpan(key),
      main,
    ]), actions);
  });

  /* แถวคูปอง 🎟 — includeCoupon (อยู่ในรอบวนไหม) สลับด้วยปุ่มที่โผล่ตอนชี้แถว · ตอนพักตรง mock: [🎟][คูปองส่วนลด][ปักคูปองเลย] */
  var couponActions = el('div', { style: CTL.rowActions }, [
    saveBtn(hov(el('button', {
      style: CTL.ghostBtn, text: cfg.includeCoupon ? '⊘ เอาออกจากรอบวน' : '+ ใส่ในรอบวน',
      title: cfg.includeCoupon ? 'ตอนนี้คูปองถูกปักสลับกับสินค้าในรอบวนอัตโนมัติ' : 'ตอนนี้คูปองไม่อยู่ในรอบวนอัตโนมัติ (ปักเองได้ด้วยปุ่มขวา)',
    }), 'background:var(--border); color:var(--text)'), 'กำลังบันทึก…', function () { return { includeCoupon: !cfg.includeCoupon }; }),
  ]);
  var couponRow = ctlHoverRow(el('div', { style: 'display:flex; align-items:center; gap:14px; min-height:54px' }, [
    el('span', { style: 'width:18px; flex-shrink:0', text: '🎟' }),
    el('span', {
      style: 'flex:1; font-size:14px; font-weight:500; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap',
      title: cfg.includeCoupon ? 'อยู่ในรอบวนปักอัตโนมัติ' : 'ไม่อยู่ในรอบวน — ชี้แถวเพื่อใส่', text: 'คูปองส่วนลด',
    }),
    couponActions,
    hov(el('button', {
      style: CTL.couponBtn, text: 'ปักคูปองเลย',
      onClick: function (e) {
        busy(e.currentTarget, 'กำลังปัก…', function () {
          return API.couponAction(acc.id, 'pin').then(function (r) {
            if (r && r.ok) toast('ปักคูปองสำเร็จ', 'ok');
            else toast('ปักคูปองไม่สำเร็จ (' + ((r && r.reason) || 'ไม่พบคูปองในไลฟ์นี้') + ')', 'err');
          });
        });
      },
    }), 'border-color:var(--borderHi)'),
  ]), couponActions);

  /* ช่องนาที: ใส่เลข ≥ 1 = เปิดปักอัตโนมัติทุก N นาที · เว้นว่าง/0 = ปิด (แทน toggle ที่ mock ไม่มี) */
  var intervalInput = el('input', {
    type: 'text', inputmode: 'numeric', maxlength: '3', placeholder: '—',
    value: cfg.enabled ? String(cfg.intervalMinutes || 5) : '',
    title: cfg.enabled ? 'ปักอัตโนมัติทุก ' + (cfg.intervalMinutes || 5) + ' นาที · เว้นว่างหรือใส่ 0 เพื่อปิด' : 'ปิดอยู่ — ใส่จำนวนนาที (1–120) เพื่อเปิดปักอัตโนมัติ',
    style: 'width:50px; height:34px; border:1px solid var(--border); border-radius:10px; text-align:center; font-size:13.5px; background:var(--surface2); color:var(--text)',
    onChange: function (e) {
      var n = parseInt(String(e.target.value).replace(/[^\d]/g, ''), 10);
      var patch = n >= 1 ? { enabled: true, intervalMinutes: Math.min(120, n) } : { enabled: false };
      busy(e.currentTarget, '', function () {
        return savePinConfig(acc, patch).then(function (ok) {
          if (ok) toast(patch.enabled ? 'ปักอัตโนมัติทุก ' + patch.intervalMinutes + ' นาที' : 'ปิดปักอัตโนมัติแล้ว', 'ok');
        });
      });
    },
  });

  return el('div', { style: 'flex:1; min-height:0; display:flex; flex-direction:column; overflow:hidden' }, [
    el('div', { style: 'display:flex; align-items:center; gap:10px; padding:10px 18px; border-bottom:1px solid var(--surface2); font-size:13.5px; flex-shrink:0' }, [
      el('span', { style: 'font-weight:600; white-space:nowrap', text: '⦿ ปักอัตโนมัติทุก' }),
      intervalInput,
      el('span', { style: 'white-space:nowrap', text: 'นาที' }),
      el('div', { style: 'flex:1' }),
      hov(el('button', {
        style: CTL.smBtn, text: 'ดึงสินค้าจากไลฟ์',
        onClick: function (e) {
          busy(e.currentTarget, 'กำลังอ่าน…', function () {
            return API.listPinProducts(acc.id).then(function (r) {
              var found = (r && r.products) || [];
              if (!found.length) { toast('ยังไม่เจอสินค้า — ต้องกำลังไลฟ์และเปิดหน้า LIVE console อยู่', 'err'); return; }
              var merged = products.slice();
              found.forEach(function (p) {
                var name = String(p.text || p.name || '').replace(/\s*Pin$/i, '').trim();
                if (!name || merged.some(function (m) { return m.name === name; })) return;
                merged.push({ id: 'p-' + Math.random().toString(36).slice(2, 8), name: name, enabled: true });
              });
              return savePinConfig(acc, { products: merged }).then(function (ok) {
                if (ok) toast('ดึงสินค้าได้ ' + found.length + ' รายการ', 'ok');
              });
            });
          });
        },
      }), 'border-color:var(--borderHi)'),
    ]),
    el('div', { style: 'flex:1; overflow:auto; padding:8px 18px; min-height:0' }, (rows.length ? rows : [
      el('div', {
        style: 'display:grid; place-items:center; text-align:center; color:var(--faint); font-size:12.5px; line-height:1.7; padding:26px; border-bottom:1px solid var(--surface2)',
        text: live ? 'ยังไม่มีสินค้า — กด "ดึงสินค้าจากไลฟ์"' : 'ยังไม่มีสินค้า — กดไลฟ์แล้วกด "ดึงสินค้าจากไลฟ์"',
      }),
    ]).concat([couponRow])),
  ]);
}

/* สลับตำแหน่งสินค้า index กับ index+delta (คืน array ใหม่ · ถ้าเกินขอบคืนสำเนาเดิม) */
function ctlSwapped(list, index, delta) {
  var next = (list || []).slice();
  var target = index + delta;
  if (target < 0 || target >= next.length) return next;
  var tmp = next[index]; next[index] = next[target]; next[target] = tmp;
  return next;
}

function movePinProduct(acc, cfg, index, delta) {
  var next = ctlSwapped(cfg.products, index, delta);
  var target = index + delta;
  if (target < 0 || target >= next.length) return Promise.resolve();
  return savePinConfig(acc, { products: next });
}

function savePinConfig(acc, patch) {
  var cfg = Object.assign({}, S.pin[acc.id] || { enabled: false, intervalMinutes: 5, includeCoupon: false, products: [] }, patch);
  /* คืน Promise<true|false> (ไม่ throw — ผู้เรียกที่อยากรู้ผลค่อยเช็ค) · ผิดพลาดขึ้น toast ที่นี่ที่เดียว */
  return API.setPinConfig(acc.id, cfg).then(function (saved) {
    S.pin[acc.id] = saved || cfg;
    render();
    return true;
  }).catch(function (e) { toast(errText(e), 'err'); return false; });
}

/* ===================================================================== */
/* แท็บยอดขาย                                                            */
/* ===================================================================== */
function tabSales(acc) {
  var stats = S.liveStats[acc.id] || {};
  var peak = ctlTrackPeakViewers(acc, stats);

  /* กราฟ "ยอดขายต่อนาที · 60 นาทีล่าสุด" = 60 แท่ง แท่งละ 1 นาที (ยอดมาจาก CSV ที่นำเข้าในหน้าผลงาน) */
  var now = Date.now();
  var minuteMs = 60000, count = 60, from = now - count * minuteMs;
  var records = (S.sales && S.sales.records) || [];
  var mine = records.filter(function (r) { return r.accountId === acc.id && typeof r.at === 'number' && r.at <= now; });
  var buckets = new Array(count).fill(0);
  mine.forEach(function (r) {
    if (r.at < from) return;
    var i = Math.min(count - 1, Math.max(0, Math.floor((r.at - from) / minuteMs)));
    buckets[i] += Number(r.amount) || 0;
  });
  var max = Math.max.apply(null, buckets);

  /* ยอดที่นำเข้าแล้วในไลฟ์นี้ (ตั้งแต่เริ่มไลฟ์) — โชว์ในบรรทัดคำอธิบายใต้กราฟ */
  var start = S.liveStart[acc.id] || now;
  var imported = mine.reduce(function (s, r) { return s + (r.at >= start ? Number(r.amount) || 0 : 0); }, 0);

  var bars = buckets.map(function (v, i) {
    var height = max > 0 ? Math.max(2, Math.round(v / max * 100)) + '%' : '2px';
    var ago = count - i;
    return el('div', { style: CTL.salesBar(height, i === count - 1), title: (ago === 1 ? 'นาทีล่าสุด' : ago + ' นาทีก่อน') + ' · ' + (v ? fmtMoney(v) + ' ฿' : '—') });
  });
  var chart = el('div', { style: 'flex:1; display:flex; align-items:flex-end; gap:5px; margin-top:10px; min-height:0; position:relative' }, bars.concat(max > 0 ? [] : [
    /* empty state ในกรอบกราฟเดิม */
    el('div', { style: 'position:absolute; inset:0; display:grid; place-items:center; text-align:center; color:var(--faint); font-size:12px; line-height:1.7; padding:0 20px' }, [
      el('div', {}, ['ยังไม่มียอดขายใน 60 นาทีล่าสุด', el('br'), 'กราฟนี้ใช้ยอดจาก CSV ที่นำเข้าในหน้าผลงาน']),
    ]),
  ]));

  return el('div', { style: 'flex:1; display:flex; flex-direction:column; padding:18px 20px; min-height:0; overflow:hidden' }, [
    el('div', { style: 'display:grid; grid-template-columns:repeat(3,1fr); gap:12px' }, [
      salesTile('GMV', typeof stats.gmv === 'number' ? fmtMoney(stats.gmv) + ' ฿' : '—', 'var(--green)'),
      salesTile('ออร์เดอร์', typeof stats.itemsSold === 'number' ? String(stats.itemsSold) : '—'),
      salesTile('คนดูสูงสุด', typeof peak === 'number' ? String(peak) : '—'),
    ]),
    el('div', { style: 'font-size:13px; font-weight:600; margin-top:16px', text: 'ยอดขายต่อนาที · 60 นาทีล่าสุด' }),
    chart,
    /* บรรทัดบอกแหล่งข้อมูล + ยอดที่นำเข้าแล้วทั้งไลฟ์ (ฟังก์ชันเดิม · mock ไม่มี แต่ระบุใน task) */
    el('div', { style: 'font-size:11.5px; color:var(--faint); margin-top:8px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis' }, [
      'GMV/ออร์เดอร์/คนดู อ่านสดจากหน้า TikTok · กราฟมาจากไฟล์ CSV ที่นำเข้าในหน้าผลงาน · นำเข้าแล้วในไลฟ์นี้ ',
      el('b', { style: 'color:var(--muted); ' + CTL.mono, text: fmtMoney(imported) + ' ฿' }),
    ]),
  ]);
}

function salesTile(label, value, color) {
  return el('div', { style: 'background:var(--surface2); border-radius:14px; padding:14px 16px' }, [
    el('div', { style: 'font-size:12px; color:var(--muted)', text: label }),
    el('div', { style: 'font-size:26px; font-weight:600; ' + CTL.mono + (color ? '; color:' + color : ''), text: value }),
  ]);
}
