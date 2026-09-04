/* Rerun Studio v11 — core
   ทุกอย่างในไฟล์นี้เป็น global (ไม่ใช้ ES module) เพราะ renderer โหลดผ่าน file:// */

/* ============================== API bridge ============================== */
/* preview stub ใช้ตอนเปิดไฟล์ในเบราว์เซอร์เฉย ๆ (ไม่มี preload) */
var PREVIEW = !window.rerun;
var API = window.rerun || (function () {
  var noop = function () { return Promise.resolve(null); };
  return {
    __preview: true,
    licenseLogin: function () { return Promise.resolve({ licensed: true, displayName: 'Preview', plan: 'preview' }); },
    getLicenseStatus: function () { return Promise.resolve({ licensed: true, displayName: 'Preview', plan: 'preview' }); },
    licenseLogout: function () { return Promise.resolve({ licensed: false }); },
    getUpdateStatus: function () { return Promise.resolve({ state: 'none' }); },
    installUpdate: noop, checkForUpdate: function () { return Promise.resolve({ state: 'none' }); },
    getUpdateConfig: function () { return Promise.resolve({ autoUpdate: true }); },
    setUpdateConfig: function (v) { return Promise.resolve(v); },
    getAnnouncements: function () { return Promise.resolve([]); },
    openExternal: noop,
    minimizeWindow: noop, closeWindow: noop,
    toggleMaximizeWindow: function () { return Promise.resolve({ maximized: false }); },
    isWindowMaximized: function () { return Promise.resolve({ maximized: false }); },
    onWindowState: function () { return function () {}; },
    adminUnlock: function () { return Promise.resolve({ unlocked: false }); },
    adminStatus: function () { return Promise.resolve({ unlocked: false }); },
    adminLock: noop, adminIssueKey: noop, adminLookupUser: noop, adminRevokeUser: noop,
    adminListKeys: function () { return Promise.resolve([]); },
    onUpdateStatus: function () { return function () {}; },
    chooseVideo: noop, probeClips: function () { return Promise.resolve([]); }, chooseOverlay: noop,
    loginTikTok: function () { return Promise.resolve({ saved: true, streamerReady: true }); },
    getTikTokStatus: function () { return Promise.resolve({ connected: false, streamerReady: false }); },
    logoutTikTok: function () { return Promise.resolve({ signedOut: true }); },
    openTikTok: noop, openTikTokShop: noop,
    scanLiveConsole: function () { return Promise.resolve({}); },
    getPinConfig: function () { return Promise.resolve({ enabled: false, intervalMinutes: 5, includeCoupon: false, products: [] }); },
    setPinConfig: function (id, c) { return Promise.resolve(c); },
    listPinProducts: function () { return Promise.resolve({ products: [] }); },
    pinProductNow: function () { return Promise.resolve({ ok: false, reason: 'preview' }); },
    couponAction: function () { return Promise.resolve({ ok: false, reason: 'preview' }); },
    getLiveStats: function () { return Promise.resolve({ gmv: null, itemsSold: null, viewers: null }); },
    startStream: function () { return Promise.reject(new Error('โหมด preview ไม่สามารถเริ่ม FFmpeg ได้')); },
    applyStreamConfig: noop,
    stopStream: function () { return Promise.resolve({ state: 'idle', message: 'พร้อมใช้งาน' }); },
    getStreamStatus: function () { return Promise.resolve({ state: 'idle', message: 'พร้อมใช้งาน' }); },
    getAppInfo: function () { return Promise.resolve({ version: 'preview', ffmpegReady: false, maxConcurrentStreams: 1 }); },
    runBenchmark: function () { return Promise.reject(new Error('โหมด preview ทดสอบไม่ได้')); },
    onStreamStatus: function () { return function () {}; },
    onStreamHealth: function () { return function () {}; },
    getChatConfig: function () { return Promise.resolve(defaultChatConfig()); },
    setChatConfig: function (id, c) { return Promise.resolve(c); },
    getLineConfig: function () { return Promise.resolve(defaultLineConfig()); },
    setLineConfig: function (c) { return Promise.resolve(c); },
    testLine: function () { return Promise.resolve({ ok: false, error: 'preview' }); },
    pushLineStatus: function () { return Promise.resolve({ ok: false, error: 'preview' }); },
    listHistory: function () { return Promise.resolve([]); },
    clearHistory: function () { return Promise.resolve([]); },
    chooseSalesFile: noop, previewSales: noop, commitSales: noop,
    listSales: function () { return Promise.resolve({ records: [], batches: [] }); },
    removeSalesBatch: function () { return Promise.resolve({ records: [], batches: [] }); },
    onHistoryChanged: function () { return function () {}; },
    getPathForFile: function () { return ''; },
    addLibraryPaths: function () { return Promise.resolve([]); },
    listLibrary: function () { return Promise.resolve([]); },
    addLibrary: function () { return Promise.resolve([]); },
    removeLibrary: function () { return Promise.resolve([]); },
    onChatEvent: function () { return function () {}; },
  };
})();

