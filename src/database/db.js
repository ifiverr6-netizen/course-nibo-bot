const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const logger = require('../infrastructure/logger');

const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      customer_id INTEGER PRIMARY KEY,
      customer_name TEXT,
      selected_product TEXT,
      conversation_stage TEXT DEFAULT 'Greeting',
      payment_status TEXT DEFAULT 'none',
      customer_intent TEXT,
      conversation_summary TEXT,
      customer_emotion TEXT DEFAULT 'neutral',
      message_history TEXT DEFAULT '[]',
      last_updated INTEGER
    );

    CREATE TABLE IF NOT EXISTS orders (
      order_id TEXT PRIMARY KEY,
      user_id INTEGER,
      customer_name TEXT,
      username TEXT,
      product TEXT,
      price TEXT,
      trx_id TEXT UNIQUE,
      screenshot_file_id TEXT,
      status TEXT,
      created_at INTEGER,
      created_at_text TEXT
    );

    CREATE TABLE IF NOT EXISTS used_trx (
      trx_id TEXT PRIMARY KEY
    );

    CREATE TABLE IF NOT EXISTS user_states (
      user_id INTEGER PRIMARY KEY,
      step TEXT DEFAULT 'home',
      product TEXT,
      order_id TEXT,
      screenshot_file_id TEXT,
      last_support_message INTEGER DEFAULT 0
    );
  `);
  logger.success('SQLite database initialized');
}

module.exports = { db, initDatabase };
