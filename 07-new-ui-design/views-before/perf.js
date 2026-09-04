/* Rerun Studio v11 — ผลงาน + นำเข้ายอดขาย CSV (อ้างอิง mock-sections/perf.html) */

/* ===================================================================== */
/* ผลงาน                                                                 */
/* ===================================================================== */
function viewPerf() {
  var days = S.perfRange;
  var sum = summarize(days);
  var bars = dailyBuckets(Math.min(days || 30, 30));
  var maxRevenue = Math.max.apply(null, bars.map(function (b) { return b.revenue; }).concat([1]));

  var head = el('div', { class: 'row' }, [
    el('span', { style: 'font-size:22px;font-weight:700', text: 'ผลงาน' }),
    el('div', { class: 'spacer' }),
    el('div', { class: 'seg' }, [[7, '7 วัน'], [30, '30 วัน'], [0, 'ทั้งหมด']].map(function (r) {
      return el('button', { class: S.perfRange === r[0] ? 'on' : '', text: r[1], onClick: function () { S.perfRange = r[0]; saveStore(); render(); } });
    })),
    el('button', { class: 'btn', text: 'นำเข้ายอดขาย CSV', onClick: function (e) { importSales(e.currentTarget); } }),
    S.sales.batches.length ? el('button', { class: 'btn', text: 'ไฟล์ที่นำเข้า (' + S.sales.batches.length + ')', onClick: showBatches }) : null,
    S.history.length ? el('button', {
      class: 'btn', text: 'ล้างประวัติ',
      onClick: function () {
        confirmDialog({ title: 'ล้างประวัติไลฟ์ทั้งหมด', body: 'ประวัติ ' + S.history.length + ' รายการจะถูกลบถาวร (ยอดขายที่นำเข้าไม่ถูกลบ)', ok: 'ล้างประวัติ', danger: true })
          .then(function (yes) { if (yes) API.clearHistory().then(function () { S.history = []; toast('ล้างประวัติแล้ว', 'ok'); render(); }); });
      },
    }) : null,
  ]);

  var kpi = el('div', { class: 'kpi4' }, [
    el('div', { class: 'kpi' }, [el('div', { class: 'muted', style: 'font-size:12px', text: 'ไลฟ์' }), el('div', { class: 'v', text: String(sum.count) })]),
    el('div', { class: 'kpi' }, [el('div', { class: 'muted', style: 'font-size:12px', text: 'เวลารวม' }), el('div', { class: 'v', text: Math.floor(sum.seconds / 3600) + ':' + pad2(Math.floor((sum.seconds % 3600) / 60)) })]),
    el('div', { class: 'kpi' }, [el('div', { class: 'muted', style: 'font-size:12px', text: 'จบปกติ' }), el('div', { class: 'v', style: 'color:var(--green)', text: sum.ended + '/' + sum.count })]),
    el('div', { class: 'kpi hi' }, [el('div', { style: 'font-size:12px;opacity:.85', text: 'ยอดขาย' }), el('div', { class: 'v', text: fmtMoney(sum.revenue) + ' ฿' })]),
  ]);

  var body = el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:14px;min-height:0' }, [
    el('div', { class: 'card', style: 'padding:18px 22px;display:flex;flex-direction:column;min-height:0' }, [
      el('div', { style: 'font-size:14px;font-weight:600', text: 'ยอดขายรายวัน · ' + bars.length + ' วัน' }),
      el('div', { class: 'bars', style: 'gap:6px' }, bars.map(function (b) {
        return el('div', { class: 'bar-col' }, [
          el('div', { class: 'bar' + (b.revenue >= maxRevenue && b.revenue > 0 ? ' hi' : ''), style: 'height:' + Math.max(2, b.revenue / maxRevenue * 100) + '%', title: fmtMoney(b.revenue) + ' ฿' }),
        ]);
      })),
      el('div', { class: 'faint', style: 'font-size:11.5px;margin-top:8px', text: S.sales.records.length ? '' : 'ยังไม่ได้นำเข้ายอดขาย — กด "นำเข้ายอดขาย CSV" เพื่อดูกราฟรายได้' }),
    ]),
    el('div', { class: 'card', style: 'overflow:hidden;display:flex;flex-direction:column;min-height:0' }, [
      el('div', { class: 'card-head', text: 'ประวัติไลฟ์' }),
      el('div', { style: 'flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:10px;padding:12px 20px' },
        sum.lives.length ? sum.lives.map(historyRow)
          : [el('div', { class: 'empty', style: 'margin:auto', text: 'ยังไม่มีประวัติไลฟ์ในช่วงนี้' })]),
    ]),
  ]);

  return el('div', { class: 'perf' }, [head, kpi, body]);
}

/* ---- นำเข้ายอดขาย CSV (เลือกไฟล์ → แม็ปคอลัมน์ → ยืนยัน) ---- */
function importSales(button) {
  busy(button, 'กำลังอ่านไฟล์…', function () {
    return API.chooseSalesFile().then(function (preview) {
      if (!preview) return;
      salesMappingDialog(preview);
    });
  });
}

/* ---- นำเข้ายอดขาย CSV (เลือกไฟล์ → แม็ปคอลัมน์ → ยืนยัน) ---- */
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
      class: 'btn btn-primary', text: 'บันทึกเข้าบัญชี', disabled: mapping.amount < 0,
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
        el('button', { class: 'btn', text: 'ยกเลิก', onClick: close }),
        commit,
      ]),
    ]);
  });
}

function showBatches() {
  openModal(function (close) {
    return el('div', { class: 'modal', style: 'width:460px' }, [
      el('div', { class: 'modal-t', text: 'ไฟล์ที่นำเข้าแล้ว' }),
      el('div', { style: 'display:flex;flex-direction:column;gap:8px' }, S.sales.batches.slice().reverse().map(function (batch) {
        return el('div', { class: 'row', style: 'font-size:13px;border-bottom:1px solid var(--surface2);padding-bottom:8px' }, [
          el('div', { style: 'flex:1;min-width:0' }, [
            el('div', { style: 'font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', text: batch.fileName }),
            el('div', { class: 'faint', style: 'font-size:11.5px', text: fmtDate(batch.importedAt) + ' · ' + batch.orderCount + ' ออร์เดอร์ · ' + fmtMoney(batch.total) + ' ฿' }),
          ]),
          el('button', {
            class: 'icon-btn danger', text: '🗑', title: 'ลบชุดข้อมูลนี้',
            onClick: function () {
              API.removeSalesBatch(batch.id).then(function (store) { S.sales = store; close(); render(); toast('ลบชุดข้อมูลแล้ว'); });
            },
          }),
        ]);
      })),
      el('div', { class: 'modal-actions' }, [el('button', { class: 'btn btn-primary', text: 'ปิด', onClick: close })]),
    ]);
  });
}

