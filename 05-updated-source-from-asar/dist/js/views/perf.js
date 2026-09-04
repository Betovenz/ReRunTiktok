/* Rerun Studio v11 — ผลงาน + นำเข้ายอดขาย CSV
   ลอก inline style จาก mock-sections/perf.html แบบ element ต่อ element ({{ T.x }} → var(--x))
   สูตร style ที่ mock คำนวณ (perfBars · history dot/status) ลอกจาก mock-sections/state.js */

/* ===================================================================== */
/* ผลงาน                                                                 */
/* ===================================================================== */
var PERF_RANGES = [[7, '7 วัน'], [30, '30 วัน'], [0, 'ทั้งหมด']];
var PERF_CHART_DAYS = 14;

/* ปุ่มขอบ 40px แบบเดียวกับ "นำเข้ายอดขาย CSV" ใน mock (style-hover → borderHi) */
function perfButton(label, onClick) {
  return hov(el('button', {
    style: 'height:40px; padding:0 16px; border:1px solid var(--border); border-radius:12px; background:none; color:var(--text); font-size:13px; font-weight:600; cursor:pointer; white-space:nowrap',
    text: label,
    onClick: onClick,
  }), 'border-color:var(--borderHi)');
}

/* KPI 1 ช่อง — radius 18 · padding 16/20 · ตัวเลข 28px mono */
function perfKpi(label, value, opts) {
  opts = opts || {};
  return el('div', {
    style: opts.hi
      ? 'background:linear-gradient(145deg,var(--primaryDeep),var(--primary)); border-radius:18px; padding:16px 20px; color:#fff'
      : 'background:var(--surface); border:1px solid var(--border); border-radius:18px; padding:16px 20px',
  }, [
    el('div', { style: opts.hi ? 'font-size:12px; opacity:.85' : 'font-size:12px; color:var(--muted)', text: label }),
    el('div', {
      style: "font-size:28px; font-weight:600; font-family:'IBM Plex Mono',monospace; margin-top:4px" + (opts.color ? '; color:' + opts.color : ''),
      text: value,
    }),
  ]);
}

/* แถวประวัติ 1 แถว — ตาม history ใน state.js (dotStyle / stStyle) + layout ใน perf.html */
function perfHistoryRow(h) {
  var ok = h.reason !== 'error';
  var acc = accById(h.accountId);
  return el('div', { style: 'display:flex; align-items:center; gap:12px; font-size:13px; flex-shrink:0' }, [
    el('span', { style: 'width:8px;height:8px;border-radius:99px;flex-shrink:0;' + (ok ? 'background:var(--green)' : 'background:#FF5A52') }),
    el('span', { style: 'width:110px; color:var(--muted); font-size:12.5px; flex-shrink:0', text: fmtDate(h.startedAt) }),
    el('span', { style: 'width:70px; font-weight:600; flex-shrink:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap', title: h.title || '', text: acc ? acc.alias : (h.title || h.accountId || '') }),
    el('span', { style: "width:80px; font-family:'IBM Plex Mono',monospace; font-size:12.5px; flex-shrink:0", text: fmtDur(h.durationSec || 0) }),
    el('span', {
      style: 'font-size:11.5px;font-weight:600;padding:2px 9px;border-radius:999px;white-space:nowrap;'
        + (ok ? 'background:rgba(var(--greenRgb),.12);color:var(--green)' : 'background:rgba(255,90,82,.12);color:var(--redText)'),
      text: ok ? 'จบปกติ' : 'ผิดพลาด',
    }),
    el('div', { style: 'flex:1' }),
    el('span', { style: "font-family:'IBM Plex Mono',monospace; font-size:12.5px", text: typeof h.gmv === 'number' ? fmtMoney(h.gmv) + ' ฿' : '—' }),
  ]);
}

function perfEmpty(text) {
  return el('div', { style: 'margin:auto; text-align:center; color:var(--faint); font-size:12.5px; line-height:1.7; padding:16px', text: text });
}

