const { Telegraf } = require('telegraf');

const config = require('./config');
const logger = require('./infrastructure/logger');

const { initDatabase } = require('./database/db');

const {
  getConversation,
  saveConversation,
  addMessageToHistory
} = require('./application/memory/conversationRepository');

const {
  getUserState,
  setUserState,
  resetUserState
} = require('./application/memory/stateRepository');

const {
  createOrder,
  getOrder,
  updateOrderStatus,
  isTrxUsed,
  getUserOrders,
  findPendingOrder
} = require('./application/memory/orderRepository');

const {
  getProduct,
  findProductByText,
  getCourseProducts
} = require('./domain/products');

const { generateReply } = require('./application/ai/replyGenerator');

const {
  DIVIDER,
  escapeHtml,
  nowBD,
  generateOrderId
} = require('./utils/format');

const { statusBadge } = require('./utils/theme');

const {
  safeReply,
  safeReplyWithPhoto,
  safeSend,
  safeSendPhoto
} = require('./utils/telegram');

const {
  mainMenuKeyboard,
  backToMenuKeyboard,
  coursesKeyboard,
  subsKeyboard,
  productActionsKeyboard,
  adminApprovalKeyboard
} = require('./interfaces/keyboards/keyboards');


/* =========================================================
   CONSTANTS
========================================================= */

const TRX_ID_REGEX = /^[A-Za-z0-9]{8,10}$/;

const SUPPORT_COOLDOWN_MS = 5 * 60 * 1000;

const MAX_AI_REPLY_LENGTH = 3500;


/* =========================================================
   BASIC HELPERS
========================================================= */

function isAdmin(ctx) {
  return Boolean(
    ctx.from &&
    config.adminId &&
    ctx.from.id.toString() === config.adminId.toString()
  );
}


/**
 * Safely convert a value to a string.
 */
function stringValue(value = '') {
  return String(value ?? '');
}


/**
 * Telegram supports a limited set of HTML tags.
 *
 * This sanitizer removes unsupported block/formatting tags
 * while preserving the useful Telegram HTML formatting.
 */
function sanitizeTelegramHtml(input = '') {
  let text = stringValue(input);

  text = text
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\/?(p|div|section|article|header|footer|main|span)[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<h[1-6][^>]*>/gi, '')
    .replace(/<\/h[1-6]>/gi, '');

  /*
   * Keep only common Telegram HTML tags.
   * Unsupported tags are removed.
   */
  text = text.replace(
    /<\/?([a-z][a-z0-9-]*)(?:\s+[^>]*)?>/gi,
    (fullTag, tagName) => {
      const tag = tagName.toLowerCase();

      const allowed = new Set([
        'b',
        'strong',
        'i',
        'em',
        'u',
        'ins',
        's',
        'strike',
        'del',
        'code',
        'pre',
        'a'
      ]);

      if (!allowed.has(tag)) {
        return '';
      }

      /*
       * Keep only safe href attributes for <a>.
       */
      if (tag === 'a') {
        const hrefMatch = fullTag.match(
          /href\s*=\s*["']([^"']+)["']/i
        );

        if (!hrefMatch) {
          return '';
        }

        const href = hrefMatch[1];

        if (!/^(https?:\/\/|tg:\/\/)/i.test(href)) {
          return '';
        }

        const isClosing = /^<\s*\//.test(fullTag);

        return isClosing
          ? '</a>'
          : `<a href="${escapeHtml(href)}">`;
      }

      return /^<\s*\//.test(fullTag)
        ? `</${tag}>`
        : `<${tag}>`;
    });

  return text.trim();
}


/**
 * Convert accidental Markdown bold from the AI into Telegram HTML.
 */
function convertMarkdownBoldToHtml(text = '') {
  return stringValue(text)
    .replace(/\*\*(.*?)\*\*/gs, '<b>$1</b>')
    .replace(/(?<!<)\*(.*?)\*(?!>)/gs, '<b>$1</b>');
}


/**
 * Clean an AI response before sending it to Telegram.
 */
function cleanAiReply(text = '') {
  let clean = stringValue(text);

  clean = convertMarkdownBoldToHtml(clean);

  clean = sanitizeTelegramHtml(clean);

  /*
   * Prevent oversized AI responses from causing Telegram errors.
   */
  if (clean.length > MAX_AI_REPLY_LENGTH) {
    clean = clean.slice(0, MAX_AI_REPLY_LENGTH).trim();
  }

  return clean;
}


/**
 * Prevent accidental blank/invalid AI messages.
 */
function isUsableAiReply(text = '') {
  const value = stringValue(text).trim();

  if (!value) return false;

  if (value.length < 2) return false;

  return true;
}


/* =========================================================
   WELCOME
========================================================= */

