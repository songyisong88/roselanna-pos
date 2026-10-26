'use strict';
const Database = require('better-sqlite3');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS branches(id TEXT PRIMARY KEY, name TEXT NOT NULL, short TEXT NOT NULL, addr TEXT, dist TEXT, weight REAL DEFAULT 1);
CREATE TABLE IF NOT EXISTS rooms(id TEXT PRIMARY KEY, branch_id TEXT NOT NULL REFERENCES branches(id), code TEXT NOT NULL, name TEXT NOT NULL, UNIQUE(branch_id, code));
CREATE TABLE IF NOT EXISTS services(id TEXT PRIMARY KEY, name TEXT NOT NULL, sub TEXT, dur INTEGER NOT NULL CHECK(dur>0), price INTEGER NOT NULL CHECK(price>=0));
CREATE TABLE IF NOT EXISTS addons(id TEXT PRIMARY KEY, name TEXT NOT NULL, price INTEGER NOT NULL CHECK(price>=0));
CREATE TABLE IF NOT EXISTS therapists(id TEXT PRIMARY KEY, branch_id TEXT NOT NULL REFERENCES branches(id), name TEXT NOT NULL, level INTEGER, av INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS customers(
  id TEXT PRIMARY KEY, name TEXT NOT NULL, points INTEGER NOT NULL DEFAULT 0 CHECK(points>=0),
  tier TEXT NOT NULL DEFAULT 'none' CHECK(tier IN ('none','member','vip')),
  line_user_id TEXT, last_visit_day TEXT, created_at INTEGER NOT NULL, is_example INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS points_history(id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id TEXT NOT NULL REFERENCES customers(id), day TEXT NOT NULL, text TEXT NOT NULL, delta INTEGER NOT NULL, ts INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS users(
  id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner','branch_manager','cashier','therapist')),
  branch_id TEXT REFERENCES branches(id), therapist_id TEXT REFERENCES therapists(id));
CREATE TABLE IF NOT EXISTS sessions(
  token_hash TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('staff','customer')),
  user_id TEXT, customer_id TEXT, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS bookings(
  id TEXT PRIMARY KEY, branch_id TEXT NOT NULL REFERENCES branches(id), day TEXT NOT NULL, start INTEGER NOT NULL, dur INTEGER NOT NULL CHECK(dur>0),
  service_id TEXT NOT NULL REFERENCES services(id), room_id TEXT NOT NULL REFERENCES rooms(id), therapist_id TEXT NOT NULL REFERENCES therapists(id),
  customer_id TEXT REFERENCES customers(id), cust_name TEXT,
  status TEXT NOT NULL CHECK(status IN ('booked','running','paid','cancelled')),
  src TEXT NOT NULL CHECK(src IN ('line','walkin')), addons TEXT NOT NULL DEFAULT '[]', disc INTEGER, pay TEXT,
  started_at INTEGER, ends_at INTEGER, paid_at INTEGER, sale_id TEXT, created_at INTEGER NOT NULL, created_by TEXT);
CREATE INDEX IF NOT EXISTS ix_bookings_room ON bookings(room_id, day);
CREATE INDEX IF NOT EXISTS ix_bookings_ther ON bookings(therapist_id, day);
CREATE INDEX IF NOT EXISTS ix_bookings_branch_day ON bookings(branch_id, day);
CREATE TABLE IF NOT EXISTS sales(
  id TEXT PRIMARY KEY, branch_id TEXT NOT NULL REFERENCES branches(id), day TEXT NOT NULL, ts INTEGER NOT NULL,
  service_id TEXT NOT NULL, therapist_id TEXT NOT NULL, booking_id TEXT, customer_id TEXT,
  gross INTEGER NOT NULL, addons TEXT NOT NULL DEFAULT '[]', pct INTEGER NOT NULL, total INTEGER NOT NULL,
  pay TEXT NOT NULL CHECK(pay IN ('cash','qr','card')), commission INTEGER NOT NULL, points INTEGER NOT NULL DEFAULT 0, cashier_id TEXT);
CREATE INDEX IF NOT EXISTS ix_sales_ts ON sales(branch_id, ts);
CREATE TABLE IF NOT EXISTS audit_log(
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, actor_kind TEXT, actor_id TEXT, role TEXT, branch_id TEXT,
  action TEXT NOT NULL, entity TEXT, entity_id TEXT, detail TEXT, ok INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS notifications(
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('customer_oa','staff_oa')), kind TEXT NOT NULL, recipient TEXT NOT NULL,
  body TEXT NOT NULL, payload TEXT, status TEXT NOT NULL DEFAULT 'queued', dedupe_key TEXT UNIQUE, sent_at INTEGER);
CREATE TABLE IF NOT EXISTS counters(name TEXT PRIMARY KEY, value INTEGER NOT NULL);
-- กันจองซ้อนที่ระดับฐานข้อมูลอีกชั้น (ห้องและหมอนวด) นอกเหนือจากการตรวจในโค้ด
CREATE TRIGGER IF NOT EXISTS bk_no_overlap_ins BEFORE INSERT ON bookings WHEN NEW.status!='cancelled'
BEGIN
  SELECT RAISE(ABORT,'ROOM_CONFLICT') WHERE EXISTS(SELECT 1 FROM bookings b WHERE b.room_id=NEW.room_id AND b.day=NEW.day AND b.status!='cancelled' AND b.start<NEW.start+NEW.dur AND NEW.start<b.start+b.dur);
  SELECT RAISE(ABORT,'THERAPIST_CONFLICT') WHERE EXISTS(SELECT 1 FROM bookings b WHERE b.therapist_id=NEW.therapist_id AND b.day=NEW.day AND b.status!='cancelled' AND b.start<NEW.start+NEW.dur AND NEW.start<b.start+b.dur);
END;
CREATE TRIGGER IF NOT EXISTS bk_no_overlap_upd BEFORE UPDATE OF room_id, therapist_id, day, start, dur, status ON bookings WHEN NEW.status!='cancelled'
BEGIN
  SELECT RAISE(ABORT,'ROOM_CONFLICT') WHERE EXISTS(SELECT 1 FROM bookings b WHERE b.id!=NEW.id AND b.room_id=NEW.room_id AND b.day=NEW.day AND b.status!='cancelled' AND b.start<NEW.start+NEW.dur AND NEW.start<b.start+b.dur);
  SELECT RAISE(ABORT,'THERAPIST_CONFLICT') WHERE EXISTS(SELECT 1 FROM bookings b WHERE b.id!=NEW.id AND b.therapist_id=NEW.therapist_id AND b.day=NEW.day AND b.status!='cancelled' AND b.start<NEW.start+NEW.dur AND NEW.start<b.start+b.dur);
END;
`;

function openDb(file) {
  const db = new Database(file || ':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}
module.exports = { openDb };
