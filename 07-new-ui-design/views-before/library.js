/* Rerun Studio v11 — คลัง + Preset (อ้างอิง mock-sections/library.html) */

/* ===================================================================== */
/* คลัง                                                                  */
/* ===================================================================== */
function viewLibrary() {
  var acc = curAcc();
  var search = (S.librarySearch || '').trim().toLowerCase();
  var items = S.library.filter(function (item) { return !search || item.name.toLowerCase().indexOf(search) >= 0; });

  var grid = el('div', { class: 'lib-grid' }, items.map(function (item) {
    return el('div', {
      class: 'lib-card', title: 'กดเพื่อเพิ่มเข้าคิวไลฟ์ของ "' + (acc ? acc.alias : '') + '"',
      onClick: function () {
        if (!acc) return;
        addClips(acc, [item.path]).then(function () { toast('เพิ่ม "' + item.name + '" เข้าคิวแล้ว', 'ok'); render(); });
      },
    }, [
      el('span', { class: 'du', text: 'MP4' }),
      el('button', {
        class: 'icon-btn danger rm', style: 'background:rgba(0,0,0,.5)', text: '🗑', title: 'ลบออกจากคลัง',
        onClick: function (e) {
          e.stopPropagation();
          API.removeLibrary(item.id).then(function (list) { S.library = list || []; toast('ลบออกจากคลังแล้ว'); render(); });
        },
      }),
      el('div', { class: 'nm', text: item.name }),
    ]);
  }).concat([
    el('div', {
      class: 'drop', html: '+<br>เพิ่มวิดีโอเข้าคลัง',
      onClick: function () { API.addLibrary().then(function (list) { S.library = list || []; render(); }); },
    }),
  ]));

  var left = el('div', { class: 'card22', style: 'padding:22px 24px;display:flex;flex-direction:column;min-height:0' }, [
    el('div', { class: 'row' }, [
      el('span', { style: 'font-size:22px;font-weight:700', text: 'คลิปในคลัง' }),
      el('span', { class: 'muted', style: 'font-size:13px', text: S.library.length + ' คลิป' }),
      el('div', { class: 'spacer' }),
      el('input', {
        class: 'inp', style: 'height:40px;width:220px', placeholder: 'ค้นหาคลิป…', value: S.librarySearch || '',
        onInput: function (e) { S.librarySearch = e.target.value; render(); },
      }),
      el('button', {
        class: 'btn btn-solid', style: 'height:40px', text: '+ เพิ่มวิดีโอ',
        onClick: function (e) { busy(e.currentTarget, 'กำลังเลือก…', function () { return API.addLibrary().then(function (list) { S.library = list || []; render(); }); }); },
      }),
    ]),
    grid,
    el('div', { class: 'faint', style: 'font-size:11.5px;margin-top:10px', text: 'ไฟล์ยังอยู่ในเครื่องของคุณ — คลังเก็บแค่ที่อยู่ไฟล์ไว้ให้หยิบใช้ซ้ำได้เร็ว · กดการ์ดเพื่อเพิ่มเข้าคิวไลฟ์' }),
  ]);

  var presetCards = S.presets.length ? S.presets.map(function (preset, i) {
    var primary = i === 0;
    return el('div', { class: primary ? 'preset-card' : 'preset-card2' }, [
      el('div', { style: 'font-size:16px;font-weight:700', text: (primary ? '🌆 ' : '🌙 ') + preset.name }),
      el('div', { style: 'font-size:12.5px;margin-top:4px;line-height:1.6;' + (primary ? 'opacity:.85' : 'color:var(--muted)'), text: presetSummary(preset) }),
      el('div', { style: 'display:flex;gap:8px;margin-top:14px' }, [
        el('button', {
          class: primary ? 'btn' : 'btn', style: primary ? 'flex:1;height:44px;border:none;background:#fff;color:var(--primaryDeep);font-weight:700' : 'flex:1;height:42px',
          text: '▶ ใช้ไลฟ์เลย',
          onClick: function (e) {
            if (!acc) return;
            applyPreset(acc, preset);
            startLive(acc, e.currentTarget);
          },
        }),
        el('button', {
          class: 'btn', style: (primary ? 'height:44px;border-color:rgba(255,255,255,.35);color:#fff' : 'height:42px'), text: 'แก้ไข',
          onClick: function () { if (acc) { applyPreset(acc, preset); go('setup'); } },
        }),
        el('button', {
          class: 'icon-btn danger', style: primary ? 'color:#fff' : '', text: '🗑', title: 'ลบ Preset',
          onClick: function () {
            S.presets = S.presets.filter(function (p) { return p.id !== preset.id; });
            saveStore(); render();
          },
        }),
      ]),
    ]);
  }) : [el('div', { class: 'empty', style: 'border:1px dashed var(--border);border-radius:20px;padding:26px', text: 'ยังไม่มี Preset — บันทึกได้จากขั้น "ยิงไลฟ์"' })];

  var right = el('div', { style: 'display:flex;flex-direction:column;gap:14px;min-height:0;overflow:auto' }, [
    el('div', { class: 'muted', style: 'font-size:12px;font-weight:600;letter-spacing:.6px;padding:4px 4px 0', text: 'PRESET · กดใช้ไลฟ์ได้ทันที' }),
  ].concat(presetCards));

  return el('div', { class: 'lib' }, [left, right]);
}

