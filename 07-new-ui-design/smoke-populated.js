/* วางใน javascript_tool ของ Browser pane หลัง render เสร็จ — เติมข้อมูลตัวอย่างให้ครบทุกหน้า
   แล้วไล่ render ทุกหน้า/แท็บ คืน object รายงาน error + ตัวชี้วัด layout ที่เคยพัง */
(async () => {
  const out = {};
  const acc = curAcc();
  acc.alias = 'ร้านหลัก'; acc.handle = 'mystore.official'; acc.category = 'สกินแคร์';
  acc.clips = [
    { path: 'C:/v/promo-a.mp4', name: 'promo-a.mp4', label: '1080x1920 · 30fps', durationSec: 80, sched: true, time: '18:30' },
    { path: 'C:/v/promo-b.mp4', name: 'promo-b.mp4', label: '1080x1920 · 30fps', durationSec: 45, sched: false, time: '18:00' },
    { path: 'C:/v/promo-c.mp4', name: 'promo-c.mp4', label: '', durationSec: 130, sched: false, time: '18:00' },
  ];
  S.tiktok[acc.id] = { connected: true, streamerReady: true };
  acc.overlays = [{ id: 'ov1', path: 'C:/x/logo.png', name: 'โลโก้ร้าน', mediaUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="120"><rect width="320" height="120" rx="16" fill="%23F2F5F9"/><text x="160" y="72" font-size="40" text-anchor="middle" fill="%230B0D12" font-family="sans-serif">LOGO</text></svg>', x: 60, y: 90, width: 320, opacity: .95, effect: 'none' }];
  acc.clocks = [{ id: 'ck1', x: 700, y: 120, fontSize: 72, opacity: 1, format: 'time-short', color: '#ffffff', font: 'mono', design: 'shadow', effect: 'none' }];
  acc.texts = [{ id: 'tx1', x: 90, y: 1560, fontSize: 56, opacity: 1, text: 'ส่งฟรี 2 ชิ้น 🚚 ทักแชทเลย', color: '#ffffff', font: 'bold', design: 'solid-accent', mode: 'marquee', speed: 120, effect: 'none' }];
  S.selLayer = { kind: 'overlay', id: 'ov1' };
  acc.liveTitle = '';
  if (S.accounts.length < 3) {
    const b = newAccount('บ้านสวนผลไม้'); b.handle = 'baansuan.fruit'; S.accounts.push(b); S.tiktok[b.id] = { connected: true };
    const c = newAccount('เครื่องสำอางพิม'); c.handle = 'pim.cosmetics'; S.accounts.push(c); S.tiktok[c.id] = { connected: false };
  }
  const day = 86400000, now = Date.now();
  S.history = [0, 1, 2, 3, 4, 5].map(i => ({ id: 'h' + i, accountId: acc.id, title: 'ไลฟ์ ' + i, startedAt: now - i * day - 3600000 * 2, endedAt: now - i * day, durationSec: 7200 + i * 600, reason: i === 1 ? 'error' : 'ended', gmv: i === 1 ? undefined : 12400 + i * 1000 }));
  S.sales = { records: [0, 1, 2, 3, 4, 5, 6].flatMap(i => [{ id: 's' + i, accountId: acc.id, orderId: 'o' + i, amount: 9000 + i * 1500, at: now - i * day, status: '', batchId: 'b1' }]), batches: [{ id: 'b1', accountId: acc.id, fileName: 'orders.csv', importedAt: now, orderCount: 7, total: 94500 }] };
  S.library = [{ id: 'l1', path: 'C:/v/promo-a.mp4', name: 'promo-a.mp4', addedAt: now, durationSec: 80 }, { id: 'l2', path: 'C:/v/promo-b.mp4', name: 'promo-b.mp4', addedAt: now, durationSec: 45 }, { id: 'l3', path: 'C:/v/promo-c.mp4', name: 'promo-c.mp4', addedAt: now, durationSec: 130 }, { id: 'l4', path: 'C:/v/unbox-1.mp4', name: 'unbox-1.mp4', addedAt: now, durationSec: 65 }];
  if (!S.presets.length) { savePreset(acc, 'รอบเย็น'); savePreset(acc, 'รอบดึก'); }
  S.pin[acc.id] = { enabled: true, intervalMinutes: 3, includeCoupon: true, products: [{ id: 'p1', name: 'ครีมบำรุงผิว', enabled: true }, { id: 'p2', name: 'เซรั่มหน้าใส', enabled: true }, { id: 'p3', name: 'โฟมล้างหน้า', enabled: false }] };
  S.chat[acc.id] = Object.assign(defaultChatConfig(), { enabled: true, hostUsername: 'mystore.official', rules: [{ id: 'r1', keyword: 'ราคา', reply: 'ชิ้นละ 199 บาทค่ะ', enabled: true }] });
  S.chatLog[acc.id] = [
    { kind: 'incoming', user: 'nook_x', text: 'ตัวนี้เท่าไหร่', meta: '18:42' }, { kind: 'reply', source: 'rule', text: 'ชิ้นละ 199 บาทค่ะ ✨', meta: '0.4 วิ' },
    { kind: 'incoming', user: 'mai.shop', text: 'ส่งฟรีไหมคะ', meta: '18:42' }, { kind: 'reply', source: 'rule', text: 'ซื้อครบ 2 ชิ้นส่งฟรีค่ะ', meta: '0.3 วิ' },
    { kind: 'incoming', user: 'beam_88', text: 'มีสีอื่นไหม', meta: '18:43' }, { kind: 'reply', source: 'ai', text: 'ตอนนี้มีสีขาวกับชมพูค่ะ กดตะกร้าหมายเลข 2 ได้เลยนะคะ', meta: '1.1 วิ' },
  ];
  S.health[acc.id] = { speed: 1.01, fps: 30, bitrateKbps: 6000 };
  S.liveStats[acc.id] = { gmv: 18240, itemsSold: 96, viewers: 214 };
  S.appInfo = { version: '0.8.0', ffmpegReady: true, maxConcurrentStreams: 2 };
  S.updateStatus = { state: 'ready', version: '0.7.13' };

  const tryRender = (label, fn) => { try { fn(); render(); out[label] = 'ok'; } catch (e) { out[label] = 'ERR ' + e.message + ' @ ' + String(e.stack || '').split('\n')[1]; } };
  S.status = {}; S.liveStart = {};
  tryRender('home', () => { S.page = 'home'; });
  tryRender('setup', () => { S.page = 'setup'; });
  await new Promise(r => setTimeout(r, 150));
  const clipRow = document.querySelector('.clip, [data-clip]');
  out.setup_ovCount = document.querySelectorAll('#phonePreview .ov, .phone .ov').length;
  const phone = document.querySelector('.phone, #phonePreview');
  if (phone) { const r = phone.getBoundingClientRect(); out.setup_phoneRatio = (r.width / r.height).toFixed(3); }
  out.setup_overflowX = document.documentElement.scrollWidth > window.innerWidth;
  tryRender('library', () => { S.page = 'library'; });
  const cards = [...document.querySelectorAll('main .lib-card, main [data-lib-card]')];
  if (cards.length) { const r = cards[0].getBoundingClientRect(); out.library_cardH = Math.round(r.height); out.library_mainH = Math.round(document.querySelector('main').getBoundingClientRect().height); }
  tryRender('perf', () => { S.page = 'perf'; });
  ['system', 'line', 'ai', 'admin'].forEach(t => tryRender('settings:' + t, () => { S.page = 'settings'; S.setTab = t; }));
  S.status[acc.id] = { state: 'live', message: 'กำลังไลฟ์' }; S.liveStart[acc.id] = now - 3725000;
  ['chat', 'pin', 'sales'].forEach(t => tryRender('control:' + t, () => { S.page = 'control'; S.liveTab = t; }));
  tryRender('shopsOpen', () => { S.shopsOpen = true; S.page = 'home'; });
  S.shopsOpen = false;
  tryRender('light', () => { S.theme = 'light'; applyTheme(); });
  S.theme = 'dark'; applyTheme(); S.status = {}; S.liveStart = {}; S.page = 'home'; render();
  out.buttonsWrapping = [...document.querySelectorAll('button')].filter(b => b.offsetHeight > 0 && b.scrollHeight > b.clientHeight + 4).map(b => b.textContent.trim().slice(0, 24));
  out.fonts = document.fonts.check('700 15px "IBM Plex Sans Thai"') && document.fonts.check('600 14px "IBM Plex Mono"');
  return out;
})()
