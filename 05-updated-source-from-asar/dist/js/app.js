/* Rerun Studio v11 — router · bootstrap · การเชื่อมกับ main process (view อยู่ใน js/views/*.js) */

var NAV = [
  ['home', 'หน้าแรก', '⌂'],
  ['setup', 'ไลฟ์', '▶'],
  ['library', 'คลัง', '▤'],
  ['perf', 'ผลงาน', '▥'],
  ['settings', 'ตั้งค่า', '⚙'],
];

function go(page) {
  S.page = page;
  render();
}

/* ===================================================================== */
/* Render                                                                */
/* ===================================================================== */
function render() {
  var root = document.getElementById('root');
  clear(root);

  /* แถบบนต้องมีทุกสถานะ ไม่งั้นตอนอยู่หน้า login จะปิดหน้าต่างไม่ได้ */
  if (!S.ready) {
    root.appendChild(el('div', { class: 'app' }, [
      titlebar(),
      el('div', { class: 'login' }, [el('div', { class: 'empty', text: 'กำลังตรวจสอบสิทธิ์ใช้งาน…' })]),
    ]));
    return;
  }
  if (!S.licensed) {
    root.appendChild(el('div', { class: 'app' }, [titlebar(), viewLogin()]));
    return;
  }

  var page = S.page === 'home' ? viewHome()
    : S.page === 'setup' ? viewSetup()
    : S.page === 'control' ? viewControl()
    : S.page === 'library' ? viewLibrary()
    : S.page === 'perf' ? viewPerf()
    : viewSettings();

  root.appendChild(el('div', { class: 'app' }, [
    titlebar(),
    el('div', { class: 'shell' }, [sidebar(), el('main', { class: 'main' }, [page])]),
  ]));
}

/* ===================================================================== */
/* โหลดข้อมูลจาก main                                                     */
/* ===================================================================== */
function refreshTikTok(accountId) {
  return API.getTikTokStatus(accountId)
    .then(function (st) { S.tiktok[accountId] = st || { connected: false }; })
    .catch(function () { S.tiktok[accountId] = { connected: false }; });
}

/* ===================================================================== */
/* โหลดข้อมูลจาก main                                                     */
/* ===================================================================== */
function refreshAccount(accountId) {
  return Promise.all([
    refreshTikTok(accountId),
    API.getStreamStatus(accountId).then(function (st) {
      S.status[accountId] = st || { state: 'idle' };
      if ((st && st.state === 'live') && !S.liveStart[accountId]) S.liveStart[accountId] = st.startedAt || Date.now();
    }).catch(function () {}),
    API.getPinConfig(accountId).then(function (c) { S.pin[accountId] = c; }).catch(function () {}),
    API.getChatConfig(accountId).then(function (c) { S.chat[accountId] = c; }).catch(function () {}),
  ]).then(render);
}

/* ===================================================================== */
/* โหลดข้อมูลจาก main                                                     */
/* ===================================================================== */
function loadHistory() {
  return API.listHistory().then(function (list) { S.history = Array.isArray(list) ? list : []; }).catch(function () {});
}

/* ===================================================================== */
/* โหลดข้อมูลจาก main                                                     */
/* ===================================================================== */
function loadSales() {
  return API.listSales().then(function (store) { S.sales = store || { records: [], batches: [] }; }).catch(function () {});
}

/* ===================================================================== */
/* โหลดข้อมูลจาก main                                                     */
/* ===================================================================== */
function refreshLiveStats(accountId) {
  return API.getLiveStats(accountId).then(function (stats) {
    if (stats) S.liveStats[accountId] = stats;
    if (S.page === 'control') render();
  }).catch(function () {});
}

