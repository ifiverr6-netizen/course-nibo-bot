const express = require('express');
const config = require('./config');
const logger = require('./infrastructure/logger');
const { createBot } = require('./bot');

const app = express();
app.get('/', (req, res) => res.send('✅ Course Nibo Final Bot is running'));
app.listen(config.port, () => logger.success(`Web server on port ${config.port}`));

const bot = createBot();
bot.launch()
  .then(() => logger.success('Course Nibo Final + Sinthiya AI is live'))
  .catch(err => logger.error('Failed to launch bot', err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
