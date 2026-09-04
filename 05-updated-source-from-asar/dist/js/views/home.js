/* Rerun Studio v11 — หน้าแรก (ลอกจาก mock-sections/home.html แบบ element ต่อ element)
   style ทุกตัวเป็น inline string ตาม mock · {{ T.x }} → var(--x) · style-hover → hov()
   ข้อมูลจริงทั้งหมดมาจาก S / summarize(7) / dailyBuckets(7) / S.history — ไม่มีค่าตัวอย่างของ mock */

/* ===================================================================== */
/* helper เฉพาะหน้านี้                                                   */
/* ===================================================================== */
var HOME_DAY_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

/* "วันอังคาร 2 ก.ย. · 18:20 น." จากเวลาจริง */
function homeDateText(now) {
  var d = now || new Date();
  return 'วัน' + TH_DAY[d.getDay()] + ' ' + d.getDate() + ' ' + TH_MONTH[d.getMonth()] + ' · ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ' น.';
}

/* ชื่อรอบตามช่วงเวลา ใช้ในหัว "พร้อมไลฟ์รอบ{เย็น}" */
function homeRoundName(now) {
  var h = (now || new Date()).getHours();
  return h < 12 ? 'เช้า' : h < 17 ? 'บ่าย' : h < 21 ? 'เย็น' : 'ดึก';
}

/* "2 ชม.ที่แล้ว" */
function homeAgo(ts) {
  var m = Math.floor(Math.max(0, Date.now() - ts) / 60000);
  if (m < 1) return 'เมื่อสักครู่';
  if (m < 60) return m + ' นาทีที่แล้ว';
  var h = Math.floor(m / 60);
  if (h < 24) return h + ' ชม.ที่แล้ว';
  return Math.floor(h / 24) + ' วันที่แล้ว';
}

/* "34 ชม." / "45 นาที" สำหรับช่องสถิติ */
function homeHoursText(sec) {
  sec = Math.max(0, sec || 0);
  if (sec >= 3600) return (Math.round(sec / 360) / 10) + ' ชม.';
  return Math.round(sec / 60) + ' นาที';
}

/* ประวัติเรียงใหม่สุดก่อน (ไม่แก้ S.history) */
function homeHistorySorted() {
  return S.history.slice().sort(function (a, b) { return (b.startedAt || 0) - (a.startedAt || 0); });
}

/* นาฬิกาบนการ์ด hero เดินเองโดยไม่ต้อง re-render ทั้งหน้า (app.js tick ไม่รู้จัก id นี้) */
var homeClockTimer = setInterval(function () {
  var node = document.getElementById('homeDate');
  if (node) node.textContent = homeDateText();
}, 1000);

