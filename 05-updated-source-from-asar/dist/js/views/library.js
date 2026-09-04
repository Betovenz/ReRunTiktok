/* Rerun Studio v11 — คลัง + Preset
   ลอก inline style จาก 07-new-ui-design/mock-sections/library.html แบบ element ต่อ element
   ({{ T.x }} → var(--x) · style-hover → hov()) และคงการเชื่อม API เดิมทั้งหมด
   API ที่หน้านี้ใช้: library:add (API.addLibrary) · API.addLibraryPaths (ลากไฟล์วาง) · library:remove (API.removeLibrary)
   กดการ์ด → addClips() (setup.js) · Preset → applyPreset() / startLive() (actions.js) */

/* ===================================================================== */
/* ความยาวคลิปในคลัง                                                      */
/* main ไม่ส่ง duration มา → probe จาก <video> แล้วเก็บใน item.durationSec  */
/* S.library ถูกแทนด้วย list ใหม่ทุกครั้งที่ เพิ่ม/ลบ จึงเก็บสำเนาไว้ตาม path */
/* ด้วย เพื่อให้การ์ดไม่กลับไปเป็น "—" · render ครั้งเดียวตอน resolve       */
/* ===================================================================== */
var libDurations = {};        /* path -> sec | null (null = probe ไม่ได้ ไม่ต้องลองซ้ำ) */
var libDurationPending = {};  /* path -> true ระหว่าง probe */

function libResolveDurations(items) {
  var pending = [];
  (items || []).forEach(function (item) {
    if (!item || !item.path) return;
    if (typeof item.durationSec !== 'number' && typeof libDurations[item.path] === 'number') item.durationSec = libDurations[item.path];
    if (typeof item.durationSec === 'number') return;
    if (libDurationPending[item.path] || libDurations[item.path] === null) return;
    pending.push(item);
  });
  if (!pending.length) return;

  Promise.all(pending.map(function (item) {
    libDurationPending[item.path] = true;
    return probeDuration(item.path, item.mediaUrl || undefined)
      .then(function (sec) {
        if (typeof sec === 'number' || !item.mediaUrl) return sec;
        /* mediaUrl เก่าอาจหมดอายุ — ลอง file:// อีกรอบ */
        return probeDuration(item.path + '#file', fileUrl(item.path));
      })
      .then(function (sec) {
        delete libDurationPending[item.path];
        libDurations[item.path] = typeof sec === 'number' ? sec : null;
        if (typeof sec !== 'number') return false;
        item.durationSec = sec;
        return true;
      }, function () {
        delete libDurationPending[item.path];
        libDurations[item.path] = null;
        return false;
      });
  })).then(function () {
    /* render ครั้งเดียวหลัง probe ครบ (probeDuration มี cache + libDurations กันลองซ้ำ จึงไม่วนลูป)
       render แม้ probe ไม่สำเร็จ เพื่อให้หัวคลังเลิกบอกว่า "กำลังอ่านความยาว…" */
    if (S.page === 'library') render();
  });
}

/* "ใช้ล่าสุด 2 ชม.ที่แล้ว" ของ mock → ของจริงใช้ preset.usedAt (stamp ตอนกด ใช้ไลฟ์/แก้ไข) */
function libraryAgo(ts) {
  if (!ts) return '';
  var m = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (m < 1) return 'เมื่อสักครู่';
  if (m < 60) return m + ' นาทีที่แล้ว';
  var h = Math.round(m / 60);
  if (h < 24) return h + ' ชม.ที่แล้ว';
  return Math.round(h / 24) + ' วันก่อน';
}

/* บรรทัดสรุป preset ในภาษาเดียวกับ mock: "3 คลิป · 3 layer · ปักทุก 3 นาที · แชท AI เปิด" */
function librarySummary(preset) {
  var text = presetSummary(preset);
  var pin = S.pin[preset.accountId];
  var chat = S.chat[preset.accountId];
  if (pin && pin.enabled) text += ' · ปักทุก ' + (pin.intervalMinutes || 5) + ' นาที';
  if (chat && chat.ai && chat.ai.enabled) text += ' · แชท AI เปิด';
  else if (chat && chat.enabled) text += ' · ตอบแชทอัตโนมัติ';
  return text;
}

