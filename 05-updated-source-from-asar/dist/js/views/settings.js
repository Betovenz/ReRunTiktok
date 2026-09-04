/* Rerun Studio v11 — ตั้งค่า — ระบบ / LINE / แชท AI / แอดมิน
   ลอก inline style จาก mock-sections/settings.html แบบ element ต่อ element
   ({{ T.x }} → var(--x) · style-hover → hov() · toggle/setTabs ตามสูตรใน state.js)
   และคงการเชื่อม API เดิมทั้งหมด (viewSettings, setSystem, showScanResult, setLine, setAi, setAdmin, adminUserCard, loadAdminKeys เป็น global)

   element ที่ mock ไม่มีแต่จำเป็นต่อฟังก์ชันจริง (ผูก IPC ตาม WIRING.md) วางไว้ "ใต้" element ของ mock เสมอ
   เพื่อให้ลำดับ/ระยะของ element ตาม mock คงเดิม:
   - ระบบ: บรรทัดสถานะอัปเดต + ปุ่ม "อัปเดตเลย" (update:*) · ส่วนเครื่องมือช่าง (tiktok:scan-live-console)
   - LINE: toggle เปิด/ปิด (line.enabled) · ปุ่ม "ส่งสถานะไลฟ์ตอนนี้" (line:push-status)
   - แชท AI: toggle เปิด/ปิดระบบตอบแชท · ตอบด้วย AI + โมเดล · @username โฮสต์ · กฎคีย์เวิร์ด · ปุ่มบันทึก (chat:set-config)
   - แอดมิน (ปลดล็อกแล้ว): ฟอร์มออกคีย์ / ค้นหา / รายการคีย์ (admin:*) */

