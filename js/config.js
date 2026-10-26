/* ROSELANNA — ตั้งค่าการเชื่อมต่อ
   serverUrl = null  → โหมดเบราว์เซอร์ (เก็บข้อมูลใน localStorage) ใช้บน GitHub Pages ได้เลย
   serverUrl = 'http://localhost:3000' → คุยกับเซิร์ฟเวอร์กลาง (ดู README)
   เมื่อรันผ่านเซิร์ฟเวอร์ของเรา ไฟล์นี้จะถูกแทนที่ให้อัตโนมัติ (server/src/app.js) */
window.RL_CONFIG = { serverUrl: null };
