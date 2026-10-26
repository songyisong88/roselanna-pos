'use strict';
/* เริ่มเซิร์ฟเวอร์: node src/index.js   (ตัวแปร: PORT, ROSELANNA_DB, ROSELANNA_CORS, ROSELANNA_DEMO_LOGIN=0) */
const path = require('path');
const fs = require('fs');
const { openDb } = require('./db');
const { makeClock } = require('./time');
const { createApp } = require('./app');
const { resetAndSeed } = require('./seed');

const port = parseInt(process.env.PORT, 10) || 3000;
const host = process.env.HOST || '127.0.0.1'; // ค่าตั้งต้น: เครื่องนี้เท่านั้น ไม่เปิดสู่เครือข่าย
const dbFile = process.env.ROSELANNA_DB || path.join(__dirname, '..', 'data', 'roselanna.sqlite');
fs.mkdirSync(path.dirname(dbFile), { recursive: true });
const fresh = !fs.existsSync(dbFile) || process.argv.includes('--reset');
if (process.argv.includes('--reset') && fs.existsSync(dbFile)) for (const s of ['', '-wal', '-shm']) try { fs.unlinkSync(dbFile + s); } catch (e) {}
const db = openDb(dbFile); const clock = makeClock();
if (fresh || db.prepare('SELECT COUNT(*) c FROM branches').get().c === 0) { resetAndSeed(db, clock); console.log('สร้างข้อมูลตัวอย่างใหม่แล้ว (EXAMPLE DATA)'); }
const log = m => { if (process.env.ROSELANNA_QUIET !== '1') console.log(m); };
const { app, notifier } = createApp({ db, clock, log, demoLogin: process.env.ROSELANNA_DEMO_LOGIN !== '0', corsOrigins: (process.env.ROSELANNA_CORS || '').split(',') });

// ตัวตั้งเวลา: เตือนก่อนถึงคิว (ทุกนาที) และสรุปประจำวันหลัง 22:30 (บันทึกลงตารางเท่านั้น ไม่ส่ง LINE)
setInterval(() => { try { notifier.queueReminders(); if (clock.nowMin() >= 22 * 60 + 30) notifier.queueNightlySummary(); } catch (e) { console.error(e); } }, 60000).unref();

app.listen(port, host, () => {
  console.log('ROSELANNA เซิร์ฟเวอร์ (เดโม) ทำงานที่ http://' + (host === '0.0.0.0' ? 'localhost' : host) + ':' + port);
  console.log('  หน้าลูกค้า : http://localhost:' + port + '/customer/');
  console.log('  หน้าร้าน   : http://localhost:' + port + '/shop/');
  console.log('  ฐานข้อมูล  : ' + dbFile + '  · ตัวแจ้งเตือน LINE: บันทึกลงตารางเท่านั้น (ไม่ได้ติดต่อ LINE)');
});