/* ===================================================================== */
/* style จาก mock (คัดลอกตรง ๆ) — ชื่อ prefix SETTINGS_/stg กันชนกับ view อื่น */
/* ===================================================================== */
var SETTINGS_ST = {
  /* โครงหน้า */
  page: 'height:100%; display:grid; grid-template-columns:240px 1fr; gap:18px; min-height:0',
  navCard: 'background:var(--surface); border:1px solid var(--border); border-radius:22px; padding:22px 14px; display:flex; flex-direction:column; gap:4px',
  navTitle: 'font-size:22px; font-weight:700; padding:0 10px 12px',
  navFoot: 'font-size:11.5px; color:var(--faint); padding:0 10px',
  bodyCard: 'background:var(--surface); border:1px solid var(--border); border-radius:22px; padding:26px 28px; min-height:0; overflow:hidden',
  /* พื้นที่เนื้อหาในการ์ด — scroll ได้เฉพาะภายในการ์ด (README: ไม่มี scroll ระดับหน้า) */
  bodyScroll: 'height:100%; min-height:0; overflow:auto',
  /* setTabs (state.js) */
  tabBase: 'height:44px; padding:0 14px; border:none; border-radius:12px; font-size:14px; cursor:pointer; font-family:inherit; text-align:left; white-space:nowrap;',
  tabOn: 'background:var(--surface2); color:var(--accentHi); font-weight:700',
  tabOff: 'background:none; color:var(--muted)',
  /* หัวข้อ */
  h: 'font-size:18px; font-weight:700',
  hSub: 'font-size:12px; color:var(--muted); font-weight:400',
  /* ระบบ */
  grid: 'display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:16px',
  card: 'background:var(--surface2); border-radius:16px; padding:18px 20px',
  cardRow: 'background:var(--surface2); border-radius:16px; padding:18px 20px; display:flex; align-items:center; gap:14px',
  k: 'font-size:12px; color:var(--muted)',
  vMono: "font-size:20px; font-weight:600; font-family:'IBM Plex Mono',monospace; margin-top:4px",
  link: 'font-size:12.5px; font-weight:600',
  cardT: 'font-size:14px; font-weight:600',
  cardS: 'font-size:12.5px; color:var(--muted); margin-top:2px',
  btn40: 'height:40px; padding:0 16px; border:1px solid var(--border); border-radius:12px; background:none; color:var(--text); font-size:13px; font-weight:600; cursor:pointer; white-space:nowrap',
  /* toggle (state.js) */
  trackBase: 'width:44px; height:26px; border-radius:99px; padding:3px; cursor:pointer; transition:background .15s; flex-shrink:0;',
  knobBase: 'width:20px; height:20px; border-radius:99px; background:#fff; transition:transform .15s;',
  /* ฟอร์ม (LINE / AI / แอดมิน) */
  formGrid: 'display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:16px; max-width:760px',
  label: 'font-size:12.5px; color:var(--muted)',
  input: 'display:block; width:100%; height:44px; border:1px solid var(--border); border-radius:12px; padding:0 12px; font-size:13.5px; margin-top:6px; background:var(--surface2); color:var(--text)',
  inputMono: "display:block; width:100%; height:44px; border:1px solid var(--border); border-radius:12px; padding:0 12px; font-size:13.5px; margin-top:6px; background:var(--surface2); color:var(--text); font-family:'IBM Plex Mono',monospace",
  textarea: 'display:block; width:100%; height:110px; border:1px solid var(--border); border-radius:12px; padding:10px 12px; font-size:13.5px; margin-top:6px; background:var(--surface2); color:var(--text); resize:none',
  chkRow: 'display:flex; gap:16px; font-size:13.5px; margin-top:16px',
  chk: 'display:flex; gap:6px; cursor:pointer; align-items:center',
  chk8: 'display:flex; gap:8px; font-size:13.5px; cursor:pointer; margin-top:14px; align-items:center',
  btnRow: 'display:flex; gap:8px; margin-top:18px',
  primary44: 'height:44px; padding:0 22px; border:1px solid rgba(255,255,255,.08); border-radius:12px; background:var(--primary); color:#fff; box-shadow:inset 0 1px 0 rgba(255,255,255,.07); font-size:13.5px; font-weight:700; cursor:pointer; white-space:nowrap',
  /* mock ไม่ระบุ font-weight (=400) — ใส่ inline ไว้เพราะ class btn ใน app.css กำหนด 600 */
  outline44: 'height:44px; padding:0 16px; border:1px solid var(--border); border-radius:12px; background:none; color:var(--text); font-size:13.5px; font-weight:400; cursor:pointer; white-space:nowrap',
  /* ปุ่มเล็ก (ส่วนที่ mock ไม่มี — ใช้สเกลเดียวกับ .btn-sm / .btn-xs แต่เป็น inline) */
  small34: 'height:34px; padding:0 14px; border:1px solid var(--border); border-radius:10px; background:none; color:var(--text); font-size:12.5px; font-weight:600; cursor:pointer; white-space:nowrap',
  tiny28: 'height:28px; padding:0 10px; border:1px solid var(--border); border-radius:8px; background:none; color:var(--text); font-size:12px; font-weight:600; cursor:pointer; white-space:nowrap',
  /* ผู้ให้บริการ AI (mock: span ไม่มี style-hover) */
  pillOn: 'padding:10px 18px; border:none; border-radius:12px; background:var(--text); color:var(--bg); font-size:13px; font-weight:700; cursor:pointer; font-family:inherit; white-space:nowrap',
  pillOff: 'padding:10px 18px; border:1px solid var(--border); border-radius:12px; background:none; font-size:13px; color:var(--muted); cursor:pointer; font-family:inherit; white-space:nowrap',
  /* แอดมิน (ล็อก) */
  lockWrap: 'height:100%; display:grid; place-items:center',
  lockBox: 'max-width:420px; text-align:center',
  lockIcon: 'font-size:30px',
  lockT: 'font-size:16px; font-weight:700; margin-top:8px',
  lockS: 'font-size:13px; color:var(--muted); margin-top:4px',
  lockRow: 'display:flex; gap:8px; margin-top:16px',
  lockInput: "flex:1; height:44px; border:1px solid var(--border); border-radius:12px; padding:0 12px; font-size:13.5px; background:var(--surface2); color:var(--text); font-family:'IBM Plex Mono',monospace",
  solid44: 'height:44px; padding:0 20px; border:none; border-radius:12px; background:var(--text); color:var(--bg); font-size:13.5px; font-weight:700; cursor:pointer; white-space:nowrap',
  /* ส่วนเสริมที่ mock ไม่มี (วางใต้ element ของ mock) */
  extra: 'margin-top:18px; border-top:1px solid var(--surface2); padding-top:14px',
  extraT: 'font-size:13px; font-weight:600; color:var(--muted)',
  /* แถวรายการ (กฎ / คีย์) */
  listRow: 'display:flex; align-items:center; gap:10px; border-bottom:1px solid var(--surface2); padding:10px 0; font-size:13px',
  faint: 'font-size:11.5px; color:var(--faint)',
  empty: 'display:grid; place-items:center; text-align:center; color:var(--faint); font-size:12.5px; line-height:1.7; padding:16px',
  /* ปุ่มใน modal (class เดิมของ app.css + nowrap ตาม brief) */
  modalBtn: 'white-space:nowrap',
};

/* toggle ตามสูตร toggle(on) ใน state.js */
function stgToggle(on, onClick) {
  return el('div', {
    style: SETTINGS_ST.trackBase + (on ? 'background:var(--primary)' : 'background:var(--border)'),
    onClick: onClick,
  }, [el('div', { style: SETTINGS_ST.knobBase + (on ? 'transform:translateX(18px)' : '') })]);
}

/* label 12.5px muted ครอบ input ตาม mock */
function stgField(labelChildren, inputNode, extraStyle) {
  return el('label', { style: SETTINGS_ST.label + (extraStyle ? ';' + extraStyle : '') },
    (Array.isArray(labelChildren) ? labelChildren : [labelChildren]).concat([inputNode]));
}

/* ปุ่มขอบ (hover → borderHi) / ปุ่มหลัก (hover → primaryHover) — ใส่ class btn ไว้ให้สถานะ disabled ตอน busy() (inline ชนะ class เสมอ) */
function stgBtn(style, props) {
  /* mock ไม่ระบุ font-weight บนปุ่มขอบ (=400) แต่ .btn ใน app.css ให้ 600 → บังคับ 400 เว้นแต่ style ระบุเอง */
  var p = Object.assign({ class: 'btn', style: (/font-weight/.test(style || '') ? style : (style || '') + '; font-weight:400') }, props || {});
  return hov(el('button', p), 'border-color:var(--borderHi)');
}
function stgPrimaryBtn(style, props) {
  var p = Object.assign({ class: 'btn', style: style }, props || {});
  return hov(el('button', p), 'background:var(--primaryHover)');
}

