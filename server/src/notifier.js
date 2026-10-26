'use strict';
/* ตัวแจ้งเตือนผ่าน LINE (จุดเชื่อมต่อ) — ตอนนี้ "บันทึกลงตารางเท่านั้น" ไม่ได้ติดต่อ LINE จริง
 *
 * สองช่องทาง:
 *   customer_oa : LINE OA ฝั่งลูกค้า (ยืนยันการจอง, เตือนก่อนถึงคิว, ยกเลิก, คะแนน)
 *   staff_oa    : LINE OA ฝั่งพนักงาน (แจ้งคิวใหม่, ยกเลิก, สรุปรายวัน)
 * ข้อความทุกอันถูกใส่ในตาราง notifications สถานะ 'queued'
 * เมื่อต่อ LINE จริง ให้เขียน transport ใหม่ที่มี deliver(row) แล้วส่งเข้า createNotifier({transport})
 * ดู docs/LINE-INTEGRATION.md
 */
const C = require('../../js/catalog.js');

const CHANNELS = ['customer_oa', 'staff_oa'];
const outboxOnly = { name: 'outbox-only', deliver() { return null; } }; // null = ยังไม่ส่ง คงสถานะ queued

function createNotifier({ db, clock, transport, log }) {
  transport = transport || outboxOnly;
  const ins = db.prepare('INSERT OR IGNORE INTO notifications(ts,channel,kind,recipient,body,payload,status,dedupe_key) VALUES (?,?,?,?,?,?,\'queued\',?)');
  const th = id => { const t = C.THERAPISTS.find(x => x.id === id); return t ? 'คุณ' + t.name : ''; };
  const br = id => C.BRANCHES.find(b => b.id === id);
  const sv = id => C.SERVICES.find(s => s.id === id);
  const when = b => b.day + ' ' + hm(b.start) + '–' + hm(b.start + b.dur) + ' น.';
  const hm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

  function queue(channel, kind, recipient, body, payload, dedupe) {
    if (!CHANNELS.includes(channel)) throw new Error('unknown channel ' + channel);
    const r = ins.run(clock.nowMs(), channel, kind, recipient, body, payload ? JSON.stringify(payload) : null, dedupe || null);
    if (log && r.changes) log('[notifier:' + channel + '] ' + kind + ' → ' + recipient + ' : ' + body.replace(/\n/g, ' / '));
    return r.changes === 1;
  }
  const custRecipient = b => 'customer:' + (b.customer_id || 'walk-in');

  const api = {
    transport: () => transport.name,
    queue,
    bookingConfirmed(b) {
      if (b.customer_id && b.src === 'line') queue('customer_oa', 'booking_confirmation', custRecipient(b),
        'ยืนยันการจอง ' + b.id + '\n' + br(b.branch_id).name + ' · ' + sv(b.service_id).name + ' ' + b.dur + ' นาที\n' + when(b) + ' · ' + th(b.therapist_id),
        { booking: b.id }, 'confirm:' + b.id);
      queue('staff_oa', 'staff_new_booking', 'branch:' + b.branch_id,
        'คิวใหม่ ' + b.id + ' (' + (b.src === 'line' ? 'จองผ่าน LINE' : 'หน้าร้าน') + ')\n' + sv(b.service_id).name + ' · ' + when(b) + ' · ' + th(b.therapist_id) + ' · ห้อง ' + b.room_id.split('-').pop().toUpperCase(),
        { booking: b.id }, 'staffnew:' + b.id);
    },
    bookingCancelled(b) {
      if (b.customer_id && b.src === 'line') queue('customer_oa', 'booking_cancelled', custRecipient(b), 'ยกเลิกการจอง ' + b.id + ' เรียบร้อยแล้ว (' + when(b) + ')', { booking: b.id }, 'cancel-c:' + b.id);
      queue('staff_oa', 'staff_booking_cancelled', 'branch:' + b.branch_id, 'ยกเลิกคิว ' + b.id + ' · ' + when(b), { booking: b.id }, 'cancel-s:' + b.id);
    },
    pointsEarned(customerId, pts, total, saleId) {
      if (customerId && pts > 0) queue('customer_oa', 'points_earned', 'customer:' + customerId, 'ขอบคุณที่ใช้บริการ ROSELANNA ได้รับ +' + pts + ' คะแนน (ยอด ฿' + total + ')', { sale: saleId, points: pts }, 'pts:' + saleId);
    },
    /* เตือนก่อนถึงคิว 2 ชั่วโมง (เรียกจากตัวตั้งเวลา หรือ POST /api/admin/jobs/reminders) */
    queueReminders() {
      const today = clock.today(), nm = clock.nowMin(); let n = 0;
      const rows = db.prepare("SELECT * FROM bookings WHERE status='booked' AND src='line' AND customer_id IS NOT NULL AND day=? AND start>? AND start<=?").all(today, nm, nm + 120);
      rows.forEach(b => { if (queue('customer_oa', 'booking_reminder', custRecipient(b), 'เตือนคิววันนี้ ' + hm(b.start) + ' น. ที่ ' + br(b.branch_id).name + ' (' + sv(b.service_id).name + ') · รหัส ' + b.id, { booking: b.id }, 'reminder:' + b.id)) n++; });
      return n;
    },
    /* สรุปประจำวันถึงเจ้าของ/สาขา (ควรเรียกหลังปิดร้าน) */
    queueNightlySummary(day) {
      day = day || clock.today(); let n = 0, all = 0, allCnt = 0;
      C.BRANCHES.forEach(b => {
        const r = db.prepare('SELECT COUNT(*) c, COALESCE(SUM(total),0) t, COALESCE(SUM(commission),0) m FROM sales WHERE branch_id=? AND day=?').get(b.id, day);
        all += r.t; allCnt += r.c;
        if (queue('staff_oa', 'nightly_summary', 'branch:' + b.id, 'สรุปวันที่ ' + day + ' · ' + b.name + '\nยอดขาย ฿' + r.t + ' (' + r.c + ' รายการ) · ค่าคอมรวม ฿' + r.m, { day, branch: b.id }, 'nightly:' + day + ':' + b.id)) n++;
      });
      if (queue('staff_oa', 'nightly_summary', 'owner', 'สรุปทุกสาขา วันที่ ' + day + '\nยอดขายรวม ฿' + all + ' (' + allCnt + ' รายการ)', { day }, 'nightly:' + day + ':all')) n++;
      return n;
    },
    /* ส่งข้อความที่ค้างคิวผ่าน transport (ค่าตั้งต้น outbox-only จะไม่ส่งอะไรเลย) */
    async flush(limit) {
      const rows = db.prepare("SELECT * FROM notifications WHERE status='queued' ORDER BY id LIMIT ?").all(limit || 50); let sent = 0;
      for (const row of rows) {
        const res = await transport.deliver(row);
        if (res && res.ok) { db.prepare("UPDATE notifications SET status='sent', sent_at=? WHERE id=?").run(clock.nowMs(), row.id); sent++; }
        else if (res && res.ok === false) db.prepare("UPDATE notifications SET status='failed' WHERE id=?").run(row.id);
      }
      return sent;
    }
  };
  return api;
}
module.exports = { createNotifier, CHANNELS };
