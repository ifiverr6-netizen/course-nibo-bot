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
  findProductByText
} = require('./domain/products');

const {
  generateReply
} = require('./application/ai/replyGenerator');

const {
  DIVIDER,
  escapeHtml,
  nowBD,
  generateOrderId
} = require('./utils/format');

const {
  statusBadge
} = require('./utils/theme');

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
   CONFIGURATION
========================================================= */

const TRX_ID_REGEX = /^[A-Za-z0-9]{8,10}$/;

const SUPPORT_COOLDOWN_MS = 5 * 60 * 1000;


/* =========================================================
   ADMIN CHECK
========================================================= */

function isAdmin(ctx) {
  return (
    ctx.from &&
    ctx.from.id.toString() === config.adminId.toString()
  );
}


/* =========================================================
   TELEGRAM HTML SANITIZER
========================================================= */

function sanitizeTelegramHtml(text = '') {
  let value = String(text ?? '').trim();

  value = value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p\s*>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<div\s*>/gi, '')
    .replace(/<\/div>/gi, '\n')
    .replace(/<span[^>]*>/gi, '')
    .replace(/<\/span>/gi, '')
    .replace(/<h[1-6][^>]*>/gi, '')
    .replace(/<\/h[1-6]>/gi, '\n');

  value = value.replace(
    /<(?!\/?(?:b|strong|i|em|u|s|del|code|pre|a)(?:\s[^>]*)?>)[^>]+>/gi,
    ''
  );

  value = value.replace(/\n{3,}/g, '\n\n');

  return value.trim();
}


/* =========================================================
   WELCOME MESSAGE
========================================================= */

function welcomeText(name) {
  return `👋 <b>আসসালামু আলাইকুম, ${escapeHtml(name)}!</b>

🌟 <b>Course Nibo-তে আপনাকে স্বাগতম।</b>

${DIVIDER}

📚 <b>আমাদের সার্ভিসসমূহ</b>
✨ <b>Premium Digital Courses</b>
🤖 <b>ChatGPT Go</b>
🎬 <b>Video Editing Courses</b>
💼 <b>Business Formula</b>

${DIVIDER}

💎 <b>কেন আমাদের বেছে নেবেন?</b>
✅ <b>দ্রুত ডেলিভারি (৫-১০ মিনিট)</b>
✅ <b>বিশ্বস্ত ও নিরাপদ সার্ভিস</b>
✅ <b>Personal Account-এ পেমেন্ট</b>
✅ <b>২৪/৭ সাপোর্ট</b>

${DIVIDER}

👇 <b>নিচের মেনু থেকে আপনার পছন্দের অপশন বেছে নিন।</b>`;
}


/* =========================================================
   PRODUCT CARD
========================================================= */

function productCardCaption(product, orderId) {
  return `🛒 <b>Order Summary</b>

📦 <b>Product:</b> <b>${escapeHtml(product.title)}</b>
💵 <b>Price:</b> <b>${escapeHtml(product.price)}</b>
🆔 <b>Order ID:</b> <code>${escapeHtml(orderId)}</code>

${DIVIDER}

💳 <b>Payment Information</b>

<b>আপনার অর্ডার সম্পন্ন করতে নিচের যেকোনো একটি Personal Account-এ "Send Money" করুন।</b>

🟢 <b>bKash (Personal)</b>
📱 <code>${escapeHtml(config.bkashNumber)}</code>

🟠 <b>Nagad (Personal)</b>
📱 <code>${escapeHtml(config.nagadNumber)}</code>

📌 <b>Payment করার পর:</b>
• <b>Payment Screenshot পাঠান</b>
• <b>Transaction ID পাঠান</b>

⏱️ <b>Verification: সাধারণত ৫–১০ মিনিট।</b>

<b>Verification সম্পন্ন হলে আপনার Product Access এই চ্যাটেই পাঠিয়ে দেওয়া হবে।</b>`;
}


/* =========================================================
   ORDERS
========================================================= */

function buildOrdersMessage(list) {
  let msg =
    `📦 <b>My Orders</b>\n` +
    `${DIVIDER}\n\n`;

  list.forEach((order, index) => {
    const product = getProduct(order.product);

    msg +=
      `${index + 1}. 🆔 <b>Order ID:</b> <code>${escapeHtml(order.order_id)}</code>\n` +
      `📦 <b>Product:</b> <b>${escapeHtml(product?.title || order.product)}</b>\n` +
      `💵 <b>Price:</b> <b>${escapeHtml(order.price)}</b>\n` +
      `📌 <b>Status:</b> ${statusBadge(order.status)}\n` +
      `🕒 <b>${escapeHtml(order.created_at_text || '')}</b>\n\n`;
  });

  return msg.trim();
}