function welcomeText(name) {
  const customerName = escapeHtml(name || 'Customer');

  return `👋 <b>আসসালামু আলাইকুম, ${customerName}!</b>

🌟 <b>Course Nibo-তে আপনাকে স্বাগতম।</b>

${DIVIDER}

📚 <b>আমাদের সার্ভিসসমূহ</b>
✨ <b>Premium Digital Courses</b>
🤖 <b>ChatGPT Go</b>
🎬 <b>Video Editing Courses</b>
💼 <b>Business Formula</b>

${DIVIDER}

💎 <b>কেন আমাদের বেছে নেবেন?</b>
✅ <b>দ্রুত ডেলিভারি (৫–১০ মিনিট)</b>
✅ <b>বিশ্বস্ত ও নিরাপদ সার্ভিস</b>
✅ <b>Personal Account-এ পেমেন্ট</b>
✅ <b>২৪/৭ সাপোর্ট</b>

${DIVIDER}

👇 <b>নিচের মেনু থেকে আপনার পছন্দের অপশন বেছে নিন।</b>`;
}


/* =========================================================
   PRODUCT CARD
========================================================= */

/**
 * Existing payment/contact information is intentionally preserved.
 *
 * Important:
 * These numbers are part of the verified Product Card flow.
 * Sinthiya AI itself is separately instructed not to volunteer
 * numbers unless the customer explicitly asks.
 */
function productCardCaption(product, orderId) {
  const title = escapeHtml(product?.title || 'Product');
  const price = escapeHtml(product?.price ?? '');

  return `🛒 <b>Order Summary</b>

📦 <b>Product:</b> <b>${title}</b>
💵 <b>Price:</b> <b>${price} BDT</b>
🆔 <b>Order ID:</b> <code>${escapeHtml(orderId)}</code>

${DIVIDER}

💳 <b>Payment Information</b>

<b>আপনার অর্ডার সম্পন্ন করতে নিচের যেকোনো একটি Personal Account-এ "Send Money" করুন।</b>

🟢 <b>bKash (Personal)</b>
📱 <code>${escapeHtml(config.bkashNumber)}</code>

🟠 <b>Nagad (Personal)</b>
📱 <code>${escapeHtml(config.nagadNumber)}</code>

${DIVIDER}

📌 <b>Payment করার পর:</b>
• <b>Payment Screenshot পাঠান</b>
• <b>Transaction ID পাঠান</b>

⏱️ <b>Verification: সাধারণত ৫–১০ মিনিট।</b>

🔐 <b>Verification সম্পন্ন হলে আপনার Product Access এই চ্যাটেই পাঠিয়ে দেওয়া হবে।</b>`;
}


/**
 * Send a product card with its course image.
 *
 * If the image fails, automatically falls back to text.
 */
async function sendProductCard(ctx, product, orderId) {
  if (!product) {
    return false;
  }

  const caption = productCardCaption(product, orderId);

  const sent = await safeReplyWithPhoto(ctx, product.photo, {
    caption,
    parse_mode: 'HTML',
    ...productActionsKeyboard()
  });

  if (sent) {
    return true;
  }

  await safeReply(ctx, caption, {
    parse_mode: 'HTML',
    ...productActionsKeyboard()
  });

  return true;
}


/**
 * Start a product purchase flow.
 */
async function startProductPurchase(ctx, product) {
  if (!product) {
    await safeReply(
      ctx,
      `⚠️ <b>প্রোডাক্টটি বর্তমানে পাওয়া যাচ্ছে না।</b>`,
      {
        parse_mode: 'HTML',
        ...backToMenuKeyboard()
      }
    );

    return false;
  }

  const userId = ctx.from.id;

  const existing = findPendingOrder(
    userId,
    product.code
  );

  if (existing) {
    await safeReply(
      ctx,
      `⏳ <b>এই প্রোডাক্টের একটি অর্ডার ইতিমধ্যে যাচাইয়ের অপেক্ষায় আছে।</b>

${DIVIDER}

📦 <b>Product:</b> <b>${escapeHtml(product.title)}</b>
🆔 <b>Order ID:</b> <code>${escapeHtml(existing.order_id)}</code>

<b>অনুগ্রহ করে আগের অর্ডারটি সম্পন্ন হওয়া পর্যন্ত অপেক্ষা করুন।</b>`,
      {
        parse_mode: 'HTML',
        ...backToMenuKeyboard()
      }
    );

    return false;
  }

  const orderId = generateOrderId();

  setUserState(userId, {
    step: 'awaiting_screenshot',
    product: product.code,
    orderId,
    screenshotFileId: null
  });

  const memory = getConversation(userId);

  memory.customerName =
    ctx.from.first_name || memory.customerName || 'Customer';

  memory.selectedProduct = product.code;
  memory.conversationStage = 'Product Selected';

  saveConversation(memory);

  await sendProductCard(
    ctx,
    product,
    orderId
  );

  return true;
}


