'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { start } = require('./helpers');

const DAY = '2026-10-29'; // วันที่ไม่มีคิวจากข้อมูลตัวอย่าง? (ตรวจในเทสต์ด้วยการนับห้องว่าง)
async function freeDay(t) { // หาวันที่ว่างทั้งวัน: ใช้สาขา 'cnx' วันที่ 5 วันข้างหน้า = 2026-10-31
  return '2026-10-31';
}

test('จองสำเร็จ แล้วจองซ้ำช่วงเดียวกัน + หมอนวดคนเดิม ถูกปฏิเสธ (409)', async () => {
  const t = await start(); try {
    const tok = await t.customer(); const day = await freeDay(t);
    // ล้างคิวของวันนั้นเพื่อให้เทสต์คาดเดาได้
    t.db.prepare("DELETE FROM bookings WHERE day=?").run(day);
    const a = await t.call('POST', '/api/me/bookings', { token: tok, body: { branch: 'bkk', service: 'thai', day, start: 600, therapist: 'bkk-1' } });
    assert.equal(a.status, 201); assert.equal(a.body.booking.therapist, 'bkk-1');
    const b = await t.call('POST', '/api/me/bookings', { token: tok, body: { branch: 'bkk', service: 'thai', day, start: 600, therapist: 'bkk-1' } });
    assert.equal(b.status, 409); assert.equal(b.body.error, 'slot_taken');
    // หมอนวดคนเดิม ช่วงเวลาทับซ้อนบางส่วน (11:00 ทับกับ 10:00–11:00? ไม่ทับ) และ 10:30 ไม่ใช่ช่วงที่เลือกได้ แต่ 10:00 90 นาทีทับ 11:00
    const c = await t.call('POST', '/api/me/bookings', { token: tok, body: { branch: 'bkk', service: 'thai', day, start: 660, therapist: 'bkk-1' } });
    assert.equal(c.status, 201, 'ช่วงต่อกันพอดีไม่ทับ');
  } finally { await t.close(); }
});

test('บริการ 90 นาทีกินเวลา 1.5 ชม. — บล็อกช่วงถัดไปของหมอนวดคนเดิม', async () => {
  const t = await start(); try {
    const tok = await t.customer(); const day = '2026-10-31'; t.db.prepare("DELETE FROM bookings WHERE day=?").run(day);
    const dur90 = t.db.prepare('SELECT id FROM services WHERE dur=90 LIMIT 1').get().id;
    const a = await t.call('POST', '/api/me/bookings', { token: tok, body: { branch: 'bkk', service: dur90, day, start: 600, therapist: 'bkk-2' } });
    assert.equal(a.status, 201); assert.equal(a.body.booking.dur, 90);
    const clash = await t.call('POST', '/api/me/bookings', { token: tok, body: { branch: 'bkk', service: 'thai', day, start: 660, therapist: 'bkk-2' } });
    assert.equal(clash.status, 409, '11:00 ยังอยู่ในช่วง 10:00–11:30 ของหมอนวดคนนี้');
    const ok = await t.call('POST', '/api/me/bookings', { token: tok, body: { branch: 'bkk', service: 'thai', day, start: 720, therapist: 'bkk-2' } });
    assert.equal(ok.status, 201, '12:00 ว่างแล้ว');
    const av = await t.call('GET', '/api/public/availability?branch=bkk&service=' + dur90 + '&day=' + day + '&therapist=bkk-2');
    assert.equal(av.body.slots.find(s => s.start === 600).ok, false);
    assert.equal(av.body.slots.find(s => s.start === 660).ok, false);
    assert.equal(av.body.slots.find(s => s.start === 780).ok, true);
  } finally { await t.close(); }
});

test('ห้องหมด: 3 ห้องเต็มแล้วจองคนที่ 4 ไม่ได้ แม้เลือก "ไม่ระบุหมอนวด"', async () => {
  const t = await start(); try {
    const tok = await t.customer(); const day = '2026-10-31'; t.db.prepare("DELETE FROM bookings WHERE day=?").run(day);
    for (let i = 0; i < 3; i++) { const r = await t.call('POST', '/api/me/bookings', { token: tok, body: { branch: 'bkk', service: 'thai', day, start: 840, therapist: 'any' } }); assert.equal(r.status, 201, 'คนที่ ' + (i + 1)); }
    const r4 = await t.call('POST', '/api/me/bookings', { token: tok, body: { branch: 'bkk', service: 'thai', day, start: 840, therapist: 'any' } });
    assert.equal(r4.status, 409);
    // สาขาอื่นเวลาเดียวกันยังว่าง
    const other = await t.call('POST', '/api/me/bookings', { token: tok, body: { branch: 'cnx', service: 'thai', day, start: 840, therapist: 'any' } });
    assert.equal(other.status, 201);
  } finally { await t.close(); }
});

