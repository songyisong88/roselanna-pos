'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { start } = require('./helpers');
const C = require('../../js/catalog.js');
const DAY = '2026-10-28';
const price = id => C.SERVICES.find(s => s.id === id).price;

async function book(t, tok, o) { const r = await t.call('POST', '/api/me/bookings', { token: tok, body: Object.assign({ branch: 'bkk', service: 'thai', day: DAY, start: 600, therapist: 'bkk-1' }, o || {}) }); assert.equal(r.status, 201, JSON.stringify(r.body)); return r.body.booking; }
const clear = t => t.db.prepare('DELETE FROM bookings WHERE day=?').run(DAY);
const clearToday = t => { t.db.prepare('UPDATE sales SET booking_id=NULL').run(); t.db.prepare('DELETE FROM bookings WHERE day=?').run(t.clock.today()); };

test('สิทธิ์: ไม่ล็อกอิน/โทเคนปลอม/โทเคนลูกค้า เข้าหน้าพนักงานไม่ได้', async () => {
  const t = await start(); try {
    for (const [m, p] of [['GET', '/api/pos/snapshot?branch=bkk'], ['GET', '/api/dashboard'], ['POST', '/api/pos/bookings/RL-1001/start'], ['POST', '/api/admin/reset-demo'], ['GET', '/api/auth/me']])
      assert.equal((await t.call(m, p)).status, 401, p);
    assert.equal((await t.call('GET', '/api/dashboard', { token: 'a'.repeat(48) })).status, 401);
    const ct = await t.customer();
    assert.equal((await t.call('GET', '/api/dashboard', { token: ct })).status, 401, 'โทเคนลูกค้าใช้กับ API พนักงานไม่ได้');
    assert.equal((await t.call('GET', '/api/pos/snapshot?branch=bkk', { token: ct })).status, 401);
    const st = await t.login('owner'); assert.equal((await t.call('GET', '/api/me', { token: st })).status, 401, 'โทเคนพนักงานใช้กับ API ลูกค้าไม่ได้');
    assert.equal((await t.call('POST', '/api/auth/demo-login', { body: { role: 'hacker' } })).status, 400);
  } finally { await t.close(); }
});

test('สิทธิ์: แดชบอร์ดตามบทบาท (เจ้าของ=ทุกสาขา, ผู้จัดการ=สาขาตัวเอง, แคชเชียร์/หมอนวด=ไม่มี)', async () => {
  const t = await start(); try {
    const owner = await t.login('owner'), mgr = await t.login('manager', { branch: 'cnx' }), cash = await t.login('cashier'), th = await t.login('therapist');
    const o = await t.call('GET', '/api/dashboard?period=today', { token: owner }); assert.equal(o.status, 200); assert.equal(o.body.perBranch.length, 3);
    assert.equal((await t.call('GET', '/api/dashboard?branch=hkt', { token: owner })).body.perBranch.length, 1);
    const m = await t.call('GET', '/api/dashboard', { token: mgr }); assert.equal(m.status, 200); assert.deepEqual(m.body.perBranch.map(x => x.id), ['cnx']);
    assert.equal((await t.call('GET', '/api/dashboard?branch=bkk', { token: mgr })).status, 403);
    assert.equal((await t.call('GET', '/api/dashboard?branch=all', { token: mgr })).status, 200, 'all ของผู้จัดการ = สาขาตัวเอง');
    assert.equal((await t.call('GET', '/api/dashboard', { token: cash })).status, 403);
    assert.equal((await t.call('GET', '/api/dashboard', { token: th })).status, 403);
    assert.equal((await t.call('GET', '/api/dashboard?period=year', { token: owner })).status, 400);
    const aud = await t.call('GET', '/api/admin/audit', { token: owner });
    assert.ok(aud.body.audit.filter(a => a.action === 'permission.denied' && a.ok === 0).length >= 3, 'การปฏิเสธถูกบันทึก');
  } finally { await t.close(); }
});

