'use strict';
const crypto = require('crypto');
const path = require('path');
const express = require('express');
const C = require('../../js/catalog.js');
const V = require('./validate');
const { ApiError, bad } = require('./errors');
const { makeClock } = require('./time');
const { createNotifier } = require('./notifier');
const { createService } = require('./service');
const { DEMO_CUSTOMER } = require('./seed');

const ROLE_ALIAS = { owner: 'owner', manager: 'branch_manager', branch_manager: 'branch_manager', cashier: 'cashier', therapist: 'therapist' };
const SESSION_MS = 12 * 3600 * 1000;
const hash = t => crypto.createHash('sha256').update(t).digest('hex');
const ROOT = path.join(__dirname, '..', '..');

/* สิทธิ์ของแต่ละบทบาท (บังคับที่เซิร์ฟเวอร์เสมอ ไม่ขึ้นกับหน้าจอ) */
const PERMS = {
  owner:          { dashboard: 'all',  checkout: true,  manage: true,  walkin: true,  start: 'any', admin: true,  branches: 'all' },
  branch_manager: { dashboard: 'own',  checkout: true,  manage: true,  walkin: true,  start: 'any', admin: false, branches: 'own' },
  cashier:        { dashboard: null,   checkout: true,  manage: true,  walkin: true,  start: 'any', admin: false, branches: 'own' },
  therapist:      { dashboard: null,   checkout: false, manage: false, walkin: false, start: 'own', admin: false, branches: 'own' }
};