function defaultChatConfig() {
  return {
    enabled: false, rules: [],
    ai: { enabled: false, provider: 'gemini', apiKey: '', model: 'gemini-2.0-flash', context: '', useProducts: true },
    replyCooldownMs: 4000, perUserCooldownMs: 30000, signApiKey: '', hostUsername: '',
  };
}
function defaultLineConfig() {
  return { enabled: false, channelAccessToken: '', targetId: '', notifyOnLive: true, notifyOnStop: true, notifyOnError: true };
}

/* ============================== DOM helpers ============================== */
function el(tag, props, children) {
  var node = document.createElement(tag);
  if (props) {
    Object.keys(props).forEach(function (key) {
      var value = props[key];
      if (value === null || value === undefined || value === false) return;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'html') node.innerHTML = value;
      else if (key === 'style') node.setAttribute('style', value);
      else if (key.slice(0, 2) === 'on') node.addEventListener(key.slice(2).toLowerCase(), value);
      else if (key === 'value') node.value = value;
      else if (key === 'checked' || key === 'disabled') node[key] = Boolean(value);
      else node.setAttribute(key, value);
    });
  }
  (children || []).forEach(function (child) {
    if (child === null || child === undefined || child === false) return;
    node.appendChild(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
  });
  return node;
}
function frag(children) {
  var f = document.createDocumentFragment();
  (children || []).forEach(function (c) { if (c) f.appendChild(c); });
  return f;
}
function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }
function $(sel, root) { return (root || document).querySelector(sel); }

/* hover แบบเดียวกับ style-hover ใน mock: ใส่สไตล์ตอนเมาส์ชี้ แล้วคืนค่าเดิมตอนออก */
function hov(node, styleString) {
  var saved = null;
  node.addEventListener('mouseenter', function () {
    saved = node.getAttribute('style') || '';
    node.setAttribute('style', saved + ';' + styleString);
  });
  node.addEventListener('mouseleave', function () {
    if (saved !== null) node.setAttribute('style', saved);
    saved = null;
  });
  return node;
}

/* รูปแบบเวลาแบบสั้น m:ss (ใช้กับความยาวคลิป) */
function fmtMS(sec) {
  if (!isFinite(sec) || sec === null || sec === undefined) return '—';
  sec = Math.max(0, Math.round(sec));
  var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? h + ':' + pad2(m) + ':' + pad2(s) : m + ':' + pad2(s);
}

/* ความยาวคลิป — main ไม่ส่ง duration มา จึงอ่านจาก metadata ของ <video> ในเครื่องแทน
   รับได้ทั้ง mediaUrl (rerun-media://) และ path ธรรมดา · cache ต่อ key · คืน Promise<number|null> */
