'use strict';
const { bad } = require('./errors');
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
function day(v, name) {
  if (typeof v !== 'string' || !DAY_RE.test(v) || isNaN(Date.parse(v + 'T00:00:00Z'))) throw bad('invalid_' + (name || 'day'), 'วันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)');
  return v;
}
function oneOf(v, list, name) {
  if (typeof v !== 'string' || !list.includes(v)) throw bad('invalid_' + name, 'ค่า ' + name + ' ไม่ถูกต้อง');
  return v;
}
function int(v, min, max, name) {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw bad('invalid_' + name, 'ค่า ' + name + ' ไม่ถูกต้อง');
  return v;
}
function text(v, max, name, optional) {
  if (v == null || v === '') { if (optional) return ''; throw bad('invalid_' + name, 'ต้องระบุ ' + name); }
  if (typeof v !== 'string' || v.length > max) throw bad('invalid_' + name, name + ' ยาวเกินไป');
  // ตัดอักขระควบคุม
  return v.replace(/[\u0000-\u001f\u007f]/g, '').trim();
}
function obj(v) { if (!v || typeof v !== 'object' || Array.isArray(v)) throw bad('invalid_body', 'ข้อมูลที่ส่งมาไม่ถูกต้อง'); return v; }
module.exports = { day, oneOf, int, text, obj };
