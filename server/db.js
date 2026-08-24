// Uses Node's built-in SQLite (node:sqlite, stable in Node 24) so there is no
// native build step. A tiny shim adds the two better-sqlite3 conveniences we
// use (`pragma` and `transaction`).
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const raw = new DatabaseSync(path.join(__dirname, 'data.sqlite'));
raw.exec('PRAGMA journal_mode = WAL');

const db = {
  prepare: (sql) => raw.prepare(sql),
  exec: (sql) => raw.exec(sql),
  pragma: (p) => raw.exec('PRAGMA ' + p),
  transaction: (fn) => (...args) => {
    raw.exec('BEGIN');
    try { const r = fn(...args); raw.exec('COMMIT'); return r; }
    catch (e) { raw.exec('ROLLBACK'); throw e; }
  },
  _raw: raw,
};

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  username      TEXT,
  password_hash TEXT NOT NULL,
  fb_uid        TEXT,
  fb_name       TEXT,
  is_active     INTEGER DEFAULT 0,
  status        INTEGER DEFAULT 0,
  must_change_password INTEGER DEFAULT 0,
  registration_time TEXT,
  last_login_at INTEGER
);

CREATE TABLE IF NOT EXISTS services (
  id          INTEGER PRIMARY KEY,
  module_id   INTEGER NOT NULL,
  module_name TEXT,
  level       TEXT,
  level_id    INTEGER,
  name        TEXT,
  num         INTEGER,
  total_num   INTEGER,
  price       TEXT,
  rateCNY     REAL,
  type        INTEGER DEFAULT 1,
  sort        INTEGER DEFAULT 0,
  create_time TEXT,
  update_time TEXT
);

-- a user's currently-owned plan per module (their membership)
CREATE TABLE IF NOT EXISTS user_services (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  uid         INTEGER NOT NULL,
  module_id   INTEGER NOT NULL,
  module_name TEXT,
  level       TEXT,
  level_id    INTEGER,
  name        TEXT,
  num         INTEGER,
  total_num   INTEGER,
  months      INTEGER DEFAULT 0,
  start_time  INTEGER,
  end_time    INTEGER,
  UNIQUE(uid, module_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ordernum     TEXT UNIQUE,
  uid          INTEGER NOT NULL,
  module_id    INTEGER,
  module_name  TEXT,
  order_type   TEXT,            -- buy | renew | upgrade
  months       INTEGER,
  currency     TEXT,            -- USD | CNY
  amount       TEXT,
  pay_amount   TEXT,
  pay_method   TEXT,            -- stripe | cryptomus | ...
  order_status INTEGER DEFAULT 0,  -- 0 pending, 1 paid, 2 refunded
  pay_status   INTEGER DEFAULT 0,  -- 0 unpaid, 1 paid
  create_time  INTEGER,
  pay_time     INTEGER
);

CREATE TABLE IF NOT EXISTS fb_accounts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  uid        INTEGER NOT NULL,
  fbid       TEXT,
  name       TEXT,
  created_at INTEGER
);

-- generic per-module usage counter (list count / total count consumed)
CREATE TABLE IF NOT EXISTS usage_records (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  uid        INTEGER NOT NULL,
  module_id  INTEGER NOT NULL,
  used       INTEGER DEFAULT 0,
  reset_day  INTEGER DEFAULT 1,
  UNIQUE(uid, module_id)
);

CREATE TABLE IF NOT EXISTS tickets (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  uid          INTEGER NOT NULL,
  type         TEXT,
  title        TEXT,
  content      TEXT,
  status       INTEGER DEFAULT 0,  -- 0 open, 1 processing, 2 closed
  handler      TEXT,
  last_reply   TEXT,
  create_time  INTEGER,
  update_time  INTEGER
);

CREATE TABLE IF NOT EXISTS ticket_replies (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id  INTEGER NOT NULL,
  from_admin INTEGER DEFAULT 0,
  content    TEXT,
  create_time INTEGER
);

-- interest keyword categories + items (兴趣定位 saved files)
CREATE TABLE IF NOT EXISTS keyword_files (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  uid        INTEGER NOT NULL,
  name       TEXT,
  create_time INTEGER
);
CREATE TABLE IF NOT EXISTS keyword_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  uid        INTEGER NOT NULL,
  cat        INTEGER,
  keyword    TEXT,
  category   TEXT,
  audience   TEXT,
  link       TEXT
);

-- module notes / favourites keyed by object id
CREATE TABLE IF NOT EXISTS obj_meta (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  uid        INTEGER NOT NULL,
  module_id  INTEGER,
  obj_id     TEXT,
  note       TEXT,
  favourite  INTEGER DEFAULT 0,
  UNIQUE(uid, module_id, obj_id)
);
`);

module.exports = db;
