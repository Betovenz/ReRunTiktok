/* Rerun Studio v11 — หน้าไลฟ์ — ตั้งค่า 3 ขั้น + พรีวิว 9:16
   ลอก inline style จาก mock-sections/setup.html + สูตรใน state.js แบบ element ต่อ element
   ({{ T.x }} → var(--x)) · พฤติกรรม/IPC เดิมคงไว้ทั้งหมด */

/* ===================================================================== */
/* สไตล์ที่ลอกมาจาก mock (ใช้ซ้ำหลายจุด)                                   */
/* ===================================================================== */
var SETUP_ST = {
  grid: 'height:100%; display:grid; grid-template-columns:1fr 1fr 300px; gap:16px; min-height:0',
  card: 'background:var(--surface); border:1px solid var(--border); border-radius:22px; padding:20px 22px; display:flex; flex-direction:column; min-height:0; overflow:auto',
  head: 'display:flex; align-items:center; gap:10px; flex-shrink:0',
  numOn: 'width:28px; height:28px; border-radius:99px; background:var(--primary); color:#fff; font-size:13px; font-weight:700; display:grid; place-items:center; flex-shrink:0',
  num: 'width:28px; height:28px; border-radius:99px; background:var(--surface2); color:var(--muted); font-size:13px; font-weight:700; display:grid; place-items:center; flex-shrink:0',
  title: 'font-size:18px; font-weight:700',
  sub: 'font-size:12px; color:var(--muted)',
  /* ปุ่มไอคอน 28px (▲ ▼) — mock กำหนด font-size 11px */
  iconBtn: 'width:28px; height:28px; border:none; background:none; border-radius:8px; cursor:pointer; color:var(--muted); font-size:11px; flex-shrink:0; display:grid; place-items:center; font-family:inherit',
  /* ปุ่ม ✕ 28px — mock ไม่กำหนด font-size (inherit จาก button) */
  xBtn: 'width:28px; height:28px; border:none; background:none; border-radius:8px; cursor:pointer; color:var(--muted); flex-shrink:0; display:grid; place-items:center; font-family:inherit',
  /* ปุ่ม ซ่อน/ลบ 30px ในแถว layer */
  rowBtn: 'height:30px; padding:0 8px; border:none; background:none; border-radius:8px; cursor:pointer; color:var(--muted); font-size:12px; white-space:nowrap; flex-shrink:0; font-family:inherit',
  /* ปุ่มขอบเล็ก 28px (▶ ดูวิดีโอ / เปิด TikTok) */
  xsBtn: 'height:28px; padding:0 10px; border:1px solid var(--border); border-radius:8px; background:none; cursor:pointer; font-size:12px; font-weight:600; white-space:nowrap; flex-shrink:0; font-family:inherit',
  /* ปุ่มขอบ 34px ในแผงขั้นสูง */
  smBtn: 'height:34px; padding:0 14px; border:1px solid var(--border); border-radius:10px; background:none; color:var(--text); font-size:12.5px; font-weight:600; cursor:pointer; white-space:nowrap; font-family:inherit',
  smBtnOn: 'height:34px; padding:0 14px; border:1px solid rgba(255,255,255,.08); border-radius:10px; background:var(--primary); color:#fff; font-size:12.5px; font-weight:600; cursor:pointer; white-space:nowrap; font-family:inherit; box-shadow:inset 0 1px 0 rgba(255,255,255,.08)',
  /* กล่องปรับ */
  insp: 'margin-top:10px; background:var(--bg); border:1px solid var(--border); border-radius:14px; padding:12px 14px; flex-shrink:0',
  inspT: 'font-size:12px; font-weight:600; color:var(--accentHi)',
  inspGrid: 'display:grid; grid-template-columns:84px 1fr; gap:10px 12px; align-items:center; margin-top:8px; font-size:13px',
  lbl: 'color:var(--muted)',
  /* input ในกล่องปรับ/ขั้นสูง (ใช้ class inp เพื่อ focus ring เดิม + ขนาดจาก mock) */
  inp34: 'height:34px; font-size:12.5px; border-radius:10px; padding:0 10px',
  inp36: 'height:36px; font-size:12.5px; border-radius:10px; padding:0 10px',
  dangerHover: 'background:rgba(255,90,82,.15); color:#FF5A52',
};

/* toggle(on) จาก state.js — 44×26 knob 20 translateX 18 */
function toggleTrackStyle(on, disabled) {
  return 'width:44px; height:26px; border-radius:99px; padding:3px; cursor:pointer; transition:background .15s; flex-shrink:0; background:' + (on ? 'var(--primary)' : 'var(--border)') + (disabled ? '; opacity:.4; cursor:not-allowed' : '');
}
function toggleKnobStyle(on) {
  return 'width:20px; height:20px; border-radius:99px; background:#fff; transition:transform .15s' + (on ? '; transform:translateX(18px)' : '');
}
/* mini toggle ตั้งเวลาเล่น — 30×18 knob 14 translateX 12 */
function miniTrackStyle(on) {
  return 'width:30px; height:18px; border-radius:99px; padding:2px; cursor:pointer; display:inline-block; transition:background .15s; flex-shrink:0; background:' + (on ? 'var(--primary)' : 'var(--border)');
}
function miniKnobStyle(on) {
  return 'display:block; width:14px; height:14px; border-radius:99px; background:#fff; transition:transform .15s' + (on ? '; transform:translateX(12px)' : '');
}
/* chip เอฟเฟกต์จาก state.js */
function effectChipStyle(on) {
  return 'padding:6px 12px; border-radius:999px; font-size:12px; font-weight:600; cursor:pointer; white-space:nowrap; user-select:none; ' + (on ? 'background:var(--primary); color:#fff' : 'background:var(--surface2); color:var(--muted)');
}
/* rowStyle ของ layer จาก state.js */
function layerRowStyle(on) {
  return 'display:flex; align-items:center; gap:10px; padding:6px 10px; border-radius:12px; cursor:pointer; min-height:46px; flex-shrink:0' + (on ? '; background:var(--surface2); box-shadow:inset 0 0 0 1.5px var(--primary)' : '');
}

/* url สำหรับเล่นคลิปในเครื่อง — ใช้ rerun-media:// จากคลัง (สดต่อ session) ก่อน แล้วค่อย mediaUrl ที่เก็บไว้ */
function clipMediaUrl(clip) {
  var hit = (S.library || []).filter(function (x) { return x && x.path === clip.path && x.mediaUrl; })[0];
  return hit ? hit.mediaUrl : (clip.mediaUrl || '');
}

