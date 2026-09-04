'use strict';

// AdminWEB - หน้าจัดการลูกค้าและแพ็กเกจของ LiveBMKode แบบแยกโปรเจกต์
// ต่อ MongoDB Atlas ตัวเดียวกับแอปหลัก จึงเห็นข้อมูลชุดเดียวกันเสมอ

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const dns = require('node:dns');
const { spawn } = require('node:child_process');

const root = __dirname;
const publicDir = path.join(root, 'public');

// อ่าน .env เองแบบเบา ๆ ไม่ต้องพึ่ง dependency ค่าที่ตั้งไว้ใน environment จริงมาก่อนเสมอ
function loadDotEnv() {
  let raw = '';
  try {
    raw = fs.readFileSync(path.join(root, '.env'), 'utf8');
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i.exec(line);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
  }
}
loadDotEnv();

// Render และ hosting เจ้าอื่นกำหนดพอร์ตมาให้ทาง PORT ส่วนเครื่องตัวเองใช้ ADMIN_PORT
const port = Number(process.env.PORT || process.env.ADMIN_PORT || 4140);
// รันบน hosting จะไม่มีเบราว์เซอร์ให้เปิด และต้องผูกทุก interface ไม่ใช่แค่ localhost
const hosted = Boolean(process.env.PORT || process.env.RENDER || process.env.NODE_ENV === 'production');
const mongoUri = process.env.MONGODB_URI || '';
const mongoDbName = process.env.MONGODB_DB || 'livebmkode';

if (!mongoUri) {
  console.error('');
  console.error('  ไม่พบ MONGODB_URI');
  console.error('  AdminWEB ต้องต่อ MongoDB Atlas ถึงจะทำงานได้');
  console.error('');
  console.error('  วิธีแก้ คัดลอกไฟล์ .env จากโปรเจกต์ rerun_tiktok_bmkode มาไว้ในโฟลเดอร์นี้');
  console.error('');
  process.exit(1);
}

let MongoClient = null;
try {
  ({ MongoClient } = require('mongodb'));
} catch {
  console.error('ไม่พบแพ็กเกจ mongodb ให้รัน npm install ในโฟลเดอร์นี้ก่อน');
  process.exit(1);
}

const authCollections = ['admins', 'packages', 'customers', 'announcements', 'adminSessions', 'customerSessions'];
const sessionCollections = new Set(['adminSessions', 'customerSessions']);

let authDb = {
  admins: [],
  packages: [],
  customers: [],
  announcements: [],
  adminSessions: [],
  customerSessions: [],
};
let mongoClient = null;
let mongoDb = null;
let mongoSynced = {};

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function id(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

function passwordDigest(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password || ''), salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, record = {}) {
  if (!record.passwordHash || !record.passwordSalt) return false;
  const { hash } = passwordDigest(password, record.passwordSalt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(record.passwordHash, 'hex'));
}

function defaultPackage() {
  return {
    id: 'pkg_rerun_20_channels',
    code: 'RERUN20',
    name: 'Rerun 20 Channels',
    price: 0,
    channelLimit: 20,
    durationDays: 30,
    description: 'แพ็กเกจขึ้นรีรันได้สูงสุด 20 ช่อง',
    active: true,
    createdAt: Date.now(),
  };
}

function normalizeAuthDb(source = {}) {
  const next = {
    admins: Array.isArray(source.admins) ? source.admins : [],
    packages: Array.isArray(source.packages) ? source.packages : [],
    customers: Array.isArray(source.customers) ? source.customers : [],
    announcements: Array.isArray(source.announcements) ? source.announcements : [],
    adminSessions: Array.isArray(source.adminSessions) ? source.adminSessions : [],
    customerSessions: Array.isArray(source.customerSessions) ? source.customerSessions : [],
  };
  if (!next.packages.length) next.packages.push(defaultPackage());
  if (!next.admins.length) {
    const digest = passwordDigest(process.env.LIVEBMKODE_ADMIN_PASSWORD || 'LiveBMKode@2026');
    next.admins.push({
      id: 'admin_root',
      name: 'LiveBMKode Admin',
      username: process.env.LIVEBMKODE_ADMIN_USER || 'admin',
      passwordSalt: digest.salt,
      passwordHash: digest.hash,
      role: 'owner',
      active: true,
      createdAt: Date.now(),
    });
  }
  const now = Date.now();
  next.adminSessions = next.adminSessions.filter((item) => Date.parse(item.expiresAt || '') > now);
  next.customerSessions = next.customerSessions.filter((item) => Date.parse(item.expiresAt || '') > now);
  return next;
}

