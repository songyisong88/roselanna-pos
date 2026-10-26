'use strict';
/* ข้อมูลตัวอย่างทั้งหมด (EXAMPLE DATA) — ชื่อลูกค้า/ตัวเลขเป็นของสมมติ ไม่ใช่ข้อมูลจริง */
const C = require('../../js/catalog.js');

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const NAMES = ['คุณพิมพ์','คุณน้อย','คุณบอล','คุณแอน','คุณต้น','คุณมิ้นท์','คุณเอก','คุณหญิง','คุณโอม','คุณฝ้าย','คุณปอ','คุณนุ่น','คุณกอล์ฟ','คุณเฟิร์น'];
const DEMO_CUSTOMER = 'c-demo';
const ROLE_LABEL = { owner: 'เจ้าของร้าน', branch_manager: 'ผู้จัดการสาขา', cashier: 'แคชเชียร์', therapist: 'หมอนวด' };

function wpick(r, arr) { const t = arr.reduce((a, x) => a + x.w, 0); let v = r() * t; for (const x of arr) { v -= x.w; if (v <= 0) return x; } return arr[0]; }

function resetAndSeed(db, clock) {
  const r = rng(20261026);
  const now = clock.nowMs(), today = clock.today(), nm = clock.nowMin(), mid = clock.midnightMs(today);
  const tx = db.transaction(() => {
    for (const t of ['notifications', 'audit_log', 'points_history', 'sales', 'bookings', 'customers', 'users', 'therapists', 'rooms', 'addons', 'services', 'branches', 'counters']) db.exec('DELETE FROM ' + t);
    const ib = db.prepare('INSERT INTO branches(id,name,short,addr,dist,weight) VALUES (?,?,?,?,?,?)');
    C.BRANCHES.forEach(b => ib.run(b.id, b.name, b.short, b.addr, b.dist, b.w));
    const ir = db.prepare('INSERT INTO rooms(id,branch_id,code,name) VALUES (?,?,?,?)');
    C.BRANCHES.forEach(b => C.ROOMS.forEach(rm => ir.run(b.id + '-' + rm.id, b.id, rm.code, rm.name)));
    const isv = db.prepare('INSERT INTO services(id,name,sub,dur,price) VALUES (?,?,?,?,?)');
    C.SERVICES.forEach(s => isv.run(s.id, s.name, s.sub, s.dur, s.price));
    const iad = db.prepare('INSERT INTO addons(id,name,price) VALUES (?,?,?)');
    C.ADDONS.forEach(a => iad.run(a.id, a.name, a.price));
    const ith = db.prepare('INSERT INTO therapists(id,branch_id,name,level,av) VALUES (?,?,?,?,?)');
    C.THERAPISTS.forEach(t => ith.run(t.id, t.branch, t.name, t.level, t.av));

    // ผู้ใช้ตัวอย่าง (ไม่มีรหัสผ่าน — เข้าสู่ระบบเดโมด้วยโทเคนเท่านั้น)
    const iu = db.prepare('INSERT INTO users(id,username,name,role,branch_id,therapist_id) VALUES (?,?,?,?,?,?)');
    iu.run('u-owner', 'owner', 'คุณเจ้าของร้าน (ตัวอย่าง)', 'owner', null, null);
    C.BRANCHES.forEach(b => {
      iu.run('u-mgr-' + b.id, 'manager-' + b.id, 'ผู้จัดการ' + b.name + ' (ตัวอย่าง)', 'branch_manager', b.id, null);
      iu.run('u-cash-' + b.id, 'cashier-' + b.id, 'แคชเชียร์' + b.name + ' (ตัวอย่าง)', 'cashier', b.id, null);
    });
    C.THERAPISTS.forEach(t => iu.run('u-th-' + t.id, 'therapist-' + t.id, 'คุณ' + t.name + ' (หมอนวด ตัวอย่าง)', 'therapist', t.branch, t.id));

    // ลูกค้าตัวอย่าง: 28 คนแรกไม่มาเกิน 30 วัน (ให้ตรงกับเดโมช่วง 1)
    const ic = db.prepare('INSERT INTO customers(id,name,points,tier,line_user_id,last_visit_day,created_at,is_example) VALUES (?,?,?,?,?,?,?,1)');
    const custs = [];
    for (let i = 0; i < 60; i++) {
      const tier = r() < 0.12 ? 'vip' : (r() < 0.55 ? 'member' : 'none');
      const ago = i < 28 ? 31 + Math.floor(r() * 90) : Math.floor(r() * 29);
      const c = { id: 'c-' + (i + 1), name: NAMES[Math.floor(r() * NAMES.length)], tier };
      ic.run(c.id, c.name, Math.floor(r() * 1500), tier, null, clock.addDays(today, -ago), now, );
      custs.push(c);
    }
    ic.run(DEMO_CUSTOMER, 'คุณลูกค้า LINE (ตัวอย่าง)', 1240, 'member', null, clock.addDays(today, -9), now);
    const ih = db.prepare('INSERT INTO points_history(customer_id,day,text,delta,ts) VALUES (?,?,?,?,?)');
    ih.run(DEMO_CUSTOMER, clock.addDays(today, -30), 'โบนัสสมาชิกใหม่', 200, now - 30 * 86400000);
    ih.run(DEMO_CUSTOMER, clock.addDays(today, -9), 'ซื้อบริการ นวดไทย 60 นาที', 50, now - 9 * 86400000);

    let bseq = 1000, sseq = 0;
    const ibk = db.prepare(`INSERT INTO bookings(id,branch_id,day,start,dur,service_id,room_id,therapist_id,customer_id,cust_name,status,src,addons,disc,pay,started_at,ends_at,paid_at,sale_id,created_at,created_by)
      VALUES (@id,@branch,@day,@start,@dur,@service,@room,@therapist,@cust,@name,@status,@src,@addons,NULL,@pay,@started,@ends,@paid,@sale,@created,'seed')`);
    const isl = db.prepare(`INSERT INTO sales(id,branch_id,day,ts,service_id,therapist_id,booking_id,customer_id,gross,addons,pct,total,pay,commission,points,cashier_id)
      VALUES (@id,@branch,@day,@ts,@service,@therapist,@booking,@cust,@gross,@addons,@pct,@total,@pay,@commission,0,'seed')`);
    const addonPrice = ids => ids.reduce((a, id) => a + C.ADDONS.find(x => x.id === id).price, 0);

    function genDay(branch, day, withBooking, cb) {
      const list = []; const bw = C.BRANCHES.find(b => b.id === branch).w;
      const roomsOf = C.ROOMS.map(x => x.id), thOf = C.THERAPISTS.filter(t => t.branch === branch);
      const ov = (a0, a1, b0, b1) => a0 < b1 && b0 < a1;
      for (let h = C.OPEN / 60; h < C.CLOSE / 60; h++) {
        const s = h * 60; const peak = (h >= 12 && h <= 14) || (h >= 17 && h <= 20) ? 1.0 : 0.62;
        const x = r() * bw * peak; const n = x > 0.95 ? 2 : (x > 0.38 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const svc = wpick(r, C.SERVICES), e = s + svc.dur;
          if (s + svc.dur > C.CLOSE + 60) continue;
          const room = roomsOf.find(rid => !list.some(b => b.room === rid && ov(s, e, b.start, b.start + b.dur)));
          const th = thOf.find(t => !list.some(b => b.therapist === t.id && ov(s, e, b.start, b.start + b.dur)));
          if (!room || !th) continue;
          const cust = custs[Math.floor(r() * custs.length)];
          const b = { branch, day, start: s, dur: svc.dur, service: svc.id, room, therapist: th.id, cust, src: r() < 0.5 ? 'line' : 'walkin', addons: r() < 0.25 ? [C.ADDONS[Math.floor(r() * 3)].id] : [] };
          list.push(b);
        }
      }
      return list;
    }
    function mkSale(b, ts, bookingId) {
      const gross = C.SERVICES.find(s => s.id === b.service).price + addonPrice(b.addons);
      const pct = b.cust.tier === 'vip' ? 15 : (b.cust.tier === 'member' ? 10 : 0);
      const total = Math.round(gross * (1 - pct / 100)); const pay = ['cash', 'qr', 'card'][Math.floor(r() * 3)];
      const id = 'S' + (++sseq);
      isl.run({ id, branch: b.branch, day: b.day, ts, service: b.service, therapist: b.therapist, booking: bookingId || null, cust: b.cust.id, gross, addons: JSON.stringify(b.addons), pct, total, pay, commission: Math.round(total * C.COMM_RATE) });
      return id;
    }
    C.BRANCHES.forEach(br => {
      for (let d = -13; d <= -1; d++) { // วันที่ผ่านมา: เฉพาะยอดขาย
        const day = clock.addDays(today, d);
        genDay(br.id, day).forEach(b => mkSale(b, clock.midnightMs(day) + (b.start + b.dur) * 60000, null));
      }
      const put = (b, extra) => {
        const id = 'RL-' + (++bseq); const room = br.id + '-' + b.room;
        ibk.run(Object.assign({ id, branch: b.branch, day: b.day, start: b.start, dur: b.dur, service: b.service, room, therapist: b.therapist, cust: b.cust.id, name: b.cust.name, status: 'booked', src: b.src, addons: JSON.stringify(b.addons), pay: null, started: null, ends: null, paid: null, sale: null, created: now }, extra || {}));
        return id;
      };
      genDay(br.id, today).forEach(b => {
        const end = b.start + b.dur;
        if (end <= nm) { // เสร็จแล้ว: ชำระแล้ว
          const paidAt = mid + end * 60000; const id = 'RL-' + (bseq + 1);
          const sid = mkSale(b, paidAt, id);
          put(b, { status: 'paid', paid: paidAt, sale: sid, pay: db.prepare('SELECT pay FROM sales WHERE id=?').get(sid).pay });
        } else if (b.start <= nm) {
          const st = mid + b.start * 60000; put(b, { status: 'running', started: st, ends: st + b.dur * 60000 });
        } else put(b);
      });
      for (let d = 1; d <= 3; d++) { // พรุ่งนี้ ถึง อีก 3 วัน: เฉพาะคิวจอง (กันเต็มทั้งวัน)
        const day = clock.addDays(today, d);
        genDay(br.id, day).filter((b, i) => i % 2 === 0 || r() < 0.4).forEach(b => put(b));
      }
    });
    const ctr = db.prepare('INSERT INTO counters(name,value) VALUES (?,?)');
    ctr.run('booking', bseq); ctr.run('sale', sseq);
  });
  tx();
}
module.exports = { resetAndSeed, DEMO_CUSTOMER, ROLE_LABEL };