/* ความยาวคลิป — main ไม่ส่งมา: probe จาก <video> แล้วเก็บใน clip.durationSec · render ครั้งเดียวตอน resolve */
var durationPending = {};
function resolveClipDurations(acc) {
  var pending = acc.clips.filter(function (c) { return typeof c.durationSec !== 'number' && !durationPending[c.path]; });
  if (!pending.length) return;
  Promise.all(pending.map(function (clip) {
    durationPending[clip.path] = true;
    var url = clipMediaUrl(clip);
    return probeDuration(clip.path, url || undefined)
      .then(function (sec) {
        if (typeof sec === 'number' || !url) return sec;
        /* mediaUrl เก่าอาจหมดอายุ — ลอง file:// อีกรอบ */
        return probeDuration(clip.path + '#file', fileUrl(clip.path));
      })
      .then(function (sec) {
        delete durationPending[clip.path];
        if (typeof sec !== 'number') return false;
        clip.durationSec = sec;
        return true;
      }, function () { delete durationPending[clip.path]; return false; });
  })).then(function (changed) {
    if (!changed.some(Boolean)) return;
    saveStore();
    if (S.page === 'setup') render();
  });
}

/* ===================================================================== */
/* ขั้น 1 · เตรียมของ                                                     */
/* ===================================================================== */
function stepPrepare(acc) {
  var tk = S.tiktok[acc.id] || {};
  var connected = Boolean(tk.connected);

  /* การ์ดบัญชี — กล่อง/ไอคอนเขียวเสมอตาม mock · ไม่เชื่อม = เปลี่ยนเฉพาะสีข้อความรองเป็น amber (curAcctSubStyle ใน state.js)
     ปุ่ม เปิด/เชื่อม TikTok ไม่มีใน mock แต่จำเป็นตาม WIRING (tiktok:open / tiktok:login) */
  var acctBox = el('div', {
    style: 'display:flex; align-items:center; gap:12px; margin-top:14px; background:rgba(var(--greenRgb),.08); border:1px solid rgba(var(--greenRgb),.3); border-radius:14px; padding:10px 14px; flex-shrink:0',
  }, [
    el('span', {
      style: 'width:34px; height:34px; border-radius:10px; background:rgba(var(--greenRgb),.15); color:var(--green); display:grid; place-items:center; font-size:15px; font-weight:700; flex-shrink:0',
      text: '✓',
    }),
    el('div', { style: 'flex:1; min-width:0' }, [
      el('div', { style: 'font-size:14px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis', text: acc.alias + (acc.handle ? ' · @' + acc.handle : '') }),
      el('div', {
        style: 'font-size:11.5px; color:' + (connected ? 'var(--green)' : 'var(--amber)'),
        text: connected
          ? 'TikTok เชื่อมแล้ว' + (acc.category ? ' · ' + acc.category : '') + ' · พร้อมไลฟ์'
          : 'ยังไม่เชื่อม TikTok · กดเชื่อมต่อ',
      }),
    ]),
    connected
      ? hov(el('button', {
          style: SETUP_ST.xsBtn + '; color:var(--muted)', text: 'เปิด TikTok',
          onClick: function (e) {
            busy(e.currentTarget, 'กำลังเปิด…', function () { return API.openTikTok(acc.id); });
          },
        }), 'border-color:var(--borderHi); color:var(--text)')
      : hov(el('button', {
          style: 'height:32px; padding:0 12px; border:1px solid rgba(255,255,255,.08); border-radius:9px; background:var(--primary); color:#fff; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap; flex-shrink:0; font-family:inherit; box-shadow:inset 0 1px 0 rgba(255,255,255,.08), 0 3px 10px rgba(var(--blueRgb),.28)',
          text: 'เชื่อม TikTok',
          onClick: function (e) {
            busy(e.currentTarget, 'กำลังรอ TikTok…', function () {
              return API.loginTikTok(acc.id).then(function (r) {
                if (r && r.saved) { toast('บันทึก session แล้ว', 'ok'); }
                else { toast('ยังจับ session ไม่ครบ — ลองล็อกอินอีกครั้ง', 'err'); }
                return refreshTikTok(acc.id).then(render);
              });
            });
          },
        }), 'background:var(--primaryHover)'),
  ]);

  /* แถวคลิป — บรรทัดเดียว: ⠿ · เลข · ชื่อ(ellipsis) · ความยาว · ▶ ดูวิดีโอ · ▲ ▼ ✕ */
  var clipRows = acc.clips.map(function (clip, i) {
    var first = i === 0, last = i === acc.clips.length - 1;
    var upBtn = el('button', {
      style: SETUP_ST.iconBtn + (first ? '; opacity:.35; cursor:not-allowed' : ''), text: '▲', title: 'เลื่อนขึ้น (เล่นก่อน)', disabled: first,
      onClick: function () { moveClip(acc, i, -1); },
    });
    var downBtn = el('button', {
      style: SETUP_ST.iconBtn + (last ? '; opacity:.35; cursor:not-allowed' : ''), text: '▼', title: 'เลื่อนลง (เล่นทีหลัง)', disabled: last,
      onClick: function () { moveClip(acc, i, 1); },
    });
    if (!first) hov(upBtn, 'background:var(--border)');
    if (!last) hov(downBtn, 'background:var(--border)');

    var top = el('div', { style: 'display:flex; align-items:center; gap:10px' }, [
      el('span', { style: 'color:var(--faint); cursor:grab; flex-shrink:0', text: '⠿' }),
      el('span', { style: 'width:24px; height:24px; border-radius:99px; background:var(--bg); color:var(--muted); font-size:11.5px; font-weight:700; display:grid; place-items:center; flex-shrink:0', text: String(i + 1) }),
      el('span', {
        style: 'flex:1; font-size:13.5px; font-weight:500; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis',
        title: clip.path + (clip.label ? '\n' + clip.label : ''),
        text: clip.name,
      }),
      el('span', {
        style: 'font-size:12px; color:var(--muted); font-family:\'IBM Plex Mono\',monospace; flex-shrink:0',
        text: typeof clip.durationSec === 'number' ? fmtMS(clip.durationSec) : '—',
      }),
      hov(el('button', {
        style: SETUP_ST.xsBtn + '; color:var(--accentHi)', text: '▶ ดูวิดีโอ',
        onClick: function () { previewClip(clip); },
      }), 'border-color:var(--primary); background:rgba(var(--blueRgb),.1)'),
      upBtn,
      downBtn,
      hov(el('button', {
        style: SETUP_ST.xBtn, text: '✕', title: 'เอาออกจากรายการ',
        onClick: function () {
          confirmDialog({
            title: 'เอาคลิปนี้ออกจากรายการไหม',
            body: clip.name + ' — ไฟล์ในเครื่องและในคลังยังอยู่ แค่ไม่วนในไลฟ์นี้',
            ok: 'เอาออก', cancel: 'ยกเลิก', danger: true,
          }).then(function (yes) {
            if (!yes) return;
            var idx = acc.clips.indexOf(clip);
            if (idx < 0) return;
            acc.clips.splice(idx, 1);
            saveStore(); render(); pushLiveConfig(acc);
            toast('เอาคลิปออกแล้ว', 'ok');
          });
        },
      }), SETUP_ST.dangerHover),
    ]);

    var sched = el('div', { style: 'display:flex; align-items:center; gap:8px; padding-left:34px; font-size:12px; color:var(--muted)' }, [
      el('span', {
        style: miniTrackStyle(clip.sched), title: 'ตั้งเวลาเล่น',
        onClick: function () { clip.sched = !clip.sched; if (clip.sched && !clip.time) clip.time = '18:00'; saveStore(); render(); },
      }, [el('span', { style: miniKnobStyle(clip.sched) })]),
      el('span', { style: 'white-space:nowrap', text: 'ตั้งเวลาเล่น' }),
      clip.sched ? el('input', {
        type: 'time', value: clip.time || '18:00',
        style: 'height:26px; border:1px solid var(--border); border-radius:7px; background:var(--bg); color:var(--text); font-size:12px; padding:0 6px; font-family:\'IBM Plex Mono\',monospace; flex-shrink:0',
        onChange: function (e) { clip.time = e.target.value; saveStore(); },
      }) : null,
      el('span', {
        style: 'color:var(--faint); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0',
        title: clip.sched ? 'ระบบจะดันคลิปนี้ขึ้นเล่นตอนถึงเวลา (เฉพาะตอนกำลังไลฟ์อยู่)' : '',
        text: clip.sched ? 'คลิปนี้จะเริ่มเล่นตอนนี้ทุกวัน' : 'วนตามลำดับปกติ',
      }),
    ]);

    return hov(el('div', { style: 'display:flex; flex-direction:column; gap:6px; background:var(--surface2); border-radius:12px; padding:8px 12px; flex-shrink:0' }, [top, sched]), 'background:var(--hover)');
  });

  var emptyClips = el('div', {
    style: 'background:var(--surface2); border-radius:12px; padding:22px 12px; text-align:center; color:var(--faint); font-size:12.5px; line-height:1.7; flex-shrink:0',
    text: 'ยังไม่มีคลิป — กด "+ เพิ่มคลิปจากเครื่อง" หรือลากไฟล์วิดีโอมาวางที่การ์ดนี้',
  });

  var shuffleDisabled = acc.clips.length < 2;
  var shuffleOn = acc.shuffle !== false;

  var card = el('div', { style: SETUP_ST.card }, [
    el('div', { style: SETUP_ST.head }, [
      el('span', { style: SETUP_ST.numOn, text: '1' }),
      el('span', { style: SETUP_ST.title, text: 'เตรียมของ' }),
      el('span', { style: SETUP_ST.sub, text: 'บัญชี · คลิปที่จะวน' }),
    ]),
    acctBox,
    el('div', { style: 'display:flex; align-items:baseline; gap:8px; margin-top:16px; flex-shrink:0' }, [
      el('span', { style: 'font-size:14px; font-weight:600', text: 'คลิปที่จะวน' }),
      el('span', { style: 'font-size:11.5px; color:var(--faint)', text: 'ปรับเป็น 1080×1920 ให้อัตโนมัติ' }),
    ]),
    el('div', { style: 'display:flex; flex-direction:column; gap:6px; margin-top:8px; flex-shrink:0' }, clipRows.length ? clipRows : [emptyClips]),
    el('div', { style: 'display:flex; gap:8px; margin-top:8px; flex-shrink:0' }, [
      hov(el('button', {
        style: 'height:40px; flex:1; border:1px dashed var(--borderHi); border-radius:12px; background:none; color:var(--accentHi); font-size:13px; font-weight:600; cursor:pointer; white-space:nowrap; font-family:inherit',
        text: '+ เพิ่มคลิปจากเครื่อง',
        onClick: function (e) {
          busy(e.currentTarget, 'กำลังเลือกไฟล์…', function () {
            return API.chooseVideo().then(function (v) {
              if (!v) return;
              return addClips(acc, [v.path]).then(function () {
                var clip = acc.clips.filter(function (c) { return c.path === v.path; })[0];
                if (clip && v.mediaUrl) { clip.mediaUrl = v.mediaUrl; saveStore(); }
                toast('เพิ่มคลิปแล้ว', 'ok');
                render();
              });
            });
          });
        },
      }), 'border-color:var(--primary); background:rgba(var(--blueRgb),.08)'),
      hov(el('button', {
        style: 'height:40px; padding:0 14px; border:1px solid var(--border); border-radius:12px; background:none; color:var(--muted); font-size:13px; cursor:pointer; white-space:nowrap; font-family:inherit',
        text: 'จากคลัง',
        onClick: function () { go('library'); },
      }), 'border-color:var(--borderHi)'),
    ]),
    el('div', { style: 'flex:1' }),
    el('label', {
      style: 'display:flex; align-items:center; gap:12px; cursor:pointer; border-top:1px solid var(--surface2); padding-top:12px; margin-top:12px; flex-shrink:0',
      title: shuffleDisabled ? 'เพิ่มอีกอย่างน้อย 1 คลิปเพื่อเปิดใช้การสุ่ม' : '',
      onClick: function () {
        if (shuffleDisabled) return;
        acc.shuffle = !shuffleOn; saveStore(); render(); pushLiveConfig(acc);
      },
    }, [
      el('div', { style: toggleTrackStyle(shuffleOn, shuffleDisabled) }, [el('div', { style: toggleKnobStyle(shuffleOn) })]),
      el('div', {}, [
        el('div', { style: 'font-size:13.5px; font-weight:600', text: 'สุ่มลำดับทุกรอบ' }),
        el('div', { style: 'font-size:11.5px; color:var(--muted)', text: shuffleDisabled ? 'เพิ่มอีกอย่างน้อย 1 คลิปเพื่อเปิดใช้การสุ่ม' : 'กันตรวจจับว่าเล่นซ้ำแพทเทิร์นเดิม' }),
      ]),
    ]),
  ]);

  /* ลากไฟล์วิดีโอมาวางบนการ์ดขั้น 1 ได้ทั้งใบ */
  dropZone(card, function (paths) {
    addClips(acc, paths).then(function () { toast('เพิ่มคลิปแล้ว ' + paths.length + ' ไฟล์', 'ok'); render(); });
  });
  (function dropHint(node) {
    var base = node.getAttribute('style');
    node.addEventListener('dragover', function () { node.setAttribute('style', base + '; border-color:var(--primary); background:rgba(var(--blueRgb),.06)'); });
    node.addEventListener('dragleave', function () { node.setAttribute('style', base); });
    node.addEventListener('drop', function () { node.setAttribute('style', base); });
  })(card);

  resolveClipDurations(acc);
  return card;
}

