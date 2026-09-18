const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const config = require('../config');
const logger = require('../infrastructure/logger');


/* =========================================================
   DATABASE PATH
========================================================= */

const dbPath = config.dbPath;

if (!dbPath) {
  throw new Error(
    'Database path is not configured. Please check DB_PATH in the configuration.'
  );
}

const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, {
    recursive: true
  });
}


/* =========================================================
   DATABASE CONNECTION
========================================================= */

const db = new Database(dbPath);


/*
 * WAL improves reliability when the bot is reading and
 * writing SQLite data frequently.
 */
db.pragma('journal_mode = WAL');

/*
 * Foreign-key support.
 */
db.pragma('foreign_keys = ON');

/*
 * Reasonable synchronous mode for a Telegram bot.
 */
db.pragma('synchronous = NORMAL');


/* =========================================================
   DATABASE INITIALIZATION
========================================================= */

function initDatabase() {
  db.exec(`
    /* -----------------------------------------------------
       CONVERSATIONS
    ----------------------------------------------------- */

    CREATE TABLE IF NOT EXISTS conversations (
      customer_id INTEGER PRIMARY KEY,

      customer_name TEXT DEFAULT '',

      selected_product TEXT,

      conversation_stage TEXT DEFAULT 'Greeting',

      payment_status TEXT DEFAULT 'none',

      customer_intent TEXT DEFAULT 'unknown',

      conversation_summary TEXT DEFAULT '',

      customer_emotion TEXT DEFAULT 'neutral',

      message_history TEXT DEFAULT '[]',

      last_updated INTEGER
    );


    /* -----------------------------------------------------
       ORDERS
    ----------------------------------------------------- */

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


    /* -----------------------------------------------------
       USED TRANSACTION IDs
    ----------------------------------------------------- */

    CREATE TABLE IF NOT EXISTS used_trx (
      trx_id TEXT PRIMARY KEY
    );


    /* -----------------------------------------------------
       USER STATES
    ----------------------------------------------------- */

    CREATE TABLE IF NOT EXISTS user_states (
      user_id INTEGER PRIMARY KEY,

      step TEXT DEFAULT 'home',

      product TEXT,

      order_id TEXT,

      screenshot_file_id TEXT,

      last_support_message INTEGER DEFAULT 0
    );
  `);


  /* =======================================================
     INDEXES
  ======================================================= */

  /*
   * Faster order lookup by user.
   */
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_orders_user_id
    ON orders(user_id);
  `);


  /*
   * Faster order lookup by product.
   */
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_orders_product
    ON orders(product);
  `);


  /*
   * Faster pending-order checks.
   */
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_orders_status
    ON orders(status);
  `);


  /*
   * Faster conversation update/read.
   *
   * customer_id is already the PRIMARY KEY, so this index
   * is mainly kept unnecessary-free and is intentionally
   * not duplicated here.
   */


  logger.success(
    'SQLite database initialized successfully'
  );
}


/* =========================================================
   DATABASE HEALTH CHECK
========================================================= */

function checkDatabase() {
  try {
    db.prepare('SELECT 1').get();

    return true;
  } catch (err) {
    logger.error(
      `SQLite database health check failed: ${err.message}`
    );

    return false;
  }
}


/* =========================================================
   GRACEFUL CLOSE
========================================================= */

function closeDatabase() {
  try {
    if (db.open) {
      db.close();

      logger.info(
        'SQLite database connection closed'
      );
    }
  } catch (err) {
    logger.error(
      `Failed to close SQLite database: ${err.message}`
    );
  }
}


/* =========================================================
   PROCESS SHUTDOWN HANDLERS
========================================================= */

function registerShutdownHandlers() {
  const shutdown = (signal) => {
    logger.info(
      `Received ${signal}. Closing database...`
    );

    closeDatabase();

    /*
     * Do not force process.exit() here.
     * Let Node.js finish remaining cleanup naturally.
     */
  };


  process.once(
    'SIGINT',
    () => shutdown('SIGINT')
  );

  process.once(
    'SIGTERM',
    () => shutdown('SIGTERM')
  );
}


/*
 * Register shutdown handlers once when this module loads.
 */
registerShutdownHandlers();


/* =========================================================
   EXPORT
========================================================= */

module.exports = {
  db,
  initDatabase,
  checkDatabase,
  closeDatabase
};