function viewPerf() {
  var days = S.perfRange;
  var sum = summarize(days);
  var bars = dailyBuckets(PERF_CHART_DAYS);
  var maxRevenue = Math.max.apply(null, bars.map(function (b) { return b.revenue; }).concat([0]));
  var hasSales = S.sales.records.length > 0;

  /* ---- หัว: ผลงาน · spacer · segmented · ปุ่ม 40px ---- */
  var seg = el('div', { style: 'display:flex; background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:3px; font-size:13px' },
    PERF_RANGES.map(function (r) {
      var on = S.perfRange === r[0];
      return el('span', {
        style: on
          ? 'padding:7px 16px; border-radius:9px; background:var(--text); color:var(--bg); font-weight:700; white-space:nowrap'
          : 'padding:7px 16px; color:var(--muted); cursor:pointer; white-space:nowrap',
        text: r[1],
        onClick: function () { if (S.perfRange === r[0]) return; S.perfRange = r[0]; saveStore(); render(); },
      });
    }));

  var head = el('div', { style: 'display:flex; align-items:center; gap:12px' }, [
    el('span', { style: 'font-size:22px; font-weight:700', text: 'ผลงาน' }),
    el('div', { style: 'flex:1' }),
    seg,
    perfButton('นำเข้ายอดขาย CSV', function (e) { importSales(e.currentTarget); }),
    S.sales.batches.length ? perfButton('ไฟล์ที่นำเข้า (' + S.sales.batches.length + ')', showBatches) : null,
    S.history.length ? perfButton('ล้างประวัติ', function () {
      confirmDialog({ title: 'ล้างประวัติไลฟ์ทั้งหมด', body: 'ประวัติ ' + S.history.length + ' รายการจะถูกลบถาวร (ยอดขายที่นำเข้าไม่ถูกลบ)', ok: 'ล้างประวัติ', danger: true })
        .then(function (yes) {
          if (!yes) return;
          API.clearHistory()
            .then(function () { S.history = []; toast('ล้างประวัติแล้ว', 'ok'); render(); })
            .catch(function (err) { toast(errText(err), 'err'); });
        });
    }) : null,
  ]);

  /* ---- KPI 4 ช่อง ---- */
  var kpi = el('div', { style: 'display:grid; grid-template-columns:repeat(4,1fr); gap:14px' }, [
    perfKpi('ไลฟ์', String(sum.count)),
    perfKpi('เวลารวม', Math.floor(sum.seconds / 3600) + ':' + pad2(Math.floor((sum.seconds % 3600) / 60))),
    perfKpi('จบปกติ', sum.ended + '/' + sum.count, { color: 'var(--green)' }),
    perfKpi('ยอดขาย', fmtMoney(sum.revenue) + ' ฿', { hi: true }),
  ]);

  /* ---- กราฟ 14 วัน (perfBars: แท่งสูงสุด accentHi opacity 1 · อื่น primary opacity .6) ---- */
  var barsHost = el('div', { style: 'flex:1; display:flex; align-items:flex-end; gap:8px; margin-top:14px; min-height:0' },
    !hasSales ? [perfEmpty('ยังไม่ได้นำเข้ายอดขาย — กด "นำเข้ายอดขาย CSV" เพื่อดูกราฟรายได้')]
      : maxRevenue <= 0 ? [perfEmpty('ยังไม่มียอดขายใน ' + PERF_CHART_DAYS + ' วันล่าสุด')]
      : bars.map(function (b) {
        var top = b.revenue > 0 && b.revenue >= maxRevenue;
        var pct = Math.round(b.revenue / maxRevenue * 100);
        return el('div', { style: 'flex:1; height:100%; display:flex; flex-direction:column; justify-content:flex-end' }, [
          el('div', {
            style: 'width:100%;height:' + pct + '%;min-height:2px;border-radius:6px 6px 2px 2px;background:' + (top ? 'var(--accentHi)' : 'var(--primary)') + ';opacity:' + (top ? 1 : .6),
            title: b.label + ' · ' + fmtMoney(b.revenue) + ' ฿',
          }),
        ]);
      }));

  var chart = el('div', { style: 'background:var(--surface); border:1px solid var(--border); border-radius:18px; padding:18px 22px; display:flex; flex-direction:column; min-height:0' }, [
    el('div', { style: 'font-size:14px; font-weight:600', text: 'ยอดขายรายวัน · ' + PERF_CHART_DAYS + ' วัน' }),
    barsHost,
  ]);

  /* ---- ประวัติไลฟ์ ---- */
  var lives = sum.lives.slice().sort(function (a, b) { return (b.startedAt || 0) - (a.startedAt || 0); });
  var many = lives.length > 8;
  var history = el('div', { style: 'background:var(--surface); border:1px solid var(--border); border-radius:18px; overflow:hidden; display:flex; flex-direction:column; min-height:0' }, [
    el('div', { style: 'padding:14px 20px; font-size:14px; font-weight:600; border-bottom:1px solid var(--surface2)', text: 'ประวัติไลฟ์' }),
    el('div', {
      style: 'flex:1; display:flex; flex-direction:column; justify-content:' + (many ? 'flex-start; gap:12px' : 'space-around') + '; padding:' + (many ? '12px 20px' : '4px 20px') + '; min-height:0; overflow:auto',
    }, lives.length ? lives.map(perfHistoryRow) : [perfEmpty('ยังไม่มีประวัติไลฟ์ในช่วงนี้')]),
  ]);

  var body = el('div', { style: 'display:grid; grid-template-columns:1fr 1fr; gap:14px; min-height:0' }, [chart, history]);

  return el('div', { style: 'height:100%; display:grid; grid-template-rows:auto auto 1fr; gap:14px; min-height:0' }, [head, kpi, body]);
}

/* ===================================================================== */
/* นำเข้ายอดขาย CSV (เลือกไฟล์ → แม็ปคอลัมน์ → ยืนยัน)                    */
/* ===================================================================== */
function importSales(button) {
  busy(button, 'กำลังอ่านไฟล์…', function () {
    return API.chooseSalesFile().then(function (preview) {
      if (!preview) return;
      salesMappingDialog(preview);
    });
  });
}