function moveClip(acc, index, delta) {
  var target = index + delta;
  if (target < 0 || target >= acc.clips.length) return;
  var tmp = acc.clips[index];
  acc.clips[index] = acc.clips[target];
  acc.clips[target] = tmp;
  saveStore();
  render();
  pushLiveConfig(acc);
}

function addClips(acc, paths) {
  var fresh = paths.filter(function (p) { return !acc.clips.some(function (c) { return c.path === p; }); });
  if (!fresh.length) { toast('คลิปนี้อยู่ในรายการแล้ว'); return Promise.resolve(); }
  fresh.forEach(function (p) {
    var lib = (S.library || []).filter(function (x) { return x && x.path === p; })[0];
    acc.clips.push({ path: p, name: p.split(/[\\/]/).pop(), label: '', sched: false, time: '18:00', mediaUrl: lib && lib.mediaUrl ? lib.mediaUrl : '' });
  });
  saveStore();
  return API.probeClips(fresh).then(function (infos) {
    (infos || []).forEach(function (info) {
      var clip = acc.clips.filter(function (c) { return c.path === info.path; })[0];
      if (clip) clip.label = info.label || '';
    });
    saveStore();
  }).catch(function () { /* probe ไม่ได้ก็ยังใช้คลิปได้ */ });
}

