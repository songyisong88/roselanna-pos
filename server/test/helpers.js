'use strict';
const { openDb } = require('../src/db');
const { makeClock } = require('../src/time');
const { createApp } = require('../src/app');
const { resetAndSeed } = require('../src/seed');

// เวลาจำลอง: 26 ต.ค. 2026 09:00 (เวลาไทย) — ยังไม่เปิดร้าน จึงมีช่วงว่างทั้งวัน
const T0 = Date.UTC(2026, 9, 26, 2, 0, 0);
async function start(extra) {
  const state = { now: T0 };
  const clock = makeClock({ nowMs: () => state.now });
  const db = openDb(':memory:');
  resetAndSeed(db, clock);
  const ctx = createApp(Object.assign({ db, clock, noRateLimit: true, serveStatic: false }, extra || {}));
  const server = await new Promise(r => { const s = ctx.app.listen(0, '127.0.0.1', () => r(s)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  async function call(method, path, { token, body } = {}) {
    const res = await fetch(base + path, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}), body: body === undefined ? undefined : JSON.stringify(body) });
    let json = null; try { json = await res.json(); } catch (e) {}
    return { status: res.status, body: json };
  }
  const login = async (role, extra2) => (await call('POST', '/api/auth/demo-login', { body: Object.assign({ role }, extra2 || {}) })).body.token;
  const customer = async () => (await call('POST', '/api/customer/session')).body.token;
  return { ...ctx, state, base, call, login, customer, close: () => new Promise(r => server.close(r)) };
}
module.exports = { start, T0 };