test('สิทธิ์: ข้ามสาขา, หมอนวด, และงานผู้ดูแล', async () => {
  const t = await start(); try {
    clear(t); const ct = await t.customer(); const b = await book(t, ct);
    const cashCnx = await t.login('cashier', { branch: 'cnx' }), cashBkk = await t.login('cashier', { branch: 'bkk' });
    assert.equal((await t.call('GET', '/api/pos/snapshot?branch=bkk', { token: cashCnx })).status, 403);
    assert.equal((await t.call('GET', '/api/pos/snapshot?branch=bkk', { token: cashBkk })).status, 200);
    assert.equal((await t.call('POST', '/api/pos/bookings/' + b.id + '/start', { token: cashCnx })).status, 403, 'แคชเชียร์สาขาอื่นเริ่มคิวนี้ไม่ได้');
    assert.equal((await t.call('POST', '/api/pos/walkins', { token: cashCnx, body: { branch: 'bkk', service: 'thai', therapist: 'bkk-3', room: 'r3' } })).status, 403);
    // หมอนวด bkk-2 ไม่ใช่เจ้าของคิว (bkk-1)
    const th2 = await t.login('therapist', { branch: 'bkk', therapist: 'bkk-2' }), th1 = await t.login('therapist', { branch: 'bkk', therapist: 'bkk-1' });
    assert.equal((await t.call('POST', '/api/pos/bookings/' + b.id + '/start', { token: th2 })).status, 403);
    const snap2 = await t.call('GET', '/api/pos/snapshot?branch=bkk', { token: th2 }); assert.ok(snap2.body.bookings.every(x => x.therapist === 'bkk-2')); assert.deepEqual(snap2.body.sales, []);
    const snap1 = await t.call('GET', '/api/pos/snapshot?branch=bkk', { token: th1 }); assert.ok(snap1.body.bookings.some(x => x.id === b.id));
    assert.equal((await t.call('POST', '/api/pos/bookings/' + b.id + '/start', { token: th1 })).status, 200, 'หมอนวดเริ่มคิวตัวเองได้');
    assert.equal((await t.call('POST', '/api/pos/bookings/' + b.id + '/checkout', { token: th1, body: {} })).status, 403, 'หมอนวดรับเงินไม่ได้');
    assert.equal((await t.call('PATCH', '/api/pos/bookings/' + b.id, { token: th1, body: { pay: 'qr' } })).status, 403);
    assert.equal((await t.call('POST', '/api/pos/bookings/' + b.id + '/cancel', { token: th1 })).status, 403);
    for (const tok of [th1, cashBkk, await t.login('manager')]) for (const p of ['/api/admin/audit', '/api/admin/notifications']) assert.equal((await t.call('GET', p, { token: tok })).status, 403, p);
    assert.equal((await t.call('POST', '/api/admin/reset-demo', { token: cashBkk })).status, 403);
  } finally { await t.close(); }
});