/* ===================================================================== */
/* หน้าแรก                                                               */
/* ===================================================================== */
function viewHome() {
  var acc = curAcc();
  var week = summarize(7);
  var bars = dailyBuckets(7);
  var now = new Date();
  var preset = S.presets[0] || null;
  var rawName = (S.license && (S.license.displayName || S.license.username)) || 'ผู้ใช้';
  var displayName = /^คุณ/.test(rawName) ? rawName : (/^[ก-๙]/.test(rawName) ? 'คุณ' + rawName : 'คุณ ' + rawName);
  var live = acc ? isLive(acc) : false;

  /* ---------- ปุ่มใหญ่ ▶ เริ่มไลฟ์เลย (64px) ---------- */
  var mainBtn = el('button', {
    style: 'height:64px; border:1px solid rgba(255,255,255,.08); border-radius:16px; background:var(--primary); color:#fff; font-size:20px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:12px; box-shadow:inset 0 1px 0 rgba(255,255,255,.08), 0 3px 10px rgba(var(--blueRgb),.28); white-space:nowrap; font-family:inherit',
    text: live ? '● กำลังไลฟ์อยู่ · เปิดหน้าควบคุม' : preset ? '▶ เริ่มไลฟ์เลย' : '▶ ไปตั้งค่าไลฟ์',
    onClick: function (e) {
      if (live) { go('control'); return; }
      if (!preset) { go('setup'); return; }
      if (!acc) { toast('ยังไม่มีบัญชีร้าน — เพิ่มบัญชีจากแผงร้านค้าก่อน', 'err'); return; }
      applyPreset(acc, preset);
      startLive(acc, e.currentTarget);
    },
  });
  hov(mainBtn, 'background:var(--primaryHover)');

  /* ---------- ปุ่ม ghost "+ ตั้งค่าใหม่จากศูนย์ (3 ขั้น)" ---------- */
  var ghostBtn = el('button', {
    style: 'height:40px; padding:0 16px; border:1px solid var(--border); border-radius:999px; background:none; color:var(--muted); font-size:13px; font-weight:600; cursor:pointer; white-space:nowrap; font-family:inherit',
    text: '+ ตั้งค่าใหม่จากศูนย์ (3 ขั้น)',
    onClick: function () { go('setup'); },
  });
  hov(ghostBtn, 'color:var(--text); border-color:var(--borderHi)');

  /* ---------- การ์ด hero (ซ้าย) ---------- */
  var hero = el('div', { style: 'background:linear-gradient(160deg,var(--tint),var(--surface)); border:1px solid var(--border); border-radius:24px; padding:30px 32px; display:flex; flex-direction:column; min-height:0' }, [
    el('div', { id: 'homeDate', style: 'font-size:12.5px; font-weight:600; color:var(--accentHi); letter-spacing:.6px', text: homeDateText(now) }),
    el('div', { style: 'font-size:34px; font-weight:700; line-height:1.2; margin-top:8px' }, [
      'พร้อมไลฟ์รอบ' + homeRoundName(now), el('br'), 'หรือยัง ' + displayName,
    ]),
    el('div', {
      style: 'font-size:14px; color:var(--muted); margin-top:8px',
      text: live ? 'ร้านนี้กำลังไลฟ์อยู่ — เข้าหน้าควบคุมเพื่อดูแชท ปักสินค้า และยอดขาย'
        : preset ? 'ค่าตั้งจากรอบล่าสุดโหลดไว้แล้ว — กดปุ่มเดียวไลฟ์ต่อได้เลย'
        : 'ยังไม่มี Preset — ตั้งค่ารอบแรกให้จบแล้วบันทึกไว้ ครั้งต่อไปกดปุ่มเดียว',
    }),
    preset ? presetBox(preset) : homePresetEmpty(),
    el('div', { style: 'flex:1' }),
    mainBtn,
    el('div', { style: 'display:flex; align-items:center; gap:12px; margin-top:12px' }, [
      el('span', { style: 'font-size:12px; color:var(--faint); flex:1', text: 'ห้อง LIVE จริงจะถูกสร้างเมื่อกดปุ่มนี้เท่านั้น' }),
      ghostBtn,
    ]),
  ]);

  /* ---------- สถิติ 3 ช่อง ---------- */
  var statStyle = 'background:var(--surface); border:1px solid var(--border); border-radius:18px; padding:16px 18px';
  var kStyle = 'font-size:12px; color:var(--muted)';
  var vStyle = 'font-size:26px; font-weight:600; font-family:\'IBM Plex Mono\',monospace; margin-top:4px';
  var smallStyle = 'font-size:12px; font-family:\'IBM Plex Sans Thai\',sans-serif; color:var(--muted)';
  var stats = el('div', { style: 'display:grid; grid-template-columns:repeat(3,1fr); gap:14px' }, [
    el('div', { style: statStyle }, [
      el('div', { style: kStyle, text: 'ไลฟ์สัปดาห์นี้' }),
      el('div', { style: vStyle }, [String(week.count) + ' ', el('span', { style: smallStyle, text: 'ครั้ง · ' + homeHoursText(week.seconds) })]),
    ]),
    el('div', { style: statStyle }, [
      el('div', { style: kStyle, text: 'ยอดขาย 7 วัน' }),
      el('div', { style: vStyle + '; color:var(--green)' }, [fmtMoney(week.revenue) + ' ', el('span', { style: smallStyle, text: 'บาท' })]),
    ]),
    el('div', { style: statStyle }, [
      el('div', { style: kStyle, text: 'จบปกติ' }),
      el('div', { style: vStyle }, [String(week.ended), el('span', { style: 'color:var(--faint)', text: '/' + week.count })]),
    ]),
  ]);

  /* ---------- การ์ดกราฟแท่ง 7 วัน ---------- */
  var maxRevenue = 0, maxIndex = -1;
  bars.forEach(function (b, i) { if (b.revenue > 0 && b.revenue >= maxRevenue) { maxRevenue = b.revenue; maxIndex = i; } });
  var hasSales = maxRevenue > 0;
  var perfLink = el('a', { style: 'font-size:12.5px; font-weight:600; white-space:nowrap', text: 'ดูผลงาน →', onClick: function () { go('perf'); } });
  var barCols = bars.map(function (b, i) {
    var pct = hasSales ? Math.max(2, Math.round(b.revenue / maxRevenue * 100)) : 4;
    return el('div', { style: 'flex:1; height:100%; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; gap:6px' }, [
      el('div', {
        style: 'width:100%;max-width:44px;height:' + pct + '%;border-radius:6px 6px 2px 2px;background:' + (i === maxIndex ? 'var(--primary)' : 'var(--border)'),
        title: HOME_DAY_SHORT[new Date(b.ts).getDay()] + ' ' + new Date(b.ts).getDate() + ' ' + TH_MONTH[new Date(b.ts).getMonth()] + ' · ' + fmtMoney(b.revenue) + ' บาท',
      }),
      el('span', { style: 'font-size:11px; color:var(--faint)', text: HOME_DAY_SHORT[new Date(b.ts).getDay()] }),
    ]);
  });
  var barsWrap = el('div', { style: 'flex:1; display:flex; align-items:flex-end; gap:10px; margin-top:10px; min-height:0' + (hasSales ? '' : '; position:relative') }, barCols);
  if (!hasSales) {
    barsWrap.appendChild(el('div', {
      style: 'position:absolute; inset:0 0 22px 0; display:grid; place-items:center; text-align:center; color:var(--faint); font-size:12.5px; line-height:1.7; pointer-events:none',
      text: 'ยังไม่มียอดขายใน 7 วันนี้ — นำเข้ายอดขาย CSV ได้ที่หน้าผลงาน',
    }));
  }
  var chart = el('div', { style: 'background:var(--surface); border:1px solid var(--border); border-radius:18px; padding:16px 20px; display:flex; flex-direction:column; min-height:0' }, [
    el('div', { style: 'display:flex; align-items:center' }, [
      el('span', { style: 'font-size:14px; font-weight:600', text: 'ยอดขายรายวัน · 7 วัน' }),
      el('div', { style: 'flex:1' }),
      perfLink,
    ]),
    barsWrap,
  ]);

  /* ---------- การ์ดไลฟ์ล่าสุด ---------- */
  var recent = homeHistorySorted().slice(0, 6);
  var allLink = el('a', { style: 'font-size:12.5px; font-weight:600; white-space:nowrap', text: 'ทั้งหมด →', onClick: function () { go('perf'); } });
  var history = el('div', { style: 'background:var(--surface); border:1px solid var(--border); border-radius:18px; overflow:hidden; display:flex; flex-direction:column; min-height:0' }, [
    el('div', { style: 'padding:12px 20px; font-size:14px; font-weight:600; border-bottom:1px solid var(--surface2); display:flex' }, [
      el('span', { text: 'ไลฟ์ล่าสุด' }),
      el('div', { style: 'flex:1' }),
      allLink,
    ]),
    el('div', { style: 'flex:1; min-height:0; overflow:auto; display:flex; flex-direction:column; justify-content:space-around; gap:6px; padding:6px 20px' },
      recent.length ? recent.map(homeHistoryRow)
        : [el('div', { style: 'margin:auto; text-align:center; color:var(--faint); font-size:12.5px; line-height:1.7; padding:16px', text: 'ยังไม่มีประวัติไลฟ์ — เริ่มไลฟ์แรกของคุณได้เลย' })]),
  ]);

  var right = el('div', { style: 'display:grid; grid-template-rows:auto 1fr 1.3fr; gap:14px; min-height:0' }, [stats, chart, history]);

  return el('div', { style: 'height:100%; display:grid; grid-template-columns:1.05fr 1fr; gap:18px; min-height:0' }, [hero, right]);
}

