# เชื่อมต่อ LINE Official Account จริง — สิ่งที่ต้องมี (ยังไม่ได้ทำ)

> **สถานะตอนนี้:** เดโมนี้ **ไม่ได้ติดต่อ LINE เลย** ไม่มี token ไม่มี webhook จริง
> ข้อความทุกอย่างถูก "จดลงตาราง `notifications`" (สถานะ `queued`) เท่านั้น
> เอกสารนี้บอกว่าถ้าจะต่อ LINE จริง ต้องเตรียม/ทำอะไรบ้าง และต้องแก้โค้ดตรงไหน

## 1. ภาพรวม: ใช้ LINE สองส่วน

| ส่วน | ใช้ทำอะไร | ในเดโมตอนนี้ |
|---|---|---|
| **LINE OA ฝั่งลูกค้า** (Messaging API) | ส่งยืนยันการจอง / เตือนก่อนถึงคิว / แจ้งคะแนน | `notifier` ช่อง `customer_oa` จดลงตาราง |
| **LINE OA ฝั่งพนักงาน** (บัญชี OA แยกต่างหาก หรือกลุ่ม LINE ของสาขา) | แจ้งคิวใหม่ / ยกเลิก / สรุปยอดตอนกลางคืน | `notifier` ช่อง `staff_oa` จดลงตาราง |
| **LINE Login + LIFF** | ให้ลูกค้าเปิดหน้าจองในแอป LINE และรู้ว่าเป็นใคร | `POST /api/customer/session` ออก token ลูกค้าเดโม (`c-demo`) แทน |

แนะนำให้สร้าง OA **สองบัญชี** (ลูกค้า / พนักงาน) เพื่อไม่ให้ข้อความภายในหลุดไปหาลูกค้า

## 2. สิ่งที่ต้องสมัคร/สร้าง (ทำโดยเจ้าของร้านเอง)

