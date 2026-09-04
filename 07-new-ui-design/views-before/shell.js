/* Rerun Studio v11 — แถบบนหน้าต่าง + sidebar (อ้างอิง mock-sections/sidebar.html) */

var winMaximized = false;

function titlebar() {
  var acc = curAcc();
  var live = anyLive();

  return el('div', { class: 'titlebar' }, [
    el('div', { class: 'tb-mark', text: 'R' }),
    el('div', { class: 'tb-name' }, ['Rerun ', el('span', { text: 'Studio' })]),
    S.licensed && acc ? el('div', { class: 'tb-sub', text: '· ' + acc.alias }) : null,
    live ? el('button', {
      class: 'tb-onair', title: 'ไปหน้าควบคุมไลฟ์',
      onClick: function () {
        var liveAcc = S.accounts.filter(isLive)[0];
        if (liveAcc) S.cur = accIndex(liveAcc.id);
        go('control');
      },
    }, [el('i'), el('span', { id: 'tbOnairTime', text: 'ON AIR ' + onairElapsedText() })]) : null,
    updateChip(),
    el('div', { class: 'tb-ctrl' }, [
      el('button', { title: 'ย่อ', text: '─', onClick: function () { API.minimizeWindow(); } }),
      el('button', {
        id: 'tbMax', title: winMaximized ? 'คืนขนาด' : 'ขยายเต็มจอ', text: winMaximized ? '❐' : '▢',
        onClick: function () {
          API.toggleMaximizeWindow().then(function (r) { if (r) winMaximized = Boolean(r.maximized); paintWindowState(); });
        },
      }),
      el('button', { class: 'x', title: 'ปิด', text: '✕', onClick: function () { API.closeWindow(); } }),
    ]),
  ]);
}

/* แจ้งเตือนอัปเดตบนแถบบน — เดิมเป็นป้ายลอยมุมขวาบนซึ่งไปทับการ์ดสถิติ */
function updateChip() {
  var up = S.updateStatus || { state: 'none' };
  if (up.state === 'ready') {
    return el('button', {
      class: 'tb-update ready', title: 'ติดตั้งเวอร์ชัน ' + (up.version || 'ใหม่') + ' แล้วเปิดแอปใหม่',
      onClick: function () {
        if (anyLive()) { toast('กำลังไลฟ์อยู่ — หยุดไลฟ์ก่อนติดตั้งอัปเดต', 'err'); return; }
        confirmDialog({
          title: 'อัปเดตแล้วเปิดแอปใหม่',
          body: 'เวอร์ชัน ' + (up.version || 'ใหม่') + ' พร้อมติดตั้ง แอปจะปิดและเปิดขึ้นมาใหม่',
          ok: 'อัปเดตเลย · รีสตาร์ต',
        }).then(function (yes) { if (yes) API.installUpdate(); });
      },
    }, [el('span', { text: '↓' }), 'อัปเดตพร้อมติดตั้ง']);
  }
  if (up.state === 'downloading') {
    return el('div', { class: 'tb-update busy', title: 'กำลังดาวน์โหลดเวอร์ชันใหม่' },
      [el('span', { class: 'spin', text: '◌' }), 'กำลังดาวน์โหลด ' + (up.percent || 0) + '%']);
  }
  if (up.state === 'available') {
    return el('div', { class: 'tb-update busy', text: 'พบเวอร์ชันใหม่ ' + (up.version || '') });
  }
  return null;
}

function paintWindowState() {
  var button = document.getElementById('tbMax');
  if (!button) return;
  button.textContent = winMaximized ? '❐' : '▢';
  button.title = winMaximized ? 'คืนขนาด' : 'ขยายเต็มจอ';
}

