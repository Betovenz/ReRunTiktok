/* Rerun Studio v11 — หน้าเข้าสู่ระบบ (License) */

/* ===================================================================== */
/* เข้าสู่ระบบ (License)                                                  */
/* ===================================================================== */
function viewLogin() {
  var code = el('input', { class: 'inp', placeholder: 'เช่น BMK-0001', autofocus: 'autofocus' });
  var user = el('input', { class: 'inp', placeholder: 'ชื่อผู้ใช้ (username)' });
  var pass = el('input', { class: 'inp', type: 'password', placeholder: 'รหัสผ่าน' });
  var errBox = el('div', { class: 'login-err hidden' });
  var submit = el('button', { class: 'btn btn-primary', style: 'height:48px;font-size:15px', text: 'เข้าสู่ระบบ' });

  var doLogin = function () {
    errBox.classList.add('hidden');
    if (!code.value.trim() || !user.value.trim() || !pass.value) {
      errBox.textContent = 'กรุณากรอกรหัสลูกค้า Username และ Password ให้ครบ';
      errBox.classList.remove('hidden');
      return;
    }
    busy(submit, 'กำลังตรวจสอบสิทธิ์…', function () {
      return API.licenseLogin({ customerCode: code.value.trim(), licenseKey: code.value.trim(), username: user.value.trim(), password: pass.value })
        .then(function (r) {
          if (r && r.licensed) { S.licensed = true; S.license = r; boot(); return; }
          errBox.textContent = (r && r.error) || 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง';
          errBox.classList.remove('hidden');
        });
    });
  };
  submit.addEventListener('click', doLogin);
  [code, user, pass].forEach(function (input) {
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
  });

  var eye = el('button', { class: 'pw-eye', text: '👁', title: 'แสดงรหัสผ่าน', onClick: function () {
    pass.type = pass.type === 'password' ? 'text' : 'password';
  } });

  return el('div', { class: 'login' }, [
    el('div', { class: 'login-card' }, [
      el('div', { class: 'login-brand' }, [
        el('div', { class: 'brand-mark', style: 'width:42px;height:42px;border-radius:13px;font-size:18px', text: 'R' }),
        el('div', {}, [
          el('div', { class: 'brand-name', style: 'font-size:18px' }, ['Rerun ', el('span', { text: 'Studio' })]),
          el('div', { class: 'brand-sub', text: 'เข้าสู่ระบบเพื่อเริ่มใช้งาน' }),
        ]),
      ]),
      el('label', { class: 'field-lbl' }, ['รหัสลูกค้า', code]),
      el('label', { class: 'field-lbl' }, ['Username', user]),
      el('label', { class: 'field-lbl' }, ['Password', el('div', { class: 'pw-wrap' }, [pass, eye])]),
      errBox,
      submit,
      el('div', { class: 'faint', style: 'font-size:11.5px;line-height:1.6;text-align:center', text: 'ใช้รหัสลูกค้า Username และ Password จากหลังบ้าน LiveBMKode · ระบบจดจำการเข้าสู่ระบบไว้บนเครื่องนี้แบบเข้ารหัส' }),
    ]),
  ]);
}