// เอกสารใน Mongo ใช้ _id เป็น id เดิม และเก็บ expiresAt เป็น Date จริงเพื่อให้ TTL index ทำงาน
function toMongoDoc(item, key) {
  const doc = { ...item };
  delete doc._id;
  if (sessionCollections.has(key)) {
    const parsed = Date.parse(doc.expiresAt || '');
    if (Number.isFinite(parsed)) doc.expiresAt = new Date(parsed);
  }
  return { _id: item.id, ...doc };
}

function fromMongoDoc(doc) {
  const item = { ...doc, id: doc._id };
  delete item._id;
  if (item.expiresAt instanceof Date) item.expiresAt = item.expiresAt.toISOString();
  return item;
}

async function loadAuthDb() {
  mongoClient = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 15000 });
  try {
    await mongoClient.connect();
  } catch (error) {
    // DNS ของเราเตอร์/ผู้ให้บริการบางรายตอบปฏิเสธ SRV แม้ nslookup ปกติจะใช้งานได้
    // ลอง public DNS เฉพาะกรณีนี้ โดยไม่แก้ DNS ของ Windows ทั้งเครื่อง
    const dnsRefused = error?.code === 'ECONNREFUSED' || error?.cause?.code === 'ECONNREFUSED';
    if (!mongoUri.startsWith('mongodb+srv://') || !dnsRefused) throw error;
    await mongoClient.close().catch(() => {});
    dns.setServers(['1.1.1.1', '8.8.8.8']);
    console.log('  DNS เดิมปฏิเสธ MongoDB SRV กำลังลอง Cloudflare/Google DNS...');
    mongoClient = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 15000 });
    await mongoClient.connect();
  }
  mongoDb = mongoClient.db(mongoDbName);
  await mongoDb.command({ ping: 1 });

  const source = {};
  for (const key of authCollections) {
    source[key] = (await mongoDb.collection(key).find({}).toArray()).map(fromMongoDoc);
  }
  authDb = normalizeAuthDb(source);
  mongoSynced = {};
  await saveAuthDb();
}

async function saveAuthDb() {
  for (const key of authCollections) {
    const rows = (Array.isArray(authDb[key]) ? authDb[key] : []).filter((row) => row && row.id);
    const fingerprint = JSON.stringify(rows);
    if (mongoSynced[key] === fingerprint) continue;
    const collection = mongoDb.collection(key);
    if (rows.length) {
      await collection.bulkWrite(rows.map((row) => ({
        replaceOne: { filter: { _id: row.id }, replacement: toMongoDoc(row, key), upsert: true },
      })), { ordered: false });
    }
    await collection.deleteMany(rows.length ? { _id: { $nin: rows.map((row) => row.id) } } : {});
    mongoSynced[key] = fingerprint;
  }
}

