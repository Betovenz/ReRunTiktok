/* Rerun Studio v11 — Live Control — แถบ ON AIR + แชท/สินค้า/ยอดขาย (อ้างอิง mock-sections/control.html) */

/* ===================================================================== */
/* Live Control                                                          */
/* ===================================================================== */
function viewControl() {
  var acc = curAcc();
  if (!acc) return el('div', { class: 'empty', text: 'ยังไม่มีบัญชี' });
  if (!isLive(acc)) {
    return el('div', { class: 'card22', style: 'height:100%;display:grid;place-items:center' }, [
      el('div', { class: 'empty' }, [
        el('div', { style: 'font-size:30px', text: '📺' }),
        el('div', { style: 'font-size:15px;font-weight:700;color:var(--text);margin-top:8px', text: 'บัญชี "' + acc.alias + '" ยังไม่ได้ไลฟ์' }),
        el('div', { style: 'margin-top:4px', text: 'ไปหน้าไลฟ์เพื่อตั้งค่าและกดเริ่ม' }),
        el('button', { class: 'btn btn-primary', style: 'margin-top:14px', text: 'ไปตั้งค่าไลฟ์', onClick: function () { go('setup'); } }),
      ]),
    ]);
  }

  var health = S.health[acc.id] || {};
  var stats = S.liveStats[acc.id] || {};
  var status = S.status[acc.id] || {};
  var elapsed = S.liveStart[acc.id] ? Math.floor((Date.now() - S.liveStart[acc.id]) / 1000) : 0;
  var speedOk = typeof health.speed !== 'number' || health.speed >= 0.9;

  var bar = el('div', { class: 'onair-bar' }, [
    el('span', { class: 'onair-dot' }),
    el('span', { class: 'onair-lbl', text: 'ON AIR' }),
    el('span', { class: 'onair-time', id: 'onairTime', text: fmtClock(elapsed) }),
    el('div', { class: 'eq' }, [0, 1, 2, 3, 4, 5].map(function (i) {
      return el('i', { style: 'animation-delay:' + (i * 0.14) + 's;animation-duration:' + (0.8 + i * 0.09) + 's' });
    })),
    el('div', { class: 'vline' }),
    el('div', { class: 'metrics' }, [
      el('span', {}, ['คนดู ', el('b', { text: typeof stats.viewers === 'number' ? String(stats.viewers) : '—' })]),
      el('span', {}, ['บิตเรต ', el('b', { text: health.bitrateKbps ? (Math.round(health.bitrateKbps / 100) / 10) + ' Mbps' : '—' })]),
      el('span', {}, ['เฟรม ', el('b', { text: health.fps ? String(Math.round(health.fps)) : '—' })]),
      el('span', {}, ['ความเร็วเข้ารหัส ', el('b', { style: speedOk ? '' : 'color:var(--amber)', text: typeof health.speed === 'number' ? health.speed.toFixed(2) + 'x' : '—' })]),
      el('span', {}, ['สถานะ ', el('b', { style: 'color:' + (status.state === 'live' ? 'var(--green)' : 'var(--amber)'), text: status.state === 'live' ? 'ปกติ ✓' : (status.message || status.state) })]),
    ]),
    el('div', { class: 'spacer' }),
    el('button', { class: 'btn', text: 'อัปเดตให้ไลฟ์นี้', onClick: function (e) {
      busy(e.currentTarget, 'กำลังอัปเดต…', function () {
        return API.applyStreamConfig(buildStreamConfig(acc)).then(function () { toast('อัปเดตให้ไลฟ์นี้แล้ว', 'ok'); });
      });
    } }),
    el('button', { class: 'btn', text: 'เปิด LIVE Manager', onClick: function () { API.openTikTokShop(acc.id); } }),
    el('button', { class: 'btn btn-danger', style: 'height:44px;padding:0 20px;font-size:14px', text: '■ หยุดไลฟ์', onClick: function () { askStopLive(acc); } }),
  ]);

  var left = el('div', { class: 'ctl-left' }, [
    nowPlayingCard(acc),
    el('div', { class: 'gmv-card' }, [
      el('div', { style: 'font-size:12px;opacity:.85', text: 'ยอดขายไลฟ์นี้ (GMV)' }),
      el('div', { class: 'gmv-v', text: typeof stats.gmv === 'number' ? fmtMoney(stats.gmv) + ' ฿' : '—' }),
      el('div', { style: 'font-size:11.5px;opacity:.8;margin-top:2px', text: (typeof stats.itemsSold === 'number' ? stats.itemsSold + ' ออร์เดอร์ · ' : '') + 'อ่านจากหน้า TikTok ทุก 1 นาที' }),
    ]),
    el('div', { class: 'card', style: 'display:grid;place-items:center;text-align:center;padding:20px;min-height:0' }, [
      el('div', { class: 'empty' }, [
        el('div', { text: 'พรีวิวหยุดไว้ระหว่างไลฟ์' }),
        el('div', { text: 'เพื่อลดภาระเครื่อง' }),
        el('a', { text: 'ดูภาพจริงบน TikTok →', onClick: function () { API.openTikTok(acc.id); } }),
      ]),
    ]),
  ]);

  var tabs = el('div', { class: 'tabs' }, [['chat', 'แชท'], ['pin', 'สินค้า'], ['sales', 'ยอดขาย']].map(function (t) {
    return el('button', { class: 'tab' + (S.liveTab === t[0] ? ' on' : ''), text: t[1], onClick: function () { S.liveTab = t[0]; render(); } });
  }));

  var body = S.liveTab === 'chat' ? tabChat(acc) : S.liveTab === 'pin' ? tabPin(acc) : tabSales(acc);

  return el('div', { class: 'control' }, [
    bar,
    el('div', { class: 'ctl-body' }, [
      left,
      el('div', { class: 'card', style: 'display:flex;flex-direction:column;min-height:0;overflow:hidden' }, [tabs, body]),
    ]),
  ]);
}