/* ===================================================================== */
/* Sidebar                                                               */
/* ===================================================================== */
function sidebar() {
  var acc = curAcc();
  var live = acc ? isLive(acc) : false;
  var pageKey = S.page === 'control' ? 'setup' : S.page;

  var nav = el('nav', { class: 'nav' }, NAV.map(function (item) {
    var key = item[0];
    return el('button', {
      class: 'nav-item' + (pageKey === key ? ' active' : ''),
      onClick: function () { go(key === 'setup' ? (live ? 'control' : 'setup') : key); },
    }, [
      el('span', { class: 'ico', text: item[2] }),
      el('span', { class: 'lbl', text: item[1] }),
      key === 'setup' && anyLive() ? el('span', { class: 'badge-live', text: 'LIVE' }) : null,
    ]);
  }));

  var top = el('div', { class: 'side-top' + (S.shopsOpen ? ' hidden' : '') }, [
    el('div', { class: 'brand' }, [
      el('div', { class: 'brand-mark', text: 'R' }),
      el('div', {}, [
        el('div', { class: 'brand-name' }, ['Rerun ', el('span', { text: 'Studio' })]),
        el('div', { class: 'brand-sub', text: 'ไลฟ์วนคลิปอัตโนมัติ' }),
      ]),
    ]),
    nav,
    el('div', { class: 'spacer' }),
  ]);

  var bottom = el('div', { class: 'side-bottom' + (S.shopsOpen ? ' hidden' : '') }, [
    acc ? el('div', { class: 'cur-card' + (live ? ' live' : '') }, [
      el('div', { class: 'cur-head' }, [
        el('span', { class: 'avatar', style: 'background:' + AVATAR_COLORS[S.cur % AVATAR_COLORS.length], text: (acc.alias || 'ร').slice(0, 1) }),
        el('div', { style: 'flex:1;min-width:0' }, [
          el('div', { class: 'cur-eyebrow', text: 'ร้านที่เลือกอยู่' }),
          el('div', { class: 'cur-name', title: acc.alias, text: acc.alias }),
        ]),
      ]),
      el('div', { class: 'cur-status' }, [
        el('span', { class: 'cur-dot' }),
        el('span', { id: 'curStatusText', text: live ? 'กำลังไลฟ์อยู่ · ' + onairElapsedText(acc) : 'พร้อมไลฟ์ · ว่างอยู่' }),
      ]),
    ]) : null,
    el('div', { class: 'sys-line' }, [
      el('span', { class: 'sys-dot' + (S.appInfo.ffmpegReady ? '' : ' warn') }),
      el('span', { text: (S.appInfo.ffmpegReady ? 'ระบบพร้อม · FFmpeg ✓' : 'ไม่พบ FFmpeg') + ' · ไหว ' + S.appInfo.maxConcurrentStreams + ' บัญชี' }),
    ]),
  ]);

  var themeBtn = el('button', {
    class: 'theme-btn', text: S.theme === 'dark' ? '☀️ โหมดสว่าง' : '🌙 โหมดมืด',
    onClick: function () { S.theme = S.theme === 'dark' ? 'light' : 'dark'; applyTheme(); saveStore(); render(); },
  });

  var shopBlock = el('div', { class: 'shop-block' + (S.shopsOpen ? ' open' : '') }, [
    el('div', {
      class: 'shop-toggle', onClick: function () { S.shopsOpen = !S.shopsOpen; render(); },
    }, [
      el('span', { class: 'ic', text: '▤' }),
      el('div', { style: 'flex:1;min-width:0' }, [
        el('div', { class: 'tt', text: S.shopsOpen ? 'กดพับร้านค้า' : 'กดดูร้านค้า' }),
        el('div', { class: 'ss', text: S.accounts.length + ' ร้าน' }),
      ]),
      el('span', { class: 'chev', text: '⌃' }),
    ]),
    el('div', { class: 'shop-panel' }, [
      el('div', { class: 'shop-list' }, S.accounts.map(function (account, i) {
        var tk = S.tiktok[account.id] || {};
        var accLive = isLive(account);
        var stCls = accLive ? 'st-live' : tk.connected ? 'st-ready' : 'st-off';
        var stText = accLive ? '● ไลฟ์อยู่' : tk.connected ? '● พร้อม' : '○ ยังไม่เชื่อม';
        return el('div', {
          class: 'shop-row' + (S.cur === i ? ' on' : ''),
          onClick: function () { S.cur = i; S.selLayer = null; saveStore(); render(); refreshAccount(account.id); },
        }, [
          el('span', { class: 'avatar', style: 'background:' + AVATAR_COLORS[i % AVATAR_COLORS.length], text: (account.alias || 'ร').slice(0, 1) }),
          el('div', { style: 'flex:1;min-width:0' }, [
            el('div', { class: 'shop-nm', text: account.alias }),
            el('div', { class: 'shop-hd', text: account.handle ? '@' + account.handle : 'ยังไม่ได้ตั้ง @handle' }),
          ]),
          el('span', { class: 'shop-st ' + stCls, text: stText }),
          el('button', {
            class: 'shop-del', text: '✕', title: 'ลบบัญชี',
            onClick: function (e) {
              e.stopPropagation();
              if (accLive) { toast('หยุดไลฟ์บัญชีนี้ก่อน', 'err'); return; }
              confirmDialog({ title: 'ลบบัญชี "' + account.alias + '"', body: 'ค่าตั้งค่า คลิป และ overlay ของบัญชีนี้จะหายไป', ok: 'ลบบัญชี', danger: true })
                .then(function (yes) {
                  if (!yes) return;
                  S.accounts = S.accounts.filter(function (a) { return a.id !== account.id; });
                  if (!S.accounts.length) S.accounts = [newAccount('ร้านหลัก')];
                  S.cur = Math.min(S.cur, S.accounts.length - 1);
                  saveStore(); render();
                });
            },
          }),
        ]);
      }).concat([
        el('button', { class: 'shop-add', onClick: addAccount }, [el('span', { text: '+' }), 'เพิ่มบัญชี']),
      ])),
    ]),
  ]);

  return el('aside', { class: 'side' }, [top, bottom, themeBtn, shopBlock]);
}

