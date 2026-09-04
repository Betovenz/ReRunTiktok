let token = localStorage.getItem('LiveBMKode:adminToken') || '';
let adminData = { packages: [], customers: [], announcements: [], stats: {} };
let currentPage = localStorage.getItem('LiveBMKode:adminPage') || 'overview';
let adminSearchTerm = '';
let searchPanelOpen = false;
let adminTheme = localStorage.getItem('LiveBMKode:theme') || 'dark';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char]));
}

function authHeaders(extra = {}) {
  return token ? { authorization: `Bearer ${token}`, ...extra } : extra;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: authHeaders({ 'content-type': 'application/json', ...(options.headers || {}) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) throw new Error(payload.message || 'เกิดข้อผิดพลาด');
  return payload.data;
}

function showLogin(visible) {
  $('#adminLogin').hidden = !visible;
  $('#adminShell').hidden = visible;
}

function showLoginMessage(message, danger = false) {
  const el = $('#adminLoginMessage');
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('danger', danger);
}

function packageName(packageId) {
  return adminData.packages.find((item) => item.id === packageId)?.name || '-';
}

function money(value) {
  return Number(value || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 });
}

function asDate(value) {
  if (!value) return null;
  const date = typeof value === 'number' ? new Date(value) : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function formatDate(value) {
  const date = asDate(value);
  if (!date) return '-';
  return date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function localDateKey(value) {
  const date = asDate(value);
  if (!date) return '';
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function daysLeft(customer) {
  if (!customer?.expireDate) return null;
  const end = new Date(`${customer.expireDate}T23:59:59`);
  if (!Number.isFinite(end.getTime())) return null;
  return Math.ceil((end.getTime() - Date.now()) / 86400000);
}

function customerPackage(customer) {
  return customer.package || adminData.packages.find((pkg) => pkg.id === customer.packageId) || null;
}

function customerRevenue(customer) {
  return Number(customerPackage(customer)?.price || 0);
}

function isCustomerExpired(customer) {
  const left = daysLeft(customer);
  return left !== null && left < 0;
}

function isCustomerActive(customer) {
  return customer.status !== 'disabled' && !isCustomerExpired(customer);
}

function dashboardMetrics(customers = adminData.customers, packages = adminData.packages, announcements = adminData.announcements) {
  const activeCustomers = customers.filter(isCustomerActive);
  const disabledCustomers = customers.filter((customer) => customer.status === 'disabled');
  const expiredCustomers = customers.filter((customer) => customer.status !== 'disabled' && isCustomerExpired(customer));
  const expiringCustomers = customers.filter((customer) => {
    const left = daysLeft(customer);
    return customer.status !== 'disabled' && left !== null && left >= 0 && left <= 7;
  });
  return {
    customers: customers.length,
    activeCustomers: activeCustomers.length,
    disabledCustomers: disabledCustomers.length,
    expiredCustomers: expiredCustomers.length,
    expiringCustomers: expiringCustomers.length,
    packages: packages.length,
    activeAnnouncements: announcements.filter((item) => item.active !== false).length,
    assignedChannels: customers.reduce((sum, customer) => sum + Number(customer.channelLimit || customerPackage(customer)?.channelLimit || 0), 0),
    packageRevenue: customers.reduce((sum, customer) => sum + customerRevenue(customer), 0),
  };
}

function percent(value, total) {
  if (!total) return 0;
  return Math.round((Number(value || 0) / total) * 100);
}

function emptyCard(message) {
  return `<div class="empty-card">${escapeHtml(message)}</div>`;
}

function applyTheme() {
  adminTheme = adminTheme === 'light' ? 'light' : 'dark';
  document.body.dataset.theme = adminTheme;
  const icon = $('#themeIcon');
  const label = $('#themeLabel');
  if (icon) icon.textContent = adminTheme === 'light' ? '☀' : '☾';
  if (label) label.textContent = adminTheme === 'light' ? 'โหมดสว่าง' : 'โหมดมืด';
}

function toggleTheme() {
  adminTheme = adminTheme === 'light' ? 'dark' : 'light';
  localStorage.setItem('LiveBMKode:theme', adminTheme);
  applyTheme();
}

function activePageLabel() {
  return {
    overview: ['ภาพรวมระบบ', 'สรุปข้อมูลทั้งหมด'],
    customers: ['ลูกค้า', 'จัดการรหัสลูกค้า username และแพ็กเกจ'],
    packages: ['แพ็กเกจ', 'จัดการราคา จำนวนช่อง และอายุการใช้งาน'],
    announcements: ['ประกาศเข้าแอป', 'แจ้งเตือน หมดอายุ โปรโมชั่น หรือข้อความสำคัญ'],
  }[currentPage] || ['ภาพรวมระบบ', 'สรุปข้อมูลทั้งหมด'];
}

function normalizeSearch(value) {
  return String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function searchText(item = {}) {
  return Object.values(item).map((value) => {
    if (value && typeof value === 'object') return searchText(value);
    return String(value ?? '');
  }).join(' ').toLowerCase();
}

const searchAliases = {
  ลูกค้า: ['customer', 'client', 'user', 'username', 'ผู้ใช้', 'สมาชิก', 'รหัสลูกค้า', 'login', 'ล็อกอิน'],
  user: ['ลูกค้า', 'customer', 'username', 'ผู้ใช้', 'รหัสลูกค้า', 'login'],
  username: ['user', 'ลูกค้า', 'ชื่อผู้ใช้', 'login'],
  customer: ['ลูกค้า', 'client', 'user', 'username', 'รหัสลูกค้า'],
  รหัส: ['code', 'customer code', 'รหัสลูกค้า', 'login', 'password'],
  รหัสลูกค้า: ['customer code', 'code', 'ลูกค้า', 'login'],
  login: ['ล็อกอิน', 'username', 'password', 'รหัสลูกค้า', 'ลูกค้า'],
  password: ['รหัสผ่าน', 'เปลี่ยนรหัสผ่าน', 'ยืนยันรหัสผ่านใหม่'],
  รหัสผ่าน: ['password', 'เปลี่ยนรหัสผ่าน', 'login'],
  แพ็กเกจ: ['package', 'plan', 'ราคา', 'ช่อง', 'โควต้า', 'quota', 'วัน'],
  package: ['แพ็กเกจ', 'plan', 'price', 'channels', 'quota'],
  ราคา: ['price', 'แพ็กเกจ', 'บาท', 'ขาย'],
  ช่อง: ['channel', 'channels', 'quota', 'โควต้า', 'แพ็กเกจ'],
  channel: ['ช่อง', 'channels', 'quota', 'package'],
  quota: ['โควต้า', 'ช่อง', 'แพ็กเกจ', 'limit'],
  หมดอายุ: ['expire', 'expired', 'expiry', 'ใกล้หมดอายุ', 'วันหมดอายุ', 'ลูกค้า'],
  expire: ['หมดอายุ', 'expired', 'expiry', 'ใกล้หมดอายุ'],
  active: ['ใช้งาน', 'เปิด', 'ลูกค้าใช้งาน', 'ประกาศเปิดอยู่'],
  disabled: ['ปิด', 'ระงับ', 'ไม่ใช้งาน'],
  ประกาศ: ['announcement', 'แจ้งเตือน', 'โปรโมชัน', 'promotion', 'promo', 'message'],
  announcement: ['ประกาศ', 'แจ้งเตือน', 'promotion', 'promo', 'message'],
  แจ้งเตือน: ['ประกาศ', 'announcement', 'warning', 'หมดอายุ'],
  โปรโมชัน: ['promotion', 'promo', 'ประกาศ'],
};

function expandedSearchTerms() {
  const raw = normalizeSearch(adminSearchTerm);
  if (!raw) return [];
  const terms = new Set([raw, ...raw.split(' ').filter(Boolean)]);
  for (const term of Array.from(terms)) {
    for (const [key, aliases] of Object.entries(searchAliases)) {
      if (term.includes(key) || key.includes(term)) {
        aliases.forEach((alias) => terms.add(normalizeSearch(alias)));
      }
    }
  }
  return Array.from(terms).filter(Boolean);
}

function matchesSearch(item) {
  const terms = expandedSearchTerms();
  if (!terms.length) return true;
  const haystack = normalizeSearch(searchText(item));
  return terms.some((term) => haystack.includes(term));
}

function customerSearchRecord(customer) {
  const pkg = customerPackage(customer);
  const left = daysLeft(customer);
  const usage = `${customer.channelUsage || 0}/${customer.channelLimit || pkg?.channelLimit || 0}`;
  const statusWords = [
    customer.status || 'active',
    isCustomerActive(customer) ? 'ใช้งาน active' : '',
    customer.status === 'disabled' ? 'ปิด disabled ระงับ' : '',
    left !== null && left < 0 ? 'หมดอายุ expired' : '',
    left !== null && left >= 0 && left <= 7 ? 'ใกล้หมดอายุ expiring' : '',
  ].join(' ');
  return {
    type: 'customer',
    page: 'customers',
    id: customer.id,
    label: 'ลูกค้า',
    title: customer.name || customer.username || customer.customerCode || 'ลูกค้า',
    detail: `${customer.customerCode || '-'} · ${customer.username || '-'} · ${pkg?.name || '-'} · ช่อง ${usage}`,
    keywords: [
      'ลูกค้า customer user username รหัสลูกค้า login member',
      customer.customerCode,
      customer.username,
      customer.name,
      pkg?.name,
      pkg?.code,
      usage,
      customer.expireDate,
      statusWords,
      customer.note,
    ],
  };
}

function packageSearchRecord(pkg) {
  const buyerCount = adminData.customers.filter((customer) => customer.packageId === pkg.id).length;
  return {
    type: 'package',
    page: 'packages',
    id: pkg.id,
    label: 'แพ็กเกจ',
    title: pkg.name || pkg.code || 'แพ็กเกจ',
    detail: `${pkg.code || '-'} · ${money(pkg.price)} บาท · ${pkg.channelLimit} ช่อง · ${buyerCount} ลูกค้า`,
    keywords: [
      'แพ็กเกจ package plan ราคา price ช่อง quota limit ขายดี',
      pkg.code,
      pkg.name,
      pkg.description,
      pkg.price,
      pkg.channelLimit,
      pkg.durationDays,
      pkg.active === false ? 'ปิด disabled' : 'เปิด active ใช้งาน',
      buyerCount ? 'มีลูกค้า ขายแล้ว' : '',
    ],
  };
}

function announcementSearchRecord(item) {
  return {
    type: 'announcement',
    page: 'announcements',
    id: item.id,
    label: 'ประกาศ',
    title: item.title || 'ประกาศ',
    detail: `${item.type || 'info'} · ${item.active === false ? 'ปิด' : 'เปิด'} · ${item.startsAt || 'ทันที'} - ${item.endsAt || 'ไม่กำหนด'}`,
    keywords: [
      'ประกาศ announcement แจ้งเตือน โปรโมชัน promotion promo message หมดอายุ warning',
      item.title,
      item.message,
      item.type,
      item.startsAt,
      item.endsAt,
      item.active === false ? 'ปิด disabled' : 'เปิด active แสดงอยู่',
    ],
  };
}

function pageSearchRecords() {
  return [
    {
      type: 'page',
      page: 'overview',
      id: 'overview',
      label: 'เมนู',
      title: 'ภาพรวมระบบ',
      detail: 'แดชบอร์ด กราฟ สรุปลูกค้า แพ็กเกจขายดี และประกาศที่เปิดอยู่',
      keywords: ['dashboard overview กราฟ สรุป ภาพรวม รายงาน ลูกค้า แพ็กเกจ ประกาศ ขายดี'],
    },
    {
      type: 'page',
      page: 'customers',
      id: 'customers',
      label: 'เมนู',
      title: 'ลูกค้า',
      detail: 'เพิ่มลูกค้า แก้ไขข้อมูล รหัสลูกค้า username แพ็กเกจ วันหมดอายุ และเปลี่ยนรหัสผ่าน',
      keywords: ['customer user client ลูกค้า เพิ่มลูกค้า แก้ลูกค้า รหัสลูกค้า username login password รหัสผ่าน เปลี่ยนรหัสผ่าน หมดอายุ'],
    },
    {
      type: 'page',
      page: 'packages',
      id: 'packages',
      label: 'เมนู',
      title: 'แพ็กเกจ',
      detail: 'เพิ่มแพ็กเกจ แก้ราคา จำนวนช่อง โควต้า และอายุการใช้งาน',
      keywords: ['package plan แพ็กเกจ ราคา price ช่อง channel quota โควต้า วัน อายุการใช้งาน'],
    },
    {
      type: 'page',
      page: 'announcements',
      id: 'announcements',
      label: 'เมนู',
      title: 'ประกาศเข้าแอป',
      detail: 'แจ้งเตือน โปรโมชัน ข้อความสำคัญ เริ่มแสดง และหยุดแสดงในหน้าแอป',
      keywords: ['announcement ประกาศ แจ้งเตือน notification โปรโมชัน promotion promo message ข้อความ เริ่มแสดง หยุดแสดง'],
    },
  ];
}

function searchRecordText(record) {
  return normalizeSearch([record.label, record.title, record.detail, ...(record.keywords || [])].join(' '));
}

function searchScore(record, terms) {
  const text = searchRecordText(record);
  const title = normalizeSearch(record.title);
  const detail = normalizeSearch(record.detail);
  return terms.reduce((score, term) => {
    if (!term) return score;
    if (title === term) return score + 80;
    if (title.includes(term)) return score + 45;
    if (detail.includes(term)) return score + 28;
    if (text.includes(term)) return score + 14;
    return score;
  }, 0);
}

function globalSearchResults() {
  const terms = expandedSearchTerms();
  if (!terms.length) return [];
  const records = [
    ...pageSearchRecords(),
    ...adminData.customers.map(customerSearchRecord),
    ...adminData.packages.map(packageSearchRecord),
    ...adminData.announcements.map(announcementSearchRecord),
  ];
  return records
    .map((record) => ({ ...record, score: searchScore(record, terms) }))
    .filter((record) => record.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'th'))
    .slice(0, 12);
}

function renderGlobalSearch() {
  const panel = $('#globalSearchPanel');
  if (!panel) return;
  const term = normalizeSearch(adminSearchTerm);
  if (!term || !searchPanelOpen) {
    panel.hidden = true;
    panel.innerHTML = '';
    return;
  }
  const results = globalSearchResults();
  panel.hidden = false;
  panel.innerHTML = `
    <div class="global-search-head">
      <b>ผลการค้นหา</b>
      <span>${results.length ? `${results.length} รายการที่เกี่ยวข้อง` : 'ไม่พบข้อมูลที่เกี่ยวข้อง'}</span>
    </div>
    <div class="global-search-list">
      ${results.length ? results.map((item) => `
        <button type="button" data-search-page="${escapeHtml(item.page)}" data-search-term="${escapeHtml(adminSearchTerm)}">
          <span>${escapeHtml(item.label)}</span>
          <b>${escapeHtml(item.title)}</b>
          <small>${escapeHtml(item.detail)}</small>
        </button>
      `).join('') : '<div class="global-search-empty">ลองค้นด้วยรหัสลูกค้า username ชื่อแพ็กเกจ ราคา จำนวนช่อง สถานะ หรือข้อความประกาศ</div>'}
    </div>
  `;
}

function filteredPackages() {
  return adminData.packages.filter(matchesSearch);
}

function filteredCustomers() {
  return adminData.customers.filter(matchesSearch);
}

function filteredAnnouncements() {
  return adminData.announcements.filter(matchesSearch);
}

function compactItem(title, detail, meta = '') {
  return `
    <article class="compact-item">
      <div><b>${escapeHtml(title)}</b><small>${escapeHtml(detail)}</small></div>
      <span>${escapeHtml(meta)}</span>
    </article>
  `;
}

function chartRow(title, detail, value, total, meta = '') {
  const width = Math.max(4, percent(value, total));
  return `
    <article class="chart-row">
      <div class="chart-row-head">
        <div><b>${escapeHtml(title)}</b><small>${escapeHtml(detail)}</small></div>
        <span>${escapeHtml(meta || value)}</span>
      </div>
      <div class="bar-track"><i style="width: ${width}%"></i></div>
    </article>
  `;
}

function renderStats() {
  const metrics = dashboardMetrics();
  const items = [
    ['ลูกค้าทั้งหมด', metrics.customers],
    ['ลูกค้าใช้งาน', metrics.activeCustomers],
    ['ใกล้หมดอายุ', metrics.expiringCustomers],
    ['ช่องที่ขาย', metrics.assignedChannels],
    ['มูลค่าแพ็กเกจ', `${money(metrics.packageRevenue)} บาท`],
  ];
  $('#adminStats').innerHTML = items.map(([label, value]) => `
    <article class="stat-card"><span>${label}</span><b>${value}</b></article>
  `).join('');
  $('#navOverviewCount').textContent = metrics.customers + metrics.packages + metrics.activeAnnouncements;
  $('#navCustomersCount').textContent = metrics.customers;
  $('#navPackagesCount').textContent = metrics.packages;
  $('#navAnnouncementsCount').textContent = metrics.activeAnnouncements;
}

function renderPackageOptions() {
  const options = adminData.packages.map((pkg) => `
    <option value="${escapeHtml(pkg.id)}">${escapeHtml(pkg.name)} · ${pkg.channelLimit} ช่อง</option>
  `).join('');
  $('#adminCustomerPackage').innerHTML = options;
  $('#editCustomerPackage').innerHTML = options;
}

function renderPackages() {
  const packages = filteredPackages();
  $('#packageResultText').textContent = `${packages.length}/${adminData.packages.length} รายการ`;
  $('#packageRows').innerHTML = packages.length ? packages.map((pkg) => `
    <tr>
      <td><b>${escapeHtml(pkg.name)}</b><small>${escapeHtml(pkg.code)} · ${escapeHtml(pkg.description || '')}</small></td>
      <td>${money(pkg.price)}</td>
      <td>${pkg.channelLimit}</td>
      <td>${pkg.durationDays || '-'}</td>
      <td><span class="badge ${pkg.active ? '' : 'off'}">${pkg.active ? 'เปิด' : 'ปิด'}</span></td>
      <td><div class="row-actions"><button data-edit-package="${escapeHtml(pkg.id)}">แก้</button><button class="danger" data-delete-package="${escapeHtml(pkg.id)}">ลบ</button></div></td>
    </tr>
  `).join('') : '<tr><td class="empty-row" colspan="6">ไม่พบแพ็กเกจตามคำค้นหา</td></tr>';
}

function renderCustomers() {
  const customers = filteredCustomers();
  $('#customerResultText').textContent = `${customers.length}/${adminData.customers.length} รายการ`;
  $('#customerRows').innerHTML = customers.length ? customers.map((customer) => `
    <tr>
      <td><b>${escapeHtml(customer.customerCode || '-')}</b></td>
      <td><b>${escapeHtml(customer.username || '-')}</b></td>
      <td>${escapeHtml(customer.name || '-')}</td>
      <td>${escapeHtml(customer.package?.name || packageName(customer.packageId))}</td>
      <td>${customer.channelUsage || 0}/${customer.channelLimit || customer.package?.channelLimit || 0}</td>
      <td>${escapeHtml(customer.expireDate || '-')}</td>
      <td><span class="badge ${customer.status === 'disabled' ? 'off' : ''}">${escapeHtml(customer.status || 'active')}</span></td>
      <td><div class="row-actions"><button data-edit-customer="${escapeHtml(customer.id)}" data-customer-code="${escapeHtml(customer.customerCode || '')}" data-customer-username="${escapeHtml(customer.username || '')}" data-customer-name="${escapeHtml(customer.name || '')}">แก้</button><button class="danger" data-delete-customer="${escapeHtml(customer.id)}">ลบ</button></div></td>
    </tr>
  `).join('') : '<tr><td class="empty-row" colspan="8">ไม่พบลูกค้าตามคำค้นหา</td></tr>';
}

function renderAnnouncements() {
  const announcements = filteredAnnouncements();
  $('#announcementResultText').textContent = `${announcements.length}/${adminData.announcements.length} รายการ`;
  $('#announcementRows').innerHTML = announcements.length ? announcements.map((item) => `
    <tr>
      <td><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.message)}</small></td>
      <td>${escapeHtml(item.type || 'info')}</td>
      <td>${escapeHtml(item.startsAt || 'ทันที')} - ${escapeHtml(item.endsAt || 'ไม่กำหนด')}</td>
      <td><span class="badge ${item.active === false ? 'off' : ''}">${item.active === false ? 'ปิด' : 'เปิด'}</span></td>
      <td><div class="row-actions"><button data-edit-announcement="${escapeHtml(item.id)}">แก้</button><button class="danger" data-delete-announcement="${escapeHtml(item.id)}">ลบ</button></div></td>
    </tr>
  `).join('') : '<tr><td class="empty-row" colspan="5">ไม่พบประกาศตามคำค้นหา</td></tr>';
}

function renderDashboard() {
  const customers = filteredCustomers();
  const packages = filteredPackages();
  const announcements = filteredAnnouncements();
  const metrics = dashboardMetrics(customers, packages, announcements);
  const packageStats = packages.map((pkg) => {
    const buyers = customers.filter((customer) => customer.packageId === pkg.id);
    return {
      pkg,
      count: buyers.length,
      revenue: buyers.reduce((sum, customer) => sum + customerRevenue(customer), 0),
    };
  }).filter((item) => item.count > 0).sort((a, b) => b.count - a.count || b.revenue - a.revenue);
  const maxPackageCount = Math.max(...packageStats.map((item) => item.count), 0);
  $('#packageChart').innerHTML = packageStats.length
    ? packageStats.map((item, index) => chartRow(
      `${index + 1}. ${item.pkg.name}`,
      `${item.pkg.code} · ${money(item.revenue)} บาท`,
      item.count,
      maxPackageCount,
      `${item.count} ลูกค้า`,
    )).join('')
    : emptyCard('ยังไม่มีแพ็กเกจที่ถูกขาย');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const signupDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const key = localDateKey(date);
    const count = customers.filter((customer) => {
      const created = asDate(customer.createdAt) || asDate(customer.startDate);
      return localDateKey(created) === key;
    }).length;
    return { date, count };
  });
  const maxSignup = Math.max(...signupDays.map((item) => item.count), 1);
  $('#signupChart').innerHTML = `
    <div class="trend-bars">
      ${signupDays.map((item) => `
        <article class="trend-day">
          <div class="trend-bar"><i style="height: ${Math.max(4, percent(item.count, maxSignup))}%"></i></div>
          <b>${item.count}</b>
          <span>${item.date.toLocaleDateString('th-TH', { weekday: 'short', day: '2-digit' })}</span>
        </article>
      `).join('')}
    </div>
  `;

  const healthRows = [
    ['ใช้งาน', metrics.activeCustomers, metrics.customers],
    ['ใกล้หมดอายุ', metrics.expiringCustomers, metrics.customers],
    ['หมดอายุ', metrics.expiredCustomers, metrics.customers],
    ['ปิดใช้งาน', metrics.disabledCustomers, metrics.customers],
  ];
  $('#customerHealth').innerHTML = healthRows.map(([label, value, total]) => chartRow(label, `${percent(value, total)}%`, value, total, value)).join('');

  const expiring = customers
    .map((customer) => ({ customer, left: daysLeft(customer) }))
    .filter((item) => item.customer.status !== 'disabled' && item.left !== null && item.left <= 7)
    .sort((a, b) => a.left - b.left)
    .slice(0, 6);
  $('#expiringCustomers').innerHTML = expiring.length
    ? expiring.map(({ customer, left }) => {
      const title = customer.name || customer.username;
      const detail = `${customer.customerCode} · ${customerPackage(customer)?.name || '-'} · หมดอายุ ${formatDate(customer.expireDate)}`;
      const meta = left < 0 ? 'หมดอายุ' : `${left} วัน`;
      return compactItem(title, detail, meta);
    }).join('')
    : emptyCard('ไม่มีลูกค้าใกล้หมดอายุ');

  const activeAnnouncements = announcements.filter((item) => item.active !== false).slice(0, 6);
  $('#announcementStatus').innerHTML = activeAnnouncements.length
    ? activeAnnouncements.map((item) => compactItem(item.title, item.message, item.type || 'info')).join('')
    : emptyCard('ไม่มีประกาศที่เปิดอยู่');
}

function renderPageShell() {
  const [title, eyebrow] = activePageLabel();
  $('#pageTitle').textContent = title;
  $('#pageEyebrow').textContent = eyebrow;
  $$('.admin-page').forEach((page) => page.classList.toggle('active', page.id === `page-${currentPage}`));
  $$('[data-admin-page]').forEach((button) => button.classList.toggle('active', button.dataset.adminPage === currentPage));
  const search = $('#adminSearch');
  if (search) {
    search.placeholder = currentPage === 'overview'
      ? 'ค้นหาลูกค้า แพ็กเกจ ประกาศ...'
      : `ค้นหา${title}...`;
  }
}

function render() {
  renderPageShell();
  renderStats();
  renderGlobalSearch();
  renderDashboard();
  renderPackageOptions();
  renderPackages();
  renderCustomers();
  renderAnnouncements();
}

function setAdminPage(page) {
  currentPage = ['overview', 'customers', 'packages', 'announcements'].includes(page) ? page : 'overview';
  localStorage.setItem('LiveBMKode:adminPage', currentPage);
  render();
}

async function loadOverview() {
  adminData = await api('/api/admin/overview');
  showLogin(false);
  render();
}

async function restoreSession() {
  if (!token) return showLogin(true);
  try {
    await api('/api/admin/session');
    await loadOverview();
  } catch {
    token = '';
    localStorage.removeItem('LiveBMKode:adminToken');
    showLogin(true);
  }
}

function resetPackageForm() {
  $('#packageForm').reset();
  $('#packageId').value = '';
  $('#packagePrice').value = 0;
  $('#packageChannelLimit').value = 20;
  $('#packageDurationDays').value = 30;
  $('#packageActive').checked = true;
}

function resetCustomerForm() {
  $('#customerForm').reset();
  $('#customerId').value = '';
  $('#adminCustomerPassword').required = true;
  $('#adminCustomerPackage').value = adminData.packages[0]?.id || '';
  $('#adminCustomerStatus').value = 'active';
}

function resetAnnouncementForm() {
  $('#announcementForm').reset();
  $('#announcementId').value = '';
  $('#announcementType').value = 'info';
  $('#announcementActive').checked = true;
}

function editPackage(id) {
  const pkg = adminData.packages.find((item) => item.id === id);
  if (!pkg) return;
  $('#packageId').value = pkg.id;
  $('#packageCode').value = pkg.code || '';
  $('#packageName').value = pkg.name || '';
  $('#packagePrice').value = pkg.price || 0;
  $('#packageChannelLimit').value = pkg.channelLimit || 20;
  $('#packageDurationDays').value = pkg.durationDays || 30;
  $('#packageDescription').value = pkg.description || '';
  $('#packageActive').checked = pkg.active !== false;
}

function tableCells(row) {
  return Array.from(row?.querySelectorAll('td') || []).map((td) => td.textContent.replace(/\s+/g, ' ').trim());
}

function editCustomer(id, trigger = null) {
  const customer = adminData.customers.find((item) => item.id === id);
  if (!customer) return;
  const row = trigger?.closest ? trigger.closest('tr') : trigger;
  const cells = tableCells(row);
  const customerCode = customer.customerCode || trigger?.dataset?.customerCode || cells[0] || '';
  const username = customer.username || trigger?.dataset?.customerUsername || cells[1] || '';
  const name = customer.name || trigger?.dataset?.customerName || cells[2] || '';
  $('#customerEditMessage').textContent = '';
  $('#customerEditMessage').classList.remove('danger');
  $('#customerEditTitle').textContent = name || username || customerCode || 'ลูกค้า';
  $('#editCustomerId').value = customer.id;
  $('#editCustomerCode').value = customerCode;
  $('#editCustomerName').value = name;
  $('#editCustomerUsername').value = username;
  $('#editCustomerPackage').value = customer.packageId || adminData.packages[0]?.id || '';
  $('#editCustomerStatus').value = customer.status || 'active';
  $('#editCustomerStart').value = customer.startDate || '';
  $('#editCustomerExpire').value = customer.expireDate || '';
  $('#editCustomerNote').value = customer.note || '';
  $('#editCustomerPassword').value = '';
  $('#editCustomerPasswordConfirm').value = '';
  const dialog = $('#customerEditDialog');
  dialog.hidden = false;
  dialog.classList.add('is-open');
}

function closeCustomerEditDialog() {
  const dialog = $('#customerEditDialog');
  dialog.classList.remove('is-open');
  dialog.hidden = true;
}

function showCustomerEditMessage(message, danger = false) {
  const el = $('#customerEditMessage');
  el.textContent = message || '';
  el.classList.toggle('danger', Boolean(danger));
}

function editAnnouncement(id) {
  const item = adminData.announcements.find((candidate) => candidate.id === id);
  if (!item) return;
  $('#announcementId').value = item.id;
  $('#announcementTitle').value = item.title || '';
  $('#announcementType').value = item.type || 'info';
  $('#announcementMessage').value = item.message || '';
  $('#announcementStartsAt').value = item.startsAt || '';
  $('#announcementEndsAt').value = item.endsAt || '';
  $('#announcementActive').checked = item.active !== false;
}

$('#adminLoginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  showLoginMessage('กำลังเข้าสู่ระบบ...');
  try {
    const data = await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        username: $('#adminUsername').value,
        password: $('#adminPassword').value,
      }),
    });
    token = data.token;
    localStorage.setItem('LiveBMKode:adminToken', token);
    await loadOverview();
  } catch (error) {
    showLoginMessage(error.message, true);
  }
});