function nowPlayingCard(acc) {
  var round = S.playRound[acc.id] || 1;
  var name = acc.clips.length ? acc.clips[0].name : '—';
  return el('div', { class: 'now-card' }, [
    el('div', { class: 'muted', style: 'font-size:11.5px', text: 'คิวคลิป · รอบที่ ' + round }),
    el('div', { style: 'font-size:14px;font-weight:600;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', text: acc.shuffle ? 'สุ่มจาก ' + acc.clips.length + ' คลิป' : name }),
    el('div', { class: 'prog' }, [el('i', { style: 'width:100%' })]),
    el('div', { style: 'display:flex;justify-content:space-between;font-size:11px;color:var(--faint);margin-top:5px', class: 'mono' }, [
      el('span', { text: acc.clips.length + ' คลิปในคิว' }),
      el('span', { text: acc.shuffle ? 'สุ่มลำดับ' : 'ตามลำดับ' }),
    ]),
  ]);
}

function tabChat(acc) {
  var cfg = S.chat[acc.id] || defaultChatConfig();
  var log = S.chatLog[acc.id] || [];

  var list = el('div', { class: 'chat-list', id: 'chatList' }, log.length ? log.map(chatBubble) : [
    el('div', { class: 'empty', style: 'margin:auto', text: 'กำลังรอคอมเมนต์จากผู้ชม…' }),
  ]);
  setTimeout(function () { list.scrollTop = list.scrollHeight; }, 0);

  return el('div', { class: 'tab-body' }, [
    el('div', { class: 'chat-bar' }, [
      el('button', {
        class: 'toggle' + (cfg.enabled ? ' on' : ''),
        onClick: function () { saveChatConfig(acc, { enabled: !cfg.enabled }); },
      }, [el('i')]),
      el('span', { style: 'font-size:13.5px;font-weight:600', text: cfg.enabled ? 'ตอบอัตโนมัติ เปิดอยู่' : 'ตอบอัตโนมัติ ปิดอยู่' }),
      el('span', { class: 'faint', style: 'font-size:12px', text: 'คีย์เวิร์ดตอบทันที · AI ตอบเมื่อไม่ตรงกฎ' }),
      el('div', { class: 'spacer' }),
      el('button', { class: 'btn btn-sm', style: 'color:var(--accentHi)', text: '+ เพิ่มกฎด่วน', onClick: function () { quickRuleDialog(acc); } }),
      el('button', { class: 'btn btn-sm', text: 'จัดการกฎ (' + cfg.rules.length + ')', onClick: function () { S.setTab = 'ai'; go('settings'); } }),
    ]),
    list,
  ]);
}

function chatBubble(event) {
  if (event.kind === 'system') {
    return el('div', { class: 'msg sys' }, [el('div', { class: 'bub' }, [el('div', { class: 'tx', text: event.text || '' })])]);
  }
  var out = event.kind === 'reply';
  var ai = out && event.source === 'ai';
  return el('div', { class: 'msg ' + (out ? 'out' : 'in') + (ai ? ' ai' : '') }, [
    el('div', { class: 'bub' }, [
      el('div', { class: 'who', text: (out ? (ai ? 'AI ตอบ' : 'ตอบแล้ว') : (event.user || 'ผู้ชม')) + (event.meta ? ' · ' + event.meta : '') }),
      el('div', { class: 'tx', text: event.text || '' }),
    ]),
  ]);
}