var durationCache = {};
function probeDuration(key, url) {
  if (durationCache[key] !== undefined) return Promise.resolve(durationCache[key]);
  return new Promise(function (resolve) {
    var video = document.createElement('video');
    var done = function (value) {
      durationCache[key] = value;
      video.removeAttribute('src');
      try { video.load(); } catch (e) {}
      resolve(value);
    };
    var timer = setTimeout(function () { done(null); }, 8000);
    video.preload = 'metadata';
    video.muted = true;
    video.addEventListener('loadedmetadata', function () { clearTimeout(timer); done(isFinite(video.duration) ? video.duration : null); });
    video.addEventListener('error', function () { clearTimeout(timer); done(null); });
    video.src = url || fileUrl(key);
  });
}
function fileUrl(path) { return 'file:///' + String(path).split(String.fromCharCode(92)).join('/'); }

/* ลากไฟล์วิดีโอมาวาง — คืน path จริงผ่าน preload (Electron 33 ไม่มี File.path แล้ว) */
var VIDEO_EXT = /[.](mp4|mov|mkv|webm|m4v)$/i;
function dropZone(node, onPaths) {
  var prevent = function (e) { e.preventDefault(); e.stopPropagation(); };
  node.addEventListener('dragenter', function (e) { prevent(e); node.classList.add('over'); });
  node.addEventListener('dragover', function (e) { prevent(e); node.classList.add('over'); });
  node.addEventListener('dragleave', function (e) { prevent(e); node.classList.remove('over'); });
  node.addEventListener('drop', function (e) {
    prevent(e); node.classList.remove('over');
    var files = Array.prototype.slice.call((e.dataTransfer && e.dataTransfer.files) || []);
    var paths = files.map(function (f) { return API.getPathForFile ? API.getPathForFile(f) : ''; })
      .filter(function (p) { return p && VIDEO_EXT.test(p); });
    if (!paths.length) { toast('รองรับเฉพาะไฟล์วิดีโอ (MP4 / MOV / MKV / WebM)', 'err'); return; }
    onPaths(paths);
  });
  return node;
}

/* ============================== format ============================== */
function pad2(n) { return String(n).padStart(2, '0'); }
function fmtClock(sec) {
  sec = Math.max(0, Math.floor(sec));
  return pad2(Math.floor(sec / 3600)) + ':' + pad2(Math.floor((sec % 3600) / 60)) + ':' + pad2(sec % 60);
}
function fmtDur(sec) {
  sec = Math.max(0, Math.floor(sec));
  var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h ? h + ':' + pad2(m) + ' ชม.' : m + ' นาที';
}
var TH_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
var TH_DAY = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
function fmtDate(ts) {
  var d = new Date(ts);
  return d.getDate() + ' ' + TH_MONTH[d.getMonth()] + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}
function fmtDayKey(ts) { var d = new Date(ts); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function fmtMoney(n) { return Math.round(Number(n) || 0).toLocaleString('th-TH'); }
function errText(e) { return (e && e.message) ? String(e.message) : 'ไม่ทราบสาเหตุ'; }

/* ============================== toast / modal ============================== */
function toast(message, kind) {
  var host = document.getElementById('toasts');
  var node = el('div', { class: 'toast ' + (kind || ''), text: message });
  host.appendChild(node);
  setTimeout(function () {
    node.style.transition = 'opacity .25s';
    node.style.opacity = '0';
    setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 260);
  }, kind === 'err' ? 6000 : 3200);
}
function openModal(build) {
  var host = document.getElementById('modals');
  var mask = el('div', { class: 'mask' });
  var close = function () { if (mask.parentNode) mask.parentNode.removeChild(mask); };
  mask.addEventListener('mousedown', function (e) { if (e.target === mask) close(); });
  mask.appendChild(build(close));
  host.appendChild(mask);
  return close;
}
function confirmDialog(opts) {
  return new Promise(function (resolve) {
    openModal(function (close) {
      return el('div', { class: 'modal' }, [
        el('div', { class: 'modal-t', text: opts.title }),
        opts.body ? el('div', { class: 'muted', style: 'font-size:14px;margin-top:2px;line-height:1.6', text: opts.body }) : null,
        el('div', { class: 'modal-actions' }, [
          el('button', { class: 'btn', text: opts.cancel || 'ยกเลิก', onClick: function () { close(); resolve(false); } }),
          el('button', {
            class: 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary'),
            style: opts.danger ? 'height:48px;padding:0 22px;font-size:15px' : '',
            text: opts.ok || 'ตกลง',
            onClick: function () { close(); resolve(true); },
          }),
        ]),
      ]);
    });
  });
}
/* ปุ่มที่เรียก API: กันกดซ้ำ + โชว์สถานะกำลังทำงานในตัวปุ่มเอง */
function busy(button, label, task) {
  var original = button.textContent;
  button.disabled = true;
  button.textContent = label;
  return Promise.resolve()
    .then(task)
    .catch(function (e) { toast(errText(e), 'err'); throw e; })
    .then(function (r) { return r; }, function () { return undefined; })
    .then(function (r) {
      button.disabled = false;
      button.textContent = original;
      return r;
    });
}