/* =========================================================
   ORDERS
========================================================= */

function buildOrdersMessage(list = []) {
  let message = `📦 <b>My Orders</b>\n${DIVIDER}\n\n`;

  list.forEach((order, index) => {
    const product = getProduct(order.product);

    const productTitle =
      product?.title ||
      order.product ||
      'Unknown Product';

    message +=
      `${index + 1}. 🆔 <b>Order ID:</b> <code>${escapeHtml(order.order_id)}</code>\n` +
      `📦 <b>Product:</b> <b>${escapeHtml(productTitle)}</b>\n` +
      `💵 <b>Price:</b> <b>${escapeHtml(order.price)}</b>\n` +
      `📌 <b>Status:</b> ${statusBadge(order.status)}\n` +
      `🕒 <b>${escapeHtml(order.created_at_text || '')}</b>\n\n`;
  });

  return message.trim();
}


async function showUserOrders(ctx) {
  const list = getUserOrders(ctx.from.id);

  if (!list.length) {
    return safeReply(
      ctx,
      `📦 <b>My Orders</b>

${DIVIDER}

<b>আপনার এখনো কোনো অর্ডার নেই।</b>`,
      {
        parse_mode: 'HTML',
        ...backToMenuKeyboard()
      }
    );
  }

  return safeReply(
    ctx,
    buildOrdersMessage(list),
    {
      parse_mode: 'HTML',
      ...backToMenuKeyboard()
    }
  );
}


/* =========================================================
   FAQ
========================================================= */

const FAQ_TEXT =
  `❓ <b>Frequently Asked Questions</b>\n\n` +
  `${DIVIDER}\n\n` +

  `<b>১. ডেলিভারি পেতে কত সময় লাগে?</b>\n` +
  `<b>সাধারণত ৫–১০ মিনিটের মধ্যে।</b>\n\n` +

  `<b>২. কোন পেমেন্ট মেথড সাপোর্ট করে?</b>\n` +
  `<b>bKash এবং Nagad (Personal - Send Money)।</b>\n\n` +

  `<b>৩. Refund পাওয়া যায় কি?</b>\n` +
  `<b>Digital Product হওয়ায় Refund প্রযোজ্য নয়।</b>\n\n` +

  `<b>৪. সাপোর্ট কখন পাওয়া যায়?</b>\n` +
  `<b>প্রতিদিন সকাল ৯টা থেকে রাত ১২টা পর্যন্ত।</b>`;


async function showFaq(ctx) {
  return safeReply(
    ctx,
    FAQ_TEXT,
    {
      parse_mode: 'HTML',
      ...backToMenuKeyboard()
    }
  );
}


/* =========================================================
   SUPPORT
========================================================= */

function supportText(username) {
  return `<b>🎧 কাস্টমার সাপোর্ট</b>

${DIVIDER}

<b>কোনো প্রশ্ন বা সহায়তার প্রয়োজন হলে আমাদের টিমের সাথে যোগাযোগ করুন।</b>

👨‍💻 <b>Admin:</b> ${escapeHtml(username || 'Support')}

<b>অথবা আপনি সরাসরি এখানে মেসেজ লিখে পাঠাতে পারেন।</b>`;
}


async function showSupport(ctx) {
  return safeReply(
    ctx,
    supportText(config.supportUsername),
    {
      parse_mode: 'HTML',
      ...backToMenuKeyboard()
    }
  );
}


/* =========================================================
   COURSE LIST TEXT
========================================================= */

function coursesIntroText() {
  const count = getCourseProducts().length;

  return `📚 <b>Digital Courses</b>

${DIVIDER}

🎓 <b>মোট ${count}টি কোর্স available আছে।</b>

👇 <b>আপনার পছন্দের কোর্সটি নির্বাচন করুন:</b>`;
}


/* =========================================================
   MAIN BOT
========================================================= */