/* modal พรีวิวคลิป 360px ตาม mock-sections/modals.html — ใช้ <video controls> จริง */
function previewClip(clip) {
  openModal(function (close) {
    var primary = clipMediaUrl(clip);
    var fallback = fileUrl(clip.path);
    var video = el('video', {
      src: primary || fallback, controls: 'controls', autoplay: 'autoplay', playsinline: 'playsinline',
      style: 'display:block; width:100%; aspect-ratio:9/16; max-height:520px; background:linear-gradient(170deg,#1B2A4A,#0F1320); border-radius:14px; object-fit:contain',
    });
    video.addEventListener('error', function () {
      if (primary && video.getAttribute('src') !== fallback) { video.setAttribute('src', fallback); video.load(); return; }
      toast('เปิดไฟล์นี้ไม่ได้ — ไฟล์อาจถูกย้ายหรือลบไปแล้ว', 'err');
    });
    var stop = function () { try { video.pause(); } catch (e) {} };
    var root = el('div', { style: 'background:var(--surface); border:1px solid var(--border); border-radius:20px; padding:18px; width:360px; display:flex; flex-direction:column; gap:12px' }, [
      el('div', { style: 'display:flex; align-items:center' }, [
        el('span', { style: 'font-size:15px; font-weight:700; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap', title: clip.path, text: clip.name }),
        el('div', { style: 'flex:1' }),
        el('button', {
          style: 'width:32px; height:32px; border:none; border-radius:8px; background:var(--surface2); color:var(--muted); cursor:pointer; flex-shrink:0; font-family:inherit',
          text: '✕', onClick: function () { stop(); close(); },
        }),
      ]),
      video,
      el('div', { style: 'font-size:12px; color:var(--faint); text-align:center', text: 'พรีวิวคลิปก่อนนำไปไลฟ์ · 1080×1920' }),
    ]);
    /* ปิดด้วยการคลิกฉากหลัง → หยุดเล่นด้วย */
    setTimeout(function () {
      var mask = root.parentNode;
      if (mask) mask.addEventListener('mousedown', function (e) { if (e.target === mask) stop(); });
    }, 0);
    return root;
  });
}

