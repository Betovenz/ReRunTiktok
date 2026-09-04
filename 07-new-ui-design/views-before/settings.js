/* Rerun Studio v11 — ตั้งค่า — ระบบ / LINE / แชท AI / แอดมิน (อ้างอิง mock-sections/settings.html) */

/* ===================================================================== */
/* ตั้งค่า                                                               */
/* ===================================================================== */
function viewSettings() {
  var tabs = [['system', 'ระบบ'], ['line', 'แจ้งเตือน LINE'], ['ai', 'แชท AI'], ['admin', 'แอดมิน 🔒']];
  var nav = el('div', { class: 'set-nav' }, [
    el('div', { style: 'font-size:22px;font-weight:700;padding:0 10px 12px', text: 'ตั้งค่า' }),
  ].concat(tabs.map(function (t) {
    return el('button', { class: 'set-tab' + (S.setTab === t[0] ? ' on' : ''), text: t[1], onClick: function () { S.setTab = t[0]; render(); } });
  })).concat([
    el('div', { class: 'spacer' }),
    el('div', { class: 'faint', style: 'font-size:11.5px;padding:0 10px' }, [
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

  return el('div', { class: 'settings' }, [nav, el('div', { class: 'set-body' }, [body])]);
}

function setSystem() {
  var up = S.updateStatus || { state: 'none' };
  var upText = up.state === 'checking' ? 'กำลังตรวจหาอัปเดต…'
    : up.state === 'available' ? 'พบเวอร์ชันใหม่ ' + (up.version || '') + ' — กำลังดาวน์โหลด'
    : up.state === 'downloading' ? 'กำลังดาวน์โหลด ' + (up.percent || 0) + '%'
    : up.state === 'ready' ? 'เวอร์ชัน ' + (up.version || '') + ' พร้อมติดตั้ง'
    : up.state === 'error' ? (up.message || 'ตรวจอัปเดตไม่สำเร็จ')
    : 'ใช้เวอร์ชันล่าสุดอยู่แล้ว';

  return el('div', {}, [
    el('div', { style: 'font-size:18px;font-weight:700', text: 'ระบบ' }),
    el('div', { class: 'set-grid' }, [
      el('div', { class: 'set-card' }, [
        el('div', { class: 'k', text: 'เวอร์ชัน' }),
        el('div', { class: 'v', text: S.appInfo.version }),
        el('div', { class: 'muted', style: 'font-size:12px;margin-top:4px', text: upText }),
        el('div', { class: 'row', style: 'margin-top:8px' }, [
          el('button', {
            class: 'btn btn-sm', text: 'ตรวจหาอัปเดต',
            onClick: function (e) { busy(e.currentTarget, 'กำลังตรวจ…', function () { return API.checkForUpdate().then(function (s) { S.updateStatus = s || up; render(); }); }); },
          }),
          up.state === 'ready' ? el('button', { class: 'btn btn-sm btn-primary', text: 'อัปเดตเลย · รีสตาร์ต', onClick: function () { API.installUpdate(); } }) : null,
        ]),
      ]),
      el('div', { class: 'set-card' }, [
        el('div', { class: 'k', text: 'FFmpeg' }),
        el('div', { style: 'font-size:20px;font-weight:600;margin-top:4px;color:' + (S.appInfo.ffmpegReady ? 'var(--green)' : 'var(--amber)'), text: S.appInfo.ffmpegReady ? 'พร้อมใช้งาน ✓' : 'ไม่พบ FFmpeg' }),
        el('div', { class: 'muted', style: 'font-size:12.5px', text: S.bench && S.bench.hardwareEncoder ? 'ตัวช่วยฮาร์ดแวร์ ' + S.bench.hardwareEncoder : 'ตัวช่วยฮาร์ดแวร์ — กดทดสอบเพื่อตรวจ' }),
      ]),
      el('div', { class: 'set-card row' }, [
        el('div', { style: 'flex:1' }, [
          el('div', { style: 'font-size:14px;font-weight:600', text: 'เครื่องนี้ไลฟ์ไหวแค่ไหน' }),
          el('div', { class: 'muted', style: 'font-size:12.5px;margin-top:2px' }, [
            S.bench
              ? el('span', {}, ['ผลล่าสุด: พร้อมกันได้ ', el('b', { style: 'color:var(--accentHi)', text: S.bench.maxStreams + ' บัญชี' }), ' · 1 บัญชี ' + S.bench.singleQuality])
              : el('span', { text: 'รองรับสูงสุด ' + S.appInfo.maxConcurrentStreams + ' บัญชี (ประเมินจากสเปกเครื่อง)' }),
          ]),
        ]),
        el('button', {
          class: 'btn btn-sm', text: S.bench ? 'ทดสอบใหม่' : 'เริ่มทดสอบ',
          onClick: function (e) {
            var acc = curAcc();
            var sample = acc && acc.clips.length ? acc.clips[0].path : '';
            busy(e.currentTarget, 'กำลังทดสอบ...', function () {
              return API.runBenchmark(sample).then(function (r) { S.bench = r; toast('ทดสอบเสร็จ — เครื่องนี้ไลฟ์พร้อมกันได้ ' + r.maxStreams + ' บัญชี', 'ok'); render(); });
            });
          },
        }),
      ]),
      el('div', { class: 'set-card row' }, [
        el('div', { style: 'flex:1' }, [
          el('div', { style: 'font-size:14px;font-weight:600', text: 'อัปเดตอัตโนมัติ' }),
          el('div', { class: 'muted', style: 'font-size:12.5px;margin-top:2px', text: 'ดาวน์โหลดเวอร์ชันใหม่ให้เองเมื่อมีการปล่อยอัปเดต' }),
        ]),
        el('button', {
          class: 'toggle' + (S.autoUpdate ? ' on' : ''),
          onClick: function () {
            S.autoUpdate = !S.autoUpdate;
            API.setUpdateConfig({ autoUpdate: S.autoUpdate }).catch(function () {});
            render();
          },
        }, [el('i')]),
      ]),
    ]),
    el('div', { style: 'margin-top:18px;border-top:1px solid var(--surface2);padding-top:14px' }, [
      el('div', { class: 'muted', style: 'font-size:13px;font-weight:600', text: 'เครื่องมือช่าง' }),
      el('div', { class: 'row', style: 'margin-top:8px' }, [
        el('button', {
          class: 'btn btn-sm', text: 'สแกนหน้า LIVE console',
          onClick: function (e) {
            var acc = curAcc();
            if (!acc) return;
            busy(e.currentTarget, 'กำลังสแกน...', function () {
              return API.scanLiveConsole(acc.id).then(function (r) { showScanResult(r); });
            });
          },
        }),
        el('span', { class: 'faint', style: 'font-size:11.5px', text: 'อ่านโครงสร้างหน้า TikTok เพื่อแก้ปัญหาระบบ Pin — อ่านอย่างเดียว ไม่กดปุ่มใด ๆ' }),
      ]),
    ]),
  ]);
}

function showScanResult(result) {
  var text = JSON.stringify(result, null, 2);
  openModal(function (close) {
    return el('div', { class: 'modal', style: 'width:560px' }, [
      el('div', { class: 'modal-t', text: 'ผลสแกนหน้า LIVE console' }),
      el('textarea', { class: 'inp mono', style: 'height:320px;font-size:11.5px', readonly: 'readonly', value: text }),
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn', text: 'คัดลอกผลทั้งหมด', onClick: function (e) { navigator.clipboard.writeText(text); e.currentTarget.textContent = 'คัดลอกแล้ว'; } }),
        el('button', { class: 'btn btn-primary', text: 'ปิด', onClick: close }),
      ]),
    ]);
  });
}

function setLine() {
  var cfg = S.line;
  var token = el('input', { class: 'inp', type: 'password', placeholder: 'วาง channel access token จาก LINE Developers', value: cfg.channelAccessToken });
  var target = el('input', { class: 'inp mono', placeholder: 'เช่น Uxxxxxxxx หรือ Cxxxxxxxx', value: cfg.targetId });
  var read = function () {
    return { enabled: cfg.enabled, channelAccessToken: token.value.trim(), targetId: target.value.trim(), notifyOnLive: cfg.notifyOnLive, notifyOnStop: cfg.notifyOnStop, notifyOnError: cfg.notifyOnError };
  };
  var chk = function (key, label) {
    return el('label', { class: 'row', style: 'font-size:13.5px;cursor:pointer;gap:6px' }, [
      el('input', { type: 'checkbox', checked: cfg[key], onChange: function (e) { cfg[key] = e.target.checked; } }),
      el('span', { text: label }),
    ]);
  };

  return el('div', {}, [
    el('div', { class: 'row' }, [
      el('span', { style: 'font-size:18px;font-weight:700', text: 'แจ้งเตือน LINE' }),
      el('div', { class: 'spacer' }),
      el('button', { class: 'toggle' + (cfg.enabled ? ' on' : ''), onClick: function () { cfg.enabled = !cfg.enabled; render(); } }, [el('i')]),
    ]),
    el('div', { class: 'muted', style: 'font-size:12.5px;margin-top:4px;line-height:1.6', text: 'ส่งข้อความเข้า LINE เมื่อเริ่มไลฟ์ / ไลฟ์จบ / ไลฟ์มีปัญหา และกดเช็คสถานะไลฟ์ทุกบัญชีได้ทุกเมื่อ' }),
    el('div', { class: 'set-grid', style: 'max-width:760px' }, [
      el('label', { class: 'field-lbl' }, ['Channel access token', token]),
      el('label', { class: 'field-lbl' }, ['ปลายทาง (User / Group ID)', target]),
    ]),
    el('div', { class: 'row', style: 'gap:16px;margin-top:16px' }, [chk('notifyOnLive', 'เริ่มไลฟ์'), chk('notifyOnStop', 'หยุดไลฟ์'), chk('notifyOnError', 'ไลฟ์มีปัญหา')]),
    el('div', { class: 'row', style: 'gap:8px;margin-top:18px' }, [
      el('button', {
        class: 'btn btn-primary', style: 'height:44px', text: 'บันทึก',
        onClick: function (e) {
          busy(e.currentTarget, 'กำลังบันทึก…', function () {
            return API.setLineConfig(read()).then(function (saved) { S.line = saved || read(); toast('บันทึกการตั้งค่าแล้ว', 'ok'); render(); });
          });
        },
      }),
      el('button', {
        class: 'btn', style: 'height:44px', text: 'ส่งข้อความทดสอบ',
        onClick: function (e) {
          busy(e.currentTarget, 'กำลังส่ง…', function () {
            return API.testLine(read()).then(function (r) {
              if (r && r.ok) toast('ส่งข้อความทดสอบไป LINE แล้ว — เช็คแชทได้เลย', 'ok');
              else toast('ส่งไม่สำเร็จ: ' + ((r && r.error) || 'ตรวจ token และปลายทางอีกครั้ง'), 'err');
            });
          });
        },
      }),
      el('button', {
        class: 'btn', style: 'height:44px', text: 'ส่งสถานะไลฟ์ตอนนี้',
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

function setAi() {
  var acc = curAcc();
  if (!acc) return el('div', { class: 'empty', text: 'ยังไม่มีบัญชี' });
  var cfg = S.chat[acc.id] || defaultChatConfig();

  var host = el('input', { class: 'inp', placeholder: 'เช่น mystore.official', value: cfg.hostUsername });
  var apiKey = el('input', { class: 'inp mono', type: 'password', placeholder: cfg.ai.provider === 'gemini' ? 'AIza…' : 'sk-ant-…', value: cfg.ai.apiKey });
  var model = el('input', { class: 'inp mono', value: cfg.ai.model });
  var context = el('textarea', { class: 'inp', placeholder: 'เช่น ร้านขายสกินแคร์ ส่งฟรีเมื่อซื้อครบ 2 ชิ้น ตอบสุภาพลงท้าย ค่ะ', value: cfg.ai.context });

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

  var ruleRows = cfg.rules.map(function (rule) {
    return el('div', { class: 'row', style: 'gap:8px;border-bottom:1px solid var(--surface2);padding:8px 0' }, [
      el('button', {
        class: 'toggle' + (rule.enabled ? ' on' : ''),
        onClick: function () {
          save({ rules: cfg.rules.map(function (r) { return r.id === rule.id ? Object.assign({}, r, { enabled: !r.enabled }) : r; }) });
        },
      }, [el('i')]),
      el('input', { class: 'inp', style: 'height:34px;flex:1', value: rule.keyword, placeholder: 'คีย์เวิร์ด', onChange: function (e) { rule.keyword = e.target.value; save({ rules: cfg.rules }); } }),
      el('span', { class: 'faint', text: '→' }),
      el('input', { class: 'inp', style: 'height:34px;flex:2', value: rule.reply, placeholder: 'คำตอบ', onChange: function (e) { rule.reply = e.target.value; save({ rules: cfg.rules }); } }),
      el('button', { class: 'icon-btn danger', text: '🗑', title: 'ลบกฎ', onClick: function () { save({ rules: cfg.rules.filter(function (r) { return r.id !== rule.id; }) }); } }),
    ]);
  });

  return el('div', {}, [
    el('div', { class: 'row' }, [
      el('span', { style: 'font-size:18px;font-weight:700' }, ['แชท AI ', el('span', { class: 'muted', style: 'font-size:12px;font-weight:400', text: '— ตั้งต่อบัญชี "' + acc.alias + '"' })]),
      el('div', { class: 'spacer' }),
      el('button', { class: 'toggle' + (cfg.enabled ? ' on' : ''), onClick: function () { save({ enabled: !cfg.enabled }); } }, [el('i')]),
    ]),
    el('div', { class: 'muted', style: 'font-size:12.5px;margin-top:4px;line-height:1.6', text: 'อ่านเฉพาะคอมเมนต์ที่ผู้ชมพิมพ์เข้ามา แล้วตอบกลับจากบัญชีโฮสต์ — ใช้คีย์เวิร์ดก่อน ถ้าไม่ตรงค่อยใช้ AI' }),
    el('label', { class: 'field-lbl', style: 'margin-top:14px;max-width:380px' }, ['@username ของบัญชีโฮสต์ (จำเป็นสำหรับการส่งข้อความ)', host]),

    el('div', { class: 'row', style: 'margin-top:18px' }, [
      el('span', { style: 'font-size:14px;font-weight:600', text: 'กฎคีย์เวิร์ด → คำตอบ (ฟรี ตอบทันที)' }),
      el('div', { class: 'spacer' }),
      el('button', { class: 'btn btn-sm', text: '+ เพิ่มกฎ', onClick: function () { quickRuleDialog(acc); } }),
    ]),
    el('div', { style: 'margin-top:6px;max-height:200px;overflow:auto' },
      ruleRows.length ? ruleRows : [el('div', { class: 'empty', style: 'padding:14px', text: 'ยังไม่มีกฎ — เพิ่มคีย์เวิร์ดที่พบบ่อย เช่น "ราคา"' })]),

    el('div', { class: 'row', style: 'margin-top:18px' }, [
      el('span', { style: 'font-size:14px;font-weight:600', text: 'ตอบด้วย AI (ใช้ API key ของคุณเอง)' }),
      el('div', { class: 'spacer' }),
      el('button', { class: 'toggle' + (cfg.ai.enabled ? ' on' : ''), onClick: function () { save({ ai: Object.assign({}, cfg.ai, { enabled: !cfg.ai.enabled, apiKey: apiKey.value.trim(), model: model.value.trim(), context: context.value }) }); } }, [el('i')]),
    ]),
    el('div', { class: 'set-grid', style: 'max-width:760px' }, [
      el('div', {}, [
        el('div', { class: 'muted', style: 'font-size:12.5px', text: 'ผู้ให้บริการ' }),
        el('div', { class: 'row', style: 'gap:8px;margin-top:6px' }, [
          el('button', {
            class: 'chip-o' + (cfg.ai.provider === 'gemini' ? ' on' : ''), style: 'padding:10px 18px;border-radius:12px', text: 'Gemini',
            onClick: function () { save({ ai: Object.assign({}, cfg.ai, { provider: 'gemini', model: 'gemini-2.0-flash' }) }); },
          }),
          el('button', {
            class: 'chip-o' + (cfg.ai.provider === 'claude' ? ' on' : ''), style: 'padding:10px 18px;border-radius:12px', text: 'Claude',
            onClick: function () { save({ ai: Object.assign({}, cfg.ai, { provider: 'claude', model: 'claude-haiku-4-5' }) }); },
          }),
        ]),
      ]),
      el('label', { class: 'field-lbl' }, [
        'API key · ',
        el('a', { text: 'ไปหน้าขอ API key →', onClick: function () { API.openExternal(cfg.ai.provider === 'gemini' ? 'https://aistudio.google.com/apikey' : 'https://console.anthropic.com/settings/keys'); } }),
        apiKey,
      ]),
      el('label', { class: 'field-lbl' }, ['โมเดล', model]),
      el('label', { class: 'row', style: 'font-size:13.5px;cursor:pointer;gap:8px;align-self:end;padding-bottom:10px' }, [
        el('input', { type: 'checkbox', checked: cfg.ai.useProducts, onChange: function (e) { save({ ai: Object.assign({}, cfg.ai, { useProducts: e.target.checked }) }); } }),
        el('span', { text: 'ให้ AI รู้จักสินค้าในไลฟ์ด้วย' }),
      ]),
    ]),
    el('label', { class: 'field-lbl', style: 'margin-top:14px;max-width:760px;display:block' }, ['บริบทร้าน (AI จะใช้ตอบลูกค้า)', context]),
    el('div', { class: 'row', style: 'margin-top:14px' }, [
      el('button', { class: 'btn btn-primary', style: 'height:44px', text: 'บันทึก', onClick: function (e) { save({}, e.currentTarget); } }),
      el('span', { class: 'faint', style: 'font-size:11.5px', text: 'API key เก็บไว้เฉพาะเครื่องนี้ และเรียกผู้ให้บริการโดยตรงจากเครื่องคุณ ไม่ผ่านเซิร์ฟเวอร์เรา' }),
    ]),
  ]);
}

function setAdmin() {
  if (!S.admin.unlocked) {
    var tokenInput = el('input', { class: 'inp mono', style: 'flex:1', placeholder: 'ADMIN TOKEN', type: 'password' });
    return el('div', { style: 'height:100%;display:grid;place-items:center' }, [
      el('div', { style: 'max-width:440px;text-align:center' }, [
        el('div', { style: 'font-size:30px', text: '🔒' }),
        el('div', { style: 'font-size:16px;font-weight:700;margin-top:8px', text: 'โหมดแอดมิน' }),
        el('div', { class: 'muted', style: 'font-size:13px;margin-top:4px', text: 'สำหรับเจ้าของระบบเท่านั้น — ใช้ออก / ถอน License Key' }),
        el('div', { class: 'row', style: 'gap:8px;margin-top:16px' }, [
          tokenInput,
          el('button', {
            class: 'btn btn-solid', style: 'height:44px;padding:0 20px', text: 'ปลดล็อก',
            onClick: function (e) {
              busy(e.currentTarget, 'กำลังตรวจ…', function () {
                return API.adminUnlock({ token: tokenInput.value }).then(function (r) {
                  if (r && r.unlocked) { S.admin.unlocked = true; toast('ปลดล็อกแล้ว', 'ok'); return loadAdminKeys().then(render); }
                  toast((r && r.error) || 'ปลดล็อกไม่สำเร็จ', 'err');
                });
              });
            },
          }),
        ]),
      ]),
    ]);
  }

  var username = el('input', { class: 'inp', placeholder: 'username' });
  var displayName = el('input', { class: 'inp', placeholder: 'ชื่อที่แสดง' });
  var password = el('input', { class: 'inp', placeholder: 'ตั้งรหัสผ่านให้ผู้ใช้', type: 'text' });
  var days = el('input', { class: 'inp', placeholder: 'อายุ (วัน)', type: 'number', value: '30' });
  var lookup = el('input', { class: 'inp', placeholder: 'ค้นหาผู้ใช้ (username)' });

  return el('div', {}, [
    el('div', { class: 'row' }, [
      el('span', { style: 'font-size:18px;font-weight:700', text: 'โหมดแอดมิน · จัดการ License Key' }),
      el('div', { class: 'spacer' }),
      el('button', { class: 'btn btn-sm', text: 'ล็อกโหมดแอดมิน', onClick: function () { API.adminLock().then(function () { S.admin = { unlocked: false, keys: [], found: null }; render(); }); } }),
    ]),
    el('div', { class: 'set-grid', style: 'max-width:760px' }, [username, displayName, password, days]),
    el('div', { class: 'row', style: 'margin-top:12px' }, [
      el('button', {
        class: 'btn btn-primary', text: 'สร้าง License Key',
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
      el('span', { class: 'faint', style: 'font-size:11.5px', text: 'คีย์จะถูกคัดลอกให้อัตโนมัติ — ส่ง username รหัสผ่าน และคีย์นี้ให้ผู้ใช้' }),
    ]),
    el('div', { class: 'row', style: 'margin-top:20px;max-width:520px' }, [
      lookup,
      el('button', {
        class: 'btn', text: 'ค้นหา',
        onClick: function (e) {
          busy(e.currentTarget, 'ค้นหา…', function () {
            return API.adminLookupUser(lookup.value.trim()).then(function (r) { S.admin.found = r; render(); });
          });
        },
      }),
    ]),
    S.admin.found ? adminUserCard(S.admin.found) : null,
    el('div', { style: 'font-size:14px;font-weight:600;margin-top:20px' }, ['คีย์ที่ออกไว้ (' + S.admin.keys.length + ') ',
      el('a', { style: 'font-size:12.5px', text: 'รีเฟรช', onClick: function () { loadAdminKeys().then(render); } })]),
    el('div', { style: 'margin-top:8px;max-height:240px;overflow:auto' },
      S.admin.keys.length ? S.admin.keys.map(adminUserCard) : [el('div', { class: 'empty', style: 'padding:16px', text: 'ยังไม่มีคีย์ที่ออก' })]),
  ]);
}

function adminUserCard(user) {
  return el('div', { class: 'row', style: 'gap:10px;border-bottom:1px solid var(--surface2);padding:10px 0;font-size:13px' }, [
    el('div', { style: 'flex:1;min-width:0' }, [
      el('div', { style: 'font-weight:600', text: (user.displayName || user.username) + ' · ' + user.username }),
      el('div', { class: 'faint', style: 'font-size:11.5px', text: user.expiresAt ? 'หมดอายุ ' + fmtDate(user.expiresAt) : 'ไม่มีวันหมดอายุ' }),
    ]),
    el('button', { class: 'btn btn-xs', text: 'คัดลอกคีย์', onClick: function (e) { navigator.clipboard.writeText(user.licenseKey || ''); e.currentTarget.textContent = 'คัดลอกแล้ว'; } }),
    el('button', {
      class: 'btn btn-xs', style: 'color:var(--redText)', text: 'ถอนสิทธิ์',
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