/* ============================== state ============================== */
var STORE_KEY = 'rerun.ui.v11';
var AVATAR_COLORS = ['#1E3A8A', '#F59E0B', '#EC4899', '#EF4444', '#8B5CF6', '#14B8A6', '#F97316', '#06B6D4', '#84CC16', '#A855F7'];

function newAccount(alias) {
  return {
    id: 'acc-' + Math.random().toString(36).slice(2, 9),
    alias: alias || 'ร้านใหม่',
    handle: '',
    category: '',
    clips: [],           /* {path,name,label,sched,time} */
    shuffle: true,
    overlays: [],        /* รูป */
    clocks: [],
    texts: [],
    camera: { zoom: 1, panX: 0, panY: 0, mirror: false },
    liveTitle: 'Rerun LIVE',
    targetMode: 'tiktok',
    rtmpServer: '',
    streamKey: '',
    bitrateKbps: 6000,
  };
}

var S = {
  ready: false,
  licensed: false,
  license: null,
  appInfo: { version: '-', ffmpegReady: false, maxConcurrentStreams: 1 },
  updateStatus: { state: 'none' },
  theme: 'dark',
  page: 'home',
  accounts: [],
  cur: 0,
  shopsOpen: false,
  selLayer: null,        /* {kind:'overlay'|'clock'|'text', id} */
  showAdvanced: false,
  liveTab: 'chat',
  setTab: 'system',
  perfRange: 7,
  presets: [],
  /* runtime (ไม่บันทึก) */
  tiktok: {},            /* accountId -> {connected, streamerReady} */
  status: {},            /* accountId -> stream status */
  health: {},            /* accountId -> {speed,fps,bitrateKbps,...} */
  liveStart: {},         /* accountId -> ts */
  chatLog: {},           /* accountId -> [] */
  pin: {},               /* accountId -> pin config */
  chat: {},              /* accountId -> chat config */
  liveStats: {},         /* accountId -> {gmv,itemsSold,viewers} */
  playRound: {},         /* accountId -> รอบที่ */
  library: [],
  history: [],
  sales: { records: [], batches: [] },
  line: defaultLineConfig(),
  autoUpdate: true,
  admin: { unlocked: false, keys: [], found: null },
  bench: null,
};

function curAcc() { return S.accounts[S.cur] || null; }
function accById(id) { for (var i = 0; i < S.accounts.length; i++) if (S.accounts[i].id === id) return S.accounts[i]; return null; }
function accIndex(id) { for (var i = 0; i < S.accounts.length; i++) if (S.accounts[i].id === id) return i; return -1; }
function isLive(acc) {
  if (!acc) return false;
  var st = S.status[acc.id];
  return Boolean(st && (st.state === 'live' || st.state === 'starting' || st.state === 'stopping'));
}
function anyLive() { return S.accounts.some(isLive); }