$('#adminLogout').addEventListener('click', async () => {
  await fetch('/api/admin/logout', { method: 'POST', headers: authHeaders() }).catch(() => undefined);
  token = '';
  localStorage.removeItem('LiveBMKode:adminToken');
  showLogin(true);
});

$('#themeToggle')?.addEventListener('click', toggleTheme);

$('#packageForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = $('#packageId').value;
  const body = {
    code: $('#packageCode').value,
    name: $('#packageName').value,
    price: Number($('#packagePrice').value || 0),
    channelLimit: Number($('#packageChannelLimit').value || 20),
    durationDays: Number($('#packageDurationDays').value || 30),
    description: $('#packageDescription').value,
    active: $('#packageActive').checked,
  };
  await api(id ? `/api/admin/packages/${id}` : '/api/admin/packages', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(body) });
  resetPackageForm();
  await loadOverview();
});

$('#customerForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const body = {
    customerCode: $('#adminCustomerCode').value,
    name: $('#adminCustomerName').value,
    username: $('#adminCustomerUsername').value,
    password: $('#adminCustomerPassword').value,
    packageId: $('#adminCustomerPackage').value,
    status: $('#adminCustomerStatus').value,
    startDate: $('#adminCustomerStart').value,
    expireDate: $('#adminCustomerExpire').value,
    note: $('#adminCustomerNote').value,
  };
  await api('/api/admin/customers', { method: 'POST', body: JSON.stringify(body) });
  resetCustomerForm();
  await loadOverview();
});