function tabPin(acc) {
  var cfg = S.pin[acc.id] || { enabled: false, intervalMinutes: 5, includeCoupon: false, products: [] };
  var live = isLive(acc);

  var rows = cfg.products.map(function (product, i) {
    var skipped = product.enabled === false;
    return el('div', { class: 'pin-row' }, [
      el('span', { class: 'n', text: (i + 1) + '.' }),
      el('span', { class: 'nm', title: product.name, text: product.name }),
      el('span', { class: 'pin-st', style: 'color:' + (skipped ? 'var(--faint)' : 'var(--green)'), text: skipped ? '⊘ ข้ามไว้' : '● อยู่ในรอบวน' }),
      el('button', { class: 'icon-btn', text: '▲', disabled: i === 0, title: 'ปักก่อน', onClick: function () { movePinProduct(acc, cfg, i, -1); } }),
      el('button', { class: 'icon-btn', text: '▼', disabled: i === cfg.products.length - 1, title: 'ปักทีหลัง', onClick: function () { movePinProduct(acc, cfg, i, 1); } }),
      el('button', {
        class: 'btn btn-sm', text: skipped ? 'ใส่กลับ' : 'ข้ามไว้',
        onClick: function () {
          var next = cfg.products.map(function (p) { return p.id === product.id ? Object.assign({}, p, { enabled: skipped }) : p; });
          savePinConfig(acc, { products: next });
        },
      }),
      el('button', {
        class: 'btn btn-sm btn-primary', text: 'ปักเลย',
        onClick: function (e) {
          busy(e.currentTarget, 'กำลังปัก…', function () {
            return API.pinProductNow(acc.id, product.name).then(function (r) {
              if (r && r.ok) toast('ปัก "' + product.name + '" สำเร็จ', 'ok');
              else toast('ปักไม่สำเร็จ (' + ((r && r.reason) || 'ไม่ทราบสาเหตุ') + ')', 'err');
            });
          });
        },
      }),
      el('button', {
        class: 'icon-btn danger', text: '🗑', title: 'ลบออกจากรายการ',
        onClick: function () { savePinConfig(acc, { products: cfg.products.filter(function (p) { return p.id !== product.id; }) }); },
      }),
    ]);
  });

  return el('div', { class: 'tab-body' }, [
    el('div', { class: 'pin-bar' }, [
      el('button', { class: 'toggle' + (cfg.enabled ? ' on' : ''), onClick: function () { savePinConfig(acc, { enabled: !cfg.enabled }); } }, [el('i')]),
      el('span', { style: 'font-weight:600', text: 'ปักอัตโนมัติทุก' }),
      el('input', {
        class: 'inp', style: 'width:56px;height:34px;text-align:center', type: 'number', min: '1', max: '120', value: String(cfg.intervalMinutes),
        onChange: function (e) { savePinConfig(acc, { intervalMinutes: Number(e.target.value) || 5 }); },
      }),
      el('span', { text: 'นาที' }),
      el('div', { class: 'spacer' }),
      el('button', {
        class: 'btn btn-sm', text: 'ดึงสินค้าจากไลฟ์',
        onClick: function (e) {
          busy(e.currentTarget, 'กำลังอ่าน...', function () {
            return API.listPinProducts(acc.id).then(function (r) {
              var found = (r && r.products) || [];
              if (!found.length) { toast('ยังไม่เจอสินค้า — ต้องกำลังไลฟ์และเปิดหน้า LIVE console อยู่', 'err'); return; }
              var merged = cfg.products.slice();
              found.forEach(function (p) {
                var name = String(p.text || p.name || '').replace(/\s*Pin$/i, '').trim();
                if (!name || merged.some(function (m) { return m.name === name; })) return;
                merged.push({ id: 'p-' + Math.random().toString(36).slice(2, 8), name: name, enabled: true });
              });
              savePinConfig(acc, { products: merged });
              toast('ดึงสินค้าได้ ' + found.length + ' รายการ', 'ok');
            });
          });
        },
      }),
    ]),
    el('div', { class: 'pin-list' }, (rows.length ? rows : [
      el('div', { class: 'empty', style: 'padding:26px', text: live ? 'ยังไม่มีสินค้า — กด "ดึงสินค้าจากไลฟ์"' : 'ยังไม่มีสินค้า — กดไลฟ์แล้วกด "ดึงสินค้าจากไลฟ์"' }),
    ]).concat([
      el('div', { class: 'pin-row', style: 'border-bottom:none' }, [
        el('span', { class: 'n', text: '🎟' }),
        el('span', { class: 'nm', text: 'คูปองส่วนลด' }),
        el('span', { class: 'pin-st', style: 'color:var(--faint)', text: cfg.includeCoupon ? '● อยู่ในรอบวน' : '⊘ ไม่วน' }),
        el('button', { class: 'toggle' + (cfg.includeCoupon ? ' on' : ''), onClick: function () { savePinConfig(acc, { includeCoupon: !cfg.includeCoupon }); } }, [el('i')]),
        el('button', {
          class: 'btn btn-sm', text: 'ปักคูปองเลย',
          onClick: function (e) {
            busy(e.currentTarget, 'กำลังปัก…', function () {
              return API.couponAction(acc.id, 'pin').then(function (r) {
                if (r && r.ok) toast('ปักคูปองสำเร็จ', 'ok');
                else toast('ปักคูปองไม่สำเร็จ (' + ((r && r.reason) || 'ไม่พบคูปองในไลฟ์นี้') + ')', 'err');
              });
            });
          },
        }),
      ]),
    ])),
  ]);
}

