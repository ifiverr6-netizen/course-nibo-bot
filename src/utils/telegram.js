const logger = require('../infrastructure/logger');

async function safeReply(ctx, text, extra = {}) {
  try {
    return await ctx.reply(text, extra);
  } catch (err) {
    logger.error('Failed to send reply', err);
    return null;
  }
}

async function safeReplyWithPhoto(ctx, photo, extra = {}) {
  try {
    return await ctx.replyWithPhoto(photo, extra);
  } catch (err) {
    logger.error('Failed to send photo', err);
    return null;
  }
}

async function safeSend(bot, chatId, text, extra = {}) {
  try {
    return await bot.telegram.sendMessage(chatId, text, extra);
  } catch (err) {
    logger.error(`Failed to send to ${chatId}`, err);
    return null;
  }
}

async function safeSendPhoto(bot, chatId, photo, extra = {}) {
  try {
    return await bot.telegram.sendPhoto(chatId, photo, extra);
  } catch (err) {
    logger.error(`Failed to send photo to ${chatId}`, err);
    return null;
  }
}

module.exports = { safeReply, safeReplyWithPhoto, safeSend, safeSendPhoto };