async function showUserOrders(ctx) {
  const list = getUserOrders(ctx.from.id);

  if (!list.length) {
    return safeReply(
      ctx,
      `📦 <b>My Orders</b>\n${DIVIDER}\n\n<b>আপনার এখনো কোনো অর্ডার নেই।</b>`,
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

const SUPPORT_TEXT = (username) =>
  `<b>কাস্টমার সাপোর্ট</b>\n\n` +

  `<b>কোনো প্রশ্ন বা সহায়তার প্রয়োজন হলে আমাদের অ্যাডমিনের সাথে যোগাযোগ করুন।</b>\n\n` +

  `👨‍💻 <b>Admin:</b> ${escapeHtml(username)}\n\n` +

  `<b>অথবা, আপনি সরাসরি এখানে মেসেজ লিখে পাঠাতে পারেন।</b>`;


async function showSupport(ctx) {
  return safeReply(
    ctx,
    SUPPORT_TEXT(config.supportUsername),
    {
      parse_mode: 'HTML',
      ...backToMenuKeyboard()
    }
  );
}


/* =========================================================
   BOT
========================================================= */

function createBot() {

  initDatabase();

  const bot = new Telegraf(config.botToken);


  /* =======================================================
     START
  ======================================================= */

  bot.start(async (ctx) => {

    try {

      const userId = ctx.from.id;

      resetUserState(userId);

      const memory = getConversation(userId);

      memory.customerName =
        ctx.from.first_name || '';

      memory.conversationStage =
        'Greeting';

      saveConversation(memory);

      await safeReply(
        ctx,
        welcomeText(
          ctx.from.first_name || 'Customer'
        ),
        {
          parse_mode: 'HTML',
          ...mainMenuKeyboard()
        }
      );

    } catch (err) {

      logger.error(
        'Start command error',
        err
      );

    }

  });


  /* =======================================================
     MAIN MENU
  ======================================================= */

  bot.action(
    'main_menu',
    async (ctx) => {

      await ctx.answerCbQuery();

      resetUserState(
        ctx.from.id
      );

      await safeReply(
        ctx,
        welcomeText(
          ctx.from.first_name || 'Customer'
        ),
        {
          parse_mode: 'HTML',
          ...mainMenuKeyboard()
        }
      );

    }
  );


  /* =======================================================
     COURSES BUTTON
  ======================================================= */

  bot.action(
    'view_courses',
    async (ctx) => {

      await ctx.answerCbQuery();

      await safeReply(
        ctx,
        `📚 <b>Digital Courses</b>\n` +
        `${DIVIDER}\n\n` +
        `<b>আপনার পছন্দের কোর্সটি নির্বাচন করুন:</b>`,
        {
          parse_mode: 'HTML',
          ...coursesKeyboard()
        }
      );

    }
  );


  /* =======================================================
     SUBSCRIPTION BUTTON
  ======================================================= */

  bot.action(
    'view_subs',
    async (ctx) => {

      await ctx.answerCbQuery();

      await safeReply(
        ctx,
        `⭐ <b>Premium Subscription</b>\n` +
        `${DIVIDER}\n\n` +
        `<b>আপনার পছন্দের প্ল্যান নির্বাচন করুন:</b>`,
        {
          parse_mode: 'HTML',
          ...subsKeyboard()
        }
      );

    }
  );


  /* =======================================================
     BUY PRODUCT
  ======================================================= */

  bot.action(
    /^buy_(.+)$/,
    async (ctx) => {

      await ctx.answerCbQuery();

      const code =
        ctx.match[1];

      const userId =
        ctx.from.id;

      const product =
        getProduct(code);

      if (!product) {

        return safeReply(
          ctx,
          `⚠️ <b>এই Product বর্তমানে পাওয়া যাচ্ছে না।</b>`,
          {
            parse_mode: 'HTML',
            ...backToMenuKeyboard()
          }
        );

      }


      const existing =
        findPendingOrder(
          userId,
          code
        );

      if (existing) {

        return safeReply(
          ctx,
          `⏳ <b>একটি অর্ডার ইতিমধ্যে যাচাইয়ের অপেক্ষায় আছে</b>

${DIVIDER}

📦 <b>Product:</b> <b>${escapeHtml(product.title)}</b>
🆔 <b>Order ID:</b> <code>${escapeHtml(existing.order_id)}</code>

<b>অনুগ্রহ করে যাচাই সম্পন্ন হওয়া পর্যন্ত অপেক্ষা করুন।</b>`,
          {
            parse_mode: 'HTML',
            ...backToMenuKeyboard()
          }
        );

      }


      const orderId =
        generateOrderId();


      setUserState(
        userId,
        {
          step: 'awaiting_screenshot',
          product: code,
          orderId,
          screenshotFileId: null
        }
      );


      const memory =
        getConversation(userId);

      memory.selectedProduct =
        code;

      memory.conversationStage =
        'Product Selected';

      saveConversation(memory);


      const caption =
        productCardCaption(
          product,
          orderId
        );


      const sent =
        await safeReplyWithPhoto(
          ctx,
          product.photo,
          {
            caption,
            parse_mode: 'HTML',
            ...productActionsKeyboard()
          }
        );


      if (!sent) {

        await safeReply(
          ctx,
          caption,
          {
            parse_mode: 'HTML',
            ...productActionsKeyboard()
          }
        );

      }

    }
  );


  /* =======================================================
     ORDER RULES
  ======================================================= */

  bot.action(
    'submit_trx',
    async (ctx) => {

      await ctx.answerCbQuery();

      await safeReply(
        ctx,
        `📝 <b>অর্ডার সম্পন্ন করার নিয়ম</b>

${DIVIDER}

<b>ধাপ ১️⃣ — পেমেন্টের স্ক্রিনশট পাঠান</b>
<b>ধাপ ২️⃣ — Transaction ID (৮–১০ অক্ষর) পাঠান</b>
<b>ধাপ ৩️⃣ — ভেরিফিকেশনের জন্য অপেক্ষা করুন</b>
<b>ধাপ ৪️⃣ — প্রোডাক্ট গ্রহণ করুন</b>`,
        {
          parse_mode: 'HTML',
          ...backToMenuKeyboard()
        }
      );

    }
  );


  /* =======================================================
     START PAYMENT
  ======================================================= */

  bot.action(
    'start_payment',
    async (ctx) => {

      await ctx.answerCbQuery();

      const userId =
        ctx.from.id;

      const state =
        getUserState(userId);


      if (
        state.step === 'home' ||
        !state.product
      ) {

        return safeReply(
          ctx,
          `⚠️ <b>আগে একটি Product Select করুন।</b>`,
          {
            parse_mode: 'HTML',
            ...backToMenuKeyboard()
          }
        );

      }


      setUserState(
        userId,
        {
          step: 'awaiting_screenshot'
        }
      );


      await safeReply(
        ctx,
        `💳 <b>পেমেন্ট শুরু হয়েছে</b>

<b>এখন আপনার Payment Screenshot পাঠান।</b>

<b>Screenshot পাঠানোর পর Transaction ID চাওয়া হবে।</b>`,
        {
          parse_mode: 'HTML'
        }
      );

    }
  );


  /* =======================================================
     PHOTO / PAYMENT SCREENSHOT
  ======================================================= */

  bot.on(
    'photo',
    async (ctx) => {

      const userId =
        ctx.from.id;

      const state =
        getUserState(userId);

      const fileId =
        ctx.message.photo[
          ctx.message.photo.length - 1
        ].file_id;


      if (
        state.step ===
        'awaiting_screenshot'
      ) {

        setUserState(
          userId,
          {
            step: 'awaiting_trx',
            screenshotFileId: fileId
          }
        );


        return safeReply(
          ctx,
          `✅ <b>Payment Screenshot Received</b>

${DIVIDER}

<b>এখন আপনার ৮–১০ অক্ষরের Transaction ID লিখে পাঠান।</b>`,
          {
            parse_mode: 'HTML'
          }
        );

      }


      if (
        state.step ===
        'awaiting_trx'
      ) {

        setUserState(
          userId,
          {
            screenshotFileId: fileId
          }
        );


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

<b>প্রথমে মেনু থেকে একটি Product Select করুন।</b>`,
        {
          parse_mode: 'HTML',
          ...backToMenuKeyboard()
        }
      );

    }
  );


  /* =======================================================
     COMMAND HANDLERS
     IMPORTANT:
     এগুলো bot.on('text') এর আগে রাখা হয়েছে।
  ======================================================= */

  bot.command(
    'courses',
    async (ctx) => {

      await safeReply(
        ctx,
        `📚 <b>Digital Courses</b>

${DIVIDER}

<b>আপনার পছন্দের কোর্সটি নির্বাচন করুন:</b>`,
        {
          parse_mode: 'HTML',
          ...coursesKeyboard()
        }
      );

    }
  );


  bot.command(
    'subs',
    async (ctx) => {

      await safeReply(
        ctx,
        `⭐ <b>Premium Subscription</b>

${DIVIDER}

<b>আপনার পছন্দের প্ল্যান নির্বাচন করুন:</b>`,
        {
          parse_mode: 'HTML',
          ...subsKeyboard()
        }
      );

    }
  );


  bot.command(
    'orders',
    async (ctx) => {

      await showUserOrders(ctx);

    }
  );


  bot.command(
    'faq',
    async (ctx) => {

      await showFaq(ctx);

    }
  );


  bot.command(
    'support',
    async (ctx) => {

      await showSupport(ctx);

    }
  );


  /* =======================================================
     TEXT HANDLER
  ======================================================= */

  bot.on(
    'text',
    async (ctx) => {

      const userId =
        ctx.from.id;

      const userName =
        ctx.from.first_name ||
        'Customer';

      const username =
        ctx.from.username;

      const text =
        ctx.message.text.trim();

      const normalizedTrxId =
        text.toUpperCase();

      const state =
        getUserState(userId);

      const isValidTrx =
        TRX_ID_REGEX.test(text);


      /* ===================================================
         TRANSACTION ID FLOW
      =================================================== */

      if (isValidTrx) {

        if (
          state.step !== 'awaiting_screenshot' &&
          state.step !== 'awaiting_trx'
        ) {

          return safeReply(
            ctx,
            `⚠️ <b>কোনো সক্রিয় অর্ডার পাওয়া যায়নি।</b>

<b>প্রথমে মেনু থেকে একটি Product Select করুন।</b>`,
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


        if (
          isTrxUsed(
            normalizedTrxId
          )
        ) {

          return safeReply(
            ctx,
            `❌ <b>এই Transaction ID ইতিমধ্যে ব্যবহৃত হয়েছে।</b>`,
            {
              parse_mode: 'HTML'
            }
          );

        }


        const product =
          getProduct(
            state.product
          );


        if (!product) {

          resetUserState(
            userId
          );

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

          orderId:
            state.orderId,

          userId,

          customerName:
            userName,

          username:
            username || null,

          product:
            state.product,

          price:
            product.price,

          trxId:
            normalizedTrxId,

          screenshotFileId:
            state.screenshotFileId,

          status:
            'Pending Verification',

          createdAt:
            Date.now(),

          createdAtText:
            nowBD()

        };


        createOrder(order);


        const memory =
          getConversation(userId);

        memory.paymentStatus =
          'pending';

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


        await safeSendPhoto(
          bot,
          config.adminId,
          state.screenshotFileId,
          {
            caption:
              `🆕 <b>New Order Received</b>

${DIVIDER}

👤 <b>Customer:</b> ${escapeHtml(userName)}
🆔 <b>Telegram ID:</b> <code>${userId}</code>
🔗 <b>Username:</b> ${
                username
                  ? '@' + escapeHtml(username)
                  : 'N/A'
              }

${DIVIDER}

📦 <b>Order ID:</b> <code>${escapeHtml(state.orderId)}</code>
🛍️ <b>Product:</b> <b>${escapeHtml(product.title)}</b>
💵 <b>Price:</b> <b>${escapeHtml(product.price)}</b>
💳 <b>Transaction ID:</b> <code>${escapeHtml(normalizedTrxId)}</code>
🕒 <b>Time:</b> ${escapeHtml(order.createdAtText)}`,

            parse_mode: 'HTML',

            ...adminApprovalKeyboard(
              state.orderId
            )
          }
        );


        resetUserState(
          userId
        );

        return;

      }


      /* ===================================================
         ADMIN
      =================================================== */

      if (isAdmin(ctx)) {
        return;
      }


      /* ===================================================
         FORWARD CUSTOMER MESSAGE
      =================================================== */

      await bot.telegram
        .forwardMessage(
          config.adminId,
          ctx.chat.id,
          ctx.message.message_id
        )
        .catch(
          (err) =>
            logger.warn(
              'Could not forward customer message',
              err
            )
        );


      const memory =
        getConversation(userId);

      memory.customerName =
        userName;


      /* ===================================================
         INTENT DETECTION
      =================================================== */

      const buyIntent =
        /(নিব|কিনব|নিতে চাই|কিনতে চাই|order|পেমেন্ট|payment|দাম|price|card|কার্ড|দেখাও|দেখতে চাই|কিনবো|নিতে চাচ্ছি|লাগবে|লাগবেই|চাই\b|নেব|প্রয়োজন|\bnibo\b|\bnite\s*chai\b|\bchai\b|\bkinbo\b|\bkinte\s*chai\b|\blagbe\b|\bdorkar\b|\bnite\s*chacchi\b)/i
          .test(text);


      const negoIntent =
        /(দেই|দিব\b|দিমু|দিতে চাই|কম|কমান|কমাও|discount|ডিসকাউন্ট)/i
          .test(text) ||
        /\d{2,4}\s*(টাকা|tk|৳)?/i
          .test(text);


      let matchedProduct =
        findProductByText(text);


      const wordCount =
        text
          .split(/\s+/)
          .filter(Boolean)
          .length;


      /* ===================================================
         COURSE LIST REQUEST
      =================================================== */

      if (
        /(card|কার্ড|কোর্স.*দেখ|course.*list|সব কোর্স|কি কি কোর্স|কোর্স.*আছে|কোর্স.*কি|কোন কোন কোর্স)/i
          .test(text) &&
        !matchedProduct &&
        state.step === 'home'
      ) {

        await safeReply(
          ctx,
          `📚 <b>আমাদের কোর্সসমূহ</b>

<b>নিচ থেকে আপনার পছন্দের কোর্সটি বেছে নিন:</b>`,
          {
            parse_mode: 'HTML',
            ...coursesKeyboard()
          }
        );

        return;

      }


      /* ===================================================
         UNKNOWN COURSE
      =================================================== */

      if (
        buyIntent &&
        !matchedProduct &&
        wordCount > 2 &&
        state.step === 'home'
      ) {

        await safeReply(
          ctx,
          `😊 <b>কোর্সটি সম্পর্কে আমাদের টিম আপনাকে বিস্তারিত জানাবে।</b>

<b>আপনার মেসেজটি এডমিনের কাছে ফরওয়ার্ড করা হয়েছে।</b>`,
          {
            parse_mode: 'HTML',
            ...coursesKeyboard()
          }
        );

        return;

      }


      /* ===================================================
         MEMORY PRODUCT
      =================================================== */

      if (
        !matchedProduct &&
        memory.selectedProduct
      ) {

        matchedProduct =
          getProduct(
            memory.selectedProduct
          );

      }


      /* ===================================================
         GENERIC BUY REQUEST
      =================================================== */

      if (
        buyIntent &&
        !matchedProduct &&
        state.step === 'home'
      ) {

        await safeReply(
          ctx,
          `😊 <b>অবশ্যই! কোন কোর্সটি নিতে চান, নিচ থেকে বেছে নিন:</b>`,
          {
            parse_mode: 'HTML',
            ...coursesKeyboard()
          }
        );

        return;

      }


      /* ===================================================
         SINTHIYA AI
      =================================================== */

      const aiReply =
        await generateReply(
          memory,
          text
        );


      if (aiReply) {

        const converted =
          aiReply
            .replace(
              /\*\*(.*?)\*\*/g,
              '<b>$1</b>'
            )
            .replace(
              /(?<!<)\*(.*?)\*(?!>)/g,
              '<b>$1</b>'
            );


        const clean =
          sanitizeTelegramHtml(
            converted
          );


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


        saveConversation(
          memory
        );


        await safeReply(
          ctx,
          clean,
          {
            parse_mode: 'HTML'
          }
        );

      } else {

        const now =
          Date.now();


        const lastSupport =
          state.lastSupportMessage || 0;


        if (
          now - lastSupport >
          SUPPORT_COOLDOWN_MS
        ) {

          setUserState(
            userId,
            {
              lastSupportMessage:
                now
            }
          );


          await safeReply(
            ctx,
            `✅ <b>মেসেজ গ্রহণ করা হয়েছে</b>

<b>আমাদের টিম যত দ্রুত সম্ভব আপনার সাথে যোগাযোগ করবে।</b>`,
            {
              parse_mode: 'HTML'
            }
          );

        }

      }


      /* ===================================================
         AUTO PRODUCT CARD
      =================================================== */

      if (
        (buyIntent || negoIntent) &&
        matchedProduct &&
        (
          state.step === 'home' ||
          state.step === 'awaiting_screenshot'
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
            `⏳ <b>আপনার একটি অর্ডার ইতিমধ্যে যাচাইয়ের অপেক্ষায় আছে।</b>

<b>Order ID:</b> <code>${escapeHtml(existing.order_id)}</code>`,
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
            step:
              'awaiting_screenshot',

            product:
              matchedProduct.code,

            orderId,

            screenshotFileId:
              null
          }
        );


        memory.selectedProduct =
          matchedProduct.code;

        memory.conversationStage =
          'Product Selected';

        saveConversation(
          memory
        );


        const caption =
          productCardCaption(
            matchedProduct,
            orderId
          );


        const sent =
          await safeReplyWithPhoto(
            ctx,
            matchedProduct.photo,
            {
              caption,
              parse_mode: 'HTML',
              ...productActionsKeyboard()
            }
          );


        if (!sent) {

          await safeReply(
            ctx,
            caption,
            {
              parse_mode: 'HTML',
              ...productActionsKeyboard()
            }
          );

        }

      }

    }
  );


  /* =======================================================
     MY ORDERS BUTTON
  ======================================================= */

  bot.action(
    'my_orders',
    async (ctx) => {

      await ctx.answerCbQuery();

      await showUserOrders(ctx);

    }
  );


  /* =======================================================
     ADMIN APPROVE
  ======================================================= */

  bot.action(
    /^approve_(.+)$/,
    async (ctx) => {

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


      updateOrderStatus(
        orderId,
        'Delivered ✅'
      );


      const product =
        getProduct(
          order.product
        );


      await ctx
        .editMessageReplyMarkup(
          undefined
        )
        .catch(() => {});


      await safeReply(
        ctx,
        `✅ <b>Order <code>${escapeHtml(orderId)}</code> approved.</b>`,
        {
          parse_mode: 'HTML'
        }
      );


      await safeSend(
        bot,
        order.user_id,
        `🎉 <b>Payment Verified!</b>

${DIVIDER}

📦 <b>Product:</b> <b>${escapeHtml(product.title)}</b>
${statusBadge('Delivered')}

🔗 <b>Access:</b>
${product.access}

${DIVIDER}

🙏 <b>ধন্যবাদ!</b>
<b>সমস্যা হলে ${escapeHtml(config.supportUsername)} এ যোগাযোগ করুন।</b>`,
        {
          parse_mode: 'HTML'
        }
      );

    }
  );


  /* =======================================================
     ADMIN REJECT
  ======================================================= */

  bot.action(
    /^reject_(.+)$/,
    async (ctx) => {

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


      updateOrderStatus(
        orderId,
        'Rejected ❌'
      );


      const product =
        getProduct(
          order.product
        );


      await ctx
        .editMessageReplyMarkup(
          undefined
        )
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
📦 <b>Product:</b> <b>${escapeHtml(product.title)}</b>

<b>সঠিক Screenshot ও Transaction ID দিয়ে পুনরায় চেষ্টা করুন।</b>`,
        {
          parse_mode: 'HTML',
          ...backToMenuKeyboard()
        }
      );

    }
  );


  /* =======================================================
     FAQ BUTTON
  ======================================================= */

  bot.action(
    'faq',
    async (ctx) => {

      await ctx.answerCbQuery();

      await showFaq(ctx);

    }
  );


  /* =======================================================
     SUPPORT BUTTON
  ======================================================= */

  bot.action(
    'support',
    async (ctx) => {

      await ctx.answerCbQuery();

      await showSupport(ctx);

    }
  );


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
    .catch(
      err =>
        logger.warn(
          'setMyCommands failed',
          err
        )
    );


  /* =======================================================
     GLOBAL ERROR HANDLER
  ======================================================= */

  bot.catch(
    (err) =>
      logger.error(
        'Bot error',
        err
      )
  );


  return bot;
}


/* =========================================================
   EXPORT
========================================================= */

module.exports = {
  createBot
};