/* ===================================================================== */
/* ขั้น 2 · แต่งหน้าจอ                                                    */
/* ===================================================================== */
function stepDecorate(acc) {
  var layers = layerList(acc);
  var sel = selectedLayer(acc);

  var addBtnStyle = 'height:38px; flex:1; border:1px solid var(--border); border-radius:10px; background:var(--surface2); color:var(--text); font-size:12.5px; font-weight:600; cursor:pointer; white-space:nowrap; font-family:inherit';
  var clockFull = acc.clocks.length >= 6, textFull = acc.texts.length >= 8;

  var addRow = el('div', { style: 'display:flex; gap:6px; margin-top:14px; flex-shrink:0' }, [
    hov(el('button', {
      style: addBtnStyle, text: '+ รูป',
      onClick: function (e) {
        busy(e.currentTarget, 'เลือกรูป…', function () {
          return API.chooseOverlay().then(function (img) {
            if (!img) return;
            var id = 'ov-' + Math.random().toString(36).slice(2, 8);
            acc.overlays.push({ id: id, path: img.path, name: img.name, mediaUrl: img.mediaUrl, x: 80, y: 120, width: 320, opacity: 0.95, effect: 'none' });
            S.selLayer = { kind: 'overlay', id: id };
            saveStore(); render(); pushLiveConfig(acc);
          });
        });
      },
    }), 'border-color:var(--primary)'),
    (function () {
      var b = el('button', {
        style: addBtnStyle + (clockFull ? '; opacity:.45; cursor:not-allowed' : ''), text: '+ นาฬิกา', disabled: clockFull,
        title: clockFull ? 'ใส่นาฬิกาได้สูงสุด 6 อัน' : '',
        onClick: function () {
          var id = 'ck-' + Math.random().toString(36).slice(2, 8);
          acc.clocks.push({ id: id, x: 700, y: 120, fontSize: 72, opacity: 1, format: 'time-short', color: '#ffffff', font: 'mono', design: 'shadow', effect: 'none' });
          S.selLayer = { kind: 'clock', id: id };
          saveStore(); render(); pushLiveConfig(acc);
        },
      });
      return clockFull ? b : hov(b, 'border-color:var(--primary)');
    })(),
    (function () {
      var b = el('button', {
        style: addBtnStyle + (textFull ? '; opacity:.45; cursor:not-allowed' : ''), text: '+ ข้อความ', disabled: textFull,
        title: textFull ? 'ใส่ข้อความได้สูงสุด 8 อัน' : '',
        onClick: function () {
          var id = 'tx-' + Math.random().toString(36).slice(2, 8);
          acc.texts.push({ id: id, x: 90, y: 1560, fontSize: 56, opacity: 1, text: 'ส่งฟรี 2 ชิ้น', color: '#ffffff', font: 'bold', design: 'solid-accent', mode: 'marquee', speed: 120, effect: 'none' });
          S.selLayer = { kind: 'text', id: id };
          saveStore(); render(); pushLiveConfig(acc);
        },
      });
      return textFull ? b : hov(b, 'border-color:var(--primary)');
    })(),
  ]);

  var layerRows = layers.map(function (layer) {
    var on = Boolean(S.selLayer && S.selLayer.kind === layer.kind && S.selLayer.id === layer.id);
    var hidden = layer.ref.opacity <= 0.02;
    var row = el('div', {
      style: layerRowStyle(on),
      onClick: function () { S.selLayer = { kind: layer.kind, id: layer.id }; render(); },
    }, [
      el('span', { style: 'width:20px; text-align:center; flex-shrink:0', text: layer.icon }),
      el('span', { style: 'flex:1; font-size:13.5px; font-weight:500; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis' + (hidden ? '; opacity:.5' : ''), title: layer.name, text: layer.name }),
      el('span', { style: 'font-size:11.5px; color:var(--muted); white-space:nowrap; flex-shrink:0', text: layer.typeLabel }),
      hov(el('button', {
        style: SETUP_ST.rowBtn, text: hidden ? 'แสดง' : 'ซ่อน',
        onClick: function (e) {
          e.stopPropagation();
          layer.ref.opacity = hidden ? 0.95 : 0.01;
          saveStore(); render(); pushLiveConfig(acc);
        },
      }), 'background:var(--border)'),
      hov(el('button', {
        style: SETUP_ST.rowBtn, text: 'ลบ',
        onClick: function (e) {
          e.stopPropagation();
          confirmDialog({
            title: 'ลบ layer นี้ไหม',
            body: layer.name + ' · ' + layer.typeLabel + ' — ลบแล้วต้องเพิ่มและปรับใหม่',
            ok: 'ลบ', cancel: 'ยกเลิก', danger: true,
          }).then(function (yes) {
            if (!yes) return;
            removeLayer(acc, layer.kind, layer.id);
            saveStore(); render(); pushLiveConfig(acc);
            toast('ลบ layer แล้ว', 'ok');
          });
        },
      }), SETUP_ST.dangerHover),
    ]);
    /* rowStyle ใน state.js ไม่มี hover — ไม่ใส่ hov() */
    return row;
  });

  var emptyLayers = el('div', {
    style: 'display:flex; align-items:center; justify-content:center; min-height:46px; border-radius:12px; border:1px dashed var(--border); font-size:12px; color:var(--faint); padding:0 12px; text-align:center; flex-shrink:0',
    text: 'ยังไม่มี layer — เพิ่มรูป นาฬิกา หรือข้อความจากปุ่มด้านบน',
  });

  var inspector = sel ? layerInspector(acc, sel) : el('div', { style: SETUP_ST.insp }, [
    el('div', { style: SETUP_ST.inspT, text: 'ปรับ · ยังไม่ได้เลือก layer' }),
    el('div', { style: 'font-size:12px; color:var(--faint); margin-top:8px; line-height:1.6', text: layers.length ? 'กดเลือก layer ด้านบน หรือลากบนพรีวิว เพื่อปรับขนาด · โปร่งใส · เอฟเฟกต์' : 'เพิ่ม layer ก่อน แล้วค่อยปรับขนาด · โปร่งใส · เอฟเฟกต์ที่นี่' }),
  ]);

  var disclose = hov(el('div', {
    style: 'font-size:12px; color:var(--faint); border-top:1px solid var(--surface2); padding-top:10px; margin-top:12px; cursor:pointer; user-select:none; flex-shrink:0',
    text: (S.showAdvanced ? '▾' : '▸') + ' ปรับกล้อง (ซูม · เลื่อน · พลิก) · ตั้งค่าขั้นสูง (RTMP · bitrate)',
    onClick: function () { S.showAdvanced = !S.showAdvanced; render(); },
  }), 'color:var(--text)');

  return el('div', { style: SETUP_ST.card }, [
    el('div', { style: SETUP_ST.head }, [
      el('span', { style: SETUP_ST.num, text: '2' }),
      el('span', { style: SETUP_ST.title, text: 'แต่งหน้าจอ' }),
      el('span', { style: SETUP_ST.sub, text: 'ข้ามได้ · ลากวางบนพรีวิว' }),
    ]),
    addRow,
    el('div', { style: 'display:flex; flex-direction:column; gap:4px; margin-top:10px; flex-shrink:0' }, layerRows.length ? layerRows : [emptyLayers]),
    inspector,
    el('div', { style: 'flex:1' }),
    disclose,
    S.showAdvanced ? advancedPanel(acc) : null,
  ]);
}