/* ===================================================================== */
/* คลัง (mock: library.html)                                              */
/* ===================================================================== */
function viewLibrary() {
  var acc = curAcc();
  var library = S.library || [];
  libResolveDurations(library);

  var refreshLibrary = function (list) { S.library = Array.isArray(list) ? list : []; };
  /* เปิด dialog เลือกไฟล์ (library:add) — จากปุ่ม "+ เพิ่มวิดีโอ" หรือกดช่องเส้นประ (ห่อ busy ทั้งคู่ กันกดซ้ำ) */
  var addFromDialog = function () {
    return API.addLibrary().then(function (list) { if (list) refreshLibrary(list); render(); });
  };

  /* ---------- หัว: "คลิปในคลัง" + "N คลิป · รวม m:ss" + ค้นหา + เพิ่มวิดีโอ ---------- */
  /* แสดง "N คลิป · รวม m:ss" เสมอ (brief ข้อ 6) — ยอดรวมมาจาก durationSec ที่ probe ได้แล้ว
     ถ้ายัง probe ไม่ครบ บอกไว้ใน title และ render ใหม่อัตโนมัติเมื่อ probe เสร็จ */
  var known = library.filter(function (x) { return x && typeof x.durationSec === 'number'; });
  var totalSec = known.reduce(function (s, x) { return s + x.durationSec; }, 0);
  var probing = library.filter(function (x) { return x && x.path && libDurationPending[x.path]; }).length;
  var unreadable = library.length - known.length - probing;
  var countText = library.length + ' คลิป · รวม ' + fmtMS(totalSec);
  var countTitle = probing
    ? 'กำลังอ่านความยาวอีก ' + probing + ' คลิป — ยอดรวมจะอัปเดตเอง'
    : (unreadable > 0 ? 'อ่านความยาวไม่ได้ ' + unreadable + ' คลิป (ไม่รวมในยอด)' : 'รวมความยาวคลิปทั้งหมดในคลัง');

  var searchInput = el('input', {
    placeholder: 'ค้นหาคลิป…', value: S.librarySearch || '',
    style: 'height:40px; width:220px; border:1px solid var(--border); border-radius:12px; padding:0 14px; font-size:13px; background:var(--surface2); color:var(--text); outline:none; font-family:inherit',
    onInput: function (e) { S.librarySearch = e.target.value; fillGrid(); },
    onFocus: function (e) { e.target.style.borderColor = 'var(--primary)'; },
    onBlur: function (e) { e.target.style.borderColor = 'var(--border)'; },
  });

  var addBtn = hov(el('button', {
    text: '+ เพิ่มวิดีโอ',
    style: 'height:40px; padding:0 18px; border:none; border-radius:12px; background:var(--text); color:var(--bg); font-size:13.5px; font-weight:700; cursor:pointer; white-space:nowrap; font-family:inherit',
    onClick: function (e) { busy(e.currentTarget, 'กำลังเลือก…', addFromDialog); },
  }), 'background:#fff');

  var head = el('div', { style: 'display:flex; align-items:center; gap:12px' }, [
    el('span', { style: 'font-size:22px; font-weight:700', text: 'คลิปในคลัง' }),
    el('span', { style: 'font-size:13px; color:var(--muted)', text: countText, title: countTitle }),
    el('div', { style: 'flex:1' }),
    searchInput,
    addBtn,
  ]);

  /* ---------- ช่องเส้นประ "+ ลากไฟล์มาวางที่นี่": รับลากไฟล์จริง + กดเปิด dialog ---------- */
  var dropHtml = '+<br>ลากไฟล์มาวางที่นี่';
  var dropBase = 'border:1px dashed var(--borderHi); border-radius:16px; display:grid; place-items:center; color:var(--accentHi); font-size:13.5px; font-weight:600; cursor:pointer; text-align:center; line-height:1.6';
  var dropOver = dropBase + '; background:rgba(var(--blueRgb),.08); border-color:var(--primary)';
  var drop = el('div', {
    html: dropHtml, style: dropBase,
    title: 'กดเพื่อเลือกไฟล์จากเครื่อง หรือลากไฟล์วิดีโอ (MP4 / MOV / MKV / WebM) มาวาง',
  });
  /* busy() แทนที่ข้อความด้วย textContent (เสีย <br>) → คืน html เดิมหลังเสร็จ ถ้าไม่ได้ render ใหม่ */
  var dropBusy = function (label, task) {
    return busy(drop, label, task).then(function (r) { drop.innerHTML = dropHtml; return r; });
  };
  drop.addEventListener('click', function () { if (!drop.disabled) dropBusy('กำลังเลือก…', addFromDialog); });
  hov(drop, 'background:rgba(var(--blueRgb),.08)');
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function () { drop.setAttribute('style', dropOver); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function () { drop.setAttribute('style', dropBase); }); });
  dropZone(drop, function (paths) {
    if (drop.disabled) return;
    dropBusy('กำลังเพิ่ม…', function () {
      return API.addLibraryPaths(paths).then(function (list) {
        var before = (S.library || []).length;
        refreshLibrary(list);
        var added = Math.max(0, S.library.length - before);
        toast(added ? 'เพิ่ม ' + added + ' คลิปเข้าคลังแล้ว' : 'คลิปนี้อยู่ในคลังแล้ว', added ? 'ok' : undefined);
        render();
      });
    });
  });

  /* ---------- การ์ดคลิป: gradient(hover→surface) · ป้ายความยาว mono มุมขวาบน · ชื่อไฟล์ล่างบน gradient ดำ ---------- */
  var clipCard = function (item) {
    /* ปุ่มลบ ✕ เล็กโปร่งใส โผล่ตอน hover เท่านั้น (ไม่ใช่กล่องดำ) · ห่อ busy กันกดซ้ำระหว่างรอ */
    var rm = hov(el('button', {
      text: '✕', title: 'ลบออกจากคลัง (ไฟล์ยังอยู่ในเครื่อง)',
      style: 'position:absolute; top:8px; left:8px; width:24px; height:24px; border:none; border-radius:8px; background:none; color:#fff; font-size:11px; cursor:pointer; opacity:0; transition:opacity .15s; display:grid; place-items:center; font-family:inherit',
      onClick: function (e) {
        e.stopPropagation();
        if (rm.disabled) return;
        confirmDialog({
          title: 'ลบ "' + item.name + '" ออกจากคลัง?',
          body: 'ไฟล์ยังอยู่ในเครื่องของคุณ — คลังเก็บแค่ที่อยู่ไฟล์ไว้ให้หยิบใช้ซ้ำ',
          ok: 'ลบออกจากคลัง', cancel: 'ยกเลิก', danger: true,
        }).then(function (yes) {
          if (!yes) return;
          busy(rm, '…', function () {
            return API.removeLibrary(item.id).then(function (list) { refreshLibrary(list); toast('ลบออกจากคลังแล้ว'); render(); });
          });
        });
      },
    }), 'background:rgba(255,90,82,.22); color:#ff5a52; opacity:1');

    var card = el('div', {
      title: acc ? 'กดเพื่อเพิ่มเข้าคิวไลฟ์ของ "' + acc.alias + '"' : 'กดเพื่อเพิ่มเข้าคิวไลฟ์',
      style: 'background:linear-gradient(160deg,var(--hover),var(--surface)); border:1px solid var(--border); border-radius:16px; position:relative; overflow:hidden; cursor:pointer; min-height:0',
      onClick: function () {
        if (!acc) { toast('ยังไม่มีร้าน — เพิ่มบัญชีจาก "กดดูร้านค้า" ก่อน', 'err'); return; }
        addClips(acc, [item.path]).then(function () { toast('เพิ่ม "' + item.name + '" เข้าคิวของ ' + acc.alias + ' แล้ว', 'ok'); render(); });
      },
    }, [
      /* ป้ายความยาว + แถบชื่อ: ลอก style ตาม mock (ไม่กำหนด color — สืบทอด var(--text) ของธีม)
         แถบชื่อคง ellipsis ไว้เพราะชื่อไฟล์จริงยาวกว่าตัวอย่างใน mock */
      el('span', {
        style: 'position:absolute; top:10px; right:10px; background:rgba(0,0,0,.5); font-size:11px; padding:3px 8px; border-radius:999px; font-family:\'IBM Plex Mono\',monospace',
        text: typeof item.durationSec === 'number' ? fmtMS(item.durationSec) : '—',
        title: typeof item.durationSec === 'number' ? 'ความยาวคลิป' : (libDurationPending[item.path] ? 'กำลังอ่านความยาวคลิป…' : 'อ่านความยาวคลิปไม่ได้'),
      }),
      rm,
      el('div', {
        style: 'position:absolute; bottom:0; left:0; right:0; padding:12px; background:linear-gradient(transparent,rgba(0,0,0,.7)); font-size:13px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis',
        text: item.name, title: item.path,
      }),
    ]);
    hov(card, 'border-color:var(--primary)');
    card.addEventListener('mouseenter', function () { rm.style.opacity = '1'; });
    card.addEventListener('mouseleave', function () { rm.style.opacity = '0'; });
    return card;
  };

  /* grid 4 คอลัมน์ 2 แถว (การ์ดสูงครึ่งเสมอ ไม่ยืดเต็ม) · เกิน 8 ช่องค่อยเลื่อนภายในโดยแถวเพิ่มยังสูงครึ่ง
     (ส่วนเกินจาก mock ที่จำเป็นต่อข้อมูลจริง — ไม่กระทบกรณี ≤ 8 ช่อง) */
  var gridBase = 'flex:1; display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-top:18px; min-height:0';
  var grid = el('div', { style: gridBase + '; grid-template-rows:1fr 1fr' });

  var fillGrid = function () {
    var search = (S.librarySearch || '').trim().toLowerCase();
    var items = library.filter(function (item) { return item && (!search || String(item.name || '').toLowerCase().indexOf(search) >= 0); });
    clear(grid);
    items.forEach(function (item) { grid.appendChild(clipCard(item)); });
    if (!items.length) {
      /* empty state วางในกรอบเดียวกับ mock (ช่องการ์ด 3 ช่องแรก) ไม่ยุบการ์ดหาย
         (WIRING.md ไม่มีหัวข้อ Empty/Loading/Error — ข้อความนี้เขียนตามภาษาของ mock/brief) */
      grid.appendChild(el('div', {
        style: 'grid-column:span 3; display:grid; place-items:center; color:var(--faint); font-size:12.5px; text-align:center; line-height:1.6; border:1px dashed var(--border); border-radius:16px; padding:16px',
        html: library.length
          ? 'ไม่พบคลิปที่ชื่อมี "' + String(S.librarySearch || '').trim().replace(/</g, '&lt;') + '"'
          : 'ยังไม่มีคลิปในคลัง<br>กด "+ เพิ่มวิดีโอ" หรือลากไฟล์มาวางในช่องด้านขวา · กดการ์ดคลิปเพื่อเพิ่มเข้าคิวไลฟ์',
      }));
    }
    grid.appendChild(drop);
    var tiles = (items.length || 3) + 1;
    grid.setAttribute('style', gridBase + (tiles > 8
      ? '; grid-template-rows:calc(50% - 7px) calc(50% - 7px); grid-auto-rows:calc(50% - 7px); overflow:auto'
      : '; grid-template-rows:1fr 1fr'));
  };
  fillGrid();

  var left = el('div', {
    style: 'background:var(--surface); border:1px solid var(--border); border-radius:22px; padding:22px 24px; display:flex; flex-direction:column; min-height:0',
  }, [head, grid]);

  /* ===================================================================== */
  /* ขวา: PRESET · กดใช้ไลฟ์ได้ทันที                                        */
  /* ===================================================================== */
  /* stamp เวลาใช้ล่าสุด → บรรทัด "ใช้ล่าสุด …" ตาม mock */
  var touchPreset = function (preset) { preset.usedAt = Date.now(); saveStore(); };
  var usePreset = function (preset, button) {
    if (!acc) { toast('ยังไม่มีร้าน — เพิ่มบัญชีก่อนใช้ Preset', 'err'); return; }
    applyPreset(acc, preset);
    touchPreset(preset);
    startLive(acc, button);
  };
  var editPreset = function (preset) {
    if (!acc) { toast('ยังไม่มีร้าน — เพิ่มบัญชีก่อนใช้ Preset', 'err'); return; }
    applyPreset(acc, preset);
    touchPreset(preset);
    go('setup');
  };
  var deletePreset = function (preset) {
    confirmDialog({
      title: 'ลบ Preset "' + preset.name + '"?',
      body: 'ค่าตั้งของรอบนี้ (คลิป · layer · กล้อง · ชื่อไลฟ์) จะหายไป กดซ้ำไม่ได้อีก',
      ok: 'ลบ Preset', cancel: 'ยกเลิก', danger: true,
    }).then(function (yes) {
      if (!yes) return;
      S.presets = S.presets.filter(function (p) { return p.id !== preset.id; });
      saveStore(); render();
    });
  };

  /* แถวหัวเรื่องลอก mock ตรง ๆ: <div style="font-size:16px; font-weight:700">🌆 ชื่อ</div> ไม่มีปุ่มในแถว */
  var titleRow = function (label, preset) {
    return el('div', { style: 'font-size:16px; font-weight:700', text: label + ' ' + preset.name });
  };
  /* ปุ่มลบ Preset (จำเป็นต่อฟีเจอร์เดิม mock ไม่มี) → ลอยมุมขวาบนของการ์ด โผล่ตอน hover เท่านั้น
     ไม่อยู่ในแถวหัวเรื่อง ชื่อ preset จึงไม่ถูกบีบ */
  var deleteCorner = function (preset, onWhite) {
    return hov(el('button', {
      text: '✕', title: 'ลบ Preset',
      style: 'position:absolute; top:8px; right:8px; width:24px; height:24px; border:none; border-radius:8px; background:none; color:' + (onWhite ? 'rgba(255,255,255,.7)' : 'var(--faint)') + '; font-size:11px; cursor:pointer; opacity:0; transition:opacity .15s; display:grid; place-items:center; font-family:inherit',
      onClick: function (e) { e.stopPropagation(); deletePreset(preset); },
    }), 'background:rgba(255,90,82,.18); color:#ff5a52; opacity:1');
  };
  var withCorner = function (card, rm) {
    card.appendChild(rm);
    card.addEventListener('mouseenter', function () { rm.style.opacity = '1'; });
    card.addEventListener('mouseleave', function () { rm.style.opacity = '0'; });
    return card;
  };
  var summaryLines = function (preset, colorStyle) {
    return el('div', { style: 'font-size:12.5px; margin-top:4px; line-height:1.6; ' + colorStyle }, [
      librarySummary(preset),
      el('br'),
      preset.usedAt ? 'ใช้ล่าสุด ' + libraryAgo(preset.usedAt) : 'ยังไม่เคยใช้' + (preset.savedAt ? ' · บันทึกเมื่อ ' + libraryAgo(preset.savedAt) : ''),
    ]);
  };

  var presetCards = (S.presets || []).map(function (preset, i) {
    if (i === 0) {
      /* preset แรก = การ์ด gradient(primaryDeep→primary) radius 20 padding 20 · ปุ่มขาว 44px "▶ ใช้ไลฟ์เลย" (ไม่มีปุ่มแก้ไข ตาม mock) */
      return withCorner(el('div', { style: 'background:linear-gradient(145deg,var(--primaryDeep),var(--primary)); border-radius:20px; padding:20px; color:#fff; position:relative; flex-shrink:0' }, [
        titleRow('🌆', preset),
        summaryLines(preset, 'opacity:.85'),
        el('button', {
          text: '▶ ใช้ไลฟ์เลย',
          style: 'margin-top:14px; width:100%; height:44px; border:none; border-radius:12px; background:#fff; color:var(--primaryDeep); font-size:14px; font-weight:700; cursor:pointer; white-space:nowrap; font-family:inherit',
          onClick: function (e) { usePreset(preset, e.currentTarget); },
        }),
      ]), deleteCorner(preset, true));
    }
    /* preset ถัดไป = การ์ด surface + ขอบ · ปุ่ม แก้ไข / ใช้ไลฟ์ 42px */
    var ghost = 'flex:1; height:42px; border:1px solid var(--border); border-radius:12px; background:none; color:var(--text); font-size:13.5px; font-weight:600; cursor:pointer; white-space:nowrap; font-family:inherit';
    return withCorner(el('div', { style: 'background:var(--surface); border:1px solid var(--border); border-radius:20px; padding:20px; position:relative; flex-shrink:0' }, [
      titleRow('🌙', preset),
      summaryLines(preset, 'color:var(--muted)'),
      el('div', { style: 'display:flex; gap:8px; margin-top:14px' }, [
        hov(el('button', { text: 'แก้ไข', title: 'โหลด Preset นี้ไปแก้ในหน้าไลฟ์', style: ghost, onClick: function () { editPreset(preset); } }), 'border-color:var(--borderHi)'),
        hov(el('button', { text: 'ใช้ไลฟ์', title: 'ใช้ค่าตั้งนี้แล้วเริ่มไลฟ์ทันที', style: ghost, onClick: function (e) { usePreset(preset, e.currentTarget); } }), 'border-color:var(--borderHi)'),
      ]),
    ]), deleteCorner(preset, false));
  });

  /* กล่องเส้นประ flex:1 อธิบายวิธีบันทึก Preset (empty state ของ Preset อยู่กรอบเดียวกัน) */
  var hint = el('div', {
    style: 'flex:1; border:1px dashed var(--border); border-radius:20px; display:grid; place-items:center; color:var(--faint); font-size:12.5px; text-align:center; line-height:1.6; padding:16px',
  }, [
    el('div', {}, [
      presetCards.length ? null : el('div', { style: 'font-weight:600; color:var(--muted); margin-bottom:4px', text: 'ยังไม่มี Preset' }),
      el('div', { html: 'บันทึก Preset ใหม่ได้จากขั้น "ยิงไลฟ์"<br>ระบบเก็บค่าตั้งทั้งหมดไว้ให้กดซ้ำได้' }),
    ]),
  ]);

  /* overflow:auto + flex-shrink:0 เป็นส่วนเกินจาก mock ที่จำเป็น (preset สูงสุด 8 ใบ สูงเกินจอได้) */
  var right = el('div', { style: 'display:flex; flex-direction:column; gap:14px; min-height:0; overflow:auto' }, [
    el('div', { style: 'font-size:12px; font-weight:600; color:var(--muted); letter-spacing:.6px; padding:4px 4px 0; flex-shrink:0', text: 'PRESET · กดใช้ไลฟ์ได้ทันที' }),
  ].concat(presetCards, [hint]));

  return el('div', { style: 'height:100%; display:grid; grid-template-columns:1fr 340px; gap:18px; min-height:0' }, [left, right]);
}