/* ===================================================================== */
/* Event จาก main                                                        */
/* ===================================================================== */
function subscribe() {
  API.onStreamStatus(function (payload) {
    if (!payload) return;
    var previous = S.status[payload.accountId] || {};
    S.status[payload.accountId] = payload.status;
    if (payload.status.state === 'live' && !S.liveStart[payload.accountId]) S.liveStart[payload.accountId] = Date.now();
    if (payload.status.state === 'idle' || payload.status.state === 'error') {
      delete S.liveStart[payload.accountId];
      if (payload.status.state === 'error' && previous.state !== 'error') {
        toast('ไลฟ์มีปัญหา: ' + (payload.status.message || 'ไม่ทราบสาเหตุ'), 'err');
      }
      if (S.page === 'control') S.page = 'home';
    }
    render();
  });

  API.onStreamHealth(function (payload) {
    if (!payload) return;
    S.health[payload.accountId] = payload.health;
    if (S.page === 'control') paintLiveMetrics();
  });

  API.onChatEvent(function (payload) {
    if (!payload || !payload.event) return;
    var id = payload.accountId;
    S.chatLog[id] = (S.chatLog[id] || []).concat([payload.event]).slice(-200);
    if (S.page === 'control' && S.liveTab === 'chat' && curAcc() && curAcc().id === id) render();
  });

  API.onHistoryChanged(function () { loadHistory().then(function () { if (S.page !== 'control') render(); }); });

  API.onWindowState(function (payload) {
    winMaximized = Boolean(payload && payload.maximized);
    paintWindowState();
  });

  API.onUpdateStatus(function (status) {
    S.updateStatus = status || { state: 'none' };
    render();
  });
}

/* อัปเดตเฉพาะตัวเลขบนแถบ ON AIR — ไม่ re-render ทั้งหน้า */
function paintLiveMetrics() {
  var acc = curAcc();
  if (!acc) return;
  var node = document.getElementById('onairTime');
  if (node && S.liveStart[acc.id]) node.textContent = fmtClock((Date.now() - S.liveStart[acc.id]) / 1000);
  var side = document.getElementById('curStatusText');
  if (side && isLive(acc)) side.textContent = 'กำลังไลฟ์อยู่ · ' + onairElapsedText(acc);
}

function tick() {
  /* นาฬิกาบนแถบ ON AIR + sidebar */
  paintLiveMetrics();

  /* นาฬิกาใน overlay preview */
  Array.prototype.slice.call(document.querySelectorAll('.ov-clock')).forEach(function (node) {
    if (node.dataset.clockFormat) node.textContent = clockText(node.dataset.clockFormat);
  });

  /* ป้าย ON AIR บนแถบบน */
  var tbTime = document.getElementById('tbOnairTime');
  if (tbTime) tbTime.textContent = 'ON AIR ' + onairElapsedText();

  runClipSchedule();
}

/* "ตั้งเวลาเล่น" — พอถึงเวลาที่ตั้งไว้ และบัญชีนั้นกำลังไลฟ์อยู่
   ระบบจะดันคลิปนั้นขึ้นหัวคิวแล้วส่งเข้าไลฟ์ที่รันอยู่ทันที */
function runClipSchedule() {
  var now = new Date();
  var minuteKey = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
  if (minuteKey === lastScheduleMinute) return;
  lastScheduleMinute = minuteKey;

  S.accounts.forEach(function (acc) {
    if (!isLive(acc)) return;
    var index = -1;
    for (var i = 0; i < acc.clips.length; i++) {
      if (acc.clips[i].sched && acc.clips[i].time === minuteKey) { index = i; break; }
    }
    if (index <= 0) return;
    var clip = acc.clips.splice(index, 1)[0];
    acc.clips.unshift(clip);
    saveStore();
    API.applyStreamConfig(buildStreamConfig(acc))
      .then(function () { toast('ถึงเวลา ' + minuteKey + ' — สลับไปเล่น "' + clip.name + '" แล้ว', 'ok'); render(); })
      .catch(function (e) { toast('สลับคลิปตามเวลาไม่สำเร็จ: ' + errText(e), 'err'); });
  });
}

function statsLoop() {
  S.accounts.forEach(function (acc) { if (isLive(acc)) refreshLiveStats(acc.id); });
}

