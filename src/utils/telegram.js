const logger = require('../infrastructure/logger');

/**
 * Safely send a text reply to the current chat.
 */
async function safeReply(ctx, text, extra = {}) {
  try {
    return await ctx.reply(text, extra);
  } catch (err) {
    logger.error('Failed to send reply', err);
    return null;
  }
}

/**
 * Safely send a photo reply to the current chat.
 *
 * Supports:
 * - URL
 * - Telegram file_id
 * - Telegram InputFile object
 */
async function safeReplyWithPhoto(ctx, photo, extra = {}) {
  try {
    return await ctx.replyWithPhoto(photo, extra);
  } catch (err) {
    logger.error('Failed to send photo reply', err);
    return null;
  }
}

/**
 * Safely send a text message from the bot.
 */
async function safeSend(bot, chatId, text, extra = {}) {
  try {
    return await bot.telegram.sendMessage(chatId, text, extra);
  } catch (err) {
    logger.error(`Failed to send message to ${chatId}`, err);
    return null;
  }
}

/**
 * Safely send a photo from the bot.
 */
async function safeSendPhoto(bot, chatId, photo, extra = {}) {
  try {
    return await bot.telegram.sendPhoto(chatId, photo, extra);
  } catch (err) {
    logger.error(`Failed to send photo to ${chatId}`, err);
    return null;
  }
}

/**
 * Safely edit an existing Telegram message.
 *
 * Useful for inline-button interactions where the bot
 * needs to update the current message instead of sending
 * unnecessary new messages.
 */
async function safeEditMessageText(ctx, text, extra = {}) {
  try {
    return await ctx.editMessageText(text, extra);
  } catch (err) {
    logger.error('Failed to edit Telegram message', err);
    return null;
  }
}

/**
 * Safely answer an inline keyboard callback query.
 *
 * Prevents Telegram's loading spinner from remaining active
 * when callback processing encounters an error.
 */
async function safeAnswerCbQuery(ctx, text = '', extra = {}) {
  try {
    return await ctx.answerCbQuery(text, extra);
  } catch (err) {
    logger.error('Failed to answer callback query', err);
    return null;
  }
}

/**
 * Safely delete the current message.
 */
async function safeDeleteMessage(ctx) {
  try {
    return await ctx.deleteMessage();
  } catch (err) {
    logger.error('Failed to delete Telegram message', err);
    return null;
  }
}

module.exports = {
  safeReply,
  safeReplyWithPhoto,
  safeSend,
  safeSendPhoto,
  safeEditMessageText,
  safeAnswerCbQuery,
  safeDeleteMessage
};