$('#customerEditForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = $('#editCustomerId').value;
  const password = $('#editCustomerPassword').value;
  const passwordConfirm = $('#editCustomerPasswordConfirm').value;
  if ((password || passwordConfirm) && password !== passwordConfirm) {
    showCustomerEditMessage('รหัสผ่านใหม่และช่องยืนยันต้องตรงกัน', true);
    return;
  }
  const body = {
    customerCode: $('#editCustomerCode').value,
    name: $('#editCustomerName').value,
    username: $('#editCustomerUsername').value,
    packageId: $('#editCustomerPackage').value,
    status: $('#editCustomerStatus').value,
    startDate: $('#editCustomerStart').value,
    expireDate: $('#editCustomerExpire').value,
    note: $('#editCustomerNote').value,
  };
  if (password) {
    body.password = password;
    body.passwordConfirm = passwordConfirm;
  }
  try {
    await api(`/api/admin/customers/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    closeCustomerEditDialog();
    await loadOverview();
  } catch (error) {
    showCustomerEditMessage(error.message, true);
  }
});

$('#announcementForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = $('#announcementId').value;
  const body = {
    title: $('#announcementTitle').value,
    type: $('#announcementType').value,
    message: $('#announcementMessage').value,
    startsAt: $('#announcementStartsAt').value,
    endsAt: $('#announcementEndsAt').value,
    active: $('#announcementActive').checked,
  };
  await api(id ? `/api/admin/announcements/${id}` : '/api/admin/announcements', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(body) });
  resetAnnouncementForm();
  await loadOverview();
});

document.body.addEventListener('click', async (event) => {
  const target = event.target.closest('button');
  if (!target) return;
  if (target.dataset.adminPage) return setAdminPage(target.dataset.adminPage);
  if (target.dataset.searchPage) {
    adminSearchTerm = target.dataset.searchTerm || adminSearchTerm;
    searchPanelOpen = false;
    const search = $('#adminSearch');
    if (search) {
      search.value = adminSearchTerm;
      search.blur();
    }
    return setAdminPage(target.dataset.searchPage);
  }
  if (target.dataset.resetForm === 'package') return resetPackageForm();
  if (target.dataset.resetForm === 'customer') return resetCustomerForm();
  if (target.dataset.resetForm === 'announcement') return resetAnnouncementForm();
  if (target.dataset.editPackage) return editPackage(target.dataset.editPackage);
  if (target.dataset.editCustomer) return editCustomer(target.dataset.editCustomer, target);
  if (target.dataset.editAnnouncement) return editAnnouncement(target.dataset.editAnnouncement);
  if (target.hasAttribute('data-close-customer-edit')) return closeCustomerEditDialog();
  if (target.dataset.deletePackage && confirm('ลบแพ็กเกจนี้?')) {
    await api(`/api/admin/packages/${target.dataset.deletePackage}`, { method: 'DELETE' });
    return loadOverview();
  }
  if (target.dataset.deleteCustomer && confirm('ลบลูกค้านี้?')) {
    await api(`/api/admin/customers/${target.dataset.deleteCustomer}`, { method: 'DELETE' });
    return loadOverview();
  }
  if (target.dataset.deleteAnnouncement && confirm('ลบประกาศนี้?')) {
    await api(`/api/admin/announcements/${target.dataset.deleteAnnouncement}`, { method: 'DELETE' });
    return loadOverview();
  }
});

$('#customerEditDialog')?.addEventListener('click', (event) => {
  if (event.target === event.currentTarget) closeCustomerEditDialog();
});

$('#adminSearch')?.addEventListener('input', (event) => {
  adminSearchTerm = event.target.value || '';
  searchPanelOpen = Boolean(adminSearchTerm.trim());
  render();
});

$('#adminSearch')?.addEventListener('focus', () => {
  searchPanelOpen = Boolean(adminSearchTerm.trim());
  renderGlobalSearch();
});

$('#adminSearch')?.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  adminSearchTerm = '';
  searchPanelOpen = false;
  event.currentTarget.value = '';
  render();
});

applyTheme();
restoreSession();
