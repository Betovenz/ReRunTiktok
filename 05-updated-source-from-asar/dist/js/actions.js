/* Rerun Studio v11 — action ที่หลายหน้าใช้ร่วมกัน — เริ่ม/หยุดไลฟ์ · Preset · สถิติ · แชท */

/* ===================================================================== */
/* เริ่ม / หยุด ไลฟ์                                                      */
/* ===================================================================== */
function startLive(acc, button) {
  var check = preflight(acc);
  if (!check.ok) { showPreflight(check); return; }
  if (!(acc.liveTitle || '').trim()) acc.liveTitle = acc.alias;

  var saveChk = document.getElementById('savePresetChk');
  var wantPreset = saveChk ? saveChk.checked : false;
  var run = function (presetName) {
    busy(button, 'กำลังเริ่ม pipeline…', function () {
      return API.startStream(buildStreamConfig(acc)).then(function (status) {
        S.status[acc.id] = status || { state: 'live', message: 'กำลังไลฟ์' };
        S.liveStart[acc.id] = Date.now();
        S.chatLog[acc.id] = S.chatLog[acc.id] || [];
        if (presetName) savePreset(acc, presetName);
        S.page = 'control';
        S.liveTab = 'chat';
        toast('เริ่มไลฟ์แล้ว', 'ok');
        render();
        refreshLiveStats(acc.id);
      });
    });
  };
  if (!wantPreset) { run(''); return; }

  /* ติ๊ก "บันทึก Preset" ไว้ → ถามชื่อสั้น ๆ ก่อนยิงไลฟ์ (ค่าเริ่มต้น = รอบ + เวลา) */
  openModal(function (close) {
    var suggested = 'รอบ ' + (new Date().getHours() < 12 ? 'เช้า' : new Date().getHours() < 17 ? 'บ่าย' : 'เย็น');
    var name = el('input', { class: 'inp', value: suggested, placeholder: 'ชื่อ Preset เช่น รอบเย็น' });
    var go = function () { var v = name.value.trim() || suggested; close(); run(v); };
    name.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    setTimeout(function () { name.focus(); name.select(); }, 0);
    return el('div', { class: 'modal' }, [
      el('div', { class: 'modal-t', text: 'ตั้งชื่อ Preset ไว้กดซ้ำ' }),
      el('div', { class: 'faint', style: 'font-size:12px;line-height:1.6', text: 'ระบบจะเก็บคลิป · overlay · กล้อง · ชื่อไลฟ์ · bitrate ของรอบนี้ไว้ ครั้งหน้ากดปุ่มเดียวไลฟ์ต่อได้เลย' }),
      name,
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn', text: 'ไม่บันทึก ไลฟ์เลย', onClick: function () { close(); run(''); } }),
        el('button', { class: 'btn btn-primary', text: 'บันทึกแล้วเริ่มไลฟ์', onClick: go }),
      ]),
    ]);
  });
}

function askStopLive(acc) {
  var stats = S.liveStats[acc.id] || {};
  confirmDialog({
    title: 'หยุดไลฟ์ตอนนี้เลยไหม',
    body: 'ห้อง LIVE บน TikTok จะถูกปิด' + (typeof stats.viewers === 'number' ? ' และผู้ชม ' + stats.viewers + ' คนจะออกจากห้องทันที' : ''),
    ok: '■ หยุดไลฟ์', cancel: 'กลับไปไลฟ์ต่อ', danger: true,
  }).then(function (yes) {
    if (!yes) return;
    API.stopStream(acc.id).then(function (status) {
      S.status[acc.id] = status || { state: 'idle', message: 'พร้อมใช้งาน' };
      delete S.liveStart[acc.id];
      toast('หยุดไลฟ์แล้ว', 'ok');
      S.page = 'home';
      render();
      loadHistory();
    }).catch(function (e) { toast(errText(e), 'err'); });
  });
}

/* แก้ overlay/คลิป/กล้อง ระหว่างไลฟ์ → ส่งค่าใหม่เข้าไลฟ์ที่รันอยู่ */
var pushTimer = null;
var pushTimer = null;
function pushLiveConfig(acc) {
  if (!acc || !isLive(acc)) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(function () {
    API.applyStreamConfig(buildStreamConfig(acc)).catch(function () { /* main จะบอกเองถ้าไลฟ์หลุด */ });
  }, 900);
}

function savePreset(acc, name) {
  var preset = {
    id: 'ps-' + Math.random().toString(36).slice(2, 8),
    name: name,
    accountId: acc.id,
    accountAlias: acc.alias,
    savedAt: Date.now(),
    data: {
      clips: acc.clips, shuffle: acc.shuffle, overlays: acc.overlays, clocks: acc.clocks, texts: acc.texts,
      camera: acc.camera, liveTitle: acc.liveTitle, targetMode: acc.targetMode, bitrateKbps: acc.bitrateKbps,
    },
  };
  S.presets = [preset].concat(S.presets.filter(function (p) { return p.name !== name; })).slice(0, 8);
  saveStore();
}

function applyPreset(acc, preset) {
  if (!acc || !preset) return;
  var d = preset.data;
  acc.clips = JSON.parse(JSON.stringify(d.clips || []));
  acc.shuffle = d.shuffle !== false;
  acc.overlays = JSON.parse(JSON.stringify(d.overlays || []));
  acc.clocks = JSON.parse(JSON.stringify(d.clocks || []));
  acc.texts = JSON.parse(JSON.stringify(d.texts || []));
  acc.camera = Object.assign({ zoom: 1, panX: 0, panY: 0, mirror: false }, d.camera || {});
  acc.liveTitle = d.liveTitle || acc.liveTitle;
  acc.targetMode = d.targetMode || acc.targetMode;
  acc.bitrateKbps = d.bitrateKbps || acc.bitrateKbps;
  saveStore();
}