/* ===================================================================== */
/* Bootstrap                                                             */
/* ===================================================================== */
function boot() {
  return Promise.all([
    API.getAppInfo().then(function (info) { if (info) S.appInfo = info; }).catch(function () {}),
    loadHistory(),
    loadSales(),
    API.listLibrary().then(function (list) { S.library = Array.isArray(list) ? list : []; }).catch(function () {}),
    API.getLineConfig().then(function (c) { if (c) S.line = c; }).catch(function () {}),
    API.getUpdateConfig().then(function (c) { if (c && typeof c.autoUpdate === 'boolean') S.autoUpdate = c.autoUpdate; }).catch(function () {}),
    API.getUpdateStatus().then(function (s) { if (s) S.updateStatus = s; }).catch(function () {}),
    API.adminStatus().then(function (r) { S.admin.unlocked = Boolean(r && r.unlocked); }).catch(function () {}),
  ]).then(function () {
    return Promise.all(S.accounts.map(function (acc) {
      return Promise.all([
        refreshTikTok(acc.id),
        API.getStreamStatus(acc.id).then(function (st) {
          S.status[acc.id] = st || { state: 'idle' };
          if (st && st.state === 'live' && !S.liveStart[acc.id]) S.liveStart[acc.id] = Date.now();
        }).catch(function () {}),
        API.getPinConfig(acc.id).then(function (c) { S.pin[acc.id] = c; }).catch(function () {}),
        API.getChatConfig(acc.id).then(function (c) { S.chat[acc.id] = c; }).catch(function () {}),
      ]);
    }));
  }).then(function () {
    if (S.admin.unlocked) return loadAdminKeys();
  }).then(function () {
    S.ready = true;
    if (anyLive()) S.page = 'control';
    render();
    showAnnouncements();
  });
}

function showAnnouncements() {
  API.getAnnouncements().then(function (items) {
    if (!Array.isArray(items) || !items.length) return;
    var seen = {};
    try { seen = JSON.parse(localStorage.getItem('rerun.seenAnnouncements') || '{}'); } catch (e) { seen = {}; }
    var fresh = items.filter(function (item) { return item && item.id && !seen[item.id]; });
    if (!fresh.length) return;
    fresh.forEach(function (item) { seen[item.id] = 1; });
    try { localStorage.setItem('rerun.seenAnnouncements', JSON.stringify(seen)); } catch (e) {}
    openModal(function (close) {
      return el('div', { class: 'modal' }, [
        el('div', { class: 'modal-t', text: 'ข่าวสารจากผู้พัฒนา' }),
        el('div', { style: 'display:flex;flex-direction:column;gap:12px' }, fresh.map(function (item) {
          return el('div', { style: 'border-left:3px solid var(--primary);padding-left:12px' }, [
            el('div', { style: 'font-weight:700;font-size:14px', text: item.title || '' }),
            el('div', { class: 'muted', style: 'font-size:13px;line-height:1.6;margin-top:2px', text: item.message || '' }),
          ]);
        })),
        el('div', { class: 'modal-actions' }, [el('button', { class: 'btn btn-primary', text: 'รับทราบ', onClick: close })]),
      ]);
    });
  }).catch(function () {});
}

function start() {
  loadStore();
  applyTheme();
  render();
  subscribe();

  setInterval(tick, 1000);
  setInterval(statsLoop, 60000);
  window.addEventListener('resize', function () { if (S.page === 'setup') paintPreview(); });

  API.isWindowMaximized().then(function (r) { winMaximized = Boolean(r && r.maximized); paintWindowState(); }).catch(function () {});

  API.getLicenseStatus().then(function (status) {
    if (status && status.licensed) {
      S.licensed = true;
      S.license = status;
      if (status.offline) toast('ตรวจสิทธิ์แบบออฟไลน์ — เชื่อมเน็ตเมื่อสะดวก');
      return boot();
    }
    S.licensed = false;
    S.ready = true;
    render();
  }).catch(function () {
    S.licensed = false;
    S.ready = true;
    render();
  });
}

var lastScheduleMinute = '';
var started = false;
function startOnce() { if (started) return; started = true; start(); }
document.addEventListener('DOMContentLoaded', startOnce);
if (document.readyState !== 'loading') startOnce();