function movePinProduct(acc, cfg, index, delta) {
  var next = cfg.products.slice();
  var target = index + delta;
  if (target < 0 || target >= next.length) return;
  var tmp = next[index]; next[index] = next[target]; next[target] = tmp;
  savePinConfig(acc, { products: next });
}

function savePinConfig(acc, patch) {
  var cfg = Object.assign({}, S.pin[acc.id] || { enabled: false, intervalMinutes: 5, includeCoupon: false, products: [] }, patch);
  return API.setPinConfig(acc.id, cfg).then(function (saved) {
    S.pin[acc.id] = saved || cfg;
    render();
  }).catch(function (e) { toast(errText(e), 'err'); });
}

function tabSales(acc) {
  var stats = S.liveStats[acc.id] || {};
  var start = S.liveStart[acc.id] || Date.now();
  var mine = S.sales.records.filter(function (r) { return r.accountId === acc.id && r.at >= start; });
  var buckets = new Array(20).fill(0);
  var span = Math.max(60000, Date.now() - start);
  mine.forEach(function (r) {
    var i = Math.min(19, Math.floor((r.at - start) / span * 20));
    buckets[i] += r.amount;
  });
  var max = Math.max.apply(null, buckets.concat([1]));

  return el('div', { class: 'tab-body', style: 'padding:18px 20px' }, [
    el('div', { style: 'display:grid;grid-template-columns:repeat(3,1fr);gap:12px' }, [
      salesTile('GMV (จาก TikTok)', typeof stats.gmv === 'number' ? fmtMoney(stats.gmv) + ' ฿' : '—', 'var(--green)'),
      salesTile('ออร์เดอร์', typeof stats.itemsSold === 'number' ? String(stats.itemsSold) : '—'),
      salesTile('คนดูตอนนี้', typeof stats.viewers === 'number' ? String(stats.viewers) : '—'),
    ]),
    el('div', { style: 'font-size:13px;font-weight:600;margin-top:16px', text: 'ยอดที่นำเข้าแล้วในไลฟ์นี้ · ' + fmtMoney(mine.reduce(function (s, r) { return s + r.amount; }, 0)) + ' ฿' }),
    el('div', { style: 'flex:1;display:flex;align-items:flex-end;gap:5px;margin-top:10px;min-height:0' }, buckets.map(function (v) {
      return el('div', { style: 'flex:1;background:' + (v ? 'var(--primary)' : 'var(--surface2)') + ';border-radius:4px 4px 0 0;height:' + Math.max(3, v / max * 100) + '%' });
    })),
    el('div', { class: 'faint', style: 'font-size:11.5px;margin-top:8px', text: 'GMV/คนดู อ่านสดจากหน้า TikTok · กราฟด้านล่างมาจากไฟล์ CSV ที่นำเข้าในหน้าผลงาน' }),
  ]);
}

function salesTile(label, value, color) {
  return el('div', { style: 'background:var(--surface2);border-radius:14px;padding:14px 16px' }, [
    el('div', { class: 'muted', style: 'font-size:12px', text: label }),
    el('div', { class: 'mono', style: 'font-size:26px;font-weight:600;' + (color ? 'color:' + color : ''), text: value }),
  ]);
}