test('คำขอพร้อมกัน 8 รายการช่วงเดียวกัน ได้คิวสูงสุดเท่าจำนวนห้อง/หมอนวด และไม่มีคิวซ้อน', async () => {
  const t = await start(); try {
    const tok = await t.customer(); const day = '2026-10-31'; t.db.prepare("DELETE FROM bookings WHERE day=?").run(day);
    const rs = await Promise.all(Array.from({ length: 8 }, () => t.call('POST', '/api/me/bookings', { token: tok, body: { branch: 'bkk', service: 'oil', day, start: 720, therapist: 'bkk-1' } })));
    assert.equal(rs.filter(r => r.status === 201).length, 1, 'หมอนวดคนเดียวรับได้ 1 คิว');
    assert.equal(rs.filter(r => r.status === 409).length, 7);
    const n = t.db.prepare("SELECT COUNT(*) c FROM bookings WHERE day=? AND therapist_id='bkk-1' AND status!='cancelled'").get(day).c;
    assert.equal(n, 1);
  } finally { await t.close(); }
});

test('ตัวกันซ้อนระดับฐานข้อมูล (trigger) ทำงานแม้ข้ามโค้ดแอป', async () => {
  const t = await start(); try {
    const day = '2026-10-31'; t.db.prepare("DELETE FROM bookings WHERE day=?").run(day);
    const ins = (id, room, th, start) => t.db.prepare(`INSERT INTO bookings(id,branch_id,day,start,dur,service_id,room_id,therapist_id,status,src,addons,created_at) VALUES (?,?,?,?,60,'thai',?,?,'booked','walkin','[]',0)`).run(id, 'bkk', day, start, room, th);
    ins('X1', 'bkk-r1', 'bkk-1', 600);
    assert.throws(() => ins('X2', 'bkk-r1', 'bkk-2', 630), /ROOM_CONFLICT/);
    assert.throws(() => ins('X3', 'bkk-r2', 'bkk-1', 630), /THERAPIST_CONFLICT/);
    ins('X4', 'bkk-r2', 'bkk-2', 660); // ต่อกันพอดี
  } finally { await t.close(); }
});

test('ยกเลิกคิวแล้วช่วงเวลานั้นว่างอีกครั้ง; ลูกค้ายกเลิกคิวคนอื่นไม่ได้', async () => {
  const t = await start(); try {
    const tok = await t.customer(); const day = '2026-10-31'; t.db.prepare("DELETE FROM bookings WHERE day=?").run(day);
    const a = await t.call('POST', '/api/me/bookings', { token: tok, body: { branch: 'bkk', service: 'thai', day, start: 600, therapist: 'bkk-1' } });
    const id = a.body.booking.id;
    t.db.prepare("INSERT INTO bookings(id,branch_id,day,start,dur,service_id,room_id,therapist_id,customer_id,status,src,addons,created_at) VALUES ('OTHER','bkk',?,900,60,'thai','bkk-r1','bkk-3','c-5','booked','line','[]',0)").run(day);
    const steal = await t.call('POST', '/api/me/bookings/OTHER/cancel', { token: tok });
    assert.equal(steal.status, 404);
    assert.equal(t.db.prepare("SELECT status FROM bookings WHERE id='OTHER'").get().status, 'booked');
    const c = await t.call('POST', '/api/me/bookings/' + id + '/cancel', { token: tok });
    assert.equal(c.status, 200); assert.equal(c.body.booking.status, 'cancelled');
    const again = await t.call('POST', '/api/me/bookings', { token: tok, body: { branch: 'bkk', service: 'thai', day, start: 600, therapist: 'bkk-1' } });
    assert.equal(again.status, 201);
    const c2 = await t.call('POST', '/api/me/bookings/' + id + '/cancel', { token: tok });
    assert.equal(c2.status, 409);
  } finally { await t.close(); }
});

test('ตรวจข้อมูลที่ส่งมา: วันที่/เวลา/สาขา/บริการ/หมอนวด ผิดต้องถูกปฏิเสธ (400)', async () => {
  const t = await start(); try {
    const tok = await t.customer(); const ok = { branch: 'bkk', service: 'thai', day: '2026-10-31', start: 600, therapist: 'any' };
    const bads = [{ branch: 'zzz' }, { service: 'nope' }, { day: '31/10/2026' }, { day: '2026-12-31' }, { day: '2026-10-20' }, { start: 'ten' }, { start: 605 }, { start: 1290 }, { start: 100 }, { therapist: 'cnx-1' }, { therapist: 5 }];
    for (const b of bads) { const r = await t.call('POST', '/api/me/bookings', { token: tok, body: Object.assign({}, ok, b) }); assert.ok(r.status === 400, JSON.stringify(b) + ' → ' + r.status); }
    const past = await t.call('POST', '/api/me/bookings', { token: tok, body: { branch: 'bkk', service: 'thai', day: '2026-10-26', start: 540, therapist: 'any' } });
    assert.equal(past.status, 400);
    assert.equal((await t.call('POST', '/api/me/bookings', { token: tok, body: [] })).status, 400);
    assert.equal((await t.call('POST', '/api/me/bookings', { body: ok })).status, 401);
  } finally { await t.close(); }
});