function addAccount() {
  openModal(function (close) {
    var alias = el('input', { class: 'inp', placeholder: 'เช่น ร้านหลัก', autofocus: 'autofocus' });
    var handle = el('input', { class: 'inp', placeholder: 'เช่น mystore.official (ไม่บังคับ)' });
    var category = el('input', { class: 'inp', placeholder: 'เช่น สกินแคร์ (ไม่บังคับ)' });
    var submit = function () {
      var name = alias.value.trim() || 'ร้านใหม่';
      var account = newAccount(name);
      account.handle = handle.value.trim().replace(/^@/, '');
      account.category = category.value.trim();
      S.accounts.push(account);
      S.cur = S.accounts.length - 1;
      S.selLayer = null;
      saveStore();
      close();
      go('setup');
      refreshAccount(account.id);
    };
    alias.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    return el('div', { class: 'modal' }, [
      el('div', { class: 'modal-t', text: 'เพิ่มบัญชีไลฟ์' }),
      el('div', { class: 'faint', style: 'font-size:12px', text: 'แต่ละบัญชีตั้งค่าและไลฟ์แยกกันได้อิสระ' }),
      el('label', { class: 'field-lbl' }, ['ชื่อบัญชีในแอป', alias]),
      el('label', { class: 'field-lbl' }, ['@handle TikTok', handle]),
      el('label', { class: 'field-lbl' }, ['หมวดสินค้า', category]),
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn', text: 'ยกเลิก', onClick: close }),
        el('button', { class: 'btn btn-primary', text: 'เพิ่มบัญชี', onClick: submit }),
      ]),
    ]);
  });
}

function onairElapsedText(acc) {
  var target = acc || S.accounts.filter(isLive)[0];
  if (!target) return '00:00:00';
  var start = S.liveStart[target.id];
  return fmtClock(start ? (Date.now() - start) / 1000 : 0);
}