function bearerToken(req) {
  const header = String(req.headers.authorization || '');
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : '';
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function createSession(adminId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const record = {
    id: id('asess'),
    tokenHash: tokenHash(token),
    adminId,
    createdAt: Date.now(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
  };
  authDb.adminSessions.push(record);
  return { token, record };
}

function createCustomerSession(customer, machineId = '') {
  const token = crypto.randomBytes(32).toString('base64url');
  const customerExpiry = customerExpiresAtMs(customer);
  const fallbackExpiry = Date.now() + 1000 * 60 * 60 * 24 * 14;
  const expiresAtMs = customerExpiry > 0 ? Math.min(customerExpiry, fallbackExpiry) : fallbackExpiry;
  const record = {
    id: id('csess'),
    tokenHash: tokenHash(token),
    customerId: customer.id,
    machineId: String(machineId || '').trim(),
    createdAt: Date.now(),
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
  authDb.customerSessions.push(record);
  return { token, record };
}

function adminOwner(req) {
  const hash = tokenHash(bearerToken(req));
  if (!hash) return null;
  const now = Date.now();
  const session = authDb.adminSessions.find((item) => item.tokenHash === hash && Date.parse(item.expiresAt || '') > now);
  const admin = session ? authDb.admins.find((item) => item.id === session.adminId && item.active !== false) : null;
  return admin ? { session, admin } : null;
}

function packageById(packageId) {
  return authDb.packages.find((item) => item.id === packageId) || null;
}

function publicPackage(pkg, { includePrice = false } = {}) {
  if (!pkg) return null;
  const payload = {
    id: pkg.id,
    code: pkg.code || '',
    name: pkg.name || '',
    channelLimit: Math.max(0, Number(pkg.channelLimit || 0)),
    durationDays: Math.max(0, Number(pkg.durationDays || 0)),
    description: pkg.description || '',
    active: pkg.active !== false,
  };
  if (includePrice) payload.price = Number(pkg.price || 0);
  return payload;
}

// จำนวนช่องที่ใช้จริงเก็บอยู่ใน data/state.json ของเครื่องลูกค้าแต่ละคน ไม่ได้อยู่บน MongoDB
// AdminWEB จึงรายงาน channelUsage เป็น 0 เสมอ ดูตัวเลขจริงได้จากแอปหลักในเครื่องนั้น
function publicCustomer(customer, { includeAdmin = false } = {}) {
  const pkg = packageById(customer.packageId);
  const payload = {
    id: customer.id,
    customerCode: customer.customerCode || '',
    name: customer.name || '',
    username: customer.username || '',
    packageId: customer.packageId || '',
    package: publicPackage(pkg, { includePrice: includeAdmin }),
    status: customer.status || 'active',
    startDate: customer.startDate || '',
    expireDate: customer.expireDate || '',
    note: includeAdmin ? (customer.note || '') : undefined,
    channelUsage: 0,
    channelLimit: Math.max(0, Number(pkg?.channelLimit || 0)),
    createdAt: customer.createdAt || Date.now(),
    updatedAt: customer.updatedAt || null,
  };
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

function customerExpiresAtMs(customer) {
  if (!customer?.expireDate) return 0;
  const end = Date.parse(`${customer.expireDate}T23:59:59`);
  return Number.isFinite(end) ? end : 0;
}

function customerPlanName(customer) {
  const pkg = packageById(customer.packageId);
  return pkg?.name || pkg?.code || 'standard';
}

function customerLicensePayload(customer) {
  return {
    displayName: customer.name || customer.username || customer.customerCode || 'LiveBMKode User',
    plan: customerPlanName(customer),
    expiresAt: customerExpiresAtMs(customer),
  };
}

function customerLicenseError(customer) {
  if (!customer) return 'รหัสลูกค้า Username หรือ Password ไม่ถูกต้อง';
  if (customer.status === 'disabled') return 'บัญชีนี้ถูกปิดใช้งาน';
  if (customerExpired(customer)) return 'สิทธิ์ใช้งานหมดอายุ';
  return '';
}

function publicLicenseUser(customer) {
  const payload = customerLicensePayload(customer);
  return {
    username: customer.username || '',
    displayName: payload.displayName,
    plan: payload.plan,
    licenseKey: customer.customerCode || '',
    expiresAt: payload.expiresAt || null,
    machineLimit: 1,
    disabled: customer.status === 'disabled',
    createdAt: customer.createdAt || Date.now(),
  };
}

function customerDaysLeft(customer) {
  if (!customer?.expireDate) return null;
  const end = Date.parse(`${customer.expireDate}T23:59:59`);
  if (!Number.isFinite(end)) return null;
  return Math.ceil((end - Date.now()) / 86400000);
}

function customerExpired(customer) {
  const daysLeft = customerDaysLeft(customer);
  return daysLeft !== null && daysLeft < 0;
}

function publicAdmin(admin) {
  return {
    id: admin.id,
    name: admin.name || '',
    username: admin.username || '',
    role: admin.role || 'admin',
  };
}

function json(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

function bad(res, status, message) {
  json(res, status, { ok: false, message });
}

async function bodyJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function handleApi(req, res, url) {
  try {
    if (req.method === 'POST' && url.pathname === '/api/login') {
      const body = await bodyJson(req);
      const username = String(body.username || '').trim().toLowerCase();
      const customerCode = String(body.customerCode || body.licenseKey || '').trim().toLowerCase();
      const customer = authDb.customers.find((item) => (
        String(item.username || '').trim().toLowerCase() === username
        && String(item.customerCode || '').trim().toLowerCase() === customerCode
      ));
      const licenseError = customerLicenseError(customer);
      if (licenseError || !verifyPassword(body.password, customer)) return json(res, 401, { ok: false, error: licenseError || 'รหัสลูกค้า Username หรือ Password ไม่ถูกต้อง' });
      const session = createCustomerSession(customer, body.machineId);
      await saveAuthDb();
      return json(res, 200, { ok: true, token: session.token, ...customerLicensePayload(customer) });
    }

    if (req.method === 'POST' && url.pathname === '/api/validate') {
      const body = await bodyJson(req);
      const hash = tokenHash(body.token);
      const machineId = String(body.machineId || '').trim();
      const now = Date.now();
      const session = authDb.customerSessions.find((item) => (
        item.tokenHash === hash
        && Date.parse(item.expiresAt || '') > now
        && (!item.machineId || !machineId || item.machineId === machineId)
      ));
      const customer = session ? authDb.customers.find((item) => item.id === session.customerId) : null;
      const licenseError = customerLicenseError(customer);
      if (!session || licenseError) {
        authDb.customerSessions = authDb.customerSessions.filter((item) => item.tokenHash !== hash);
        await saveAuthDb();
        return json(res, 401, { ok: false, error: licenseError || 'session หมดอายุ กรุณาเข้าสู่ระบบใหม่' });
      }
      return json(res, 200, { ok: true, token: String(body.token || ''), ...customerLicensePayload(customer) });
    }

    if (req.method === 'GET' && url.pathname === '/api/announcements') {
      const now = Date.now();
      const items = authDb.announcements
        .filter((item) => {
          if (item.active === false) return false;
          const startsAt = item.startsAt ? Date.parse(item.startsAt) : 0;
          const endsAt = item.endsAt ? Date.parse(item.endsAt) : 0;
          if (startsAt && Number.isFinite(startsAt) && startsAt > now) return false;
          if (endsAt && Number.isFinite(endsAt) && endsAt < now) return false;
          return true;
        })
        .map((item) => ({
          id: item.id,
          kind: item.type || 'info',
          text: [item.title, item.message].filter(Boolean).join(' - ') || 'ประกาศ',
        }));
      return json(res, 200, { ok: true, items });
    }

    if (req.method === 'POST' && url.pathname === '/api/admin/login') {
      const body = await bodyJson(req);
      const username = String(body.username || '').trim().toLowerCase();
      const admin = authDb.admins.find((item) => String(item.username || '').trim().toLowerCase() === username && item.active !== false);
      if (!admin || !verifyPassword(body.password, admin)) return bad(res, 401, 'ชื่อผู้ใช้หรือรหัสผ่านแอดมินไม่ถูกต้อง');
      const session = createSession(admin.id);
      await saveAuthDb();
      return json(res, 200, { ok: true, data: { token: session.token, admin: publicAdmin(admin) } });
    }

    if (req.method === 'GET' && url.pathname === '/api/admin/session') {
      const owner = adminOwner(req);
      if (!owner) return bad(res, 401, 'กรุณาเข้าสู่ระบบแอดมิน');
      return json(res, 200, { ok: true, data: { admin: publicAdmin(owner.admin) } });
    }

    if (req.method === 'POST' && url.pathname === '/api/admin/logout') {
      const hash = tokenHash(bearerToken(req));
      authDb.adminSessions = authDb.adminSessions.filter((item) => item.tokenHash !== hash);
      await saveAuthDb();
      return json(res, 200, { ok: true });
    }

    if (!url.pathname.startsWith('/api/admin/')) return bad(res, 404, 'Not found');

    const owner = adminOwner(req);
    if (!owner) return bad(res, 401, 'กรุณาเข้าสู่ระบบแอดมิน');

    if (req.method === 'PUT' && url.pathname === '/api/admin/user') {
      const body = await bodyJson(req);
      const username = String(body.username || '').trim().toLowerCase();
      const customerCode = String(body.customerCode || body.licenseKey || '').trim();
      if (!username || !body.password || !customerCode) return json(res, 400, { ok: false, error: 'ต้องระบุรหัสลูกค้า, username และ password' });
      let customer = authDb.customers.find((item) => String(item.username || '').trim().toLowerCase() === username);
      if (!customer && authDb.customers.some((item) => String(item.customerCode || '').trim().toLowerCase() === customerCode.toLowerCase())) {
        return json(res, 409, { ok: false, error: 'รหัสลูกค้านี้ถูกใช้แล้ว' });
      }
      const pkg = authDb.packages.find((item) => (
        String(item.code || '').trim().toLowerCase() === String(body.plan || '').trim().toLowerCase()
        || String(item.name || '').trim().toLowerCase() === String(body.plan || '').trim().toLowerCase()
      )) || authDb.packages.find((item) => item.active !== false) || authDb.packages[0] || defaultPackage();
      const expiresAt = typeof body.expiresAt === 'number' && body.expiresAt > 0 ? new Date(body.expiresAt) : null;
      const expireDate = expiresAt ? expiresAt.toISOString().slice(0, 10) : '';
      const digest = passwordDigest(body.password);
      if (customer) {
        customer.customerCode = customerCode;
        customer.name = String(body.displayName || '').trim() || customer.name || username;
        customer.packageId = pkg.id;
        customer.status = 'active';
        customer.expireDate = expireDate;
        customer.passwordSalt = digest.salt;
        customer.passwordHash = digest.hash;
        customer.updatedAt = Date.now();
      } else {
        customer = {
          id: id('cust'),
          customerCode,
          name: String(body.displayName || '').trim() || username,
          username,
          passwordSalt: digest.salt,
          passwordHash: digest.hash,
          packageId: pkg.id,
          status: 'active',
          startDate: new Date().toISOString().slice(0, 10),
          expireDate,
          note: 'สร้างจาก Rerun Studio admin API compatibility',
          createdAt: Date.now(),
        };
        authDb.customers.unshift(customer);
      }
      await saveAuthDb();
      return json(res, 200, { ok: true, user: publicLicenseUser(customer) });
    }

    if (req.method === 'GET' && url.pathname === '/api/admin/user') {
      const username = String(url.searchParams.get('username') || '').trim().toLowerCase();
      const customer = authDb.customers.find((item) => String(item.username || '').trim().toLowerCase() === username);
      if (!customer) return json(res, 404, { ok: false, error: 'ไม่พบผู้ใช้' });
      return json(res, 200, { ok: true, user: publicLicenseUser(customer) });
    }

    if (req.method === 'DELETE' && url.pathname === '/api/admin/user') {
      const username = String(url.searchParams.get('username') || '').trim().toLowerCase();
      const customer = authDb.customers.find((item) => String(item.username || '').trim().toLowerCase() === username);
      if (!customer) return json(res, 404, { ok: false, error: 'ไม่พบผู้ใช้' });
      customer.status = 'disabled';
      authDb.customerSessions = authDb.customerSessions.filter((item) => item.customerId !== customer.id);
      await saveAuthDb();
      return json(res, 200, { ok: true });
    }

    if (req.method === 'GET' && url.pathname === '/api/admin/users') {
      return json(res, 200, { ok: true, users: authDb.customers.map(publicLicenseUser) });
    }

    if (req.method === 'GET' && url.pathname === '/api/admin/overview') {
      return json(res, 200, {
        ok: true,
        data: {
          packages: authDb.packages.map((item) => publicPackage(item, { includePrice: true })),
          customers: authDb.customers.map((item) => publicCustomer(item, { includeAdmin: true })),
          announcements: authDb.announcements,
          stats: {
            customers: authDb.customers.length,
            activeCustomers: authDb.customers.filter((item) => item.status !== 'disabled' && !customerExpired(item)).length,
            packages: authDb.packages.length,
            announcements: authDb.announcements.filter((item) => item.active !== false).length,
            appChannels: 0,
            appRuns: 0,
          },
        },
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/admin/packages') {
      return json(res, 200, { ok: true, data: authDb.packages.map((item) => publicPackage(item, { includePrice: true })) });
    }
    if (req.method === 'POST' && url.pathname === '/api/admin/packages') {
      const body = await bodyJson(req);
      const pkg = {
        id: id('pkg'),
        code: String(body.code || '').trim() || `PKG${authDb.packages.length + 1}`,
        name: String(body.name || '').trim() || 'แพ็กเกจใหม่',
        price: Math.max(0, Number(body.price || 0)),
        channelLimit: Math.max(1, Number(body.channelLimit || 20)),
        durationDays: Math.max(0, Number(body.durationDays || 30)),
        description: String(body.description || '').trim(),
        active: body.active !== false,
        createdAt: Date.now(),
      };
      authDb.packages.unshift(pkg);
      await saveAuthDb();
      return json(res, 201, { ok: true, data: publicPackage(pkg, { includePrice: true }) });
    }
    if ((req.method === 'PUT' || req.method === 'PATCH') && url.pathname.startsWith('/api/admin/packages/')) {
      const pkg = authDb.packages.find((item) => item.id === url.pathname.split('/').pop());
      if (!pkg) return bad(res, 404, 'ไม่พบแพ็กเกจ');
      const body = await bodyJson(req);
      for (const key of ['code', 'name', 'description']) if (typeof body[key] === 'string') pkg[key] = body[key].trim();
      if (body.price !== undefined) pkg.price = Math.max(0, Number(body.price || 0));
      if (body.channelLimit !== undefined) pkg.channelLimit = Math.max(1, Number(body.channelLimit || 1));
      if (body.durationDays !== undefined) pkg.durationDays = Math.max(0, Number(body.durationDays || 0));
      if (body.active !== undefined) pkg.active = Boolean(body.active);
      pkg.updatedAt = Date.now();
      await saveAuthDb();
      return json(res, 200, { ok: true, data: publicPackage(pkg, { includePrice: true }) });
    }
    if (req.method === 'DELETE' && url.pathname.startsWith('/api/admin/packages/')) {
      const packageId = url.pathname.split('/').pop();
      if (authDb.customers.some((item) => item.packageId === packageId)) return bad(res, 409, 'แพ็กเกจนี้มีลูกค้าใช้อยู่ ให้ปิดใช้งานแทนการลบ');
      authDb.packages = authDb.packages.filter((item) => item.id !== packageId);
      await saveAuthDb();
      return json(res, 200, { ok: true });
    }

    if (req.method === 'POST' && url.pathname === '/api/admin/customers') {
      const body = await bodyJson(req);
      const username = String(body.username || '').trim();
      const customerCode = String(body.customerCode || '').trim();
      if (!customerCode || !username || !body.password) return bad(res, 400, 'กรุณากรอกรหัสลูกค้า username และ password');
      if (authDb.customers.some((item) => item.customerCode === customerCode || item.username === username)) return bad(res, 409, 'รหัสลูกค้าหรือ username ซ้ำ');
      const digest = passwordDigest(body.password);
      const customer = {
        id: id('cust'),
        customerCode,
        name: String(body.name || '').trim(),
        username,
        passwordSalt: digest.salt,
        passwordHash: digest.hash,
        packageId: body.packageId || authDb.packages[0]?.id || '',
        status: body.status || 'active',
        startDate: body.startDate || '',
        expireDate: body.expireDate || '',
        note: String(body.note || '').trim(),
        createdAt: Date.now(),
      };
      authDb.customers.unshift(customer);
      await saveAuthDb();
      return json(res, 201, { ok: true, data: publicCustomer(customer, { includeAdmin: true }) });
    }
    if ((req.method === 'PUT' || req.method === 'PATCH') && url.pathname.startsWith('/api/admin/customers/')) {
      const customer = authDb.customers.find((item) => item.id === url.pathname.split('/').pop());
      if (!customer) return bad(res, 404, 'ไม่พบลูกค้า');
      const body = await bodyJson(req);
      for (const key of ['customerCode', 'name', 'username', 'packageId', 'status', 'startDate', 'expireDate', 'note']) {
        if (body[key] !== undefined) customer[key] = String(body[key] || '').trim();
      }
      if (body.password) {
        if (body.passwordConfirm !== undefined && body.password !== body.passwordConfirm) return bad(res, 400, 'รหัสผ่านใหม่และช่องยืนยันต้องตรงกัน');
        const digest = passwordDigest(body.password);
        customer.passwordSalt = digest.salt;
        customer.passwordHash = digest.hash;
        authDb.customerSessions = authDb.customerSessions.filter((item) => item.customerId !== customer.id);
      }
      customer.updatedAt = Date.now();
      await saveAuthDb();
      return json(res, 200, { ok: true, data: publicCustomer(customer, { includeAdmin: true }) });
    }
    if (req.method === 'DELETE' && url.pathname.startsWith('/api/admin/customers/')) {
      const customerId = url.pathname.split('/').pop();
      authDb.customers = authDb.customers.filter((item) => item.id !== customerId);
      authDb.customerSessions = authDb.customerSessions.filter((item) => item.customerId !== customerId);
      await saveAuthDb();
      return json(res, 200, { ok: true });
    }

    if (req.method === 'POST' && url.pathname === '/api/admin/announcements') {
      const body = await bodyJson(req);
      const announcement = {
        id: id('ann'),
        title: String(body.title || '').trim() || 'ประกาศ',
        message: String(body.message || '').trim(),
        type: body.type || 'info',
        startsAt: body.startsAt || '',
        endsAt: body.endsAt || '',
        active: body.active !== false,
        createdAt: Date.now(),
      };
      authDb.announcements.unshift(announcement);
      await saveAuthDb();
      return json(res, 201, { ok: true, data: announcement });
    }
    if ((req.method === 'PUT' || req.method === 'PATCH') && url.pathname.startsWith('/api/admin/announcements/')) {
      const announcement = authDb.announcements.find((item) => item.id === url.pathname.split('/').pop());
      if (!announcement) return bad(res, 404, 'ไม่พบประกาศ');
      const body = await bodyJson(req);
      for (const key of ['title', 'message', 'type', 'startsAt', 'endsAt']) if (body[key] !== undefined) announcement[key] = String(body[key] || '').trim();
      if (body.active !== undefined) announcement.active = Boolean(body.active);
      announcement.updatedAt = Date.now();
      await saveAuthDb();
      return json(res, 200, { ok: true, data: announcement });
    }
    if (req.method === 'DELETE' && url.pathname.startsWith('/api/admin/announcements/')) {
      const announcementId = url.pathname.split('/').pop();
      authDb.announcements = authDb.announcements.filter((item) => item.id !== announcementId);
      await saveAuthDb();
      return json(res, 200, { ok: true });
    }

    return bad(res, 404, 'Not found');
  } catch (error) {
    console.error(error);
    bad(res, 500, error && error.message ? error.message : 'เกิดข้อผิดพลาด');
  }
}

async function serveStatic(res, pathname) {
  // ทุกเส้นทางที่ไม่ใช่ไฟล์จริงให้ตกมาที่หน้าแอดมิน AdminWEB มีหน้าเดียว
  const relative = pathname === '/' || pathname === '/admin' ? 'admin.html' : decodeURIComponent(pathname.slice(1));
  const filePath = path.resolve(publicDir, relative);
  if (!filePath.startsWith(publicDir)) return bad(res, 403, 'Forbidden');
  try {
    const data = await fsp.readFile(filePath);
    res.writeHead(200, {
      'content-type': mime[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      pragma: 'no-cache',
      expires: '0',
    });
    res.end(data);
  } catch {
    bad(res, 404, 'Not found');
  }
}

// เปิดเบราว์เซอร์ให้เองหลังเซิร์ฟเวอร์พร้อม ตั้ง ADMIN_OPEN=0 ถ้าไม่อยากให้เปิด
function openBrowser(target) {
  if (process.env.ADMIN_OPEN === '0') return;
  try {
    const opener = process.platform === 'win32'
      ? spawn('cmd', ['/c', 'start', '', target], { detached: true, stdio: 'ignore' })
      : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [target], { detached: true, stdio: 'ignore' });
    opener.on('error', () => {});
    opener.unref();
  } catch {
    // เปิดเองไม่ได้ก็ไม่เป็นไร ผู้ใช้พิมพ์ URL เองได้
  }
}

async function main() {
  try {
    await loadAuthDb();
  } catch (error) {
    console.error('');
    console.error('  เชื่อมต่อ MongoDB ไม่สำเร็จ');
    console.error(`  ${error && error.message ? error.message : error}`);
    console.error('');
    console.error('  เช็ค 2 อย่างนี้');
    console.error('  1 รหัสผ่านใน .env ถูกไหม');
    console.error('  2 IP เครื่องนี้อยู่ใน Network Access ของ Atlas หรือยัง');
    console.error('');
    process.exit(1);
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) return void handleApi(req, res, url);
    return void serveStatic(res, url.pathname);
  });

  server.listen(port, () => {
    console.log('');
    console.log('  LiveBMKode AdminWEB พร้อมใช้งาน');
    console.log(`  เปิดที่  http://localhost:${port}`);
    console.log(`  ข้อมูล   MongoDB ${mongoDbName}`);
    console.log(`  ลูกค้า   ${authDb.customers.length} ราย | แพ็กเกจ ${authDb.packages.length} รายการ`);
    console.log('');
    console.log('  ปิดหน้าต่างนี้เพื่อหยุดโปรแกรม');
    console.log('');
    openBrowser(`http://localhost:${port}/`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