function salesMappingDialog(preview) {
  var mapping = Object.assign({}, preview.mapping);
  openModal(function (close) {
    var summary = el('div', { class: 'muted', style: 'font-size:12.5px;line-height:1.7' });
    var paint = function () {
      summary.textContent = 'พบ ' + preview.rowCount + ' แถว · อ่านยอดได้ ' + preview.parsedCount + ' แถว · รวม ' + fmtMoney(preview.total) + ' บาท'
        + (preview.excluded ? ' · ไม่นับที่ยกเลิก/คืนเงิน ' + preview.excluded : '');
    };
    paint();

    var pick = function (label, key, required) {
      var options = [['-1', '— ไม่ใช้ —']].concat(preview.headers.map(function (h, i) { return [String(i), h || ('คอลัมน์ ' + (i + 1))]; }));
      var sel = selectBox(options, String(mapping[key]), function (v) {
        mapping[key] = Number(v);
        API.previewSales(mapping).then(function (next) {
          preview = Object.assign(preview, next);
          paint();
          commit.disabled = mapping.amount < 0;
        }).catch(function (e) { toast(errText(e), 'err'); });
      });
      return el('label', { class: 'field-lbl' }, [label + (required ? ' (จำเป็น)' : ''), sel]);
    };

    var commit = el('button', {
      class: 'btn btn-primary', style: 'white-space:nowrap', text: 'บันทึกเข้าบัญชี', disabled: mapping.amount < 0,
      onClick: function (e) {
        var acc = curAcc();
        busy(e.currentTarget, 'กำลังบันทึก…', function () {
          return API.commitSales({ token: preview.token, accountId: acc ? acc.id : '', mapping: mapping }).then(function (r) {
            toast('บันทึก ' + r.imported + ' ออร์เดอร์ · รวม ' + fmtMoney(r.total) + ' บาท'
              + (r.duplicates ? ' · ข้ามรายการซ้ำ ' + r.duplicates : ''), 'ok');
            close();
            return loadSales().then(render);
          });
        });
      },
    });

    return el('div', { class: 'modal', style: 'width:460px' }, [
      el('div', { class: 'modal-t', text: 'นำเข้ายอดขาย · ' + (preview.fileName || '') }),
      el('div', { class: 'faint', style: 'font-size:12px', text: 'ถ้าคอลัมน์ที่ระบบเดาไม่ถูก เลือกใหม่ได้เลย' }),
      pick('ยอดเงิน', 'amount', true),
      pick('เลขคำสั่งซื้อ', 'orderId'),
      pick('วันเวลา', 'time'),
      pick('สถานะ', 'status'),
      summary,
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn', style: 'white-space:nowrap', text: 'ยกเลิก', onClick: close }),
        commit,
      ]),
    ]);
  });
}

/* ===================================================================== */
/* ไฟล์ที่นำเข้าแล้ว (ลบชุดข้อมูลได้ · ยืนยันก่อน)                          */
/* ===================================================================== */
function showBatches() {
  openModal(function (close) {
    var batches = S.sales.batches.slice().reverse();
    return el('div', { class: 'modal', style: 'width:460px' }, [
      el('div', { class: 'modal-t', text: 'ไฟล์ที่นำเข้าแล้ว' }),
      el('div', { style: 'display:flex;flex-direction:column;gap:8px' },
        batches.length ? batches.map(function (batch) {
          return el('div', { style: 'display:flex;align-items:center;gap:10px;font-size:13px;border-bottom:1px solid var(--surface2);padding-bottom:8px' }, [
            el('div', { style: 'flex:1;min-width:0' }, [
              el('div', { style: 'font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', text: batch.fileName }),
              el('div', { class: 'faint', style: 'font-size:11.5px', text: fmtDate(batch.importedAt) + ' · ' + batch.orderCount + ' ออร์เดอร์ · ' + fmtMoney(batch.total) + ' ฿' }),
            ]),
            el('button', {
              class: 'icon-btn danger', text: '✕', title: 'ลบชุดข้อมูลนี้',
              onClick: function () {
                confirmDialog({ title: 'ลบชุดข้อมูลนี้', body: batch.fileName + ' · ' + batch.orderCount + ' ออร์เดอร์ · ' + fmtMoney(batch.total) + ' ฿ จะถูกลบออกจากยอดขาย', ok: 'ลบชุดข้อมูล', danger: true })
                  .then(function (yes) {
                    if (!yes) return;
                    API.removeSalesBatch(batch.id)
                      .then(function (store) { S.sales = store || { records: [], batches: [] }; close(); render(); toast('ลบชุดข้อมูลแล้ว', 'ok'); })
                      .catch(function (e) { toast(errText(e), 'err'); });
                  });
              },
            }),
          ]);
        }) : [perfEmpty('ยังไม่มีไฟล์ที่นำเข้า')]),
      el('div', { class: 'modal-actions' }, [el('button', { class: 'btn btn-primary', style: 'white-space:nowrap', text: 'ปิด', onClick: close })]),
    ]);
  });
}
