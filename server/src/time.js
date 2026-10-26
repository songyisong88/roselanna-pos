'use strict';
/* นาฬิกาของเซิร์ฟเวอร์ (เวลาไทย UTC+7 เป็นค่าตั้งต้น) แยกออกมาเพื่อให้ทดสอบได้ */
function makeClock(opts) {
  opts = opts || {};
  const offsetMin = opts.offsetMin != null ? opts.offsetMin : 420;
  const nowMs = opts.nowMs || (() => Date.now());
  const shifted = (ms) => new Date(ms + offsetMin * 60000);
  const keyOf = (ms) => shifted(ms).toISOString().slice(0, 10);
  return {
    offsetMin,
    nowMs,
    today: () => keyOf(nowMs()),
    dayKey: keyOf,
    nowMin: () => { const d = shifted(nowMs()); return d.getUTCHours() * 60 + d.getUTCMinutes(); },
    midnightMs: (key) => {
      const k = key || keyOf(nowMs()); const p = k.split('-').map(Number);
      return Date.UTC(p[0], p[1] - 1, p[2]) - offsetMin * 60000;
    },
    addDays: (key, n) => { const p = key.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10); }
  };
}
module.exports = { makeClock };