test('จบบริการ+ชำระเงิน: ยอด ส่วนลดสมาชิก ค่าคอม 30% และคะแนนถูกต้อง', async () => {
  const t = await start(); try {
    clear(t); const ct = await t.customer(); const cash = await t.login('cashier');
    const before = (await t.call('GET', '/api/me', { token: ct })).body; assert.equal(before.points.total, 1240); assert.equal(before.customer.tier, 'member');
    const b = await book(t, ct, { service: 'oil' });
    // ยังไม่เริ่มบริการ → ชำระไม่ได้
    assert.equal((await t.call('POST', '/api/pos/bookings/' + b.id + '/checkout', { token: cash, body: {} })).status, 409);
    assert.equal((await t.call('POST', '/api/pos/bookings/' + b.id + '/start', { token: cash })).status, 200);
    assert.equal((await t.call('PATCH', '/api/pos/bookings/' + b.id, { token: cash, body: { addons: ['herb'], pay: 'qr' } })).status, 200, 'เพิ่มส่วนเสริม');
    const addon = C.ADDONS.find(a => a.id === 'herb'); assert.ok(addon, 'ต้องมี addon id herb'); 
    const co = await t.call('POST', '/api/pos/bookings/' + b.id + '/checkout', { token: cash, body: {} });
    assert.equal(co.status, 200, JSON.stringify(co.body));
    const gross = price('oil') + addon.price, total = gross - Math.round(gross * 0.10), comm = Math.round(total * 0.30), pts = Math.floor(total / 10);
    const s = co.body.sale; assert.equal(s.gross, gross); assert.equal(s.pct, 10); assert.equal(s.total, total); assert.equal(s.commission, comm); assert.equal(s.points, pts); assert.equal(s.pay, 'qr'); assert.equal(s.therapist, 'bkk-1');
    const after = (await t.call('GET', '/api/me', { token: ct })).body; assert.equal(after.points.total, 1240 + pts);
    assert.equal(after.points.history[0].d, '+' + pts);
    assert.equal(after.bookings.find(x => x.id === b.id).status, 'paid');
    assert.equal((await t.call('POST', '/api/pos/bookings/' + b.id + '/checkout', { token: cash, body: {} })).status, 409, 'ชำระซ้ำไม่ได้ คะแนนไม่เพิ่มซ้ำ');
    assert.equal((await t.call('GET', '/api/me', { token: ct })).body.points.total, 1240 + pts);
    const dbSale = t.db.prepare('SELECT * FROM sales WHERE id=?').get(s.id); assert.equal(dbSale.cashier_id, 'u-cash-bkk');
    // ข้อความแจ้งเตือนถูกใส่คิว (ไม่ได้ส่งจริง)
    const kinds = t.db.prepare('SELECT channel,kind,status FROM notifications ORDER BY id').all();
    assert.ok(kinds.some(k => k.kind === 'booking_confirmation' && k.channel === 'customer_oa' && k.status === 'queued'));
    assert.ok(kinds.some(k => k.kind === 'staff_new_booking' && k.channel === 'staff_oa'));
    assert.ok(kinds.some(k => k.kind === 'points_earned'));
  } finally { await t.close(); }
});

test('คะแนนถึง 2000 → อัปเกรดเป็น VIP; ลูกค้าเดินเข้าไม่ได้คะแนน; ส่วนลดที่เลือกเอง', async () => {
  const t = await start(); try {
    clear(t); t.db.prepare("UPDATE customers SET points=1990 WHERE id='c-demo'").run();
    const ct = await t.customer(); const cash = await t.login('cashier'); const b = await book(t, ct, { service: 'thai' });
    await t.call('POST', '/api/pos/bookings/' + b.id + '/start', { token: cash }); await t.call('POST', '/api/pos/bookings/' + b.id + '/checkout', { token: cash, body: {} });
    assert.equal((await t.call('GET', '/api/me', { token: ct })).body.customer.tier, 'vip');
    // เดินเข้า: เลือกส่วนลด VIP 15%
    t.state.now += 3 * 3600 * 1000; // 12:00
    const w = await t.call('POST', '/api/pos/walkins', { token: cash, body: { branch: 'bkk', service: 'foot', therapist: 'bkk-3', room: 'r3', tier: 15, name: 'ลูกค้าทดสอบ' } });
    assert.equal(w.status, 201, JSON.stringify(w.body)); assert.equal(w.body.booking.status, 'running');
    const co = await t.call('POST', '/api/pos/bookings/' + w.body.booking.id + '/checkout', { token: cash, body: { pay: 'card' } });
    const g = price('foot'); const tot = g - Math.round(g * 0.15); assert.equal(co.body.sale.total, tot); assert.equal(co.body.sale.points, 0); assert.equal(co.body.sale.commission, Math.round(tot * 0.3));
    assert.equal((await t.call('POST', '/api/pos/walkins', { token: cash, body: { branch: 'bkk', service: 'foot', therapist: 'bkk-3', room: 'r3', tier: 99 } })).status, 400);
  } finally { await t.close(); }
});

