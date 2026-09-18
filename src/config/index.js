require('dotenv').config();

/*
 * =========================================================
 * ENVIRONMENT CONFIGURATION
 * =========================================================
 *
 * Payment/contact values are NOT changed here.
 * They are read directly from .env.
 */

const REQUIRED_ENV = [
  'BOT_TOKEN',
  'ADMIN_ID',
  'BKASH_NUMBER',
  'NAGAD_NUMBER',
  'SUPPORT_USERNAME'
];


function getRequiredEnv(name) {
  const value = process.env[name];

  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ''
  ) {
    console.error(
      `❌ Missing required environment variable: ${name}`
    );

    process.exit(1);
  }

  return String(value).trim();
}


function getOptionalEnv(
  name,
  fallback = null
) {
  const value = process.env[name];

  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ''
  ) {
    return fallback;
  }

  return String(value).trim();
}


function parsePort(
  value
) {
  const port =
    Number(value);

  if (
    Number.isInteger(port) &&
    port > 0 &&
    port <= 65535
  ) {
    return port;
  }

  return 3000;
}


function parseAdminId(
  value
) {
  const adminId =
    String(value).trim();

  if (!adminId) {
    console.error(
      '❌ ADMIN_ID cannot be empty.'
    );

    process.exit(1);
  }

  return adminId;
}


/*
 * Validate required environment variables.
 */
for (
  const key of REQUIRED_ENV
) {
  getRequiredEnv(key);
}


const config = {
  /*
   * Telegram
   */
  botToken:
    getRequiredEnv(
      'BOT_TOKEN'
    ),

  adminId:
    parseAdminId(
      getRequiredEnv(
        'ADMIN_ID'
      )
    ),


  /*
   * Payment
   *
   * Existing values from .env are preserved.
   */
  bkashNumber:
    getRequiredEnv(
      'BKASH_NUMBER'
    ),

  nagadNumber:
    getRequiredEnv(
      'NAGAD_NUMBER'
    ),


  /*
   * Customer support
   */
  supportUsername:
    getRequiredEnv(
      'SUPPORT_USERNAME'
    ),


  /*
   * Optional AI
   */
  groqApiKey:
    getOptionalEnv(
      'GROQ_API_KEY',
      null
    ),


  /*
   * HTTP server
   */
  port:
    parsePort(
      process.env.PORT
    ),


  /*
   * SQLite
   */
  dbPath:
    getOptionalEnv(
      'DB_PATH',
      './data/course_nibo.db'
    )
};


module.exports = config;
