'use strict';
const C = require('../../js/catalog.js');
const DASH = require('../../js/dashboard-calc.js');
const V = require('./validate');
const { ApiError, bad } = require('./errors');
const { resetAndSeed } = require('./seed');

const PAY = ['cash', 'qr', 'card'];
const DISCS = C.TIERS.map(t => t.pct);
const tierPct = t => t === 'vip' ? 15 : (t === 'member' ? 10 : 0);
const roomCode = id => id.split('-').pop(); // 'bkk-r1' -> 'r1'

function createService({ db, clock, notifier }) {
  const q = (sql) => db.prepare(sql);
  const svc = id => q('SELECT * FROM services WHERE id=?').get(id);
  const addonsPrice = ids => ids.reduce((a, id) => a + (C.ADDONS.find(x => x.id === id) || { price: 0 }).price, 0);

  /* ---------- audit ---------- */
  function audit(actor, action, entity, entityId, detail, ok) {
    actor = actor || {};
    q('INSERT INTO audit_log(ts,actor_kind,actor_id,role,branch_id,action,entity,entity_id,detail,ok) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(clock.nowMs(), actor.kind || 'system', actor.id || null, actor.role || null, actor.branch || null, action, entity || null, entityId || null, detail ? JSON.stringify(detail) : null, ok === false ? 0 : 1);
  }

  /* ---------- serializers ---------- */
  function serBooking(b, own) {
    return { id: b.id, branch: b.branch_id, day: b.day, start: b.start, dur: b.dur, service: b.service_id, room: roomCode(b.room_id), therapist: b.therapist_id,
      status: b.status, cust: own ? 'me' : (b.customer_id || 'walk'), custName: b.cust_name || 'ลูกค้า', member: !!b.c_tier && b.c_tier !== 'none', vip: b.c_tier === 'vip',
      src: b.src, addons: JSON.parse(b.addons || '[]'), disc: b.disc, pay: b.pay, startedAt: b.started_at, endsAt: b.ends_at, paidAt: b.paid_at, saleId: b.sale_id, created: b.created_at };
  }
  function serSale(s) {
    return { id: s.id, branch: s.branch_id, day: s.day, ts: s.ts, service: s.service_id, therapist: s.therapist_id, gross: s.gross, addons: JSON.parse(s.addons || '[]'),
      pct: s.pct, total: s.total, pay: s.pay, commission: s.commission, booking: s.booking_id, points: s.points };
  }
  const BK_SELECT = 'SELECT b.*, c.tier AS c_tier FROM bookings b LEFT JOIN customers c ON c.id=b.customer_id';
  const getBooking = id => q(BK_SELECT + ' WHERE b.id=?').get(id);
  const mustBooking = id => { const b = getBooking(String(id)); if (!b) throw new ApiError(404, 'not_found', 'ไม่พบคิวนี้'); return b; };

  function nextId(name, prefix) {
    q('UPDATE counters SET value=value+1 WHERE name=?').run(name);
    return prefix + q('SELECT value FROM counters WHERE name=?').get(name).value;
  }

  /* ---------- ห้อง/หมอนวดว่าง ---------- */
  const roomFreeSql = q(`SELECT r.id FROM rooms r WHERE r.branch_id=? AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.room_id=r.id AND b.day=? AND b.status!='cancelled' AND b.start<? AND ?<b.start+b.dur) ORDER BY r.code`);
  const therBusySql = q(`SELECT 1 FROM bookings b WHERE b.therapist_id=? AND b.day=? AND b.status!='cancelled' AND b.start<? AND ?<b.start+b.dur AND b.id!=?`);
  const therFree = (tid, day, s, e, exceptId) => !therBusySql.get(tid, day, e, s, exceptId || '');
  function pick(branch, day, start, dur, therapist) {
    const e = start + dur;
    const room = roomFreeSql.get(branch, day, e, start); if (!room) return null;
    let th = null;
    if (therapist && therapist !== 'any') { if (!therFree(therapist, day, start, e)) return null; th = therapist; }
    else { const t = C.THERAPISTS.filter(x => x.branch === branch).find(x => therFree(x.id, day, start, e)); if (!t) return null; th = t.id; }
    return { room: room.id, therapist: th };
  }
  const branchOf = id => { const b = C.BRANCHES.find(x => x.id === id); if (!b) throw bad('invalid_branch', 'ไม่พบสาขา'); return b; };
  function therapistArg(v, branch) {
    if (v == null || v === 'any') return 'any';
    const t = C.THERAPISTS.find(x => x.id === v && x.branch === branch);
    if (!t) throw bad('invalid_therapist', 'ไม่พบหมอนวดในสาขานี้'); return t.id;
  }
  const mapConflict = e => {
    if (e && typeof e.message === 'string' && /ROOM_CONFLICT|THERAPIST_CONFLICT/.test(e.message)) return new ApiError(409, 'slot_taken', 'ช่วงเวลานี้ถูกจองไปแล้ว กรุณาเลือกเวลาอื่น');
    return e;
  };

  /* ---------- ข้อมูลสาธารณะ ---------- */
  function catalog() {
    return { branches: C.BRANCHES.map(b => ({ id: b.id, name: b.name, short: b.short, addr: b.addr, dist: b.dist })),
      services: C.SERVICES.map(s => ({ id: s.id, name: s.name, sub: s.sub, dur: s.dur, price: s.price })), addons: C.ADDONS,
      therapists: C.THERAPISTS.map(t => ({ id: t.id, branch: t.branch, name: t.name, level: t.level })), open: C.OPEN, close: C.CLOSE, serverToday: clock.today() };
  }
  function slots(p) {
    const branch = branchOf(p.branch).id; const sv = svc(V.oneOf(p.service, C.SERVICES.map(s => s.id), 'service')); const day = V.day(p.day);
    const th = therapistArg(p.therapist, branch); const today = clock.today(), nm = clock.nowMin();
    if (day < today || day > clock.addDays(today, 6)) throw bad('invalid_day', 'จองล่วงหน้าได้ 7 วัน');
    const out = [];
    for (let s = C.OPEN; s + sv.dur <= C.CLOSE; s += 60) {
      const past = day === today && s <= nm;
      out.push({ start: s, ok: !past && !!pick(branch, day, s, sv.dur, th), past });
    }
    return out;
  }

  /* ---------- สร้างคิว (LINE / ลูกค้าเดินเข้า) ---------- */
  function insertBooking(r) {
    q(`INSERT INTO bookings(id,branch_id,day,start,dur,service_id,room_id,therapist_id,customer_id,cust_name,status,src,addons,disc,pay,started_at,ends_at,created_at,created_by)
       VALUES (@id,@branch,@day,@start,@dur,@service,@room,@therapist,@cust,@name,@status,@src,@addons,@disc,NULL,@started,@ends,@created,@by)`).run(r);
  }
  function createLineBooking(body, customerId, actor) {
    body = V.obj(body);
    const branch = branchOf(body.branch).id; const sv = svc(V.oneOf(body.service, C.SERVICES.map(s => s.id), 'service'));
    const day = V.day(body.day); const start = V.int(body.start, C.OPEN, C.CLOSE, 'start'); const th = therapistArg(body.therapist, branch);
    const today = clock.today();
    if (day < today || day > clock.addDays(today, 6)) throw bad('invalid_day', 'จองล่วงหน้าได้ 7 วัน');
    if (start % 30 !== 0 || start + sv.dur > C.CLOSE) throw bad('invalid_start', 'เวลาไม่อยู่ในช่วงเปิดทำการ');
    if (day === today && start <= clock.nowMin()) throw bad('past_time', 'เวลานี้ผ่านไปแล้ว');
    const cust = q('SELECT * FROM customers WHERE id=?').get(customerId);
    const live = q("SELECT COUNT(*) c FROM bookings WHERE customer_id=? AND status='booked' AND day>=?").get(customerId, today).c;
    if (live >= 10) throw new ApiError(429, 'too_many_bookings', 'มีคิวที่จองไว้มากเกินไป (สูงสุด 10 คิว)');
    let id;
    try {
      db.transaction(() => {
        const pk = pick(branch, day, start, sv.dur, th); if (!pk) throw new ApiError(409, 'slot_taken', 'ช่วงเวลานี้ถูกจองไปแล้ว กรุณาเลือกเวลาอื่น');
        id = nextId('booking', 'RL-');
        insertBooking({ id, branch, day, start, dur: sv.dur, service: sv.id, room: pk.room, therapist: pk.therapist, cust: customerId, name: cust.name, status: 'booked', src: 'line', addons: '[]', disc: null, started: null, ends: null, created: clock.nowMs(), by: 'customer:' + customerId });
      })();
    } catch (e) { throw mapConflict(e); }
    const row = getBooking(id);
    notifier.bookingConfirmed(row);
    audit(actor, 'booking.create', 'booking', id, { branch, day, start, service: sv.id, via: 'line' });
    return serBooking(row, true);
  }
  function createWalkin(body, user) {
    body = V.obj(body);
    const branch = branchOf(body.branch).id; const sv = svc(V.oneOf(body.service, C.SERVICES.map(s => s.id), 'service'));
    const th = C.THERAPISTS.find(t => t.id === body.therapist && t.branch === branch); if (!th) throw bad('invalid_therapist', 'ไม่พบหมอนวดในสาขานี้');
    const room = C.ROOMS.find(r => r.id === body.room); if (!room) throw bad('invalid_room', 'ไม่พบห้อง');
    const disc = body.tier == null ? 0 : V.int(body.tier, 0, 15, 'tier'); if (!DISCS.includes(disc)) throw bad('invalid_tier', 'ส่วนลดไม่ถูกต้อง');
    const name = V.text(body.name, 30, 'name', true) || 'ลูกค้าเดินเข้า';
    const day = clock.today(), nm = clock.nowMin(), now = clock.nowMs();
    if (nm < C.OPEN || nm + sv.dur > C.CLOSE + 30) throw bad('closed', 'อยู่นอกเวลาทำการ');
    let id;
    try {
      db.transaction(() => {
        id = nextId('booking', 'WK-');
        insertBooking({ id, branch, day, start: nm, dur: sv.dur, service: sv.id, room: branch + '-' + room.id, therapist: th.id, cust: null, name, status: 'running', src: 'walkin', addons: '[]', disc, started: now, ends: now + sv.dur * 60000, created: now, by: user.id });
      })();
    } catch (e) { const m = mapConflict(e); if (m.code === 'slot_taken') throw new ApiError(409, 'slot_taken', 'ห้องหรือหมอนวดไม่ว่างแล้ว'); throw m; }
    audit(user.actor, 'walkin.create', 'booking', id, { branch, service: sv.id });
    return serBooking(getBooking(id), false);
  }

  function cancelBooking(id, actor, onlyCustomerId) {
    const b = mustBooking(id);
    if (onlyCustomerId && b.customer_id !== onlyCustomerId) throw new ApiError(404, 'not_found', 'ไม่พบคิวนี้'); // ไม่บอกว่ามีอยู่
    if (b.status !== 'booked') throw new ApiError(409, 'not_cancellable', 'ยกเลิกได้เฉพาะคิวที่ยังไม่เริ่มบริการ');
    q("UPDATE bookings SET status='cancelled' WHERE id=?").run(b.id);
    notifier.bookingCancelled(b);
    audit(actor, 'booking.cancel', 'booking', b.id, null);
    return serBooking(getBooking(b.id), !!onlyCustomerId);
  }

  /* ---------- POS ---------- */
  function startBooking(id, user) {
    const b = mustBooking(id);
    if (b.status !== 'booked') throw new ApiError(409, 'bad_state', 'คิวนี้เริ่มบริการไม่ได้ (สถานะปัจจุบัน: ' + b.status + ')');
    const now = clock.nowMs(); const sv = svc(b.service_id);
    q("UPDATE bookings SET status='running', started_at=?, ends_at=? WHERE id=?").run(now, now + sv.dur * 60000, b.id);
    audit(user.actor, 'session.start', 'booking', b.id, null);
    return serBooking(getBooking(b.id));
  }
  function fastForward(id, user) {
    const b = mustBooking(id);
    if (b.status !== 'running') throw new ApiError(409, 'bad_state', 'ต้องกำลังให้บริการอยู่');
    q('UPDATE bookings SET ends_at=ends_at-600000 WHERE id=?').run(b.id);
    audit(user.actor, 'session.fast-forward', 'booking', b.id, { demo: true });
    return serBooking(getBooking(b.id));
  }
  function patchBooking(id, body, user) {
    body = V.obj(body); const b = mustBooking(id);
    if (b.status !== 'booked' && b.status !== 'running') throw new ApiError(409, 'bad_state', 'แก้ไขคิวนี้ไม่ได้แล้ว');
    const sets = [], vals = {};
    if (body.addons !== undefined) {
      if (!Array.isArray(body.addons) || body.addons.length > C.ADDONS.length) throw bad('invalid_addons', 'ส่วนเสริมไม่ถูกต้อง');
      const ids = [...new Set(body.addons.map(x => V.oneOf(x, C.ADDONS.map(a => a.id), 'addon')))];
      sets.push('addons=@addons'); vals.addons = JSON.stringify(ids);
    }
    if (body.pay !== undefined) { sets.push('pay=@pay'); vals.pay = V.oneOf(body.pay, PAY, 'pay'); }
    if (body.disc !== undefined) { const d = V.int(body.disc, 0, 15, 'disc'); if (!DISCS.includes(d)) throw bad('invalid_disc', 'ส่วนลดไม่ถูกต้อง'); sets.push('disc=@disc'); vals.disc = d; }
    if (body.therapist !== undefined) {
      if (b.status === 'running') throw new ApiError(409, 'bad_state', 'เปลี่ยนหมอนวดระหว่างให้บริการไม่ได้');
      const t = C.THERAPISTS.find(x => x.id === body.therapist && x.branch === b.branch_id); if (!t) throw bad('invalid_therapist', 'ไม่พบหมอนวดในสาขานี้');
      sets.push('therapist_id=@therapist'); vals.therapist = t.id;
    }
    if (!sets.length) throw bad('nothing_to_update', 'ไม่มีข้อมูลที่จะแก้ไข');
    try { db.prepare('UPDATE bookings SET ' + sets.join(',') + ' WHERE id=@id').run(Object.assign(vals, { id: b.id })); } catch (e) { throw mapConflict(e); }
    audit(user.actor, 'booking.update', 'booking', b.id, Object.keys(vals).filter(k => k !== 'id'));
    return serBooking(getBooking(b.id));
  }
  function checkout(id, body, user) {
    body = body ? V.obj(body) : {};
    let result;
    db.transaction(() => {
      const b = mustBooking(id);
      if (b.status === 'paid') throw new ApiError(409, 'already_paid', 'คิวนี้ชำระเงินแล้ว');
      if (b.status !== 'running') throw new ApiError(409, 'bad_state', 'ต้องกดเริ่มบริการก่อนจึงจะชำระเงินได้');
      const pay = body.pay !== undefined ? V.oneOf(body.pay, PAY, 'pay') : (b.pay || 'cash');
      const addons = JSON.parse(b.addons || '[]');
      const gross = svc(b.service_id).price + addonsPrice(addons);
      const pct = b.disc != null ? b.disc : tierPct(b.c_tier);
      const total = gross - Math.round(gross * pct / 100);
      const commission = Math.round(total * C.COMM_RATE);
      const now = clock.nowMs(); const sid = nextId('sale', 'S');
      const pts = b.customer_id ? Math.floor(total / C.PTS_DIV) : 0;
      q(`INSERT INTO sales(id,branch_id,day,ts,service_id,therapist_id,booking_id,customer_id,gross,addons,pct,total,pay,commission,points,cashier_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(sid, b.branch_id, clock.today(), now, b.service_id, b.therapist_id, b.id, b.customer_id, gross, JSON.stringify(addons), pct, total, pay, commission, pts, user.id);
      q("UPDATE bookings SET status='paid', paid_at=?, sale_id=?, pay=?, disc=? WHERE id=?").run(now, sid, pay, pct, b.id);
      if (b.customer_id && pts > 0) {
        q('UPDATE customers SET points=points+?, last_visit_day=? WHERE id=?').run(pts, clock.today(), b.customer_id);
        q('INSERT INTO points_history(customer_id,day,text,delta,ts) VALUES (?,?,?,?,?)').run(b.customer_id, clock.today(), 'ซื้อบริการ ' + svc(b.service_id).name + ' ' + b.dur + ' นาที', pts, now);
        const c = q('SELECT points,tier FROM customers WHERE id=?').get(b.customer_id);
        if (c.points >= C.VIP_AT && c.tier !== 'vip') q("UPDATE customers SET tier='vip' WHERE id=?").run(b.customer_id);
        else if (c.tier === 'none') q("UPDATE customers SET tier='member' WHERE id=?").run(b.customer_id);
      }
      notifier.pointsEarned(b.customer_id, pts, total, sid);
      audit(user.actor, 'sale.checkout', 'sale', sid, { booking: b.id, total, pay, commission, points: pts });
      result = { booking: serBooking(getBooking(b.id)), sale: serSale(q('SELECT * FROM sales WHERE id=?').get(sid)) };
    })();
    return result;
  }
  function snapshot(branch, user) {
    branchOf(branch); const today = clock.today(), to = clock.addDays(today, 3);
    let rows = q(BK_SELECT + " WHERE b.branch_id=? AND b.day>=? AND b.day<=? AND b.status!='cancelled' ORDER BY b.day, b.start").all(branch, today, to);
    if (user.role === 'therapist') rows = rows.filter(r => r.therapist_id === user.therapist_id);
    const canSales = user.role !== 'therapist';
    const sales = canSales ? q('SELECT * FROM sales WHERE branch_id=? AND day=? ORDER BY ts').all(branch, today).map(serSale) : [];
    return { today, bookings: rows.map(r => serBooking(r)), sales, serverNow: clock.nowMs() };
  }

  /* ---------- แดชบอร์ด ---------- */
  function dashboard(period, scopeBranches) {
    const today = clock.today(), mid = clock.midnightMs(today);
    const sales = q('SELECT branch_id, ts, total, service_id, therapist_id, commission FROM sales WHERE ts>=?').all(mid - 14 * 86400000)
      .map(s => ({ branch: s.branch_id, ts: s.ts, total: s.total, service: s.service_id, therapist: s.therapist_id, commission: s.commission }));
    const bookings = q("SELECT branch_id, day, status, src, dur FROM bookings WHERE day>=? AND status!='cancelled'").all(today)
      .map(b => ({ branch: b.branch_id, day: b.day, status: b.status, src: b.src, dur: b.dur }));
    const lapsed = q('SELECT COUNT(*) c FROM customers WHERE last_visit_day<=?').get(clock.addDays(today, -30)).c;
    return DASH.calc({ sales, bookings, scope: scopeBranches, period, now: clock.nowMs(), midnight: mid, today, lapsed });
  }

  /* ---------- ลูกค้า ---------- */
  function customerMe(customerId) {
    const c = q('SELECT * FROM customers WHERE id=?').get(customerId); if (!c) throw new ApiError(404, 'not_found', 'ไม่พบลูกค้า');
    const hist = q('SELECT day, text, delta FROM points_history WHERE customer_id=? ORDER BY id DESC LIMIT 30').all(customerId).map(h => ({ t: h.text, d: (h.delta >= 0 ? '+' : '') + h.delta, day: h.day }));
    const bks = q(BK_SELECT + " WHERE b.customer_id=? AND b.status!='cancelled' AND b.day>=? ORDER BY b.day, b.start LIMIT 50").all(customerId, clock.addDays(clock.today(), -7)).map(r => serBooking(r, true));
    return { customer: { id: c.id, name: c.name, tier: c.tier }, points: { total: c.points, history: hist }, bookings: bks, next: C.VIP_AT };
  }

  function resetDemo(actor) {
    resetAndSeed(db, clock);
    audit(actor, 'admin.reset-demo', 'system', null, null);
  }

  return { audit, catalog, slots, createLineBooking, createWalkin, cancelBooking, startBooking, fastForward, patchBooking, checkout, snapshot, dashboard, customerMe, resetDemo, getBooking, serBooking };
}
module.exports = { createService };