/* ลิงก์ <a> ที่เรียก API: anchor ไม่มี disabled → ปิดการกดซ้ำด้วย pointer-events + aria-busy แล้วห่อ busy() ตาม brief */
function stgLinkBusy(link, label, task) {
  if (link.getAttribute('aria-busy') === 'true') return Promise.resolve();
  var base = link.getAttribute('style') || '';
  link.setAttribute('aria-busy', 'true');
  link.setAttribute('style', base + '; pointer-events:none; opacity:.45');
  return busy(link, label, task).then(function (r) {
    link.removeAttribute('aria-busy');
    link.setAttribute('style', base);
    return r;
  });
}

/* ===================================================================== */
/* ตั้งค่า                                                               */
/* ===================================================================== */
function viewSettings() {
  var tabs = [['system', 'ระบบ'], ['line', 'แจ้งเตือน LINE'], ['ai', 'แชท AI'], ['admin', 'แอดมิน 🔒']];

  var nav = el('div', { style: SETTINGS_ST.navCard }, [
    el('div', { style: SETTINGS_ST.navTitle, text: 'ตั้งค่า' }),
  ].concat(tabs.map(function (t) {
    var on = S.setTab === t[0];
    /* setTabs ใน state.js ไม่มี style-hover → ไม่ใส่ hov() */
    return el('button', {
      style: SETTINGS_ST.tabBase + (on ? SETTINGS_ST.tabOn : SETTINGS_ST.tabOff),
      text: t[1],
      onClick: function () { S.setTab = t[0]; render(); },
    });
  })).concat([
    el('div', { style: 'flex:1' }),
    el('div', { style: SETTINGS_ST.navFoot }, [
      'v' + S.appInfo.version + ' · ',
      el('a', { text: 'ออกจากระบบ', onClick: function () {
        confirmDialog({ title: 'ออกจากระบบ', body: 'ต้องเข้าสู่ระบบใหม่ด้วยรหัสลูกค้าเดิม', ok: 'ออกจากระบบ' }).then(function (yes) {
          if (yes) API.licenseLogout().then(function () { S.licensed = false; render(); });
        });
      } }),
    ]),
  ]));

  var body = S.setTab === 'system' ? setSystem()
    : S.setTab === 'line' ? setLine()
    : S.setTab === 'ai' ? setAi()
    : setAdmin();

  return el('div', { style: SETTINGS_ST.page }, [
    nav,
    el('div', { style: SETTINGS_ST.bodyCard }, [el('div', { style: SETTINGS_ST.bodyScroll }, [body])]),
  ]);
}