/* ===================================================================== */
/* กล่อง Preset ใน hero                                                  */
/* ===================================================================== */
var HOME_PRESET_BOX = 'display:flex; gap:12px; margin-top:22px; align-items:center; background:var(--bg); border:1px solid var(--border); border-radius:18px; padding:14px 16px';
var HOME_PRESET_THUMB = 'width:54px; aspect-ratio:9/16; border-radius:8px; background:linear-gradient(160deg,#2B3446,#161B26); display:grid; place-items:center; font-size:10px; color:var(--muted); font-family:\'IBM Plex Mono\',monospace; flex-shrink:0';

/* preset พร้อมไลฟ์ไหม — มีคลิป + ปลายทางพร้อม (TikTok เชื่อมแล้ว หรือ RTMP ครบ) */
function homePresetReady(preset) {
  var d = preset.data || {};
  if (!(d.clips || []).length) return false;
  var acc = accById(preset.accountId) || curAcc();
  if (!acc) return false;
  if ((d.targetMode || acc.targetMode) === 'manual') return Boolean(acc.rtmpServer && acc.streamKey);
  var tk = S.tiktok[acc.id] || {};
  return Boolean(tk.connected);
}

/* สรุป preset: presetSummary() + สถานะปัก/แชทจริงของบัญชีนั้น ในภาษาเดียวกับ mock */
function homePresetSummary(preset) {
  var text = presetSummary(preset);
  var pin = S.pin[preset.accountId];
  var chat = S.chat[preset.accountId];
  if (pin && pin.enabled) text += ' · ปักทุก ' + (pin.intervalMinutes || 5) + ' นาที';
  if (chat && chat.ai && chat.ai.enabled) text += ' · แชท AI เปิด';
  else if (chat && chat.enabled) text += ' · ตอบแชทอัตโนมัติ';
  return text;
}

