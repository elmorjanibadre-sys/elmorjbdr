// Base SQLite intégrée à Node (node:sqlite) : aucune dépendance externe.
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  name TEXT,
  platform TEXT,
  created_at INTEGER NOT NULL,
  last_scan_at INTEGER,
  last_error TEXT
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  title TEXT,
  url TEXT,
  image TEXT,
  price REAL,
  available INTEGER,
  inventory INTEGER,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  removed_at INTEGER,
  UNIQUE (store_id, external_id)
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  old_value REAL,
  new_value REAL,
  amount REAL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS events_store_time ON events (store_id, created_at);
CREATE TABLE IF NOT EXISTS ads (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  page_name TEXT,
  platform TEXT,
  text TEXT,
  transcript TEXT,
  video_url TEXT,
  landing_url TEXT,
  started_at INTEGER,
  last_seen_at INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  hook TEXT,
  hook_types TEXT,
  hook_score INTEGER,
  language TEXT,
  price_mad REAL,
  created_at INTEGER NOT NULL,
  UNIQUE (source, external_id)
);
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  city TEXT,
  category TEXT,
  contact TEXT,
  url TEXT,
  moq TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL
);
`;

function openDb(file = process.env.DB_FILE || 'radar.db') {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

module.exports = { openDb };