/* ===================================================================== */
/* ระบบ                                                                  */
/* ===================================================================== */
function setSystem() {
  var up = S.updateStatus || { state: 'none' };
  var upText = up.state === 'checking' ? 'กำลังตรวจหาอัปเดต…'
    : up.state === 'available' ? 'พบเวอร์ชันใหม่ ' + (up.version || '') + ' — กำลังดาวน์โหลด'
    : up.state === 'downloading' ? 'กำลังดาวน์โหลด ' + (up.percent || 0) + '%'
    : up.state === 'ready' ? 'เวอร์ชัน ' + (up.version || '') + ' พร้อมติดตั้ง'
    : up.state === 'error' ? (up.message || 'ตรวจอัปเดตไม่สำเร็จ')
    : 'ใช้เวอร์ชันล่าสุดอยู่แล้ว';

  var checkLink = el('a', { style: SETTINGS_ST.link, text: 'ตรวจหาอัปเดต →' });
  checkLink.addEventListener('click', function (e) {
    e.preventDefault();
    stgLinkBusy(checkLink, 'กำลังตรวจ…', function () {
      return API.checkForUpdate().then(function (s) { S.updateStatus = s || up; render(); });
    });
  });

  return el('div', {}, [
    el('div', { style: SETTINGS_ST.h, text: 'ระบบ' }),
    el('div', { style: SETTINGS_ST.grid }, [
      /* เวอร์ชัน */
      el('div', { style: SETTINGS_ST.card }, [
        el('div', { style: SETTINGS_ST.k, text: 'เวอร์ชัน' }),
        el('div', { style: SETTINGS_ST.vMono, text: S.appInfo.version }),
        checkLink,
        /* (mock ไม่มี) สถานะอัปเดตจาก event update:status */
        el('div', { style: 'font-size:12px; color:var(--muted); margin-top:6px', text: upText }),
        /* (mock ไม่มี) update:install — ยืนยันก่อน · กันกดตอนกำลังไลฟ์ (เหมือนชิปบนแถบบน) */
        up.state === 'ready' ? el('div', { style: 'margin-top:10px' }, [
          stgPrimaryBtn(SETTINGS_ST.primary44.replace('height:44px', 'height:36px').replace('padding:0 22px', 'padding:0 16px'), {
            text: 'อัปเดตเลย · รีสตาร์ต',
            onClick: function (e) {
              var btn = e.currentTarget;
              if (anyLive()) { toast('กำลังไลฟ์อยู่ — หยุดไลฟ์ก่อนติดตั้งอัปเดต', 'err'); return; }
              confirmDialog({
                title: 'อัปเดตแล้วเปิดแอปใหม่',
                body: 'เวอร์ชัน ' + (up.version || 'ใหม่') + ' พร้อมติดตั้ง แอปจะปิดและเปิดขึ้นมาใหม่',
                ok: 'อัปเดตเลย · รีสตาร์ต',
              }).then(function (yes) {
                if (!yes) return;
                busy(btn, 'กำลังติดตั้ง…', function () { return API.installUpdate(); });
              });
            },
          }),
        ]) : null,
      ]),
      /* FFmpeg */
      el('div', { style: SETTINGS_ST.card }, [
        el('div', { style: SETTINGS_ST.k, text: 'FFmpeg' }),
        el('div', {
          style: 'font-size:20px; font-weight:600; margin-top:4px; color:' + (S.appInfo.ffmpegReady ? 'var(--green)' : 'var(--amber)'),
          text: S.appInfo.ffmpegReady ? 'พร้อมใช้งาน ✓' : 'ไม่พบ FFmpeg',
        }),
        el('div', {
          style: 'font-size:12.5px; color:var(--muted)',
          text: S.bench && S.bench.hardwareEncoder ? 'ตัวช่วยฮาร์ดแวร์ ' + S.bench.hardwareEncoder : 'ตัวช่วยฮาร์ดแวร์ — กดทดสอบเพื่อตรวจ',
        }),
      ]),
      /* เครื่องนี้ไลฟ์ไหวแค่ไหน */
      el('div', { style: SETTINGS_ST.cardRow }, [
        el('div', { style: 'flex:1' }, [
          el('div', { style: SETTINGS_ST.cardT, text: 'เครื่องนี้ไลฟ์ไหวแค่ไหน' }),
          el('div', { style: SETTINGS_ST.cardS }, S.bench
            ? ['ผลล่าสุด: พร้อมกันได้ ', el('b', { style: 'color:var(--accentHi)', text: S.bench.maxStreams + ' บัญชี' }), S.bench.singleQuality ? ' · 1 บัญชี ' + S.bench.singleQuality : '']
            : ['รองรับสูงสุด ', el('b', { style: 'color:var(--accentHi)', text: S.appInfo.maxConcurrentStreams + ' บัญชี' }), ' (ประเมินจากสเปกเครื่อง)']),
        ]),
        stgBtn(SETTINGS_ST.btn40, {
          text: S.bench ? 'ทดสอบใหม่' : 'เริ่มทดสอบ',
          onClick: function (e) {
            var acc = curAcc();
            var sample = acc && acc.clips.length ? acc.clips[0].path : '';
            busy(e.currentTarget, 'กำลังทดสอบ...', function () {
              return API.runBenchmark(sample).then(function (r) { S.bench = r; toast('ทดสอบเสร็จ — เครื่องนี้ไลฟ์พร้อมกันได้ ' + r.maxStreams + ' บัญชี', 'ok'); render(); });
            });
          },
        }),
      ]),
      /* อัปเดตอัตโนมัติ */
      el('div', { style: SETTINGS_ST.cardRow }, [
        el('div', { style: 'flex:1' }, [
          el('div', { style: SETTINGS_ST.cardT, text: 'อัปเดตอัตโนมัติ' }),
          el('div', { style: SETTINGS_ST.cardS, text: 'ติดตั้งตอนไม่ได้ไลฟ์' }),
        ]),
        stgToggle(S.autoUpdate, function () {
          S.autoUpdate = !S.autoUpdate;
          API.setUpdateConfig({ autoUpdate: S.autoUpdate }).catch(function () {});
          render();
        }),
      ]),
    ]),
    /* (mock ไม่มี) เครื่องมือช่าง — tiktok:scan-live-console */
    el('div', { style: SETTINGS_ST.extra }, [
      el('div', { style: SETTINGS_ST.extraT, text: 'เครื่องมือช่าง' }),
      el('div', { style: 'display:flex; align-items:center; gap:10px; margin-top:8px' }, [
        stgBtn(SETTINGS_ST.small34, {
          text: 'สแกนหน้า LIVE console',
          onClick: function (e) {
            var acc = curAcc();
            if (!acc) { toast('ยังไม่มีบัญชี', 'err'); return; }
            busy(e.currentTarget, 'กำลังสแกน...', function () {
              return API.scanLiveConsole(acc.id).then(function (r) { showScanResult(r); });
            });
          },
        }),
        el('span', { style: SETTINGS_ST.faint, text: 'อ่านโครงสร้างหน้า TikTok เพื่อแก้ปัญหาระบบ Pin — อ่านอย่างเดียว ไม่กดปุ่มใด ๆ' }),
      ]),
    ]),
  ]);
}