function createBot() {
  initDatabase();

  const bot = new Telegraf(config.botToken);


  /* =======================================================
     START
  ======================================================= */

  bot.start(async (ctx) => {
    const userId = ctx.from.id;

    resetUserState(userId);

    const memory = getConversation(userId);

    memory.customerName =
      ctx.from.first_name || 'Customer';

    memory.selectedProduct = null;
    memory.conversationStage = 'Greeting';

    saveConversation(memory);

    await safeReply(
      ctx,
      welcomeText(ctx.from.first_name || 'Customer'),
      {
        parse_mode: 'HTML',
        ...mainMenuKeyboard()
      }
    );
  });


  /* =======================================================
     MAIN MENU
  ======================================================= */

  bot.action('main_menu', async (ctx) => {
    await ctx.answerCbQuery();

    resetUserState(ctx.from.id);

    const memory = getConversation(ctx.from.id);

    memory.customerName =
      ctx.from.first_name || memory.customerName || 'Customer';

    memory.conversationStage = 'Greeting';

    saveConversation(memory);

    await safeReply(
      ctx,
      welcomeText(ctx.from.first_name || 'Customer'),
      {
        parse_mode: 'HTML',
        ...mainMenuKeyboard()
      }
    );
  });


  /* =======================================================
     COURSES
  ======================================================= */

  bot.action('view_courses', async (ctx) => {
    await ctx.answerCbQuery();

    await safeReply(
      ctx,
      coursesIntroText(),
      {
        parse_mode: 'HTML',
        ...coursesKeyboard()
      }
    );
  });


  /* =======================================================
     SUBSCRIPTIONS
  ======================================================= */

  bot.action('view_subs', async (ctx) => {
    await ctx.answerCbQuery();

    await safeReply(
      ctx,
      `⭐ <b>Premium Subscription</b>

${DIVIDER}

<b>আপনার পছন্দের প্ল্যানটি নির্বাচন করুন।</b>`,
      {
        parse_mode: 'HTML',
        ...subsKeyboard()
      }
    );
  });


  /* =======================================================
     PRODUCT PURCHASE
  ======================================================= */

  bot.action(/^buy_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();

    const code = ctx.match[1];

    const product = getProduct(code);

    if (!product) {
      return safeReply(
        ctx,
        `⚠️ <b>দুঃখিত, এই প্রোডাক্টটি পাওয়া যাচ্ছে না।</b>`,
        {
          parse_mode: 'HTML',
          ...backToMenuKeyboard()
        }
      );
    }

    await startProductPurchase(
      ctx,
      product
    );
  });


  /* =======================================================
     ORDER INSTRUCTIONS
  ======================================================= */

  bot.action('submit_trx', async (ctx) => {
    await ctx.answerCbQuery();

    await safeReply(
      ctx,
      `📝 <b>অর্ডার সম্পন্ন করার নিয়ম</b>

${DIVIDER}

<b>ধাপ ১️⃣ — পেমেন্টের Screenshot পাঠান</b>

<b>ধাপ ২️⃣ — Transaction ID (৮–১০ অক্ষর) পাঠান</b>

<b>ধাপ ৩️⃣ — Verification-এর জন্য অপেক্ষা করুন</b>

<b>ধাপ ৪️⃣ — Admin Approval-এর পর Product Access পাবেন</b>`,
      {
        parse_mode: 'HTML'
      }
    );
  });


  /* =======================================================
     START PAYMENT
  ======================================================= */

  bot.action('start_payment', async (ctx) => {
    await ctx.answerCbQuery();

    const userId = ctx.from.id;

    const state = getUserState(userId);

    if (
      !state ||
      state.step === 'home' ||
      !state.product
    ) {
      return safeReply(
        ctx,
        `⚠️ <b>আগে একটি প্রোডাক্ট সিলেক্ট করুন।</b>`,
        {
          parse_mode: 'HTML',
          ...backToMenuKeyboard()
        }
      );
    }

    setUserState(userId, {
      step: 'awaiting_screenshot'
    });

    await safeReply(
      ctx,
      `💳 <b>Payment শুরু হয়েছে</b>

${DIVIDER}

<b>এখন আপনার Payment Screenshot পাঠান।</b>

📸 <b>Screenshot পাঠানোর পর Transaction ID চাওয়া হবে।</b>`,
      {
        parse_mode: 'HTML'
      }
    );
  });


  /* =======================================================
     PHOTO / PAYMENT SCREENSHOT
  ======================================================= */

  bot.on('photo', async (ctx) => {
    const userId = ctx.from.id;

    const state = getUserState(userId);

    const photos = ctx.message.photo || [];

    if (!photos.length) {
      return;
    }

    const fileId =
      photos[photos.length - 1].file_id;

    if (
      state &&
      state.step === 'awaiting_screenshot'
    ) {
      setUserState(userId, {
        step: 'awaiting_trx',
        screenshotFileId: fileId
      });

      return safeReply(
        ctx,
        `✅ <b>Payment Screenshot Received</b>

${DIVIDER}

🧾 <b>এখন আপনার ৮–১০ অক্ষরের Transaction ID লিখে পাঠান।</b>`,
        {
          parse_mode: 'HTML'
        }
      );
    }


    if (
      state &&
      state.step === 'awaiting_trx'
    ) {
      setUserState(userId, {
        screenshotFileId: fileId
      });

      return safeReply(
        ctx,
        `✅ <b>Screenshot Updated</b>

<b>এখন আপনার Transaction ID লিখে পাঠান।</b>`,
        {
          parse_mode: 'HTML'
        }
      );
    }


    return safeReply(
      ctx,
      `⚠️ <b>কোনো সক্রিয় অর্ডার পাওয়া যায়নি।</b>

<b>প্রথমে মেনু থেকে একটি প্রোডাক্ট সিলেক্ট করুন।</b>`,
      {
        parse_mode: 'HTML',
        ...backToMenuKeyboard()
      }
    );
  });


  /* =======================================================
     TEXT HANDLER
  ======================================================= */

  bot.on('text', async (ctx) => {
    const userId = ctx.from.id;

    const userName =
      ctx.from.first_name || 'Customer';

    const username =
      ctx.from.username || null;

    const text =
      String(ctx.message.text || '').trim();

    if (!text) {
      return;
    }

    const normalizedTrxId =
      text.toUpperCase();

    const state =
      getUserState(userId);

    const isValidTrx =
      TRX_ID_REGEX.test(text);


    /* =====================================================
       TRANSACTION ID FLOW
    ===================================================== */

    if (isValidTrx) {
      if (
        !state ||
        (
          state.step !== 'awaiting_screenshot' &&
          state.step !== 'awaiting_trx'
        )
      ) {
        return safeReply(
          ctx,
          `⚠️ <b>কোনো সক্রিয় অর্ডার পাওয়া যায়নি।</b>

<b>প্রথমে মেনু থেকে একটি প্রোডাক্ট সিলেক্ট করুন।</b>`,
          {
            parse_mode: 'HTML',
            ...backToMenuKeyboard()
          }
        );
      }


      if (
        state.step === 'awaiting_screenshot' ||
        !state.screenshotFileId
      ) {
        return safeReply(
          ctx,
          `⚠️ <b>প্রথমে Payment Screenshot পাঠান।</b>`,
          {
            parse_mode: 'HTML'
          }
        );
      }


      if (isTrxUsed(normalizedTrxId)) {
        return safeReply(
          ctx,
          `❌ <b>এই Transaction ID ইতিমধ্যে ব্যবহৃত হয়েছে।</b>

<b>অন্য Transaction ID দিয়ে চেষ্টা করুন।</b>`,
          {
            parse_mode: 'HTML'
          }
        );
      }


      const product =
        getProduct(state.product);


      if (!product) {
        resetUserState(userId);

        return safeReply(
          ctx,
          `⚠️ <b>প্রোডাক্টটি আর উপলভ্য নেই।</b>

<b>দয়া করে মেনু থেকে আবার একটি প্রোডাক্ট বেছে নিন।</b>`,
          {
            parse_mode: 'HTML',
            ...backToMenuKeyboard()
          }
        );
      }


      const order = {
        orderId: state.orderId,
        userId,
        customerName: userName,
        username,
        product: state.product,
        price: product.price,
        trxId: normalizedTrxId,
        screenshotFileId: state.screenshotFileId,
        status: 'Pending Verification',
        createdAt: Date.now(),
        createdAtText: nowBD()
      };


      try {
        createOrder(order);
      } catch (err) {
        logger.error(
          'Failed to create order',
          err
        );

        return safeReply(
          ctx,
          `⚠️ <b>অর্ডার প্রসেস করতে সমস্যা হয়েছে।</b>

<b>দয়া করে কিছুক্ষণ পর আবার চেষ্টা করুন।</b>`,
          {
            parse_mode: 'HTML'
          }
        );
      }


      const memory =
        getConversation(userId);

      memory.customerName = userName;
      memory.selectedProduct = product.code;
      memory.paymentStatus = 'pending';
      memory.conversationStage =
        'Payment Pending';

      saveConversation(memory);


      await safeReply(
        ctx,
        `🎉 <b>ধন্যবাদ, ${escapeHtml(userName)}!</b>

<b>আপনার Transaction ID সফলভাবে গ্রহণ করা হয়েছে।</b>

🆔 <b>Order ID:</b> <code>${escapeHtml(state.orderId)}</code>
📦 <b>Product:</b> <b>${escapeHtml(product.title)}</b>
📌 <b>Status:</b> ${statusBadge('Pending Verification')}

⏳ <b>সাধারণত ৫–১০ মিনিটের মধ্যে ভেরিফাই হয়ে যায়।</b>`,
        {
          parse_mode: 'HTML',
          ...backToMenuKeyboard()
        }
      );


      const adminCaption =
        `🆕 <b>New Order Received</b>

${DIVIDER}

👤 <b>Customer:</b> ${escapeHtml(userName)}
🆔 <b>Telegram ID:</b> <code>${escapeHtml(userId)}</code>
🔗 <b>Username:</b> ${
          username
            ? '@' + escapeHtml(username)
            : 'N/A'
        }

${DIVIDER}

📦 <b>Order ID:</b> <code>${escapeHtml(state.orderId)}</code>
🛍️ <b>Product:</b> <b>${escapeHtml(product.title)}</b>
💵 <b>Price:</b> <b>${escapeHtml(product.price)} BDT</b>
💳 <b>Transaction ID:</b> <code>${escapeHtml(normalizedTrxId)}</code>
🕒 <b>Time:</b> ${escapeHtml(order.createdAtText)}`;


      const adminMessage =
        await safeSendPhoto(
          bot,
          config.adminId,
          state.screenshotFileId,
          {
            caption: adminCaption,
            parse_mode: 'HTML',
            ...adminApprovalKeyboard(
              state.orderId
            )
          }
        );


      if (!adminMessage) {
        logger.warn(
          `Order ${state.orderId}: failed to send screenshot to admin`
        );
      }


      resetUserState(userId);

      return;
    }


    /* =====================================================
       ADMIN TEXT
    ===================================================== */

    if (isAdmin(ctx)) {
      return;
    }


    /* =====================================================
       FORWARD CUSTOMER MESSAGE TO ADMIN
    ===================================================== */

    await bot.telegram
      .forwardMessage(
        config.adminId,
        ctx.chat.id,
        ctx.message.message_id
      )
      .catch((err) => {
        logger.warn(
          'Could not forward customer message',
          err
        );
      });


    /* =====================================================
       MEMORY
    ===================================================== */

    const memory =
      getConversation(userId);

    memory.customerName = userName;


    /* =====================================================
       INTENT DETECTION
    ===================================================== */

    const buyIntent =
      /(নিব|কিনব|নিতে চাই|কিনতে চাই|order|পেমেন্ট|payment|দাম|price|card|কার্ড|দেখাও|দেখতে চাই|কিনবো|নিতে চাচ্ছি|লাগবে|লাগবেই|চাই\b|নেব|প্রয়োজন|\bnibo\b|\bnite\s*chai\b|\bchai\b|\bkinbo\b|\bkinte\s*chai\b|\blagbe\b|\bdorkar\b|\bnite\s*chacchi\b)/i
        .test(text);


    const negoIntent =
      /(দেই|দিব\b|দিমু|দিতে চাই|কম|কমান|কমাও|discount|ডিসকাউন্ট)/i
        .test(text) ||
      /\d{2,4}\s*(টাকা|tk|৳)?/i.test(text);


    /* =====================================================
       PRODUCT MATCH
    ===================================================== */

    let matchedProduct =
      findProductByText(text);


    const wordCount =
      text
        .split(/\s+/)
        .filter(Boolean)
        .length;


    /* =====================================================
       COURSE LIST REQUEST
    ===================================================== */

    const courseListRequest =
      /(card|কার্ড|কোর্স.*দেখ|course.*list|সব কোর্স|কি কি কোর্স|কোর্স.*আছে|কোর্স.*কি|কোন কোন কোর্স)/i
        .test(text);


    if (
      courseListRequest &&
      !matchedProduct &&
      (
        state?.step === 'home' ||
        !state?.step
      )
    ) {
      memory.conversationStage =
        'Viewing Courses';

      saveConversation(memory);

      await safeReply(
        ctx,
        coursesIntroText(),
        {
          parse_mode: 'HTML',
          ...coursesKeyboard()
        }
      );

      return;
    }


    /* =====================================================
       UNKNOWN COURSE REQUEST
    ===================================================== */

    if (
      buyIntent &&
      !matchedProduct &&
      wordCount > 2 &&
      (
        state?.step === 'home' ||
        !state?.step
      )
    ) {
      memory.conversationStage =
        'Unknown Product Request';

      saveConversation(memory);

      await safeReply(
        ctx,
        `😊 <b>আপনার চাওয়া কোর্সটি আমাদের তালিকায় নেই।</b>

<b>আমাদের টিম বিষয়টি দেখে আপনার সাথে যোগাযোগ করবে।</b>

📌 <b>আপনার মেসেজটি এডমিনের কাছে ফরওয়ার্ড করা হয়েছে।</b>`,
        {
          parse_mode: 'HTML',
          ...coursesKeyboard()
        }
      );

      return;
    }


    /* =====================================================
       CONTEXT PRODUCT
    ===================================================== */

    if (
      !matchedProduct &&
      memory.selectedProduct
    ) {
      matchedProduct =
        getProduct(
          memory.selectedProduct
        );
    }


    /* =====================================================
       GENERIC BUY REQUEST
    ===================================================== */

    if (
      buyIntent &&
      !matchedProduct &&
      (
        state?.step === 'home' ||
        !state?.step
      )
    ) {
      memory.conversationStage =
        'Choosing Product';

      saveConversation(memory);

      await safeReply(
        ctx,
        `😊 <b>অবশ্যই! কোন কোর্সটি নিতে চান?</b>

👇 <b>নিচ থেকে আপনার পছন্দের কোর্সটি নির্বাচন করুন:</b>`,
        {
          parse_mode: 'HTML',
          ...coursesKeyboard()
        }
      );

      return;
    }


    /* =====================================================
       AI RESPONSE
    ===================================================== */

    let aiReply = null;

    try {
      aiReply =
        await generateReply(
          memory,
          text
        );
    } catch (err) {
      logger.error(
        'AI reply generation failed',
        err
      );
    }


    if (isUsableAiReply(aiReply)) {
      const clean =
        cleanAiReply(aiReply);


      if (isUsableAiReply(clean)) {
        addMessageToHistory(
          memory,
          'user',
          text
        );

        addMessageToHistory(
          memory,
          'assistant',
          clean
        );


        if (matchedProduct) {
          memory.selectedProduct =
            matchedProduct.code;
        }


        saveConversation(memory);


        const sent =
          await safeReply(
            ctx,
            clean,
            {
              parse_mode: 'HTML'
            }
          );


        if (!sent) {
          logger.warn(
            'AI response could not be sent to customer'
          );
        }
      }
    } else {
      const now = Date.now();

      if (
        now -
          (state?.lastSupportMessage || 0) >
        SUPPORT_COOLDOWN_MS
      ) {
        setUserState(
          userId,
          {
            lastSupportMessage: now
          }
        );

        await safeReply(
          ctx,
          `✅ <b>আপনার মেসেজটি গ্রহণ করা হয়েছে।</b>

<b>আমাদের টিম যত দ্রুত সম্ভব আপনার সাথে যোগাযোগ করবে।</b>`,
          {
            parse_mode: 'HTML'
          }
        );
      }
    }


    /* =====================================================
       AUTO PRODUCT CARD
    ===================================================== */

    if (
      (buyIntent || negoIntent) &&
      matchedProduct &&
      (
        state?.step === 'home' ||
        state?.step === 'awaiting_screenshot' ||
        !state?.step
      )
    ) {
      const existing =
        findPendingOrder(
          userId,
          matchedProduct.code
        );


      if (existing) {
        await safeReply(
          ctx,
          `⏳ <b>এই প্রোডাক্টের একটি অর্ডার ইতিমধ্যে যাচাইয়ের অপেক্ষায় আছে।</b>

🆔 <b>Order ID:</b> <code>${escapeHtml(existing.order_id)}</code>

<b>অনুগ্রহ করে যাচাই সম্পন্ন হওয়া পর্যন্ত অপেক্ষা করুন।</b>`,
          {
            parse_mode: 'HTML',
            ...backToMenuKeyboard()
          }
        );

        return;
      }


      const orderId =
        generateOrderId();


      setUserState(
        userId,
        {
          step: 'awaiting_screenshot',
          product: matchedProduct.code,
          orderId,
          screenshotFileId: null
        }
      );


      memory.selectedProduct =
        matchedProduct.code;

      memory.conversationStage =
        'Product Selected';

      saveConversation(memory);


      await sendProductCard(
        ctx,
        matchedProduct,
        orderId
      );
    }
  });


  /* =======================================================
     MY ORDERS
  ======================================================= */

  bot.action('my_orders', async (ctx) => {
    await ctx.answerCbQuery();

    await showUserOrders(ctx);
  });


  /* =======================================================
     ADMIN APPROVE
  ======================================================= */

  bot.action(/^approve_(.+)$/, async (ctx) => {
    if (!isAdmin(ctx)) {
      return ctx.answerCbQuery(
        '🚫 Unauthorized',
        {
          show_alert: true
        }
      );
    }

    await ctx.answerCbQuery();

    const orderId =
      ctx.match[1];

    const order =
      getOrder(orderId);


    if (!order) {
      return safeReply(
        ctx,
        `⚠️ <b>Order not found.</b>`,
        {
          parse_mode: 'HTML'
        }
      );
    }


    if (
      order.status !==
      'Pending Verification'
    ) {
      return safeReply(
        ctx,
        `⚠️ <b>Already processed.</b>`,
        {
          parse_mode: 'HTML'
        }
      );
    }


    const product =
      getProduct(order.product);


    if (!product) {
      return safeReply(
        ctx,
        `⚠️ <b>Product not found.</b>`,
        {
          parse_mode: 'HTML'
        }
      );
    }


    updateOrderStatus(
      orderId,
      'Delivered ✅'
    );


    await ctx
      .editMessageReplyMarkup(undefined)
      .catch(() => {});


    await safeReply(
      ctx,
      `✅ <b>Order <code>${escapeHtml(orderId)}</code> approved.</b>`,
      {
        parse_mode: 'HTML'
      }
    );


    const customerMessage =
      `🎉 <b>Payment Verified!</b>

${DIVIDER}

📦 <b>Product:</b> <b>${escapeHtml(product.title)}</b>
${statusBadge('Delivered')}

🔗 <b>Access:</b>
${product.access}

${DIVIDER}

🙏 <b>ধন্যবাদ!</b>

<b>সমস্যা হলে ${escapeHtml(config.supportUsername || 'Support')} এ যোগাযোগ করুন।</b>`;


    await safeSend(
      bot,
      order.user_id,
      customerMessage,
      {
        parse_mode: 'HTML'
      }
    );
  });


  /* =======================================================
     ADMIN REJECT
  ======================================================= */

  bot.action(/^reject_(.+)$/, async (ctx) => {
    if (!isAdmin(ctx)) {
      return ctx.answerCbQuery(
        '🚫 Unauthorized',
        {
          show_alert: true
        }
      );
    }

    await ctx.answerCbQuery();

    const orderId =
      ctx.match[1];

    const order =
      getOrder(orderId);


    if (!order) {
      return safeReply(
        ctx,
        `⚠️ <b>Order not found.</b>`,
        {
          parse_mode: 'HTML'
        }
      );
    }


    if (
      order.status !==
      'Pending Verification'
    ) {
      return safeReply(
        ctx,
        `⚠️ <b>Already processed.</b>`,
        {
          parse_mode: 'HTML'
        }
      );
    }


    const product =
      getProduct(order.product);


    updateOrderStatus(
      orderId,
      'Rejected ❌'
    );


    await ctx
      .editMessageReplyMarkup(undefined)
      .catch(() => {});


    await safeReply(
      ctx,
      `❌ <b>Order rejected.</b>`,
      {
        parse_mode: 'HTML'
      }
    );


    await safeSend(
      bot,
      order.user_id,
      `❌ <b>Payment Verification Failed</b>

${DIVIDER}

🆔 <b>Order ID:</b> <code>${escapeHtml(orderId)}</code>
📦 <b>Product:</b> <b>${escapeHtml(product?.title || order.product)}</b>

<b>সঠিক Payment Screenshot এবং Transaction ID দিয়ে পুনরায় চেষ্টা করুন।</b>`,
      {
        parse_mode: 'HTML',
        ...backToMenuKeyboard()
      }
    );
  });


  /* =======================================================
     FAQ
  ======================================================= */

  bot.action('faq', async (ctx) => {
    await ctx.answerCbQuery();

    await showFaq(ctx);
  });


  /* =======================================================
     SUPPORT
  ======================================================= */

  bot.action('support', async (ctx) => {
    await ctx.answerCbQuery();

    await showSupport(ctx);
  });


  /* =======================================================
     TELEGRAM COMMAND MENU
  ======================================================= */

  bot.telegram
    .setMyCommands([
      {
        command: 'start',
        description: 'মেইন মেনু'
      },
      {
        command: 'courses',
        description: 'কোর্সসমূহ'
      },
      {
        command: 'subs',
        description: 'সাবস্ক্রিপশন'
      },
      {
        command: 'orders',
        description: 'আমার অর্ডার'
      },
      {
        command: 'faq',
        description: 'FAQ'
      },
      {
        command: 'support',
        description: 'সাপোর্ট'
      }
    ])
    .catch((err) => {
      logger.warn(
        'setMyCommands failed',
        err
      );
    });


  /* =======================================================
     /COURSES
  ======================================================= */

  bot.command('courses', async (ctx) => {
    await safeReply(
      ctx,
      coursesIntroText(),
      {
        parse_mode: 'HTML',
        ...coursesKeyboard()
      }
    );
  });


  /* =======================================================
     /SUBS
  ======================================================= */

  bot.command('subs', async (ctx) => {
    await safeReply(
      ctx,
      `⭐ <b>Premium Subscription</b>

${DIVIDER}

<b>আপনার পছন্দের প্ল্যানটি নির্বাচন করুন।</b>`,
      {
        parse_mode: 'HTML',
        ...subsKeyboard()
      }
    );
  });


  /* =======================================================
     /ORDERS
  ======================================================= */

  bot.command('orders', async (ctx) => {
    await showUserOrders(ctx);
  });


  /* =======================================================
     /FAQ
  ======================================================= */

  bot.command('faq', async (ctx) => {
    await showFaq(ctx);
  });


  /* =======================================================
     /SUPPORT
  ======================================================= */

  bot.command('support', async (ctx) => {
    await showSupport(ctx);
  });


  /* =======================================================
     GLOBAL ERROR HANDLER
  ======================================================= */

  bot.catch((err, ctx) => {
    logger.error(
      `Telegram bot error for update ${ctx?.update?.update_id || 'unknown'}`,
      err
    );
  });


  return bot;
}


module.exports = {
  createBot
};