function presetBox(preset) {
  var ready = homePresetReady(preset);
  var byAcc = homeHistorySorted().filter(function (h) { return h.accountId === preset.accountId; });
  var last = byAcc[0] || homeHistorySorted()[0] || null;
  var lastLine = last
    ? 'รอบล่าสุด ' + homeAgo(last.startedAt) + ' · ' + fmtDur(last.durationSec || 0) + ' · ' + (last.reason === 'error' ? 'ผิดพลาด' : 'จบปกติ')
    : 'บันทึกเมื่อ ' + fmtDate(preset.savedAt);

  var chips = S.presets.slice(0, 3).map(function (p, i) {
    var on = i === 0;
    return el('span', {
      style: 'padding:7px 12px;border-radius:999px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;' + (on ? 'background:var(--primary);color:#fff' : 'border:1px solid var(--border);color:var(--muted)'),
      text: p.name, title: presetSummary(p),
      onClick: function () {
        if (on) return;
        S.presets = [p].concat(S.presets.filter(function (x) { return x.id !== p.id; }));
        saveStore(); render();
      },
    });
  });

  return el('div', { style: HOME_PRESET_BOX }, [
    el('div', { style: HOME_PRESET_THUMB, text: '9:16' }),
    el('div', { style: 'flex:1; min-width:0' }, [
      el('div', { style: 'display:flex; align-items:center; gap:8px' }, [
        el('span', { style: 'font-size:15px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis', text: 'Preset · ' + preset.name }),
        ready
          ? el('span', { style: 'font-size:11px; font-weight:700; color:var(--green); background:rgba(var(--greenRgb),.12); padding:2px 8px; border-radius:999px; white-space:nowrap', text: 'พร้อม' })
          : el('span', { style: 'font-size:11px; font-weight:700; color:var(--amber); background:rgba(245,184,61,.12); padding:2px 8px; border-radius:999px; white-space:nowrap', text: 'ยังไม่พร้อม' }),
      ]),
      el('div', { style: 'font-size:12.5px; color:var(--muted); margin-top:3px', text: homePresetSummary(preset) }),
      el('div', { style: 'font-size:12px; color:var(--faint); margin-top:2px', text: lastLine }),
    ]),
    el('div', { style: 'display:flex; gap:6px' }, chips),
  ]);
}