function showScanResult(result) {
  var text = JSON.stringify(result, null, 2);
  openModal(function (close) {
    return el('div', { class: 'modal', style: 'width:560px' }, [
      el('div', { class: 'modal-t', text: 'ผลสแกนหน้า LIVE console' }),
      el('textarea', { class: 'inp mono', style: 'height:320px; font-size:11.5px', readonly: 'readonly', value: text }),
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn', style: SETTINGS_ST.modalBtn, text: 'คัดลอกผลทั้งหมด', onClick: function (e) { navigator.clipboard.writeText(text); e.currentTarget.textContent = 'คัดลอกแล้ว'; } }),
        el('button', { class: 'btn btn-primary', style: SETTINGS_ST.modalBtn, text: 'ปิด', onClick: close }),
      ]),
    ]);
  });
}

/* ===================================================================== */
/* แจ้งเตือน LINE                                                        */
/* ===================================================================== */
function setLine() {
  var cfg = S.line;
  var token = el('input', { class: 'inp', style: SETTINGS_ST.input, type: 'password', placeholder: 'วาง token จาก LINE Developers', value: cfg.channelAccessToken });
  var target = el('input', { class: 'inp', style: SETTINGS_ST.input, placeholder: 'Uxxxxxxxx…', value: cfg.targetId });
  var read = function () {
    return { enabled: cfg.enabled, channelAccessToken: token.value.trim(), targetId: target.value.trim(), notifyOnLive: cfg.notifyOnLive, notifyOnStop: cfg.notifyOnStop, notifyOnError: cfg.notifyOnError };
  };
  var chk = function (key, label) {
    return el('label', { style: SETTINGS_ST.chk }, [
      el('input', { type: 'checkbox', checked: cfg[key], onChange: function (e) { cfg[key] = e.target.checked; } }),
      label,
    ]);
  };

  return el('div', {}, [
    el('div', { style: 'display:flex; align-items:center; gap:10px' }, [
      el('div', { style: SETTINGS_ST.h, text: 'แจ้งเตือน LINE' }),
      el('div', { style: 'flex:1' }),
      /* (mock ไม่มี) เปิด/ปิดการแจ้งเตือน — field enabled ของ line:set-config */
      stgToggle(cfg.enabled, function () { cfg.enabled = !cfg.enabled; render(); }),
    ]),
    el('div', { style: SETTINGS_ST.formGrid }, [
      stgField('Channel access token', token),
      stgField('ปลายทาง (User / Group ID)', target),
    ]),
    el('div', { style: SETTINGS_ST.chkRow }, [chk('notifyOnLive', 'เริ่มไลฟ์'), chk('notifyOnStop', 'หยุดไลฟ์'), chk('notifyOnError', 'ไลฟ์มีปัญหา')]),
    el('div', { style: SETTINGS_ST.btnRow }, [
      stgPrimaryBtn(SETTINGS_ST.primary44, {
        text: 'บันทึก',
        onClick: function (e) {
          busy(e.currentTarget, 'กำลังบันทึก…', function () {
            return API.setLineConfig(read()).then(function (saved) { S.line = saved || read(); toast('บันทึกการตั้งค่าแล้ว', 'ok'); render(); });
          });
        },
      }),
      stgBtn(SETTINGS_ST.outline44, {
        text: 'ส่งข้อความทดสอบ',
        onClick: function (e) {
          busy(e.currentTarget, 'กำลังส่ง…', function () {
            return API.testLine(read()).then(function (r) {
              if (r && r.ok) toast('ส่งข้อความทดสอบไป LINE แล้ว — เช็คแชทได้เลย', 'ok');
              else toast('ส่งไม่สำเร็จ: ' + ((r && r.error) || 'ตรวจ token และปลายทางอีกครั้ง'), 'err');
            });
          });
        },
      }),
      /* (mock ไม่มี) line:push-status */
      stgBtn(SETTINGS_ST.outline44, {
        text: 'ส่งสถานะไลฟ์ตอนนี้',
        onClick: function (e) {
          busy(e.currentTarget, 'กำลังส่ง…', function () {
            return API.pushLineStatus().then(function (r) {
              if (r && r.ok) toast('ส่งสรุปสถานะไลฟ์ไป LINE แล้ว', 'ok');
              else toast('ส่งไม่สำเร็จ: ' + ((r && r.error) || 'ยังไม่ได้บันทึกการตั้งค่า'), 'err');
            });
          });
        },
      }),
    ]),
  ]);
}