1. **LINE Official Account** (ฟรีเปิดได้ที่ https://manager.line.biz) — ตั้งชื่อ ROSELANNA และอัปโลโก้
2. **LINE Developers Console** (https://developers.line.biz) ล็อกอินด้วยบัญชี LINE ของเจ้าของ แล้วสร้าง
   - 1 **Provider** (เช่น "ROSELANNA")
   - **Messaging API channel** ผูกกับ OA ลูกค้า (และอีกอันสำหรับ OA พนักงาน)
   - **LINE Login channel** สำหรับ LIFF (ต้องอยู่ใน Provider เดียวกับ Messaging API channel เพื่อให้ได้ `userId` ตัวเดียวกัน)
3. **เซิร์ฟเวอร์ที่เข้าถึงจากอินเทอร์เน็ตด้วย HTTPS** (LINE ไม่ยิง webhook เข้า localhost) — ดูตัวเลือกโฮสต์ใน README
4. (ถ้าต้องการ) ยืนยันบัญชี OA (โล่สีน้ำเงิน) — LINE แจ้งว่ามีค่าธรรมเนียมครั้งเดียว ตรวจราคาล่าสุดที่หน้า LINE for Business

## 3. ค่าลับ (secrets) ที่ต้องเก็บ — **ห้าม commit ลง GitHub**

เก็บเป็น environment variable บนเซิร์ฟเวอร์เท่านั้น (ไฟล์ `.env` ถูก `.gitignore` ไว้แล้ว)

| ตัวแปร | ได้จากไหน | ใช้ทำอะไร |
|---|---|---|
| `LINE_CUSTOMER_CHANNEL_SECRET` | Developers Console › Messaging API channel › Basic settings | ตรวจลายเซ็น webhook (`X-Line-Signature`) |
| `LINE_CUSTOMER_ACCESS_TOKEN` | Messaging API tab › Channel access token (long-lived หรือแบบ stateless) | เรียก push/reply API |
| `LINE_STAFF_CHANNEL_SECRET` / `LINE_STAFF_ACCESS_TOKEN` | เหมือนกัน แต่ของ OA พนักงาน | ตรวจ webhook / ส่งแจ้งเตือนพนักงาน |
| `LINE_LOGIN_CHANNEL_ID` | LINE Login channel › Basic settings | ตรวจ ID token ของ LIFF (`client_id`) |
| `LIFF_ID` | LINE Login channel › LIFF tab (เป็นค่าสาธารณะ ใส่ในหน้าเว็บได้) | เปิดหน้า `/customer/` ในแอป LINE |

ถ้า token รั่ว ให้ออก token ใหม่ที่ Console ทันที

## 4. Webhook (LINE → เซิร์ฟเวอร์เรา)

ใช้เมื่อลูกค้าเพิ่มเพื่อน / พิมพ์ข้อความ / กดปุ่มใน Rich Menu

- ตั้ง **Webhook URL** = `https://<โดเมนของเรา>/line/webhook/customer` (และ `/staff` ของอีก OA) แล้วเปิด *Use webhook*
- ปิด *Auto-reply messages* และ *Greeting* ใน OA Manager ถ้าจะให้เซิร์ฟเวอร์เป็นคนตอบเอง
- **ต้องตรวจลายเซ็นทุกครั้ง** ก่อนเชื่อข้อมูล:
  - อ่าน **raw body** (ก่อน `JSON.parse`) → คำนวณ `HMAC-SHA256(channelSecret, rawBody)` เข้ารหัส Base64
  - เทียบกับ header `X-Line-Signature` ด้วย `crypto.timingSafeEqual`
  - ไม่ตรง → ตอบ 401 และไม่ทำอะไรต่อ
- ตอบ HTTP 200 เร็ว ๆ แล้วค่อยประมวลผลต่อ (LINE จะลองส่งซ้ำถ้าช้า/ผิดพลาด จึงต้องกันประมวลผลซ้ำด้วย `webhookEventId`)
- event ที่ใช้: `follow` (เก็บ `userId` ผูกกับลูกค้า), `unfollow`, `message`, `postback` (เช่นปุ่ม "ยกเลิกคิว")
- ใน Express ต้องเก็บ raw body เช่น `express.json({ verify: (req,res,buf) => { req.rawBody = buf; } })`

## 5. LIFF + LINE Login (ให้ลูกค้าเข้าหน้าจองโดยไม่ต้องกรอกอะไร)

1. ใน LINE Login channel สร้าง **LIFF app** — *Endpoint URL* = `https://<โดเมนของเรา>/customer/`, scope `profile openid`
2. ที่หน้า `/customer/` โหลด LIFF SDK แล้วเรียก `liff.init({liffId})` → ถ้ายังไม่ล็อกอิน `liff.login()` → ได้ `liff.getIDToken()`
3. หน้าเว็บส่ง **ID token** ไป `POST /api/customer/session` (แทนที่ endpoint เดโมที่ไม่ต้องใช้ข้อมูลอะไร)
4. เซิร์ฟเวอร์ **ตรวจ ID token ฝั่งเซิร์ฟเวอร์เสมอ** ที่ `POST https://api.line.me/oauth2/v2.1/verify` (พารามิเตอร์ `id_token`, `client_id=LINE_LOGIN_CHANNEL_ID`)
   → ได้ `sub` (= LINE `userId`) และชื่อที่แสดง
5. หา/สร้างแถว `customers` ด้วย `line_user_id = sub` แล้วออก session token ของเราเอง (ตารางและโค้ด `newSession('customer', …)` มีอยู่แล้ว) — หน้าที่เหลือของ API ไม่ต้องแก้
6. อย่าเชื่อ `userId` ที่หน้าเว็บส่งมาเฉย ๆ — ต้องมาจากการตรวจ ID token เท่านั้น

> ต้องเพิ่มคอลัมน์ `customers.line_user_id` (unique) — ตอนนี้ยังไม่มีเพราะเดโมไม่ใช้ข้อมูลส่วนบุคคลจริง

## 6. ส่งข้อความ (แทนที่ `outbox-only`)

`server/src/notifier.js` ทุกข้อความถูกจดลงตาราง `notifications` (`channel`, `kind`, `recipient`, `body`, `status`)
ให้เขียน **transport** ใหม่ที่มีเมธอด `deliver(row)` แล้วส่งเข้า `createNotifier({ transport })` ใน `server/src/app.js`:

```js
// ตัวอย่างโครง (ยังไม่ได้ใช้งานจริง)
const lineTransport = {
  name: 'line',
  async deliver(row) {
    const token = row.channel === 'customer_oa' ? process.env.LINE_CUSTOMER_ACCESS_TOKEN : process.env.LINE_STAFF_ACCESS_TOKEN;
    const to = resolveLineUserId(row.recipient);       // 'customer:c-123' → LINE userId ; 'branch:bkk' → groupId ของสาขา
    if (!to) return { ok: false };
    const r = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'X-Line-Retry-Key': crypto.randomUUID() },
      body: JSON.stringify({ to, messages: [{ type: 'text', text: row.body }] })
    });
    return { ok: r.ok };
  }
};
```

แล้วเพิ่มตัวจับเวลาเรียก `notifier.flush()` ทุกนาที (ตอนนี้ `flush` มีอยู่แต่ยังไม่ถูกเรียกอัตโนมัติ)
ส่วนตัวจับเวลาของ `queueReminders()` (เตือนก่อนถึงคิว 2 ชม.) และ `queueNightlySummary()` (หลัง 22:30 เวลากรุงเทพ) มีอยู่แล้วใน `server/src/index.js`
และสั่งด้วยมือได้ผ่าน `POST /api/admin/jobs/reminders` และ `/api/admin/jobs/nightly-summary` (เฉพาะเจ้าของ)

**ข้อควรรู้เรื่องโควตา/ราคา** (ตรวจจากหน้า LINE for Business ประเทศไทย เดือน ต.ค. 2569 — ราคายังไม่รวม VAT 7% และเปลี่ยนได้):
แพ็กเกจฟรี 300 ข้อความ/เดือน, เบสิก ฿1,280 (15,000 ข้อความ), โปร ฿1,780 (35,000 ข้อความ)
ข้อความ **push** (ร้านทักก่อน เช่น เตือนคิว) นับโควตา ส่วน **reply** (ตอบหลังลูกค้าทักมา โดยใช้ `replyToken`) ไม่นับ
ดังนั้นควรให้ข้อความยืนยันการจองไปทาง reply เมื่อทำได้ และใช้ push เฉพาะเตือนคิว/สรุปพนักงาน

## 7. Rich Menu (เมนูด้านล่างแชต OA)

สร้างใน OA Manager หรือผ่าน API: ปุ่ม "จองคิว" → ลิงก์ `https://liff.line.me/<LIFF_ID>`, ปุ่ม "คะแนนของฉัน" → ลิงก์เข้าหน้า `/customer/` (แท็บคะแนน),
"โปรโมชั่น", "ติดต่อสาขา" (โทร)

## 8. ความปลอดภัย / PDPA ที่ต้องทำก่อนใช้จริง

- เก็บเฉพาะข้อมูลที่จำเป็น (ชื่อที่แสดง, LINE userId, เบอร์ถ้าจำเป็น) และแจ้งนโยบายความเป็นส่วนตัว + ขอความยินยอม
- เซิร์ฟเวอร์จริงต้องใช้ HTTPS, ตั้ง `ROSELANNA_CORS` เฉพาะโดเมนของร้าน, **ปิด** `ROSELANNA_DEMO_LOGIN=0`
- พนักงานต้องมีรหัสผ่าน/PIN จริง (เดโมใช้ปุ่มเลือกบทบาทเฉย ๆ) แล้วสิทธิ์ที่เซิร์ฟเวอร์บังคับอยู่แล้วจะใช้ต่อได้ทันที
- สำรองไฟล์ฐานข้อมูล SQLite ทุกวัน (หรือย้ายไป Postgres)

## 9. ลำดับงานแนะนำเมื่อพร้อมต่อจริง

1. โฮสต์เซิร์ฟเวอร์กลาง (HTTPS) + ใส่ env ตามข้อ 3
2. ทำ webhook + ตรวจลายเซ็น (ข้อ 4) ทดสอบด้วยปุ่ม *Verify* ใน Console
3. ทำ LIFF login (ข้อ 5) แล้วปิด demo login
4. เขียน `lineTransport` (ข้อ 6) ลองกับบัญชีทดสอบของเจ้าของก่อน
5. เปิดให้ลูกค้าจริง