/* ไม่มี preset — empty state ในกรอบเดียวกับกล่อง Preset ของ mock (ข้อความ + ปุ่มไปตั้งค่า แทนตำแหน่ง chips) */
function homePresetEmpty() {
  var goBtn = el('button', {
    style: 'height:34px; padding:0 14px; border:1px solid var(--border); border-radius:999px; background:none; color:var(--muted); font-size:12.5px; font-weight:600; cursor:pointer; white-space:nowrap; font-family:inherit; flex-shrink:0',
    text: 'ไปตั้งค่า →',
    onClick: function () { go('setup'); },
  });
  hov(goBtn, 'color:var(--text); border-color:var(--borderHi)');
  return el('div', { style: HOME_PRESET_BOX }, [
    el('div', { style: HOME_PRESET_THUMB, text: '9:16' }),
    el('div', { style: 'flex:1; min-width:0' }, [
      el('div', { style: 'display:flex; align-items:center; gap:8px' }, [
        el('span', { style: 'font-size:15px; font-weight:700', text: 'ยังไม่มี Preset' }),
        el('span', { style: 'font-size:11px; font-weight:700; color:var(--muted); background:var(--surface2); padding:2px 8px; border-radius:999px; white-space:nowrap', text: 'ตั้งค่าก่อน' }),
      ]),
      el('div', { style: 'font-size:12.5px; color:var(--muted); margin-top:3px', text: 'ตั้งค่าไลฟ์ครั้งแรกให้จบ แล้วติ๊ก "บันทึก Preset" ในขั้นที่ 3' }),
      el('div', { style: 'font-size:12px; color:var(--faint); margin-top:2px', text: 'ครั้งต่อไปจะกดปุ่มเดียวไลฟ์ต่อได้เลย' }),
    ]),
    el('div', { style: 'display:flex; gap:6px' }, [goBtn]),
  ]);
}

/* ===================================================================== */
/* แถวไลฟ์ล่าสุด (สไตล์ตาม mock — historyRow ใน actions.js ใช้ class เดิม) */
/* ===================================================================== */
function homeHistoryRow(h) {
  var err = h.reason === 'error';
  var acc = accById(h.accountId);
  var name = acc ? acc.alias : (h.title || h.accountId || '—');
  return el('div', { style: 'display:flex; align-items:center; gap:12px; font-size:13px' }, [
    el('span', { style: 'width:8px;height:8px;border-radius:99px;flex-shrink:0;' + (err ? 'background:#FF5A52' : 'background:var(--green)') }),
    el('span', { style: 'width:110px; color:var(--muted); font-size:12.5px; flex-shrink:0', text: fmtDate(h.startedAt) }),
    el('span', { style: 'width:70px; font-weight:600; flex-shrink:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis', title: h.title || name, text: name }),
    el('span', { style: 'width:80px; font-family:\'IBM Plex Mono\',monospace; font-size:12.5px; flex-shrink:0', text: fmtDur(h.durationSec || 0) }),
    el('span', { style: 'font-size:11.5px;font-weight:600;padding:2px 9px;border-radius:999px;white-space:nowrap;' + (err ? 'background:rgba(255,90,82,.12);color:var(--redText)' : 'background:rgba(var(--greenRgb),.12);color:var(--green)'), text: err ? 'ผิดพลาด' : 'จบปกติ' }),
    el('div', { style: 'flex:1' }),
    el('span', { style: 'font-family:\'IBM Plex Mono\',monospace; font-size:12.5px', text: typeof h.gmv === 'number' ? fmtMoney(h.gmv) + ' ฿' : '—' }),
  ]);
}
