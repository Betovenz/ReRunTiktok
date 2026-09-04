/* Rerun Studio v11 — หน้าแรก (อ้างอิง mock-sections/home.html) */

/* ===================================================================== */
/* หน้าแรก                                                               */
/* ===================================================================== */
function viewHome() {
  var acc = curAcc();
  var week = summarize(7);
  var bars = dailyBuckets(7);
  var maxRevenue = Math.max.apply(null, bars.map(function (b) { return b.revenue; }).concat([1]));
  var now = new Date();
  var preset = S.presets[0] || null;
  var displayName = (S.license && S.license.displayName) || 'ผู้ใช้';

  var hero = el('div', { class: 'hero' }, [
    el('div', { class: 'hero-date', text: 'วัน' + TH_DAY[now.getDay()] + ' ' + now.getDate() + ' ' + TH_MONTH[now.getMonth()] + ' · ' + pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ' น.' }),
    el('div', { class: 'hero-h1' }, ['พร้อมไลฟ์รอบนี้', el('br'), 'หรือยัง ' + displayName]),
    el('div', { class: 'hero-sub', text: preset ? 'ค่าตั้งจากรอบล่าสุดโหลดไว้แล้ว — กดปุ่มเดียวไลฟ์ต่อได้เลย' : 'ยังไม่มี Preset — ตั้งค่ารอบแรกแล้วบันทึกไว้กดซ้ำได้' }),
    preset ? presetBox(preset) : el('div', { class: 'empty', style: 'margin-top:22px;border:1px dashed var(--border);border-radius:18px;padding:22px', text: 'ตั้งค่าไลฟ์ครั้งแรกให้จบ แล้วติ๊ก "บันทึกเป็น Preset" — ครั้งต่อไปจะกดไลฟ์ได้ในปุ่มเดียว' }),
    el('div', { class: 'spacer' }),
    el('button', {
      class: 'btn btn-primary btn-lg', text: preset ? '▶ เริ่มไลฟ์เลย' : '▶ ไปตั้งค่าไลฟ์',
      onClick: function (e) {
        if (!preset) { go('setup'); return; }
        applyPreset(acc, preset);
        startLive(acc, e.currentTarget);
      },
    }),
    el('div', { class: 'row', style: 'margin-top:12px' }, [
      el('span', { class: 'faint', style: 'font-size:12px;flex:1', text: 'ห้อง LIVE จริงจะถูกสร้างเมื่อกดปุ่มนี้เท่านั้น' }),
      el('button', { class: 'btn btn-ghost', text: '+ ตั้งค่าใหม่จากศูนย์ (3 ขั้น)', onClick: function () { go('setup'); } }),
    ]),
  ]);

  var right = el('div', { style: 'display:grid;grid-template-rows:auto 1fr 1.3fr;gap:14px;min-height:0' }, [
    el('div', { class: 'stat3' }, [
      el('div', { class: 'stat' }, [
        el('div', { class: 'k', text: 'ไลฟ์สัปดาห์นี้' }),
        el('div', { class: 'v' }, [String(week.count), ' ', el('small', { text: 'ครั้ง · ' + Math.round(week.seconds / 360) / 10 + ' ชม.' })]),
      ]),
      el('div', { class: 'stat' }, [
        el('div', { class: 'k', text: 'ยอดขาย 7 วัน' }),
        el('div', { class: 'v', style: 'color:var(--green)' }, [fmtMoney(week.revenue), ' ', el('small', { text: 'บาท' })]),
      ]),
      el('div', { class: 'stat' }, [
        el('div', { class: 'k', text: 'จบปกติ' }),
        el('div', { class: 'v' }, [String(week.ended), el('span', { class: 'faint', text: '/' + week.count })]),
      ]),
    ]),
    el('div', { class: 'card', style: 'padding:16px 20px;display:flex;flex-direction:column;min-height:0' }, [
      el('div', { class: 'row' }, [
        el('span', { style: 'font-size:14px;font-weight:600', text: 'ยอดขายรายวัน · 7 วัน' }),
        el('div', { class: 'spacer' }),
        el('a', { style: 'font-size:12.5px;font-weight:600', text: 'ดูผลงาน →', onClick: function () { go('perf'); } }),
      ]),
      el('div', { class: 'bars' }, bars.map(function (b) {
        return el('div', { class: 'bar-col' }, [
          el('div', { class: 'bar' + (b.revenue >= maxRevenue && b.revenue > 0 ? ' hi' : ''), style: 'height:' + Math.max(2, b.revenue / maxRevenue * 100) + '%' }),
          el('span', { class: 'bar-lbl', text: b.label }),
        ]);
      })),
    ]),
    el('div', { class: 'card', style: 'overflow:hidden;display:flex;flex-direction:column;min-height:0' }, [
      el('div', { class: 'card-head' }, [
        el('span', { text: 'ไลฟ์ล่าสุด' }),
        el('div', { class: 'spacer' }),
        el('a', { style: 'font-size:12.5px;font-weight:600', text: 'ทั้งหมด →', onClick: function () { go('perf'); } }),
      ]),
      el('div', { style: 'flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:8px;padding:10px 20px' },
        S.history.length ? S.history.slice(0, 6).map(historyRow)
          : [el('div', { class: 'empty', style: 'margin:auto', text: 'ยังไม่มีประวัติไลฟ์ — เริ่มไลฟ์แรกของคุณได้เลย' })]),
    ]),
  ]);

  return el('div', { class: 'home' }, [hero, right]);
}

function presetBox(preset) {
  return el('div', { class: 'preset-box' }, [
    el('div', { class: 'preset-thumb', text: '9:16' }),
    el('div', { style: 'flex:1;min-width:0' }, [
      el('div', { class: 'row' }, [
        el('span', { style: 'font-size:15px;font-weight:700', text: 'Preset · ' + preset.name }),
        el('span', { class: 'pill-ok', text: 'พร้อม' }),
      ]),
      el('div', { class: 'muted', style: 'font-size:12.5px;margin-top:3px', text: presetSummary(preset) }),
      el('div', { class: 'faint', style: 'font-size:12px;margin-top:2px', text: 'บันทึกเมื่อ ' + fmtDate(preset.savedAt) }),
    ]),
    el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;max-width:150px;justify-content:flex-end' }, S.presets.slice(0, 3).map(function (p, i) {
      return el('button', {
        class: 'chip-o' + (i === 0 ? ' on' : ''), text: p.name,
        onClick: function () {
          S.presets = [p].concat(S.presets.filter(function (x) { return x.id !== p.id; }));
          saveStore(); render();
        },
      });
    })),
  ]);
}