function saveStore() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      theme: S.theme,
      accounts: S.accounts,
      cur: S.cur,
      presets: S.presets,
      perfRange: S.perfRange,
    }));
  } catch (e) { /* โควตาเต็ม — ไม่ควรทำให้แอปพัง */ }
}
function loadStore() {
  var raw = null;
  try { raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { raw = null; }
  if (raw && Array.isArray(raw.accounts) && raw.accounts.length) {
    S.accounts = raw.accounts.map(function (a) {
      var base = newAccount(a.alias);
      Object.keys(base).forEach(function (k) { if (a[k] !== undefined) base[k] = a[k]; });
      base.id = a.id || base.id;
      return base;
    });
    S.cur = Math.min(Math.max(0, raw.cur || 0), S.accounts.length - 1);
  } else {
    S.accounts = [newAccount('ร้านหลัก')];
    S.cur = 0;
  }
  if (raw) {
    S.theme = raw.theme === 'light' ? 'light' : 'dark';
    S.presets = Array.isArray(raw.presets) ? raw.presets : [];
    S.perfRange = raw.perfRange || 7;
  }
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', S.theme);
}

/* ============================== stream config ============================== */
/* แปลง state ของบัญชี → payload ที่ main.js (validateConfig) รับ */
function buildStreamConfig(acc) {
  return {
    accountId: acc.id,
    videoPaths: acc.clips.map(function (c) { return c.path; }),
    shuffleEnabled: acc.shuffle !== false,
    camera: acc.camera,
    overlays: acc.overlays.map(function (o) {
      return { id: o.id, path: o.path, name: o.name, x: Math.round(o.x), y: Math.round(o.y), width: Math.round(o.width), opacity: o.opacity, effect: o.effect || 'none' };
    }),
    clocks: acc.clocks.map(function (c) {
      return { id: c.id, x: Math.round(c.x), y: Math.round(c.y), fontSize: Math.round(c.fontSize), opacity: c.opacity, format: c.format, color: c.color, font: c.font, design: c.design, effect: c.effect || 'none' };
    }),
    texts: acc.texts.map(function (t) {
      return { id: t.id, x: Math.round(t.x), y: Math.round(t.y), fontSize: Math.round(t.fontSize), opacity: t.opacity, text: t.text, color: t.color, font: t.font, design: t.design, mode: t.mode, speed: t.speed, effect: t.effect || 'none' };
    }),
    targetMode: acc.targetMode,
    liveTitle: acc.liveTitle,
    rtmpServer: acc.rtmpServer,
    streamKey: acc.streamKey,
    loop: true,
    bitrateKbps: acc.bitrateKbps,
  };
}

/* เช็กลิสต์ก่อนไลฟ์ — ใช้ทั้งแสดงผลและกันกดเริ่มไลฟ์ทั้งที่ยังไม่พร้อม */
function preflight(acc) {
  var tk = S.tiktok[acc.id] || {};
  var items = [
    { ok: acc.clips.length > 0, label: 'มีคลิปอย่างน้อย 1 คลิป', fix: 'เพิ่มคลิปในขั้นที่ 1' },
    { ok: acc.targetMode === 'manual' ? true : Boolean(tk.connected), label: 'เชื่อม TikTok แล้ว', fix: 'กดเชื่อม TikTok ในขั้นที่ 1' },
    { ok: acc.targetMode === 'manual' ? Boolean(acc.rtmpServer && acc.streamKey) : true, label: 'ปลายทางพร้อม', fix: 'กรอก RTMP server และ stream key ในตั้งค่าขั้นสูง' },
    { ok: S.appInfo.ffmpegReady, label: 'FFmpeg พร้อม', fix: 'ติดตั้งแอปใหม่อีกครั้ง' },
    { ok: Boolean((acc.liveTitle || '').trim()), label: 'ตั้งชื่อ LIVE แล้ว', fix: 'ใส่ชื่อ LIVE ในขั้นที่ 3' },
    { ok: !isLive(acc), label: 'บัญชีนี้ยังไม่ได้ไลฟ์อยู่', fix: 'หยุดไลฟ์เดิมก่อน' },
  ];
  return { items: items, passed: items.filter(function (i) { return i.ok; }).length, total: items.length, ok: items.every(function (i) { return i.ok; }) };
}

/* ============================== overlay layers ============================== */
var CANVAS_W = 1080, CANVAS_H = 1920;
var EFFECTS = [['none', 'ไม่มี'], ['blink', 'กะพริบ'], ['pulse', 'จางเข้า-ออก'], ['float', 'ลอยขึ้น-ลง']];
var CLOCK_FORMATS = [
  ['time', 'เวลา 24 ชม. (HH:MM:SS)'], ['time-short', 'เวลา 24 ชม. (HH:MM)'], ['time-12h', 'เวลา 12 ชม. (AM/PM)'],
  ['date', 'วันที่ไทย'], ['datetime', 'วันที่ + เวลา'], ['weekday', 'วัน + เวลา'],
];
var FONTS = [
  ['sans', 'เรียบง่าย'], ['modern', 'โมเดิร์น'], ['bold', 'หนาเด่น'], ['poster', 'โปสเตอร์'], ['classic', 'คลาสสิก'],
  ['heavy', 'ทึบหนัก'], ['mono', 'โมโนสเปซ'], ['serif', 'มีเชิง'], ['lcd', 'นาฬิกา LCD (ตัวเลข)'],
  ['lcd-alpha', 'LCD 14 ส่วน (EN)'], ['techno', 'เทคโน (EN)'], ['pixel', 'พิกเซลเกม (EN)'], ['terminal', 'เทอร์มินัล (EN)'],
];
var DESIGNS = [['solid-dark', 'กล่องดำ'], ['solid-accent', 'กล่องส้ม'], ['outline', 'ขอบตัด'], ['shadow', 'เงา'], ['plain', 'พื้นใส']];

function layerList(acc) {
  var out = [];
  acc.overlays.forEach(function (o) { out.push({ kind: 'overlay', id: o.id, icon: '🖼', name: o.name || 'รูปภาพ', typeLabel: 'รูปภาพ', ref: o }); });
  acc.clocks.forEach(function (c) { out.push({ kind: 'clock', id: c.id, icon: '🕐', name: 'นาฬิกา', typeLabel: 'เวลาจริง', ref: c }); });
  acc.texts.forEach(function (t) { out.push({ kind: 'text', id: t.id, icon: '🅣', name: t.text ? '"' + t.text.slice(0, 22) + '"' : 'ข้อความ', typeLabel: t.mode === 'marquee' ? 'ข้อความวิ่ง' : 'ข้อความ', ref: t }); });
  return out;
}
function selectedLayer(acc) {
  if (!S.selLayer) return null;
  var found = layerList(acc).filter(function (l) { return l.kind === S.selLayer.kind && l.id === S.selLayer.id; })[0];
  return found || null;
}
function removeLayer(acc, kind, id) {
  var bucket = kind === 'overlay' ? 'overlays' : kind === 'clock' ? 'clocks' : 'texts';
  acc[bucket] = acc[bucket].filter(function (x) { return x.id !== id; });
  if (S.selLayer && S.selLayer.id === id) S.selLayer = null;
}
function clockText(format, now) {
  var d = now || new Date();
  var hh = pad2(d.getHours()), mm = pad2(d.getMinutes()), ss = pad2(d.getSeconds());
  var dateTh = d.getDate() + ' ' + TH_MONTH[d.getMonth()] + ' ' + (d.getFullYear() + 543);
  if (format === 'time-short') return hh + ':' + mm;
  if (format === 'time-12h') { var h12 = d.getHours() % 12 || 12; return pad2(h12) + ':' + mm + ' ' + (d.getHours() < 12 ? 'AM' : 'PM'); }
  if (format === 'date') return dateTh;
  if (format === 'datetime') return dateTh + ' ' + hh + ':' + mm;
  if (format === 'weekday') return TH_DAY[d.getDay()] + ' ' + hh + ':' + mm;
  return hh + ':' + mm + ':' + ss;
}
function designStyle(design, color) {
  if (design === 'solid-dark') return 'background:rgba(0,0,0,.65);color:' + color + ';';
  if (design === 'solid-accent') return 'background:#ff6a00;color:' + color + ';';
  if (design === 'outline') return 'color:' + color + ';-webkit-text-stroke:1px rgba(0,0,0,.85);';
  if (design === 'shadow') return 'color:' + color + ';text-shadow:0 2px 6px rgba(0,0,0,.9);';
  return 'color:' + color + ';';
}