function layerInspector(acc, layer) {
  var ref = layer.ref;
  var rows = [];
  var commit = function () { saveStore(); pushLiveConfig(acc); };
  var lbl = function (text) { return el('span', { style: SETUP_ST.lbl, text: text }); };

  if (layer.kind === 'overlay') {
    rows.push(lbl('ขนาด'));
    rows.push(el('input', {
      type: 'range', min: '64', max: '900', value: String(ref.width), style: 'width:100%; margin:0',
      onInput: function (e) { ref.width = Number(e.target.value); paintPreview(); },
      onChange: commit,
    }));
  } else {
    rows.push(lbl('ขนาด'));
    rows.push(el('input', {
      type: 'range', min: layer.kind === 'clock' ? '24' : '18', max: layer.kind === 'clock' ? '180' : '200', value: String(ref.fontSize), style: 'width:100%; margin:0',
      onInput: function (e) { ref.fontSize = Number(e.target.value); paintPreview(); },
      onChange: commit,
    }));
  }

  rows.push(lbl('โปร่งใส'));
  rows.push(el('input', {
    type: 'range', min: '0', max: '100', value: String(Math.round(ref.opacity * 100)), style: 'width:100%; margin:0',
    onInput: function (e) { ref.opacity = Number(e.target.value) / 100; paintPreview(); },
    onChange: commit,
  }));

  rows.push(lbl('เอฟเฟกต์'));
  rows.push(el('div', { style: 'display:flex; gap:5px; flex-wrap:wrap' }, EFFECTS.map(function (fx) {
    return el('span', {
      style: effectChipStyle((ref.effect || 'none') === fx[0]), text: fx[1],
      onClick: function () { ref.effect = fx[0]; saveStore(); render(); pushLiveConfig(acc); },
    });
  })));

  if (layer.kind === 'text') {
    rows.push(lbl('ข้อความ'));
    rows.push(el('input', {
      class: 'inp', style: SETUP_ST.inp34, maxlength: '200', value: ref.text, placeholder: 'พิมพ์ข้อความ…',
      onInput: function (e) { ref.text = e.target.value; paintPreview(); },
      onChange: function () { saveStore(); render(); pushLiveConfig(acc); },
    }));
    rows.push(lbl('การเคลื่อนไหว'));
    rows.push(el('div', { style: 'display:flex; gap:5px; flex-wrap:wrap' }, [
      el('span', { style: effectChipStyle(ref.mode === 'static'), text: 'นิ่ง', onClick: function () { ref.mode = 'static'; saveStore(); render(); pushLiveConfig(acc); } }),
      el('span', { style: effectChipStyle(ref.mode === 'marquee'), text: 'วิ่ง', onClick: function () { ref.mode = 'marquee'; saveStore(); render(); pushLiveConfig(acc); } }),
    ]));
  }
  if (layer.kind === 'clock') {
    rows.push(lbl('รูปแบบเวลา'));
    rows.push(selectBox(CLOCK_FORMATS, ref.format, function (v) { ref.format = v; saveStore(); render(); pushLiveConfig(acc); }));
  }
  if (layer.kind === 'clock' || layer.kind === 'text') {
    rows.push(lbl('ฟอนต์'));
    rows.push(selectBox(FONTS, ref.font, function (v) { ref.font = v; saveStore(); render(); pushLiveConfig(acc); }));
    rows.push(lbl('สไตล์'));
    rows.push(selectBox(DESIGNS, ref.design, function (v) { ref.design = v; saveStore(); render(); pushLiveConfig(acc); }));
    rows.push(lbl('สี'));
    rows.push(el('input', {
      type: 'color', value: ref.color, style: 'width:56px; height:30px; background:none; border:1px solid var(--border); border-radius:8px; padding:2px; cursor:pointer',
      onInput: function (e) { ref.color = e.target.value; paintPreview(); },
      onChange: commit,
    }));
  }

  return el('div', { style: SETUP_ST.insp }, [
    el('div', { style: SETUP_ST.inspT + '; white-space:nowrap; overflow:hidden; text-overflow:ellipsis', title: layer.name, text: 'ปรับ · ' + layer.name }),
    el('div', { style: SETUP_ST.inspGrid }, rows),
  ]);
}

/* แผงปรับกล้อง + ตั้งค่าขั้นสูง (ซูม · พลิก · รีเซ็ต · TikTok/Manual RTMP · stream key · bitrate) */
function advancedPanel(acc) {
  var rowSt = 'display:flex; align-items:center; gap:10px';
  var lblSt = 'color:var(--muted); width:84px; flex-shrink:0; white-space:nowrap';
  var brateLabel = el('span', {
    style: 'width:96px; text-align:right; font-size:12px; font-family:\'IBM Plex Mono\',monospace; flex-shrink:0',
    text: acc.bitrateKbps.toLocaleString() + ' kbps',
  });
  var manual = acc.targetMode === 'manual';

  return el('div', { style: 'margin-top:10px; display:grid; gap:10px; font-size:13px; flex-shrink:0' }, [
    el('div', { style: rowSt }, [
      el('span', { style: lblSt, text: 'ซูมกล้อง' }),
      el('input', {
        type: 'range', min: '1', max: '3', step: '0.05', value: String(acc.camera.zoom), style: 'flex:1; margin:0',
        onInput: function (e) { acc.camera.zoom = Number(e.target.value); },
        onChange: function () { saveStore(); pushLiveConfig(acc); },
      }),
    ]),
    el('div', { style: rowSt }, [
      hov(el('button', {
        style: acc.camera.mirror ? SETUP_ST.smBtnOn : SETUP_ST.smBtn, text: 'พลิกกล้อง (สะท้อน)',
        onClick: function () { acc.camera.mirror = !acc.camera.mirror; saveStore(); render(); pushLiveConfig(acc); },
      }), acc.camera.mirror ? 'background:var(--primaryHover)' : 'border-color:var(--borderHi)'),
      hov(el('button', {
        style: SETUP_ST.smBtn, text: 'รีเซ็ตกล้อง',
        onClick: function () { acc.camera = { zoom: 1, panX: 0, panY: 0, mirror: false }; saveStore(); render(); pushLiveConfig(acc); },
      }), 'border-color:var(--borderHi)'),
    ]),
    el('div', { style: rowSt + '; margin-top:4px; flex-wrap:wrap' }, [
      el('span', { style: lblSt, text: 'ปลายทาง' }),
      el('span', { style: effectChipStyle(!manual), text: 'TikTok อัตโนมัติ', onClick: function () { acc.targetMode = 'tiktok'; saveStore(); render(); } }),
      el('span', { style: effectChipStyle(manual), text: 'Manual RTMP', onClick: function () { acc.targetMode = 'manual'; saveStore(); render(); } }),
    ]),
    manual ? el('input', {
      class: 'inp', style: SETUP_ST.inp36, placeholder: 'rtmp://... หรือ rtmps://...', value: acc.rtmpServer,
      onInput: function (e) { acc.rtmpServer = e.target.value; }, onChange: function () { saveStore(); render(); },
    }) : null,
    manual ? el('input', {
      class: 'inp mono', style: SETUP_ST.inp36, type: 'password', placeholder: 'วาง stream key ที่นี่', value: acc.streamKey,
      onInput: function (e) { acc.streamKey = e.target.value; }, onChange: function () { saveStore(); render(); },
    }) : null,
    el('div', { style: rowSt }, [
      el('span', { style: lblSt, text: 'Bitrate' }),
      el('input', {
        type: 'range', min: '1500', max: '10000', step: '250', value: String(acc.bitrateKbps), style: 'flex:1; margin:0',
        onInput: function (e) { acc.bitrateKbps = Number(e.target.value); brateLabel.textContent = acc.bitrateKbps.toLocaleString() + ' kbps'; },
        onChange: function () { saveStore(); render(); },
      }),
      brateLabel,
    ]),
    el('div', { style: 'font-size:11.5px; line-height:1.6; color:var(--faint)', text: 'ยิ่งสูงภาพยิ่งคม แต่ต้องการเน็ตอัปโหลดแรงขึ้น — ถ้าตั้งสูงเกินกำลังเน็ตจะทำให้ไลฟ์กระตุกหรือหลุด' }),
  ]);
}