/* ===================================================================== */
/* แชท AI                                                                */
/* ===================================================================== */
function setAi() {
  var acc = curAcc();
  var head = function (right) {
    return el('div', { style: 'display:flex; align-items:center; gap:10px' }, [
      el('div', { style: SETTINGS_ST.h }, ['แชท AI ', el('span', { style: SETTINGS_ST.hSub, text: '— ตั้งครั้งเดียว ใช้กับทุกไลฟ์' })]),
      el('div', { style: 'flex:1' }),
      right || null,
    ]);
  };
  if (!acc) {
    return el('div', {}, [
      head(null),
      el('div', { style: SETTINGS_ST.empty + '; margin-top:16px', text: 'ยังไม่มีบัญชี — เพิ่มบัญชีจากแผงร้านค้าด้านซ้ายก่อน' }),
    ]);
  }
  var cfg = S.chat[acc.id] || defaultChatConfig();

  var host = el('input', { class: 'inp', style: SETTINGS_ST.input, placeholder: 'เช่น mystore.official', value: cfg.hostUsername });
  var apiKey = el('input', { class: 'inp', style: SETTINGS_ST.inputMono, type: 'password', placeholder: cfg.ai.provider === 'gemini' ? 'AIza…' : 'sk-ant-…', value: cfg.ai.apiKey });
  var model = el('input', { class: 'inp', style: SETTINGS_ST.inputMono, value: cfg.ai.model });
  var context = el('textarea', { class: 'inp', style: SETTINGS_ST.textarea, placeholder: 'เช่น ร้านขายสกินแคร์ ส่งฟรีเมื่อซื้อครบ 2 ชิ้น ตอบสุภาพลงท้าย ค่ะ', value: cfg.ai.context });

  var save = function (patch, button) {
    var next = Object.assign({}, cfg, {
      hostUsername: host.value.trim(),
      ai: Object.assign({}, cfg.ai, { apiKey: apiKey.value.trim(), model: model.value.trim(), context: context.value }),
    }, patch || {});
    var run = function () {
      return API.setChatConfig(acc.id, next).then(function (saved) { S.chat[acc.id] = saved || next; toast('บันทึกการตั้งค่าแล้ว', 'ok'); render(); });
    };
    return button ? busy(button, 'กำลังบันทึก…', run) : run();
  };

  /* mock: span ไม่มี style-hover → ไม่ใส่ hov() */
  var pill = function (label, key, modelName) {
    var on = cfg.ai.provider === key;
    return el('button', {
      style: on ? SETTINGS_ST.pillOn : SETTINGS_ST.pillOff, text: label,
      onClick: function () { if (!on) save({ ai: Object.assign({}, cfg.ai, { provider: key, model: modelName }) }); },
    });
  };

  var ruleInput = 'flex:1; height:34px; border:1px solid var(--border); border-radius:10px; padding:0 10px; font-size:13px; background:var(--surface2); color:var(--text); min-width:0';
  var ruleRows = cfg.rules.map(function (rule) {
    return el('div', { style: 'display:flex; align-items:center; gap:8px; border-bottom:1px solid var(--surface2); padding:8px 0' }, [
      stgToggle(rule.enabled, function () {
        save({ rules: cfg.rules.map(function (r) { return r.id === rule.id ? Object.assign({}, r, { enabled: !r.enabled }) : r; }) });
      }),
      el('input', { class: 'inp', style: ruleInput, value: rule.keyword, placeholder: 'คีย์เวิร์ด', onChange: function (e) { rule.keyword = e.target.value; save({ rules: cfg.rules }); } }),
      el('span', { style: 'color:var(--faint)', text: '→' }),
      el('input', { class: 'inp', style: ruleInput.replace('flex:1', 'flex:2'), value: rule.reply, placeholder: 'คำตอบ', onChange: function (e) { rule.reply = e.target.value; save({ rules: cfg.rules }); } }),
      hov(el('button', {
        style: 'width:28px; height:28px; border:none; background:none; border-radius:8px; cursor:pointer; color:var(--muted); font-size:12px; display:grid; place-items:center; flex-shrink:0; white-space:nowrap',
        text: '✕', title: 'ลบกฎ',
        onClick: function () {
          /* ปุ่มทำลาย → ยืนยันก่อน */
          confirmDialog({
            title: 'ลบกฎ "' + (rule.keyword || 'ไม่มีคีย์เวิร์ด') + '"',
            body: 'ระบบจะไม่ตอบคอมเมนต์ที่มีคำนี้อัตโนมัติอีก',
            ok: 'ลบกฎ', danger: true,
          }).then(function (yes) {
            if (yes) save({ rules: cfg.rules.filter(function (r) { return r.id !== rule.id; }) });
          });
        },
      }), 'background:rgba(255,90,82,.15); color:#ff5a52'),
    ]);
  });

  return el('div', {}, [
    /* ---- element ตาม mock (ลำดับ/ระยะเดิม) ---- */
    /* หัวข้อ + (mock ไม่มี) toggle เปิด/ปิดระบบตอบแชทของบัญชีนี้ (chat.enabled) */
    head(stgToggle(cfg.enabled, function () { save({ enabled: !cfg.enabled }); })),
    el('div', { style: SETTINGS_ST.formGrid }, [
      el('div', {}, [
        el('div', { style: SETTINGS_ST.label, text: 'ผู้ให้บริการ' }),
        el('div', { style: 'display:flex; gap:8px; margin-top:6px' }, [
          pill('Gemini', 'gemini', 'gemini-2.0-flash'),
          pill('Claude', 'claude', 'claude-haiku-4-5'),
        ]),
      ]),
      stgField([
        'API key · ',
        el('a', { text: 'ไปหน้าขอ API key →', onClick: function (e) { e.preventDefault(); API.openExternal(cfg.ai.provider === 'gemini' ? 'https://aistudio.google.com/apikey' : 'https://console.anthropic.com/settings/keys'); } }),
      ], apiKey),
    ]),
    stgField('บริบทร้าน (AI จะใช้ตอบลูกค้า)', context, 'display:block; margin-top:14px; max-width:760px'),
    el('label', { style: SETTINGS_ST.chk8 }, [
      el('input', { type: 'checkbox', checked: cfg.ai.useProducts, onChange: function (e) { save({ ai: Object.assign({}, cfg.ai, { useProducts: e.target.checked }) }); } }),
      'ให้ AI รู้จักสินค้าในไลฟ์',
    ]),

    /* ---- (mock ไม่มี) ส่วนที่ต้องมีเพื่อ chat:set-config ให้ครบ — วางใต้ element ของ mock ---- */
    el('div', { style: SETTINGS_ST.extra + '; max-width:760px' }, [
      /* ตอบด้วย AI (ai.enabled) */
      el('div', { style: 'display:flex; align-items:center; gap:10px' }, [
        el('div', { style: SETTINGS_ST.cardT, text: 'ตอบด้วย AI (ใช้ API key ของคุณเอง)' }),
        el('div', { style: 'flex:1' }),
        stgToggle(cfg.ai.enabled, function () {
          save({ ai: Object.assign({}, cfg.ai, { enabled: !cfg.ai.enabled, apiKey: apiKey.value.trim(), model: model.value.trim(), context: context.value }) });
        }),
      ]),
      el('div', { style: SETTINGS_ST.formGrid.replace('margin-top:16px', 'margin-top:10px') }, [
        stgField('โมเดล', model),
        stgField('@username ของบัญชีโฮสต์ (จำเป็นสำหรับการส่งข้อความ)', host),
      ]),

      /* กฎคีย์เวิร์ด (rules) */
      el('div', { style: 'display:flex; align-items:center; gap:10px; margin-top:18px' }, [
        el('div', { style: SETTINGS_ST.cardT, text: 'กฎคีย์เวิร์ด → คำตอบ (ฟรี ตอบทันที · ใช้ก่อน AI)' }),
        el('div', { style: 'flex:1' }),
        stgBtn(SETTINGS_ST.small34, { text: '+ เพิ่มกฎ', onClick: function () { quickRuleDialog(acc); } }),
      ]),
      el('div', { style: 'margin-top:6px; max-height:200px; overflow:auto' },
        ruleRows.length ? ruleRows : [el('div', { style: SETTINGS_ST.empty + '; padding:14px', text: 'ยังไม่มีกฎ — เพิ่มคีย์เวิร์ดที่พบบ่อย เช่น "ราคา"' })]),

      /* บันทึก */
      el('div', { style: 'display:flex; align-items:center; gap:10px; margin-top:14px' }, [
        stgPrimaryBtn(SETTINGS_ST.primary44, { text: 'บันทึก', onClick: function (e) { save({}, e.currentTarget); } }),
        el('span', { style: SETTINGS_ST.faint, text: 'API key เก็บไว้เฉพาะเครื่องนี้ และเรียกผู้ให้บริการโดยตรงจากเครื่องคุณ ไม่ผ่านเซิร์ฟเวอร์เรา' }),
      ]),
    ]),
  ]);
}