function createApp(opts) {
  opts = opts || {};
  const db = opts.db, clock = opts.clock || makeClock();
  const notifier = opts.notifier || createNotifier({ db, clock, log: opts.log });
  const S = createService({ db, clock, notifier });
  const demoLogin = opts.demoLogin !== false;
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);

  /* ----- CORS: อนุญาตเฉพาะ localhost และโดเมนที่ตั้งไว้เอง ----- */
  const allowed = (opts.corsOrigins || []).map(s => s.trim()).filter(Boolean);
  app.use((req, res, next) => {
    const o = req.headers.origin;
    if (o && (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o) || allowed.includes(o))) {
      res.set('Access-Control-Allow-Origin', o); res.set('Vary', 'Origin');
      res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type'); res.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use(express.json({ limit: '20kb' }));

  /* ----- จำกัดอัตราแบบง่าย (หน่วยความจำ) ----- */
  const hits = new Map();
  const limiter = (max, windowMs) => (req, res, next) => {
    if (opts.noRateLimit) return next();
    const k = req.ip + '|' + req.path.slice(0, 30), now = Date.now(); const h = hits.get(k);
    if (!h || now - h.t > windowMs) { hits.set(k, { t: now, n: 1 }); return next(); }
    if (++h.n > max) return next(new ApiError(429, 'rate_limited', 'ส่งคำขอถี่เกินไป กรุณารอสักครู่'));
    next();
  };
  setInterval(() => { const n = Date.now(); for (const [k, v] of hits) if (n - v.t > 120000) hits.delete(k); }, 60000).unref();
  const wrap = fn => (req, res, next) => { try { const r = fn(req, res, next); if (r && typeof r.catch === 'function') r.catch(next); } catch (e) { next(e); } };

  /* ----- ยืนยันตัวตน ----- */
  function newSession(kind, userId, customerId) {
    const token = crypto.randomBytes(24).toString('hex'); const now = clock.nowMs();
    db.prepare('INSERT INTO sessions(token_hash,kind,user_id,customer_id,created_at,expires_at) VALUES (?,?,?,?,?,?)').run(hash(token), kind, userId || null, customerId || null, now, now + SESSION_MS);
    return token;
  }
  function authenticate(req, res, next) {
    const m = /^Bearer ([a-f0-9]{48})$/.exec(req.headers.authorization || '');
    req.auth = null;
    if (m) {
      const s = db.prepare('SELECT * FROM sessions WHERE token_hash=?').get(hash(m[1]));
      if (s && s.expires_at > clock.nowMs()) {
        if (s.kind === 'staff') {
          const u = db.prepare('SELECT * FROM users WHERE id=?').get(s.user_id);
          if (u) req.auth = { kind: 'staff', token: m[1], user: Object.assign({}, u, { actor: { kind: 'staff', id: u.id, role: u.role, branch: u.branch_id } }) };
        } else {
          const c = db.prepare('SELECT * FROM customers WHERE id=?').get(s.customer_id);
          if (c) req.auth = { kind: 'customer', token: m[1], customer: c, actor: { kind: 'customer', id: c.id, role: 'customer', branch: null } };
        }
      }
    }
    next();
  }
  app.use('/api', authenticate);
  const needStaff = (req) => { if (!req.auth || req.auth.kind !== 'staff') throw new ApiError(401, 'unauthenticated', 'กรุณาเข้าสู่ระบบ'); return req.auth.user; };
  const needCustomer = (req) => { if (!req.auth || req.auth.kind !== 'customer') throw new ApiError(401, 'unauthenticated', 'กรุณาเข้าสู่ระบบ'); return req.auth.customer; };
  const deny = (user, what, detail) => { S.audit(user.actor, 'permission.denied', 'api', what, detail, false); return new ApiError(403, 'forbidden', 'บทบาทนี้ไม่มีสิทธิ์ทำรายการนี้'); };
  const need = (req, perm) => { const u = needStaff(req); if (!PERMS[u.role][perm]) throw deny(u, perm, { path: req.path }); return u; };
  /* ตรวจว่าผู้ใช้เข้าถึงสาขานี้ได้ไหม */
  const branchOK = (u, branch) => { if (PERMS[u.role].branches === 'all') return true; return u.branch_id === branch; };
  const needBranch = (u, branch, req) => { if (!branchOK(u, branch)) throw deny(u, 'branch:' + branch, { path: req.path }); };
  const bookingFor = (u, id, req) => { // คิวต้องอยู่สาขาที่เข้าถึงได้ (หมอนวดเฉพาะคิวตัวเอง)
    const b = S.getBooking(String(id)); if (!b) throw new ApiError(404, 'not_found', 'ไม่พบคิวนี้');
    if (!branchOK(u, b.branch_id)) throw deny(u, 'booking:' + b.id, { path: req.path });
    if (u.role === 'therapist' && b.therapist_id !== u.therapist_id) throw deny(u, 'booking:' + b.id, { path: req.path });
    return b;
  };

  /* ----- สุขภาพ/ข้อมูลสาธารณะ ----- */
  app.get('/api/health', (req, res) => res.json({ ok: true, today: clock.today(), notifierTransport: notifier.transport(), demoLogin }));
  app.get('/api/public/catalog', (req, res) => res.json(S.catalog()));
  app.get('/api/public/availability', limiter(120, 60000), wrap((req, res) => res.json({ slots: S.slots(req.query) })));

  /* ----- ลูกค้า (จุดแทน LIFF login ของ LINE) ----- */
  app.post('/api/customer/session', limiter(30, 60000), wrap((req, res) => {
    if (!demoLogin) throw new ApiError(404, 'disabled', 'ปิดการเข้าสู่ระบบเดโม');
    const token = newSession('customer', null, DEMO_CUSTOMER);
    S.audit({ kind: 'customer', id: DEMO_CUSTOMER, role: 'customer' }, 'auth.customer-demo-login', 'customer', DEMO_CUSTOMER);
    res.json({ token, customer: S.customerMe(DEMO_CUSTOMER).customer });
  }));
  app.get('/api/me', wrap((req, res) => { const c = needCustomer(req); res.json(S.customerMe(c.id)); }));
  app.post('/api/me/bookings', limiter(30, 60000), wrap((req, res) => { const c = needCustomer(req); res.status(201).json({ booking: S.createLineBooking(req.body, c.id, req.auth.actor) }); }));
  app.post('/api/me/bookings/:id/cancel', wrap((req, res) => { const c = needCustomer(req); res.json({ booking: S.cancelBooking(req.params.id, req.auth.actor, c.id) }); }));

  /* ----- เข้าสู่ระบบพนักงาน (เดโม: เลือกบทบาท ได้โทเคน — ของจริงต้องมีรหัสผ่าน/PIN) ----- */
  app.post('/api/auth/demo-login', limiter(30, 60000), wrap((req, res) => {
    if (!demoLogin) throw new ApiError(404, 'disabled', 'ปิดการเข้าสู่ระบบเดโม');
    const b = V.obj(req.body); const role = ROLE_ALIAS[b.role];
    if (!role) throw bad('invalid_role', 'บทบาทไม่ถูกต้อง');
    const branch = b.branch == null ? 'bkk' : V.oneOf(b.branch, C.BRANCHES.map(x => x.id), 'branch');
    let u;
    if (role === 'owner') u = db.prepare("SELECT * FROM users WHERE role='owner'").get();
    else if (role === 'therapist') {
      const tid = b.therapist == null ? branch + '-1' : String(b.therapist);
      u = db.prepare("SELECT * FROM users WHERE role='therapist' AND branch_id=? AND therapist_id=?").get(branch, tid);
      if (!u) throw bad('invalid_therapist', 'ไม่พบหมอนวด');
    } else u = db.prepare('SELECT * FROM users WHERE role=? AND branch_id=?').get(role, branch);
    const token = newSession('staff', u.id);
    S.audit({ kind: 'staff', id: u.id, role: u.role, branch: u.branch_id }, 'auth.demo-login', 'user', u.id);
    res.json({ token, user: publicUser(u) });
  }));
  const publicUser = u => ({ id: u.id, name: u.name, role: u.role, branch: u.branch_id, therapistId: u.therapist_id,
    therapistName: u.therapist_id ? (C.THERAPISTS.find(t => t.id === u.therapist_id) || {}).name : null, permissions: PERMS[u.role] });
  app.get('/api/auth/me', wrap((req, res) => { const u = needStaff(req); res.json({ user: publicUser(u) }); }));
  app.post('/api/auth/logout', wrap((req, res) => {
    if (req.auth) { db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(req.auth.token)); S.audit(req.auth.kind === 'staff' ? req.auth.user.actor : req.auth.actor, 'auth.logout'); }
    res.json({ ok: true });
  }));

  /* ----- POS ----- */
  app.get('/api/pos/snapshot', wrap((req, res) => {
    const u = needStaff(req); const branch = V.oneOf(req.query.branch || u.branch_id, C.BRANCHES.map(b => b.id), 'branch'); needBranch(u, branch, req);
    res.json(S.snapshot(branch, u));
  }));
  app.post('/api/pos/walkins', limiter(60, 60000), wrap((req, res) => {
    const u = need(req, 'walkin'); const body = V.obj(req.body); needBranch(u, body.branch, req);
    res.status(201).json({ booking: S.createWalkin(body, u) });
  }));
  app.post('/api/pos/bookings/:id/start', wrap((req, res) => {
    const u = needStaff(req); bookingFor(u, req.params.id, req); res.json({ booking: S.startBooking(req.params.id, u) });
  }));
  app.post('/api/pos/bookings/:id/fast-forward', wrap((req, res) => {
    const u = needStaff(req); bookingFor(u, req.params.id, req); res.json({ booking: S.fastForward(req.params.id, u) });
  }));
  app.patch('/api/pos/bookings/:id', wrap((req, res) => {
    const u = need(req, 'manage'); bookingFor(u, req.params.id, req); res.json({ booking: S.patchBooking(req.params.id, req.body, u) });
  }));
  app.post('/api/pos/bookings/:id/cancel', wrap((req, res) => {
    const u = need(req, 'manage'); bookingFor(u, req.params.id, req); res.json({ booking: S.cancelBooking(req.params.id, u.actor) });
  }));
  app.post('/api/pos/bookings/:id/checkout', wrap((req, res) => {
    const u = need(req, 'checkout'); bookingFor(u, req.params.id, req); res.json(S.checkout(req.params.id, req.body, u));
  }));

  /* ----- แดชบอร์ด (เจ้าของ: ทุกสาขา · ผู้จัดการ: สาขาตัวเอง · อื่น ๆ: ไม่มีสิทธิ์) ----- */
  app.get('/api/dashboard', wrap((req, res) => {
    const u = need(req, 'dashboard'); const period = V.oneOf(req.query.period || 'today', ['today', '7d'], 'period');
    const all = C.BRANCHES.map(b => b.id); let scope;
    if (PERMS[u.role].dashboard === 'all') { const b = req.query.branch || 'all'; scope = b === 'all' ? all : [V.oneOf(b, all, 'branch')]; }
    else { if (req.query.branch && req.query.branch !== 'all' && req.query.branch !== u.branch_id) throw deny(u, 'branch:' + req.query.branch, { path: req.path }); scope = [u.branch_id]; }
    res.json(S.dashboard(period, scope));
  }));

  /* ----- ผู้ดูแลระบบ (เจ้าของเท่านั้น) ----- */
  app.post('/api/admin/reset-demo', wrap((req, res) => { const u = need(req, 'admin'); S.resetDemo(u.actor); res.json({ ok: true }); }));
  app.get('/api/admin/notifications', wrap((req, res) => {
    need(req, 'admin'); const lim = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const rows = db.prepare('SELECT id,ts,channel,kind,recipient,body,status FROM notifications ORDER BY id DESC LIMIT ?').all(lim);
    res.json({ transport: notifier.transport(), notifications: rows });
  }));
  app.get('/api/admin/audit', wrap((req, res) => {
    need(req, 'admin'); const lim = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    res.json({ audit: db.prepare('SELECT id,ts,actor_kind,actor_id,role,branch_id,action,entity,entity_id,detail,ok FROM audit_log ORDER BY id DESC LIMIT ?').all(lim) });
  }));
  app.post('/api/admin/jobs/reminders', wrap((req, res) => { need(req, 'admin'); res.json({ queued: notifier.queueReminders() }); }));
  app.post('/api/admin/jobs/nightly-summary', wrap((req, res) => { need(req, 'admin'); res.json({ queued: notifier.queueNightlySummary(req.body && req.body.day ? V.day(req.body.day) : undefined) }); }));
  app.all('/api/*', (req, res, next) => next(new ApiError(404, 'not_found', 'ไม่พบ API นี้')));

  /* ----- ไฟล์หน้าเว็บ (ถ้าเปิดใช้) : เสิร์ฟหน้าเดโมจากเซิร์ฟเวอร์เดียวกัน ----- */
  if (opts.serveStatic !== false) {
    app.get('/js/config.js', (req, res) => { res.type('js').send('window.RL_CONFIG={serverUrl:location.origin,servedByApi:true};'); });
    app.get('/', (req, res) => res.sendFile(path.join(ROOT, 'index.html')));
    ['customer', 'shop', 'css', 'js', 'assets', 'fonts'].forEach(d => app.use('/' + d, express.static(path.join(ROOT, d))));
    app.get('/favicon.svg', (req, res) => res.sendFile(path.join(ROOT, 'favicon.svg')));
  }

  /* ----- จัดการข้อผิดพลาด ----- */
  app.use((err, req, res, next) => { // eslint-disable-line
    if (err instanceof ApiError) return res.status(err.status).json({ error: err.code, message: err.message });
    if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid_json', message: 'ข้อมูล JSON ไม่ถูกต้อง' });
    if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'too_large', message: 'ข้อมูลใหญ่เกินไป' });
    if (opts.log) opts.log('[error] ' + (err && err.stack || err));
    res.status(500).json({ error: 'server_error', message: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' });
  });
  return { app, db, clock, notifier, service: S };
}
module.exports = { createApp, PERMS };