/* ===================================================================== */
/* ขั้น 3 · ยิงไลฟ์ + พรีวิว 9:16                                         */
/* ===================================================================== */
var LEGACY_LIVE_TITLE = 'Rerun LIVE';

/* เช็กลิสต์สำหรับแสดงผล — ถ้ายังไม่ตั้งชื่อ LIVE จะใช้ชื่อร้านแทนตอนกดเริ่ม จึงนับว่าผ่าน */
function setupCheck(acc) {
  if ((acc.liveTitle || '').trim()) return preflight(acc);
  return preflight(Object.assign({}, acc, { liveTitle: acc.alias }));
}

function stepGoLive(acc) {
  var check = setupCheck(acc);
  var mbps = Math.round(acc.bitrateKbps / 1000 * 10) / 10;

  var titleInput = el('input', {
    value: acc.liveTitle || '', placeholder: 'ไลฟ์สินค้ารอบเย็น 🔥 ส่งฟรี 2 ชิ้น', maxlength: '120',
    style: 'width:100%; height:42px; border:1px solid var(--border); border-radius:12px; padding:0 12px; font-size:13.5px; background:var(--surface); color:var(--text); outline:none; flex-shrink:0',
    onInput: function (e) { acc.liveTitle = e.target.value; },
    onChange: function () { saveStore(); },
    onFocus: function (e) { e.target.style.borderColor = 'var(--primary)'; },
    onBlur: function (e) { e.target.style.borderColor = 'var(--border)'; },
  });

  /* mock ไม่มีสถานะ disabled — กดตอนยังไม่พร้อม startLive() จะเปิด showPreflight บอกเหตุผลเอง */
  var startBtn = hov(el('button', {
    style: 'height:54px; border:1px solid rgba(255,255,255,.08); border-radius:14px; background:var(--primary); color:#fff; font-size:17px; font-weight:700; cursor:pointer; white-space:nowrap; font-family:inherit; flex-shrink:0; box-shadow:inset 0 1px 0 rgba(255,255,255,.08), 0 3px 10px rgba(var(--blueRgb),.28)',
    text: '▶ เริ่มไลฟ์ตอนนี้',
    onClick: function (e) {
      if (!(acc.liveTitle || '').trim()) { acc.liveTitle = acc.alias; saveStore(); }
      startLive(acc, e.currentTarget);
    },
  }), 'background:var(--primaryHover)');

  return el('div', { style: 'display:flex; flex-direction:column; gap:10px; min-height:0' }, [
    el('div', { style: SETUP_ST.head }, [
      el('span', { style: SETUP_ST.num, text: '3' }),
      el('span', { style: SETUP_ST.title, text: 'ยิงไลฟ์' }),
    ]),
    phonePreview(acc),
    titleInput,
    el('div', { style: 'display:flex; align-items:center; gap:8px; font-size:12px; color:var(--muted); white-space:nowrap; flex-shrink:0; min-width:0' }, [
      el('span', {
        style: 'color:' + (check.ok ? 'var(--green)' : 'var(--amber)') + '; font-weight:700; cursor:pointer; white-space:nowrap',
        title: 'กดดูรายละเอียดการตรวจ',
        text: (check.ok ? '✓' : '!') + ' ตรวจแล้ว ' + check.passed + '/' + check.total,
        onClick: function () { showPreflight(check); },
      }),
      el('span', { style: 'white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0', text: '· ' + (acc.targetMode === 'manual' ? 'Manual RTMP' : 'TikTok อัตโนมัติ') + ' · ' + mbps + ' Mbps' }),
      el('div', { style: 'flex:1' }),
      el('label', { style: 'display:flex; align-items:center; gap:6px; cursor:pointer; white-space:nowrap; flex-shrink:0' }, [
        el('input', { type: 'checkbox', id: 'savePresetChk', checked: true, style: 'margin:0' }),
        ' บันทึก Preset',
      ]),
    ]),
    startBtn,
    el('div', { style: 'font-size:11px; color:var(--faint); text-align:center; flex-shrink:0', text: 'ห้อง LIVE จริงจะถูกสร้างเมื่อกดปุ่มนี้เท่านั้น' }),
  ]);
}

function showPreflight(check) {
  openModal(function (close) {
    return el('div', { class: 'modal' }, [
      el('div', { class: 'modal-t', text: 'ตรวจก่อนยิงไลฟ์' }),
      el('div', { style: 'font-size:12px; color:var(--muted)', text: 'ผ่าน ' + check.passed + '/' + check.total + (check.ok ? ' · พร้อมยิงไลฟ์' : ' · แก้ข้อที่ติด ! ก่อนเริ่ม') }),
      el('div', { style: 'display:flex; flex-direction:column; gap:8px; margin-top:6px' }, check.items.map(function (item) {
        return el('div', { style: 'display:flex; align-items:center; gap:10px; font-size:13.5px' }, [
          el('span', { style: 'width:18px; flex-shrink:0; font-weight:700; color:' + (item.ok ? 'var(--green)' : 'var(--amber)'), text: item.ok ? '✓' : '!' }),
          el('span', { style: 'flex:1', text: item.label }),
          item.ok ? null : el('span', { style: 'font-size:12px; color:var(--faint); text-align:right', text: item.fix }),
        ]);
      })),
      el('div', { class: 'modal-actions' }, [el('button', { class: 'btn btn-primary', text: 'ปิด', onClick: close })]),
    ]);
  });
}

/* พรีวิวโทรศัพท์ 9:16 — จอมืดเสมอทั้ง 2 ธีม · overlay จริงวาดโดย paintPreview */
function phonePreview(acc) {
  var phone = el('div', {
    id: 'phonePreview',
    style: 'height:100%; aspect-ratio:9/16; background:linear-gradient(170deg,#1B2A4A,#0F1320); border-radius:24px; position:relative; overflow:hidden; border:1px solid var(--border); box-shadow:0 20px 50px rgba(0,0,0,.4)',
  }, [
    el('div', { style: 'position:absolute; inset:12px; border:1px dashed rgba(255,255,255,.2); border-radius:14px; pointer-events:none' }),
    el('div', {
      id: 'phoneGhost',
      style: 'position:absolute; inset:0; display:grid; place-items:center; color:rgba(255,255,255,.3); font-size:11px; pointer-events:none; text-align:center; padding:20px',
      text: acc.clips.length ? 'พรีวิว · ' + acc.clips[0].name : 'ยังไม่ได้เลือกคลิป',
    }),
  ]);
  var wrap = el('div', { style: 'flex:1; min-height:0; display:flex; justify-content:center' }, [phone]);
  setTimeout(paintPreview, 0);
  return wrap;
}