/* ===================================================================== */
/* แอดมิน                                                                */
/* ===================================================================== */
function setAdmin() {
  if (!S.admin.unlocked) {
    var tokenInput = el('input', { class: 'inp', style: SETTINGS_ST.lockInput, placeholder: 'ADMIN TOKEN', type: 'password' });
    var unlockBtn = el('button', {
      class: 'btn', style: SETTINGS_ST.solid44, text: 'ปลดล็อก',
      onClick: function (e) {
        busy(e.currentTarget, 'กำลังตรวจ…', function () {
          return API.adminUnlock({ token: tokenInput.value }).then(function (r) {
            if (r && r.unlocked) { S.admin.unlocked = true; toast('ปลดล็อกแล้ว', 'ok'); return loadAdminKeys().then(render); }
            toast((r && r.error) || 'ปลดล็อกไม่สำเร็จ', 'err');
          });
        });
      },
    });
    tokenInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') unlockBtn.click(); });
    return el('div', { style: SETTINGS_ST.lockWrap }, [
      el('div', { style: SETTINGS_ST.lockBox }, [
        el('div', { style: SETTINGS_ST.lockIcon, text: '🔒' }),
        el('div', { style: SETTINGS_ST.lockT, text: 'โหมดแอดมิน' }),
        el('div', { style: SETTINGS_ST.lockS, text: 'สำหรับเจ้าของระบบเท่านั้น — ใช้ออก/ถอน License Key' }),
        el('div', { style: SETTINGS_ST.lockRow }, [tokenInput, unlockBtn]),
      ]),
    ]);
  }

  /* (mock มีเฉพาะหน้าล็อก) หน้าปลดล็อกแล้ว — admin:issue-key / lookup / list / revoke / lock */
  var username = el('input', { class: 'inp', style: SETTINGS_ST.input, placeholder: 'username' });
  var displayName = el('input', { class: 'inp', style: SETTINGS_ST.input, placeholder: 'ชื่อที่แสดง' });
  var password = el('input', { class: 'inp', style: SETTINGS_ST.input, placeholder: 'ตั้งรหัสผ่านให้ผู้ใช้', type: 'text' });
  var days = el('input', { class: 'inp', style: SETTINGS_ST.inputMono, placeholder: 'อายุ (วัน)', type: 'number', value: '30' });
  var lookup = el('input', { class: 'inp', style: SETTINGS_ST.input.replace('margin-top:6px', 'margin-top:0'), placeholder: 'ค้นหาผู้ใช้ (username)' });

  return el('div', {}, [
    el('div', { style: 'display:flex; align-items:center; gap:10px' }, [
      el('div', { style: SETTINGS_ST.h, text: 'โหมดแอดมิน · จัดการ License Key' }),
      el('div', { style: 'flex:1' }),
      stgBtn(SETTINGS_ST.small34, { text: 'ล็อกโหมดแอดมิน', onClick: function () { API.adminLock().then(function () { S.admin = { unlocked: false, keys: [], found: null }; render(); }); } }),
    ]),
    el('div', { style: SETTINGS_ST.formGrid }, [
      stgField('Username', username),
      stgField('ชื่อที่แสดง', displayName),
      stgField('รหัสผ่าน', password),
      stgField('อายุ (วัน)', days),
    ]),
    el('div', { style: 'display:flex; align-items:center; gap:10px; margin-top:12px' }, [
      stgPrimaryBtn(SETTINGS_ST.primary44, {
        text: 'สร้าง License Key',
        onClick: function (e) {
          busy(e.currentTarget, 'กำลังออกคีย์…', function () {
            return API.adminIssueKey({ username: username.value.trim(), displayName: displayName.value.trim(), password: password.value, days: Number(days.value) || 30 })
              .then(function (r) {
                if (!r || !r.licenseKey) { toast((r && r.error) || 'ออกคีย์ไม่สำเร็จ', 'err'); return; }
                toast('ออกคีย์ให้ ' + r.username + ' แล้ว', 'ok');
                navigator.clipboard.writeText(r.licenseKey);
                return loadAdminKeys().then(render);
              });
          });
        },
      }),
      el('span', { style: SETTINGS_ST.faint, text: 'คีย์จะถูกคัดลอกให้อัตโนมัติ — ส่ง username รหัสผ่าน และคีย์นี้ให้ผู้ใช้' }),
    ]),
    el('div', { style: 'display:flex; align-items:center; gap:8px; margin-top:20px; max-width:520px' }, [
      lookup,
      stgBtn(SETTINGS_ST.outline44, {
        text: 'ค้นหา',
        onClick: function (e) {
          busy(e.currentTarget, 'ค้นหา…', function () {
            return API.adminLookupUser(lookup.value.trim()).then(function (r) { S.admin.found = r; render(); });
          });
        },
      }),
    ]),
    S.admin.found ? el('div', { style: 'max-width:760px' }, [adminUserCard(S.admin.found)]) : null,
    el('div', { style: 'font-size:14px; font-weight:600; margin-top:20px' }, ['คีย์ที่ออกไว้ (' + S.admin.keys.length + ') ',
      el('a', { style: 'font-size:12.5px', text: 'รีเฟรช', onClick: function () { loadAdminKeys().then(render); } })]),
    el('div', { style: 'margin-top:8px; max-height:240px; overflow:auto; max-width:760px' },
      S.admin.keys.length ? S.admin.keys.map(adminUserCard) : [el('div', { style: SETTINGS_ST.empty, text: 'ยังไม่มีคีย์ที่ออก' })]),
  ]);
}