function presetSummary(preset) {
  var d = preset.data;
  var layers = (d.overlays || []).length + (d.clocks || []).length + (d.texts || []).length;
  return (preset.accountAlias || '') + ' · ' + (d.clips || []).length + ' คลิป · ' + layers + ' layer · ' + (d.shuffle ? 'สุ่มลำดับ' : 'ตามลำดับ');
}

/* ===================================================================== */
/* สถิติที่ใช้ร่วมกัน                                                     */
/* ===================================================================== */
function rangeStart(days) {
  if (!days) return 0;
  var d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime() - (days - 1) * 86400000;
}

/* ===================================================================== */
/* สถิติที่ใช้ร่วมกัน                                                     */
/* ===================================================================== */
function summarize(days) {
  var from = rangeStart(days);
  var lives = S.history.filter(function (h) { return h.startedAt >= from; });
  var sales = S.sales.records.filter(function (r) { return r.at >= from; });
  return {
    count: lives.length,
    seconds: lives.reduce(function (s, h) { return s + (h.durationSec || 0); }, 0),
    ended: lives.filter(function (h) { return h.reason !== 'error'; }).length,
    revenue: sales.reduce(function (s, r) { return s + (r.amount || 0); }, 0),
    lives: lives,
    sales: sales,
  };
}

/* ===================================================================== */
/* สถิติที่ใช้ร่วมกัน                                                     */
/* ===================================================================== */
function dailyBuckets(days) {
  var out = [];
  var base = new Date(); base.setHours(0, 0, 0, 0);
  for (var i = days - 1; i >= 0; i--) {
    var day = new Date(base.getTime() - i * 86400000);
    out.push({ ts: day.getTime(), key: fmtDayKey(day.getTime()), label: TH_DAY[day.getDay()].slice(0, 2), revenue: 0, seconds: 0 });
  }
  var index = {};
  out.forEach(function (b) { index[b.key] = b; });
  S.sales.records.forEach(function (r) { var b = index[fmtDayKey(r.at)]; if (b) b.revenue += r.amount || 0; });
  S.history.forEach(function (h) { var b = index[fmtDayKey(h.startedAt)]; if (b) b.seconds += h.durationSec || 0; });
  return out;
}

/* ===================================================================== */
/* สถิติที่ใช้ร่วมกัน                                                     */
/* ===================================================================== */
function historyRow(h) {
  var err = h.reason === 'error';
  var acc = accById(h.accountId);
  return el('div', { class: 'hist-row' }, [
    el('span', { class: 'd' + (err ? ' err' : '') }),
    el('span', { class: 'dt', text: fmtDate(h.startedAt) }),
    el('span', { class: 'ac', title: h.title, text: acc ? acc.alias : (h.title || h.accountId) }),
    el('span', { class: 'du', text: fmtDur(h.durationSec) }),
    el('span', { class: 'tag' + (err ? ' err' : ''), text: err ? 'ผิดพลาด' : 'จบปกติ' }),
    el('div', { class: 'spacer' }),
    el('span', { class: 'mono', style: 'font-size:12.5px', text: typeof h.gmv === 'number' ? fmtMoney(h.gmv) + ' ฿' : '—' }),
  ]);
}

function selectBox(options, value, onPick) {
  var sel = el('select', {
    class: 'inp', style: 'height:32px;padding:0 8px;font-size:12.5px',
    onChange: function (e) { onPick(e.target.value); },
  }, options.map(function (o) { return el('option', { value: o[0], text: o[1] }); }));
  sel.value = value;
  return sel;
}

function quickRuleDialog(acc) {
  openModal(function (close) {
    var keyword = el('input', { class: 'inp', placeholder: 'คีย์เวิร์ด เช่น ราคา' });
    var reply = el('input', { class: 'inp', placeholder: 'คำตอบ เช่น ชิ้นละ 199 บาทค่ะ' });
    return el('div', { class: 'modal' }, [
      el('div', { class: 'modal-t', text: 'เพิ่มกฎตอบแชท' }),
      el('div', { class: 'faint', style: 'font-size:12px;line-height:1.6', text: 'ระบบจะดูว่าคอมเมนต์ "มีคำนี้อยู่ข้างใน" — ตั้งสั้น ๆ จับได้กว้างกว่า' }),
      keyword, reply,
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn', text: 'ยกเลิก', onClick: close }),
        el('button', {
          class: 'btn btn-primary', text: 'เพิ่มกฎ',
          onClick: function () {
            if (!keyword.value.trim() || !reply.value.trim()) { toast('กรอกคีย์เวิร์ดและคำตอบให้ครบ', 'err'); return; }
            var cfg = S.chat[acc.id] || defaultChatConfig();
            var rules = cfg.rules.concat([{ id: 'r-' + Math.random().toString(36).slice(2, 8), keyword: keyword.value.trim(), reply: reply.value.trim(), enabled: true }]);
            saveChatConfig(acc, { rules: rules });
            close();
          },
        }),
      ]),
    ]);
  });
}

function saveChatConfig(acc, patch) {
  var cfg = Object.assign({}, S.chat[acc.id] || defaultChatConfig(), patch);
  return API.setChatConfig(acc.id, cfg).then(function (saved) {
    S.chat[acc.id] = saved || cfg;
    toast('บันทึกการตั้งค่าแล้ว', 'ok');
    render();
  }).catch(function (e) { toast(errText(e), 'err'); });
}

