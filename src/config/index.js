require('dotenv').config();

const required = ['BOT_TOKEN', 'ADMIN_ID', 'BKASH_NUMBER', 'NAGAD_NUMBER', 'SUPPORT_USERNAME'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

module.exports = {
  botToken: process.env.BOT_TOKEN,
  adminId: process.env.ADMIN_ID,
  bkashNumber: process.env.BKASH_NUMBER,
  nagadNumber: process.env.NAGAD_NUMBER,
  supportUsername: process.env.SUPPORT_USERNAME,
  groqApiKey: process.env.GROQ_API_KEY || null,
  port: Number(process.env.PORT) || 3000,
  dbPath: process.env.DB_PATH || './data/course_nibo.db'
};