function adminUserCard(user) {
  return el('div', { style: SETTINGS_ST.listRow }, [
    el('div', { style: 'flex:1; min-width:0' }, [
      el('div', { style: 'font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis', text: (user.displayName || user.username) + ' · ' + user.username }),
      el('div', { style: SETTINGS_ST.faint, text: user.expiresAt ? 'หมดอายุ ' + fmtDate(user.expiresAt) : 'ไม่มีวันหมดอายุ' }),
    ]),
    stgBtn(SETTINGS_ST.tiny28, { text: 'คัดลอกคีย์', onClick: function (e) { navigator.clipboard.writeText(user.licenseKey || ''); e.currentTarget.textContent = 'คัดลอกแล้ว'; } }),
    stgBtn(SETTINGS_ST.tiny28 + '; color:var(--redText)', {
      text: 'ถอนสิทธิ์',
      onClick: function () {
        confirmDialog({ title: 'ถอนสิทธิ์ ' + user.username, body: 'ผู้ใช้จะเข้าแอปไม่ได้ทันที', ok: 'ถอนสิทธิ์', danger: true }).then(function (yes) {
          if (yes) API.adminRevokeUser(user.username).then(function () { toast('ถอนสิทธิ์แล้ว'); loadAdminKeys().then(render); });
        });
      },
    }),
  ]);
}

function loadAdminKeys() {
  return API.adminListKeys().then(function (keys) { S.admin.keys = Array.isArray(keys) ? keys : []; }).catch(function () { S.admin.keys = []; });
}
