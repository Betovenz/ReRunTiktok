/* Rerun Studio v11 — หน้าไลฟ์ — ตั้งค่า 3 ขั้น + พรีวิว 9:16 (อ้างอิง mock-sections/setup.html) */

/* ===================================================================== */
/* ขั้น 1 · เตรียมของ                                                     */
/* ===================================================================== */
function stepPrepare(acc) {
  var tk = S.tiktok[acc.id] || {};
  var connected = Boolean(tk.connected);

  var acctBox = el('div', { class: 'acct-box' + (connected ? '' : ' off') }, [
    el('span', { class: 'acct-ic', text: connected ? '✓' : '!' }),
    el('div', { style: 'flex:1;min-width:0' }, [
      el('div', { style: 'font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis', text: acc.alias + (acc.handle ? ' · @' + acc.handle : '') }),
      el('div', {
        style: 'font-size:11.5px;color:' + (connected ? 'var(--green)' : 'var(--amber)'),
        text: connected
          ? 'TikTok เชื่อมแล้ว' + (acc.category ? ' · ' + acc.category : '') + ' · พร้อมไลฟ์'
          : 'ยังไม่เชื่อม TikTok · กดเชื่อมต่อ',
      }),
    ]),
    connected
      ? el('button', { class: 'btn btn-xs', text: 'เปิด TikTok', onClick: function () { API.openTikTok(acc.id); } })
      : el('button', {
          class: 'btn btn-xs btn-primary', text: 'เชื่อม TikTok',
          onClick: function (e) {
            busy(e.currentTarget, 'กำลังรอ TikTok…', function () {
              return API.loginTikTok(acc.id).then(function (r) {
                if (r && r.saved) { toast('บันทึก session แล้ว', 'ok'); }
                else { toast('ยังจับ session ไม่ครบ — ลองล็อกอินอีกครั้ง', 'err'); }
                return refreshTikTok(acc.id).then(render);
              });
            });
          },
        }),
  ]);

  var clipRows = acc.clips.map(function (clip, i) {
    return el('div', { class: 'clip' }, [
      el('div', { class: 'clip-top' }, [
        el('span', { style: 'color:var(--faint)', text: '⠿' }),
        el('span', { class: 'clip-n', text: String(i + 1) }),
        el('span', { class: 'clip-name', title: clip.path, text: clip.name }),
        el('span', { class: 'clip-dur', text: clip.label || '' }),
        el('button', {
          class: 'btn btn-xs', style: 'color:var(--accentHi)', text: '▶ ดูวิดีโอ',
          onClick: function () { previewClip(clip); },
        }),
        el('button', { class: 'icon-btn', title: 'เลื่อนขึ้น (เล่นก่อน)', text: '▲', disabled: i === 0, onClick: function () { moveClip(acc, i, -1); } }),
        el('button', { class: 'icon-btn', title: 'เลื่อนลง (เล่นทีหลัง)', text: '▼', disabled: i === acc.clips.length - 1, onClick: function () { moveClip(acc, i, 1); } }),
        el('button', {
          class: 'icon-btn danger', title: 'เอาออกจากรายการ', text: '✕',
          onClick: function () { acc.clips.splice(i, 1); saveStore(); render(); },
        }),
      ]),
      el('div', { class: 'clip-sched' }, [
        el('button', {
          class: 'mini-toggle' + (clip.sched ? ' on' : ''), title: 'ตั้งเวลาเล่น',
          onClick: function () { clip.sched = !clip.sched; if (clip.sched && !clip.time) clip.time = '18:00'; saveStore(); render(); },
        }, [el('i')]),
        el('span', { text: 'ตั้งเวลาเล่น' }),
        clip.sched ? el('input', {
          type: 'time', class: 'time-inp', value: clip.time || '18:00',
          onChange: function (e) { clip.time = e.target.value; saveStore(); },
        }) : null,
        el('span', { class: 'faint', text: clip.sched ? 'คลิปนี้จะถูกดันขึ้นเล่นตอนนี้ทุกวัน (เฉพาะตอนกำลังไลฟ์)' : 'วนตามลำดับปกติ' }),
      ]),
    ]);
  });

  return el('div', { class: 'step-col' }, [
    el('div', { class: 'step-head' }, [
      el('span', { class: 'step-n on', text: '1' }),
      el('span', { class: 'step-t', text: 'เตรียมของ' }),
      el('span', { class: 'step-s', text: 'บัญชี · คลิปที่จะวน' }),
    ]),
    acctBox,
    el('div', { style: 'display:flex;align-items:baseline;gap:8px;margin-top:16px;flex-shrink:0' }, [
      el('span', { style: 'font-size:14px;font-weight:600', text: 'คลิปที่จะวน' }),
      el('span', { class: 'faint', style: 'font-size:11.5px', text: 'ปรับเป็น 1080×1920 ให้อัตโนมัติ' }),
    ]),
    el('div', { style: 'display:flex;flex-direction:column;gap:6px;margin-top:8px' },
      clipRows.length ? clipRows : [el('div', { class: 'empty', style: 'padding:22px', text: 'ยังไม่มีคลิป — กด "เพิ่มคลิปจากเครื่อง" ด้านล่าง' })]),
    el('div', { style: 'display:flex;gap:8px;margin-top:8px;flex-shrink:0' }, [
      el('button', {
        class: 'btn btn-dash', style: 'flex:1', text: '+ เพิ่มคลิปจากเครื่อง',
        onClick: function (e) {
          busy(e.currentTarget, 'กำลังเลือกไฟล์…', function () {
            return API.chooseVideo().then(function (v) {
              if (!v) return;
              return addClips(acc, [v.path]).then(function () { toast('เพิ่มคลิปแล้ว', 'ok'); render(); });
            });
          });
        },
      }),
      el('button', { class: 'btn', text: 'จากคลัง', onClick: function () { go('library'); } }),
    ]),
    el('div', { class: 'spacer' }),
    el('label', { style: 'display:flex;align-items:center;gap:12px;cursor:pointer;border-top:1px solid var(--surface2);padding-top:12px;margin-top:12px;flex-shrink:0' }, [
      el('button', {
        class: 'toggle' + (acc.shuffle ? ' on' : ''), disabled: acc.clips.length < 2,
        onClick: function () { acc.shuffle = !acc.shuffle; saveStore(); render(); pushLiveConfig(acc); },
      }, [el('i')]),
      el('div', {}, [
        el('div', { style: 'font-size:13.5px;font-weight:600', text: 'สุ่มลำดับทุกรอบ' }),
        el('div', { class: 'muted', style: 'font-size:11.5px', text: acc.clips.length < 2 ? 'เพิ่มอีกอย่างน้อย 1 คลิปเพื่อเปิดใช้การสุ่ม' : 'กันตรวจจับว่าเล่นซ้ำแพทเทิร์นเดิม' }),
      ]),
    ]),
  ]);
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
    acc.clips.push({ path: p, name: p.split(/[\\/]/).pop(), label: '', sched: false, time: '18:00' });
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

function previewClip(clip) {
  openModal(function (close) {
    return el('div', { class: 'modal', style: 'width:360px' }, [
      el('div', { class: 'row' }, [
        el('span', { style: 'font-size:15px;font-weight:700;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', text: clip.name }),
        el('button', { class: 'icon-btn', text: '✕', onClick: close }),
      ]),
      el('video', {
        src: 'file:///' + String(clip.path).replace(/\\/g, '/'),
        controls: 'controls', autoplay: 'autoplay',
        style: 'width:100%;aspect-ratio:9/16;max-height:520px;background:#0f1320;border-radius:14px;object-fit:contain',
      }),
      el('div', { class: 'faint', style: 'font-size:12px;text-align:center', text: 'พรีวิวคลิปก่อนนำไปไลฟ์ · ' + (clip.label || '1080×1920') }),
    ]);
  });
}

/* ===================================================================== */
/* ขั้น 2 · แต่งหน้าจอ                                                    */
/* ===================================================================== */
function stepDecorate(acc) {
  var layers = layerList(acc);
  var sel = selectedLayer(acc);

  var addRow = el('div', { style: 'display:flex;gap:6px;margin-top:14px;flex-shrink:0' }, [
    el('button', {
      class: 'btn btn-sm', style: 'flex:1;height:38px', text: '+ รูป',
      onClick: function (e) {
        busy(e.currentTarget, 'เลือกรูป…', function () {
          return API.chooseOverlay().then(function (img) {
            if (!img) return;
            var id = 'ov-' + Math.random().toString(36).slice(2, 8);
            acc.overlays.push({ id: id, path: img.path, name: img.name, mediaUrl: img.mediaUrl, x: 80, y: 120, width: 320, opacity: 0.95, effect: 'none' });
            S.selLayer = { kind: 'overlay', id: id };
            saveStore(); render();
          });
        });
      },
    }),
    el('button', {
      class: 'btn btn-sm', style: 'flex:1;height:38px', text: '+ นาฬิกา', disabled: acc.clocks.length >= 6,
      onClick: function () {
        var id = 'ck-' + Math.random().toString(36).slice(2, 8);
        acc.clocks.push({ id: id, x: 700, y: 120, fontSize: 72, opacity: 1, format: 'time-short', color: '#ffffff', font: 'mono', design: 'shadow', effect: 'none' });
        S.selLayer = { kind: 'clock', id: id };
        saveStore(); render();
      },
    }),
    el('button', {
      class: 'btn btn-sm', style: 'flex:1;height:38px', text: '+ ข้อความ', disabled: acc.texts.length >= 8,
      onClick: function () {
        var id = 'tx-' + Math.random().toString(36).slice(2, 8);
        acc.texts.push({ id: id, x: 90, y: 1560, fontSize: 56, opacity: 1, text: 'ส่งฟรี 2 ชิ้น', color: '#ffffff', font: 'bold', design: 'solid-accent', mode: 'marquee', speed: 120, effect: 'none' });
        S.selLayer = { kind: 'text', id: id };
        saveStore(); render();
      },
    }),
  ]);

  var layerRows = layers.map(function (layer) {
    var on = S.selLayer && S.selLayer.kind === layer.kind && S.selLayer.id === layer.id;
    return el('div', {
      class: 'layer-row' + (on ? ' on' : ''),
      onClick: function () { S.selLayer = { kind: layer.kind, id: layer.id }; render(); },
    }, [
      el('span', { class: 'layer-ic', text: layer.icon }),
      el('span', { class: 'layer-nm', text: layer.name }),
      el('span', { class: 'layer-kind', text: layer.typeLabel }),
      el('button', {
        class: 'icon-btn', style: 'width:auto;padding:0 8px;height:30px;font-size:12px',
        text: layer.ref.opacity <= 0.02 ? 'แสดง' : 'ซ่อน',
        onClick: function (e) {
          e.stopPropagation();
          layer.ref.opacity = layer.ref.opacity <= 0.02 ? 0.95 : 0.01;
          saveStore(); render(); pushLiveConfig(acc);
        },
      }),
      el('button', {
        class: 'icon-btn danger', style: 'width:auto;padding:0 8px;height:30px;font-size:12px', text: 'ลบ',
        onClick: function (e) { e.stopPropagation(); removeLayer(acc, layer.kind, layer.id); saveStore(); render(); pushLiveConfig(acc); },
      }),
    ]);
  });

  return el('div', { class: 'step-col' }, [
    el('div', { class: 'step-head' }, [
      el('span', { class: 'step-n', text: '2' }),
      el('span', { class: 'step-t', text: 'แต่งหน้าจอ' }),
      el('span', { class: 'step-s', text: 'ข้ามได้ · ลากวางบนพรีวิว' }),
    ]),
    addRow,
    el('div', { style: 'display:flex;flex-direction:column;gap:4px;margin-top:10px' },
      layerRows.length ? layerRows : [el('div', { class: 'empty', style: 'padding:18px', text: 'ยังไม่มี overlay — เพิ่มรูป นาฬิกา หรือข้อความจากปุ่มด้านบน' })]),
    sel ? layerInspector(acc, sel) : null,
    el('div', { class: 'spacer' }),
    el('button', {
      class: 'disclose', text: (S.showAdvanced ? '▾' : '▸') + ' ปรับกล้อง (ซูม · เลื่อน · พลิก) · ตั้งค่าขั้นสูง (RTMP · bitrate)',
      onClick: function () { S.showAdvanced = !S.showAdvanced; render(); },
    }),
    S.showAdvanced ? advancedPanel(acc) : null,
  ]);
}

function layerInspector(acc, layer) {
  var ref = layer.ref;
  var rows = [];
  var commit = function () { saveStore(); pushLiveConfig(acc); };

  if (layer.kind === 'overlay') {
    rows.push(el('span', { class: 'muted', text: 'ขนาด' }));
    rows.push(el('input', {
      type: 'range', min: '64', max: '900', value: String(ref.width),
      onInput: function (e) { ref.width = Number(e.target.value); paintPreview(); },
      onChange: commit,
    }));
  } else {
    rows.push(el('span', { class: 'muted', text: 'ขนาดตัวอักษร' }));
    rows.push(el('input', {
      type: 'range', min: layer.kind === 'clock' ? '24' : '18', max: layer.kind === 'clock' ? '180' : '200', value: String(ref.fontSize),
      onInput: function (e) { ref.fontSize = Number(e.target.value); paintPreview(); },
      onChange: commit,
    }));
  }

  rows.push(el('span', { class: 'muted', text: 'โปร่งใส' }));
  rows.push(el('input', {
    type: 'range', min: '10', max: '100', value: String(Math.round(ref.opacity * 100)),
    onInput: function (e) { ref.opacity = Number(e.target.value) / 100; paintPreview(); },
    onChange: commit,
  }));

  rows.push(el('span', { class: 'muted', text: 'เอฟเฟกต์' }));
  rows.push(el('div', { style: 'display:flex;gap:5px;flex-wrap:wrap' }, EFFECTS.map(function (fx) {
    return el('button', {
      class: 'chip' + ((ref.effect || 'none') === fx[0] ? ' on' : ''), text: fx[1],
      onClick: function () { ref.effect = fx[0]; saveStore(); render(); pushLiveConfig(acc); },
    });
  })));

  if (layer.kind === 'text') {
    rows.push(el('span', { class: 'muted', text: 'ข้อความ' }));
    rows.push(el('input', {
      class: 'inp', style: 'height:34px', maxlength: '200', value: ref.text, placeholder: 'พิมพ์ข้อความ…',
      onInput: function (e) { ref.text = e.target.value; paintPreview(); },
      onChange: function () { saveStore(); render(); pushLiveConfig(acc); },
    }));
    rows.push(el('span', { class: 'muted', text: 'การเคลื่อนไหว' }));
    rows.push(el('div', { style: 'display:flex;gap:5px' }, [
      el('button', { class: 'chip' + (ref.mode === 'static' ? ' on' : ''), text: 'นิ่ง', onClick: function () { ref.mode = 'static'; saveStore(); render(); pushLiveConfig(acc); } }),
      el('button', { class: 'chip' + (ref.mode === 'marquee' ? ' on' : ''), text: 'วิ่ง', onClick: function () { ref.mode = 'marquee'; saveStore(); render(); pushLiveConfig(acc); } }),
    ]));
  }
  if (layer.kind === 'clock') {
    rows.push(el('span', { class: 'muted', text: 'รูปแบบเวลา' }));
    rows.push(selectBox(CLOCK_FORMATS, ref.format, function (v) { ref.format = v; saveStore(); render(); pushLiveConfig(acc); }));
  }
  if (layer.kind === 'clock' || layer.kind === 'text') {
    rows.push(el('span', { class: 'muted', text: 'ฟอนต์' }));
    rows.push(selectBox(FONTS, ref.font, function (v) { ref.font = v; saveStore(); render(); pushLiveConfig(acc); }));
    rows.push(el('span', { class: 'muted', text: 'สไตล์' }));
    rows.push(selectBox(DESIGNS, ref.design, function (v) { ref.design = v; saveStore(); render(); pushLiveConfig(acc); }));
    rows.push(el('span', { class: 'muted', text: 'สี' }));
    rows.push(el('input', {
      type: 'color', value: ref.color, style: 'width:56px;height:30px;background:none;border:1px solid var(--border);border-radius:8px;padding:2px',
      onInput: function (e) { ref.color = e.target.value; paintPreview(); },
      onChange: commit,
    }));
  }

  return el('div', { class: 'insp' }, [
    el('div', { class: 'insp-t', text: 'ปรับ · ' + layer.name }),
    el('div', { class: 'insp-grid' }, rows),
  ]);
}

function advancedPanel(acc) {
  return el('div', { class: 'adv' }, [
    el('div', { class: 'row' }, [
      el('span', { class: 'muted', style: 'width:84px', text: 'ซูมกล้อง' }),
      el('input', {
        type: 'range', min: '1', max: '3', step: '0.05', value: String(acc.camera.zoom), style: 'flex:1',
        onInput: function (e) { acc.camera.zoom = Number(e.target.value); },
        onChange: function () { saveStore(); pushLiveConfig(acc); },
      }),
    ]),
    el('div', { class: 'row' }, [
      el('button', {
        class: 'btn btn-sm' + (acc.camera.mirror ? ' btn-primary' : ''), text: 'พลิกกล้อง (สะท้อน)',
        onClick: function () { acc.camera.mirror = !acc.camera.mirror; saveStore(); render(); pushLiveConfig(acc); },
      }),
      el('button', {
        class: 'btn btn-sm', text: 'รีเซ็ตกล้อง',
        onClick: function () { acc.camera = { zoom: 1, panX: 0, panY: 0, mirror: false }; saveStore(); render(); pushLiveConfig(acc); },
      }),
    ]),
    el('div', { class: 'row', style: 'margin-top:4px' }, [
      el('span', { class: 'muted', style: 'width:84px', text: 'ปลายทาง' }),
      el('button', { class: 'chip' + (acc.targetMode === 'tiktok' ? ' on' : ''), text: 'TikTok อัตโนมัติ', onClick: function () { acc.targetMode = 'tiktok'; saveStore(); render(); } }),
      el('button', { class: 'chip' + (acc.targetMode === 'manual' ? ' on' : ''), text: 'Manual RTMP', onClick: function () { acc.targetMode = 'manual'; saveStore(); render(); } }),
    ]),
    acc.targetMode === 'manual' ? el('input', {
      class: 'inp', style: 'height:36px', placeholder: 'rtmp://... หรือ rtmps://...', value: acc.rtmpServer,
      onInput: function (e) { acc.rtmpServer = e.target.value; }, onChange: saveStore,
    }) : null,
    acc.targetMode === 'manual' ? el('input', {
      class: 'inp mono', style: 'height:36px', type: 'password', placeholder: 'วาง stream key ที่นี่', value: acc.streamKey,
      onInput: function (e) { acc.streamKey = e.target.value; }, onChange: saveStore,
    }) : null,
    el('div', { class: 'row' }, [
      el('span', { class: 'muted', style: 'width:84px', text: 'Bitrate' }),
      el('input', {
        type: 'range', min: '1500', max: '10000', step: '250', value: String(acc.bitrateKbps), style: 'flex:1',
        onInput: function (e) { acc.bitrateKbps = Number(e.target.value); var lbl = e.target.parentNode.querySelector('.brate'); if (lbl) lbl.textContent = acc.bitrateKbps.toLocaleString() + ' kbps'; },
        onChange: function () { saveStore(); },
      }),
      el('span', { class: 'mono brate', style: 'width:96px;text-align:right;font-size:12px', text: acc.bitrateKbps.toLocaleString() + ' kbps' }),
    ]),
    el('div', { class: 'faint', style: 'font-size:11.5px;line-height:1.6', text: 'ยิ่งสูงภาพยิ่งคม แต่ต้องการเน็ตอัปโหลดแรงขึ้น — ถ้าตั้งสูงเกินกำลังเน็ตจะทำให้ไลฟ์กระตุกหรือหลุด' }),
  ]);
}

/* ===================================================================== */
/* ขั้น 3 · ยิงไลฟ์ + พรีวิว 9:16                                         */
/* ===================================================================== */
function stepGoLive(acc) {
  var check = preflight(acc);
  var live = isLive(acc);

  var titleInput = el('input', {
    class: 'inp', value: acc.liveTitle, placeholder: 'เช่น ไลฟ์สินค้ารอบเย็น',
    onInput: function (e) { acc.liveTitle = e.target.value; },
    onChange: function () { saveStore(); },
  });

  var startBtn = el('button', {
    class: 'btn btn-primary btn-md', text: '▶ เริ่มไลฟ์ตอนนี้', disabled: !check.ok,
    onClick: function (e) { startLive(acc, e.currentTarget); },
  });

  return el('div', { style: 'display:flex;flex-direction:column;gap:10px;min-height:0' }, [
    el('div', { class: 'step-head' }, [
      el('span', { class: 'step-n', text: '3' }),
      el('span', { class: 'step-t', text: 'ยิงไลฟ์' }),
      live ? el('span', { class: 'redt', style: 'font-size:12px;font-weight:700', text: '· บัญชีนี้กำลังไลฟ์อยู่' }) : null,
    ]),
    phonePreview(acc),
    titleInput,
    el('div', { class: 'check-line' }, [
      el('span', {
        style: 'font-weight:700;color:' + (check.ok ? 'var(--green)' : 'var(--amber)'),
        text: (check.ok ? '✓' : '!') + ' ตรวจแล้ว ' + check.passed + '/' + check.total,
      }),
      el('span', { text: '· ' + (acc.targetMode === 'manual' ? 'Manual RTMP' : 'TikTok อัตโนมัติ') + ' · ' + Math.round(acc.bitrateKbps / 1000 * 10) / 10 + ' Mbps' }),
      el('div', { class: 'spacer' }),
      el('button', {
        class: 'btn btn-xs', text: 'ดูรายละเอียด',
        onClick: function () { showPreflight(check); },
      }),
    ]),
    el('label', { class: 'row', style: 'font-size:12.5px;cursor:pointer;color:var(--muted)' }, [
      el('input', { type: 'checkbox', id: 'savePresetChk', checked: true }),
      el('span', { text: 'บันทึกเป็น Preset ไว้กดซ้ำ' }),
      el('input', { class: 'inp', id: 'presetName', style: 'height:30px;flex:1;font-size:12.5px', placeholder: 'ชื่อ Preset เช่น รอบเย็น' }),
    ]),
    startBtn,
    el('div', { class: 'faint', style: 'font-size:11px;text-align:center', text: 'ห้อง LIVE จริงจะถูกสร้างเมื่อกดปุ่มนี้เท่านั้น' }),
  ]);
}

function showPreflight(check) {
  openModal(function (close) {
    return el('div', { class: 'modal' }, [
      el('div', { class: 'modal-t', text: 'ตรวจก่อนยิงไลฟ์' }),
      el('div', { style: 'display:flex;flex-direction:column;gap:8px;margin-top:6px' }, check.items.map(function (item) {
        return el('div', { class: 'row', style: 'font-size:13.5px' }, [
          el('span', { style: 'width:18px;color:' + (item.ok ? 'var(--green)' : 'var(--amber)'), text: item.ok ? '✓' : '!' }),
          el('span', { style: 'flex:1', text: item.label }),
          item.ok ? null : el('span', { class: 'faint', style: 'font-size:12px', text: item.fix }),
        ]);
      })),
      el('div', { class: 'modal-actions' }, [el('button', { class: 'btn btn-primary', text: 'ปิด', onClick: close })]),
    ]);
  });
}

function phonePreview(acc) {
  var phone = el('div', { class: 'phone', id: 'phonePreview' }, [
    el('div', { class: 'safe' }),
    el('div', { class: 'ghost', id: 'phoneGhost', text: acc.clips.length ? 'พรีวิว · ' + acc.clips[0].name : 'ยังไม่ได้เลือกคลิป' }),
  ]);
  var wrap = el('div', { class: 'phone-wrap' }, [phone]);
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

  layerList(acc).forEach(function (layer) {
    var ref = layer.ref;
    var selected = S.selLayer && S.selLayer.kind === layer.kind && S.selLayer.id === layer.id;
    var fx = ref.effect && ref.effect !== 'none' ? ' fx-' + ref.effect : '';
    var node;

    if (layer.kind === 'overlay') {
      node = el('div', { class: 'ov' + fx + (selected ? ' sel' : ''), style: 'width:' + (ref.width * scale) + 'px;opacity:' + ref.opacity },
        [el('img', { src: ref.mediaUrl || ('file:///' + String(ref.path).replace(/\\/g, '/')), alt: '' })]);
    } else if (layer.kind === 'clock') {
      node = el('div', {
        class: 'ov ov-clock' + fx + (selected ? ' sel' : ''),
        style: 'font-size:' + Math.max(8, ref.fontSize * scale) + 'px;opacity:' + ref.opacity + ';padding:2px 6px;border-radius:6px;' + designStyle(ref.design, ref.color),
        text: clockText(ref.format),
      });
      node.dataset.clockFormat = ref.format;
    } else {
      node = el('div', {
        class: 'ov ov-text' + fx + (selected ? ' sel' : ''),
        style: 'font-size:' + Math.max(8, ref.fontSize * scale) + 'px;opacity:' + ref.opacity + ';' + designStyle(ref.design, ref.color),
        text: ref.text || 'ข้อความ',
      });
    }

    node.style.left = (ref.x * scale) + 'px';
    node.style.top = (ref.y * scale) + 'px';
    dragLayer(node, ref, scale, layer);
    phone.appendChild(node);
  });
}

function dragLayer(node, ref, scale, layer) {
  node.addEventListener('pointerdown', function (down) {
    down.preventDefault();
    node.setPointerCapture(down.pointerId);
    S.selLayer = { kind: layer.kind, id: layer.id };
    var startX = down.clientX, startY = down.clientY, baseX = ref.x, baseY = ref.y;
    var move = function (e) {
      ref.x = Math.round(Math.max(-300, Math.min(CANVAS_W - 20, baseX + (e.clientX - startX) / scale)));
      ref.y = Math.round(Math.max(-100, Math.min(CANVAS_H - 20, baseY + (e.clientY - startY) / scale)));
      node.style.left = (ref.x * scale) + 'px';
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
  if (!acc) return el('div', { class: 'empty', text: 'ยังไม่มีบัญชี — กด "เพิ่มบัญชี" ใน sidebar' });
  return el('div', { class: 'setup' }, [stepPrepare(acc), stepDecorate(acc), stepGoLive(acc)]);
}