test('แดชบอร์ด: ยอดรวม/จำนวน/ต่อสาขา/ค่าคอม ตรงกับผลรวมของตาราง sales', async () => {
  const t = await start(); try {
    clearToday(t); const owner = await t.login('owner'), cash = await t.login('cashier');
    // เพิ่มยอดขายใหม่ 2 รายการ แล้วเทียบ
    for (const [br, th, room] of [['bkk', 'bkk-3', 'r3'], ['bkk', 'bkk-2', 'r2']]) {
      t.state.now += 3600 * 1000;
      const w = await t.call('POST', '/api/pos/walkins', { token: cash, body: { branch: br, service: 'oil', therapist: th, room } }); assert.equal(w.status, 201, JSON.stringify(w.body));
      assert.equal((await t.call('POST', '/api/pos/bookings/' + w.body.booking.id + '/checkout', { token: cash, body: {} })).status, 200);
    }
    const d = (await t.call('GET', '/api/dashboard?period=today', { token: owner })).body;
    const today = t.clock.today();
    const sum = t.db.prepare('SELECT COALESCE(SUM(total),0) t, COUNT(*) c, COALESCE(SUM(commission),0) m FROM sales WHERE day=?').get(today);
    assert.equal(d.revenue, sum.t); assert.equal(d.count, sum.c);
    assert.equal(d.perBranch.reduce((a, x) => a + x.rev, 0), sum.t);
    for (const b of C.BRANCHES) assert.equal(d.perBranch.find(x => x.id === b.id).rev, t.db.prepare('SELECT COALESCE(SUM(total),0) t FROM sales WHERE day=? AND branch_id=?').get(today, b.id).t, b.id);
    assert.equal(d.services.reduce((a, x) => a + x.rev, 0), sum.t); assert.equal(d.services.reduce((a, x) => a + x.n, 0), sum.c);
    // ผู้จัดการเห็นเฉพาะสาขาของตัวเอง ยอดเท่ากับของสาขานั้น
    const mg = (await t.call('GET', '/api/dashboard', { token: await t.login('manager', { branch: 'bkk' }) })).body;
    assert.equal(mg.revenue, d.perBranch.find(x => x.id === 'bkk').rev);
    // 7 วัน = ผลรวม 7 วันล่าสุดใน SQL
    const d7 = (await t.call('GET', '/api/dashboard?period=7d', { token: owner })).body;
    const s7 = t.db.prepare('SELECT COALESCE(SUM(total),0) t FROM sales WHERE day>=? AND day<=?').get(t.clock.addDays(today, -6), today).t;
    assert.equal(d7.revenue, s7);
    // ค่าคอมต่อหมอนวด (5 อันดับแรก) ตรงกับ SQL
    for (const th of d.therapists) assert.equal(th.c, t.db.prepare('SELECT COALESCE(SUM(commission),0) c FROM sales WHERE day=? AND therapist_id=?').get(today, th.id).c);
  } finally { await t.close(); }
});

test('ตัวแจ้งเตือน: เตือนก่อนถึงคิว/สรุปรายวัน บันทึกลงตาราง ไม่ซ้ำ และไม่ได้ส่งจริง', async () => {
  const t = await start(); try {
    clear(t); const ct = await t.customer(); const owner = await t.login('owner');
    t.state.now = Date.UTC(2026, 9, 26, 4, 0, 0); // 11:00
    t.db.prepare("DELETE FROM bookings WHERE day='2026-10-26'").run();
    await book(t, ct, { day: '2026-10-26', start: 720 }); // 12:00 → อีก 1 ชม.
    await book(t, ct, { day: '2026-10-26', start: 900, therapist: 'bkk-2' }); // 15:00 ไกลเกิน 2 ชม.
    assert.equal((await t.call('POST', '/api/admin/jobs/reminders', { token: owner })).body.queued, 1);
    assert.equal((await t.call('POST', '/api/admin/jobs/reminders', { token: owner })).body.queued, 0, 'ไม่ส่งซ้ำ');
    assert.equal((await t.call('POST', '/api/admin/jobs/nightly-summary', { token: owner, body: {} })).body.queued, 4);
    assert.equal((await t.call('POST', '/api/admin/jobs/nightly-summary', { token: owner, body: {} })).body.queued, 0);
    const n = (await t.call('GET', '/api/admin/notifications', { token: owner })).body;
    assert.equal(n.transport, 'outbox-only'); assert.ok(n.notifications.every(x => x.status === 'queued'));
    assert.ok(n.notifications.some(x => x.kind === 'booking_reminder' && x.channel === 'customer_oa'));
    assert.ok(n.notifications.some(x => x.kind === 'nightly_summary' && x.channel === 'staff_oa'));
  } finally { await t.close(); }
});