/* วาด overlay ทั้งหมดลงบนพรีวิว (เรียกซ้ำได้ ไม่ re-render ทั้งหน้า) */
function paintPreview() {
  var phone = document.getElementById('phonePreview');
  if (!phone) return;
  var acc = curAcc();
  if (!acc) return;

  Array.prototype.slice.call(phone.querySelectorAll('.ov')).forEach(function (n) { n.parentNode.removeChild(n); });
  var rect = phone.getBoundingClientRect();
  var scale = rect.width / CANVAS_W;
  if (!scale || !isFinite(scale)) return;

  var ghost = document.getElementById('phoneGhost');
  if (ghost) ghost.textContent = acc.clips.length ? 'พรีวิว · ' + acc.clips[0].name : 'ยังไม่ได้เลือกคลิป';

  var base = 'position:absolute; cursor:grab; user-select:none; touch-action:none; ';
  var ring = 'box-shadow:0 0 0 2px var(--primary); border-radius:6px; ';

  layerList(acc).forEach(function (layer) {
    var ref = layer.ref;
    var selected = Boolean(S.selLayer && S.selLayer.kind === layer.kind && S.selLayer.id === layer.id);
    var fx = ref.effect && ref.effect !== 'none' ? ' fx-' + ref.effect : '';
    var node;

    if (layer.kind === 'overlay') {
      node = el('div', {
        class: 'ov' + fx,
        style: base + (selected ? ring : '') + 'width:' + (ref.width * scale) + 'px; opacity:' + ref.opacity,
      }, [el('img', { src: ref.mediaUrl || fileUrl(ref.path), alt: '', draggable: 'false', style: 'display:block; width:100%; height:auto; pointer-events:none' })]);
    } else if (layer.kind === 'clock') {
      node = el('div', {
        class: 'ov ov-clock' + fx,
        style: base + (selected ? ring : '') + 'color:#fff; font-family:\'IBM Plex Mono\',monospace; font-weight:600; white-space:nowrap; padding:2px 6px; border-radius:6px; font-size:' + Math.max(8, ref.fontSize * scale) + 'px; opacity:' + ref.opacity + '; ' + designStyle(ref.design, ref.color),
        text: clockText(ref.format),
      });
      node.dataset.clockFormat = ref.format;
    } else if (ref.mode === 'marquee') {
      /* ข้อความวิ่ง — แถบเต็มความกว้างเหมือน mock (marquee 8s ที่ speed 120) */
      var dur = Math.max(3, Math.round(8 * 120 / (Number(ref.speed) || 120) * 10) / 10);
      node = el('div', {
        class: 'ov ov-text' + fx,
        style: base + 'left:0; right:0; overflow:hidden; opacity:' + ref.opacity + (selected ? '; box-shadow:0 0 0 2px var(--primary)' : ''),
      }, [
        el('div', {
          style: 'display:inline-block; white-space:nowrap; font-weight:700; padding:5px 10px; border-radius:6px; font-size:' + Math.max(8, ref.fontSize * scale) + 'px; animation:marquee ' + dur + 's linear infinite; ' + designStyle(ref.design, ref.color),
          text: ref.text || 'ข้อความ',
        }),
      ]);
      node.dataset.marquee = '1';
    } else {
      node = el('div', {
        class: 'ov ov-text' + fx,
        style: base + (selected ? ring : '') + 'white-space:nowrap; font-weight:700; padding:5px 10px; border-radius:6px; font-size:' + Math.max(8, ref.fontSize * scale) + 'px; opacity:' + ref.opacity + '; ' + designStyle(ref.design, ref.color),
        text: ref.text || 'ข้อความ',
      });
    }

    if (!node.dataset.marquee) node.style.left = (ref.x * scale) + 'px';
    node.style.top = (ref.y * scale) + 'px';
    dragLayer(node, ref, scale, layer);
    phone.appendChild(node);
  });
}

/* ลาก overlay บนพรีวิว → อัปเดต x/y ในพิกัด 1080×1920 จริง */
function dragLayer(node, ref, scale, layer) {
  node.addEventListener('pointerdown', function (down) {
    down.preventDefault();
    node.setPointerCapture(down.pointerId);
    S.selLayer = { kind: layer.kind, id: layer.id };
    var startX = down.clientX, startY = down.clientY, baseX = ref.x, baseY = ref.y;
    var move = function (e) {
      ref.x = Math.round(Math.max(-300, Math.min(CANVAS_W - 20, baseX + (e.clientX - startX) / scale)));
      ref.y = Math.round(Math.max(-100, Math.min(CANVAS_H - 20, baseY + (e.clientY - startY) / scale)));
      if (!node.dataset.marquee) node.style.left = (ref.x * scale) + 'px';
      node.style.top = (ref.y * scale) + 'px';
    };
    var up = function () {
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', up);
      saveStore();
      render();
      pushLiveConfig(curAcc());
    };
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', up);
  });
}

/* ===================================================================== */
/* หน้าไลฟ์ (รวม 3 ขั้น)                                                  */
/* ===================================================================== */
function viewSetup() {
  var acc = curAcc();
  if (!acc) {
    return el('div', { style: SETUP_ST.grid }, [
      el('div', { style: SETUP_ST.card + '; grid-column:1 / -1; align-items:center; justify-content:center; color:var(--faint); font-size:12.5px', text: 'ยังไม่มีบัญชี — กด "เพิ่มบัญชี" ใน sidebar' }),
    ]);
  }
  /* ค่าเริ่มต้นเดิม "Rerun LIVE" → ว่างไว้ให้เห็น placeholder (ถ้าว่างตอนเริ่มไลฟ์จะใช้ชื่อร้านแทน) */
  if (acc.liveTitle === LEGACY_LIVE_TITLE) { acc.liveTitle = ''; saveStore(); }
  return el('div', { style: SETUP_ST.grid }, [stepPrepare(acc), stepDecorate(acc), stepGoLive(acc)]);
}
