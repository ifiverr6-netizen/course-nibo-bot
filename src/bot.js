const { Telegraf } = require('telegraf');
const config = require('./config');
const logger = require('./infrastructure/logger');
const { initDatabase } = require('./database/db');
const { getConversation, saveConversation, addMessageToHistory } = require('./application/memory/conversationRepository');
const { getUserState, setUserState, resetUserState } = require('./application/memory/stateRepository');
const { createOrder, getOrder, updateOrderStatus, isTrxUsed, getUserOrders, findPendingOrder } = require('./application/memory/orderRepository');
const { getProduct, findProductByText } = require('./domain/products');
const { generateReply } = require('./application/ai/replyGenerator');
const { DIVIDER, escapeHtml, nowBD, generateOrderId } = require('./utils/format');
const { safeReply, safeReplyWithPhoto, safeSend, safeSendPhoto } = require('./utils/telegram');
const {
  mainMenuKeyboard, backToMenuKeyboard, coursesKeyboard, subsKeyboard,
  productActionsKeyboard, adminApprovalKeyboard
} = require('./interfaces/keyboards/keyboards');

const TRX_ID_REGEX = /^[A-Za-z0-9]{8,10}$/;
const SUPPORT_COOLDOWN_MS = 5 * 60 * 1000;

function isAdmin(ctx) {
  return ctx.from && ctx.from.id.toString() === config.adminId.toString();
}

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

function productCardCaption(product, orderId) {
  return `🛒 <b>Order Summary</b>

📦 <b>Product:</b> <b>${escapeHtml(product.title)}</b>
💵 <b>Price:</b> <b>${escapeHtml(product.price)}</b>
🆔 <b>Order ID:</b> <code>${orderId}</code>

${DIVIDER}

💳 <b>Payment Information</b>

<b>আপনার অর্ডার সম্পন্ন করতে নিচের যেকোনো একটি Personal Account-এ "Send Money" করুন।</b>

🟢 <b>bKash (Personal)</b>
📱 <code>${config.bkashNumber}</code>

🟠 <b>Nagad (Personal)</b>
📱 <code>${config.nagadNumber}</code>

📌 <b>Payment করার পর:</b>
• <b>Payment Screenshot পাঠান</b>
• <b>Transaction ID পাঠান</b>

⏱️ <b>Verification: সাধারণত ৫–১০ মিনিট।</b>

<b>Verification সম্পন্ন হলে আপনার Product Access এই চ্যাটেই পাঠিয়ে দেওয়া হবে।</b>`;
}

function createBot() {
  initDatabase();
  const bot = new Telegraf(config.botToken);

  // START
  bot.start(async (ctx) => {
    resetUserState(ctx.from.id);
    const mem = getConversation(ctx.from.id);
    mem.customerName = ctx.from.first_name || '';
    mem.conversationStage = 'Greeting';
    saveConversation(mem);

    await safeReply(ctx, welcomeText(ctx.from.first_name || 'Customer'), {
      parse_mode: 'HTML',
      ...mainMenuKeyboard()
    });
  });

  bot.action('main_menu', async (ctx) => {
    await ctx.answerCbQuery();
    resetUserState(ctx.from.id);
    await safeReply(ctx, welcomeText(ctx.from.first_name || 'Customer'), {
      parse_mode: 'HTML',
      ...mainMenuKeyboard()
    });
  });

  // MENUS
  bot.action('view_courses', async (ctx) => {
    await ctx.answerCbQuery();
    await safeReply(ctx, `📚 <b>Digital Courses</b>\n${DIVIDER}\n\n<b>আপনি কোন কোর্সটি নিতে চান?</b>`, {
      parse_mode: 'HTML',
      ...coursesKeyboard()
    });
  });

  bot.action('view_subs', async (ctx) => {
    await ctx.answerCbQuery();
    await safeReply(ctx, `⭐ <b>Premium Subscription</b>\n${DIVIDER}\n\n<b>আপনার পছন্দের প্ল্যান বেছে নিন।</b>`, {
      parse_mode: 'HTML',
      ...subsKeyboard()
    });
  });

  // BUY
  bot.action(/^buy_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const code = ctx.match[1];
    const userId = ctx.from.id;
    const product = getProduct(code);
    if (!product) return;

    const existing = findPendingOrder(userId, code);
    if (existing) {
      return safeReply(ctx, `⏳ <b>একটি অর্ডার ইতিমধ্যে যাচাইয়ের অপেক্ষায় আছে</b>\n${DIVIDER}\n\n📦 <b>Product:</b> <b>${escapeHtml(product.title)}</b>\n🆔 <b>Order ID:</b> <code>${existing.order_id}</code>\n\n<b>অনুগ্রহ করে যাচাই সম্পন্ন হওয়া পর্যন্ত অপেক্ষা করুন।</b>`, {
        parse_mode: 'HTML',
        ...backToMenuKeyboard()
      });
    }

    const orderId = generateOrderId();
    setUserState(userId, {
      step: 'awaiting_screenshot',
      product: code,
      orderId,
      screenshotFileId: null
    });

    const mem = getConversation(userId);
    mem.selectedProduct = code;
    mem.conversationStage = 'Product Selected';
    saveConversation(mem);

    const caption = productCardCaption(product, orderId);
    const sent = await safeReplyWithPhoto(ctx, product.photo, {
      caption,
      parse_mode: 'HTML',
      ...productActionsKeyboard()
    });
    if (!sent) {
      await safeReply(ctx, caption, { parse_mode: 'HTML', ...productActionsKeyboard() });
    }
  });

  bot.action('submit_trx', async (ctx) => {
    await ctx.answerCbQuery();
    await safeReply(ctx, `📝 <b>অর্ডার সম্পন্ন করার নিয়ম</b>\n${DIVIDER}\n\n<b>ধাপ ১️⃣ — পেমেন্টের স্ক্রিনশট পাঠান</b>\n<b>ধাপ ২️⃣ — Transaction ID (৮–১০ অক্ষর) পাঠান</b>\n<b>ধাপ ৩️⃣ — ভেরিফিকেশনের জন্য অপেক্ষা করুন</b>\n<b>ধাপ ৪️⃣ — প্রোডাক্ট গ্রহণ করুন</b>`, { parse_mode: 'HTML' });
  });

  bot.action('start_payment', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const state = getUserState(userId);
    if (state.step === 'home' || !state.product) {
      return safeReply(ctx, `⚠️ <b>আগে একটি প্রোডাক্ট সিলেক্ট করুন।</b>`, {
        parse_mode: 'HTML',
        ...backToMenuKeyboard()
      });
    }
    setUserState(userId, { step: 'awaiting_screenshot' });
    await safeReply(ctx, `💳 <b>পেমেন্ট শুরু হয়েছে</b>\n\n<b>এখন আপনার Payment Screenshot পাঠান।</b>\n\n<b>Screenshot পাঠানোর পর Transaction ID চাওয়া হবে।</b>`, {
      parse_mode: 'HTML'
    });
  });

  // PHOTO
  bot.on('photo', async (ctx) => {
    const userId = ctx.from.id;
    const state = getUserState(userId);
    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;

    if (state.step === 'awaiting_screenshot') {
      setUserState(userId, { step: 'awaiting_trx', screenshotFileId: fileId });
      return safeReply(ctx, `✅ <b>Payment Screenshot Received</b>\n${DIVIDER}\n\n<b>এখন আপনার ৮–১০ অক্ষরের Transaction ID লিখে পাঠান।</b>`, { parse_mode: 'HTML' });
    }
    if (state.step === 'awaiting_trx') {
      setUserState(userId, { screenshotFileId: fileId });
      return safeReply(ctx, `✅ <b>Screenshot Updated</b>\n\n<b>এখন আপনার Transaction ID লিখে পাঠান।</b>`, { parse_mode: 'HTML' });
    }
    return safeReply(ctx, `⚠️ <b>কোনো সক্রিয় অর্ডার পাওয়া যায়নি</b>\n\n<b>দয়া করে প্রথমে মেনু থেকে একটি প্রোডাক্ট সিলেক্ট করুন।</b>`, {
      parse_mode: 'HTML',
      ...backToMenuKeyboard()
    });
  });

  // TEXT
  bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const userName = ctx.from.first_name || 'Customer';
    const username = ctx.from.username;
    const text = ctx.message.text.trim();
    const state = getUserState(userId);
    const isValidTrx = TRX_ID_REGEX.test(text);

    // TRX Flow
    if (isValidTrx) {
      if (state.step !== 'awaiting_screenshot' && state.step !== 'awaiting_trx') {
        return safeReply(ctx, `⚠️ <b>কোনো সক্রিয় অর্ডার পাওয়া যায়নি</b>\n\n<b>প্রথমে মেনু থেকে একটি প্রোডাক্ট সিলেক্ট করুন।</b>`, {
          parse_mode: 'HTML',
          ...backToMenuKeyboard()
        });
      }
      if (state.step === 'awaiting_screenshot' || !state.screenshotFileId) {
        return safeReply(ctx, `⚠️ <b>প্রথমে Payment Screenshot পাঠান</b>`, { parse_mode: 'HTML' });
      }
      if (isTrxUsed(text)) {
        return safeReply(ctx, `❌ <b>এই Transaction ID ইতিমধ্যে ব্যবহৃত হয়েছে</b>`, { parse_mode: 'HTML' });
      }

      const product = getProduct(state.product);
      const order = {
        orderId: state.orderId,
        userId,
        customerName: userName,
        username: username || null,
        product: state.product,
        price: product.price,
        trxId: text,
        screenshotFileId: state.screenshotFileId,
        status: 'Pending Verification',
        createdAt: Date.now(),
        createdAtText: nowBD()
      };
      createOrder(order);

      const mem = getConversation(userId);
      mem.paymentStatus = 'pending';
      mem.conversationStage = 'Payment Pending';
      saveConversation(mem);

      await safeReply(ctx, `🎉 <b>ধন্যবাদ, ${escapeHtml(userName)}!</b>

<b>আপনার Transaction ID সফলভাবে গ্রহণ করা হয়েছে।</b>

🆔 <b>Order ID:</b> <code>${state.orderId}</code>
📦 <b>Product:</b> <b>${escapeHtml(product.title)}</b>
📌 <b>Status:</b> <b>Pending Verification</b>

⏳ <b>সাধারণত ৫–১০ মিনিটের মধ্যে ভেরিফাই হয়ে যায়।</b>`, {
        parse_mode: 'HTML',
        ...backToMenuKeyboard()
      });

      await safeSendPhoto(bot, config.adminId, state.screenshotFileId, {
        caption: `🆕 <b>New Order Received</b>\n${DIVIDER}\n\n👤 <b>Customer:</b> ${escapeHtml(userName)}\n🆔 <b>Telegram ID:</b> <code>${userId}</code>\n🔗 <b>Username:</b> ${username ? '@' + escapeHtml(username) : 'N/A'}\n\n${DIVIDER}\n📦 <b>Order ID:</b> <code>${state.orderId}</code>\n🛍️ <b>Product:</b> <b>${escapeHtml(product.title)}</b>\n💵 <b>Price:</b> <b>${escapeHtml(product.price)}</b>\n💳 <b>Transaction ID:</b> <code>${escapeHtml(text)}</code>\n🕒 <b>Time:</b> ${order.createdAtText}`,
        parse_mode: 'HTML',
        ...adminApprovalKeyboard(state.orderId)
      });

      resetUserState(userId);
      return;
    }

    // Free text → Sinthiya + auto Product Card if purchase intent
    if (!isAdmin(ctx)) {
      await bot.telegram.forwardMessage(config.adminId, ctx.chat.id, ctx.message.message_id).catch(() => {});

      const memory = getConversation(userId);
      memory.customerName = userName;

      // Buying intent (নিব/কিনব ইত্যাদি) ও Negotiation intent (দাম কমানোর কথা) আলাদা করে চেনা হচ্ছে
      const buyIntent = /(নিব|কিনব|নিতে চাই|কিনতে চাই|order|পেমেন্ট|payment|দাম|price|card|কার্ড|দেখাও|দেখতে চাই|কিনবো|নিতে চাচ্ছি)/i.test(text);
      const negoIntent = /(দেই|দিব\b|দিমু|দিতে চাই|কম|কমান|কমাও|discount|ডিসকাউন্ট)/i.test(text) || /\d{2,4}\s*(টাকা|tk|৳)?/i.test(text);

      let matchedProduct = findProductByText(text);

      // ★ FIX: text-এ প্রোডাক্টের নাম না থাকলে, আগে থেকে সিলেক্ট করা প্রোডাক্ট (conversation context) থেকে নেওয়া হচ্ছে
      // ৬টা প্রোডাক্টের মধ্যে কোনটা বোঝানো হচ্ছে তা context ছাড়া guess করা হয় না — ভুল প্রোডাক্টের card এড়াতে
      if (!matchedProduct && memory.selectedProduct) {
        matchedProduct = getProduct(memory.selectedProduct);
      }

      // If user asks for course card/list without specific product → show courses menu
      if (/(card|কার্ড|কোর্স.*দেখ|course.*list|সব কোর্স|কি কি কোর্স|কোর্স.*আছে|কোর্স.*কি|কোন কোন কোর্স)/i.test(text) && !matchedProduct && state.step === 'home') {
        await safeReply(ctx, `📚 <b>আমাদের কোর্সসমূহ</b>\n\n<b>নিচ থেকে বেছে নিন:</b>`, {
          parse_mode: 'HTML',
          ...coursesKeyboard()
        });
        return;
      }

      // ★ FIX: buying intent থাকলেও, কোন প্রোডাক্ট বোঝানো হচ্ছে সেটা যদি এখনো অজানা থাকে
      // (matchedProduct null), তাহলে card না পাঠিয়ে বরং Courses মেনু দেখানো হচ্ছে —
      // যাতে কাস্টমার নিজেই এক ট্যাপে সঠিক কোর্স বেছে নিতে পারে (ভুল প্রোডাক্ট এড়াতে)
      if (buyIntent && !matchedProduct && state.step === 'home') {
        // শুধু "নিব"/"কিনব" জাতীয় জেনেরিক শব্দ (১-২ শব্দ) হলে সরাসরি Courses মেনু।
        // কিন্তু যদি টেক্সটে বেশি শব্দ থাকে (মানে কাস্টমার একটা নির্দিষ্ট, তালিকার বাইরের কোর্সের নাম বলেছে),
        // তাহলে "হয়তো Available আছে" মেসেজ দেখানো হবে, ভুল ধারণা এড়াতে
        const wordCount = text.split(/\s+/).filter(Boolean).length;
        if (wordCount > 2) {
          await safeReply(ctx, `😊 <b>Maybe কোর্সটি Available আছে।</b>\n<b>আমাদের টিম আপনার সাথে খুব দ্রুত যোগাযোগ করবে</b> আর <b>আপনার মেসেজটি এডমিনের কাছে ফরওয়ার্ড করা হয়েছে।</b>`, {
            parse_mode: 'HTML',
            ...coursesKeyboard()
          });
        } else {
          await safeReply(ctx, `😊 <b>অবশ্যই! কোন কোর্সটি নিতে চান, নিচ থেকে বেছে নিন:</b>`, {
            parse_mode: 'HTML',
            ...coursesKeyboard()
          });
        }
        return;
      }

      // Normal Sinthiya reply আগে পাঠানো হচ্ছে
      const aiReply = await generateReply(memory, text);
      if (aiReply) {
        // ★ Safety net: AI ভুলে **bold** (markdown) পাঠালেও তা <b>bold</b> (HTML) এ কনভার্ট হবে,
        // নাহলে parse_mode HTML-এ শুধু স্টার (**) চিহ্ন দেখাবে, বোল্ড হবে না
        const clean = aiReply
          .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
          .replace(/(?<!<)\*(.*?)\*(?!>)/g, '<b>$1</b>');
        addMessageToHistory(memory, 'user', text);
        addMessageToHistory(memory, 'assistant', clean);
        if (matchedProduct) memory.selectedProduct = matchedProduct.code;
        saveConversation(memory);
        await safeReply(ctx, clean, { parse_mode: 'HTML' });
      } else {
        const now = Date.now();
        if (now - (state.lastSupportMessage || 0) > SUPPORT_COOLDOWN_MS) {
          setUserState(userId, { lastSupportMessage: now });
          await safeReply(ctx, `✅ <b>মেসেজ গ্রহণ করা হয়েছে</b>\n\n<b>আমাদের টিম যত দ্রুত সম্ভব আপনার সাথে যোগাযোগ করবে।</b>`, { parse_mode: 'HTML' });
        }
      }

      // ★ FIX: AI reply-র পরে, buying অথবা negotiation (দাম নিয়ে কথা) — দুই ক্ষেত্রেই
      // matchedProduct (context সহ) থাকলে সাথে সাথে Product Card পাঠানো হচ্ছে
      if ((buyIntent || negoIntent) && matchedProduct && (state.step === 'home' || state.step === 'awaiting_screenshot')) {
        const existing = findPendingOrder(userId, matchedProduct.code);
        if (existing) {
          await safeReply(ctx, `⏳ <b>আপনার একটি অর্ডার ইতিমধ্যে যাচাইয়ের অপেক্ষায় আছে।</b>\n<b>Order ID:</b> <code>${existing.order_id}</code>`, {
            parse_mode: 'HTML',
            ...backToMenuKeyboard()
          });
          return;
        }

        const orderId = generateOrderId();
        setUserState(userId, {
          step: 'awaiting_screenshot',
          product: matchedProduct.code,
          orderId,
          screenshotFileId: null
        });

        memory.selectedProduct = matchedProduct.code;
        memory.conversationStage = 'Product Selected';
        saveConversation(memory);

        const caption = productCardCaption(matchedProduct, orderId);
        const sent = await safeReplyWithPhoto(ctx, matchedProduct.photo, {
          caption,
          parse_mode: 'HTML',
          ...productActionsKeyboard()
        });
        if (!sent) {
          await safeReply(ctx, caption, { parse_mode: 'HTML', ...productActionsKeyboard() });
        }
      }
    }
  });

  // MY ORDERS
  bot.action('my_orders', async (ctx) => {
    await ctx.answerCbQuery();
    const list = getUserOrders(ctx.from.id);
    if (!list.length) {
      return safeReply(ctx, `📦 <b>My Orders</b>\n${DIVIDER}\n\n<b>আপনার এখনো কোনো অর্ডার নেই।</b>`, {
        parse_mode: 'HTML',
        ...backToMenuKeyboard()
      });
    }
    let msg = `📦 <b>My Orders</b>\n${DIVIDER}\n\n`;
    list.forEach((o, i) => {
      const p = getProduct(o.product);
      msg += `${i + 1}. 🆔 <b>Order ID:</b> <code>${o.order_id}</code>\n📦 <b>Product:</b> <b>${escapeHtml(p?.title || o.product)}</b>\n💵 <b>Price:</b> <b>${escapeHtml(o.price)}</b>\n📌 <b>Status:</b> <b>${o.status}</b>\n🕒 ${o.created_at_text}\n\n`;
    });
    await safeReply(ctx, msg.trim(), { parse_mode: 'HTML', ...backToMenuKeyboard() });
  });

  // ADMIN
  bot.action(/^approve_(.+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('🚫 Unauthorized', { show_alert: true });
    await ctx.answerCbQuery();
    const orderId = ctx.match[1];
    const order = getOrder(orderId);
    if (!order) return safeReply(ctx, `⚠️ <b>Order not found.</b>`, { parse_mode: 'HTML' });
    if (order.status !== 'Pending Verification') {
      return safeReply(ctx, `⚠️ <b>Already processed.</b>`, { parse_mode: 'HTML' });
    }
    updateOrderStatus(orderId, 'Delivered ✅');
    const product = getProduct(order.product);
    await ctx.editMessageReplyMarkup(undefined).catch(() => {});
    await safeReply(ctx, `✅ <b>Order <code>${orderId}</code> approved.</b>`, { parse_mode: 'HTML' });
    await safeSend(bot, order.user_id, `🎉 <b>Payment Verified!</b>\n${DIVIDER}\n\n📦 <b>Product:</b> <b>${escapeHtml(product.title)}</b>\n✅ <b>Status:</b> <b>Delivered</b>\n\n🔗 <b>Access:</b>\n${product.access}\n\n${DIVIDER}\n🙏 <b>ধন্যবাদ!</b>\n<b>সমস্যা হলে ${config.supportUsername} এ যোগাযোগ করুন।</b>`, { parse_mode: 'HTML' });
  });

  bot.action(/^reject_(.+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery('🚫 Unauthorized', { show_alert: true });
    await ctx.answerCbQuery();
    const orderId = ctx.match[1];
    const order = getOrder(orderId);
    if (!order) return safeReply(ctx, `⚠️ <b>Order not found.</b>`, { parse_mode: 'HTML' });
    if (order.status !== 'Pending Verification') {
      return safeReply(ctx, `⚠️ <b>Already processed.</b>`, { parse_mode: 'HTML' });
    }
    updateOrderStatus(orderId, 'Rejected ❌');
    const product = getProduct(order.product);
    await ctx.editMessageReplyMarkup(undefined).catch(() => {});
    await safeReply(ctx, `❌ <b>Order rejected.</b>`, { parse_mode: 'HTML' });
    await safeSend(bot, order.user_id, `❌ <b>Payment Verification Failed</b>\n${DIVIDER}\n\n🆔 <b>Order ID:</b> <code>${orderId}</code>\n📦 <b>Product:</b> <b>${escapeHtml(product.title)}</b>\n\n<b>সঠিক Screenshot ও Transaction ID দিয়ে পুনরায় চেষ্টা করুন।</b>`, {
      parse_mode: 'HTML',
      ...backToMenuKeyboard()
    });
  });

  // FAQ + SUPPORT
  bot.action('faq', async (ctx) => {
    await ctx.answerCbQuery();
    await safeReply(ctx, `❓ <b>Frequently Asked Questions</b>

${DIVIDER}

<b>১. ডেলিভারি পেতে কত সময় লাগে?</b>
<b>সাধারণত ৫–১০ মিনিটের মধ্যে।</b>

<b>২. কোন পেমেন্ট মেথড সাপোর্ট করে?</b>
<b>bKash এবং Nagad (Personal - Send Money)।</b>

<b>৩. Refund পাওয়া যায় কি?</b>
<b>Digital Product হওয়ায় Refund প্রযোজ্য নয়।</b>

<b>৪. সাপোর্ট কখন পাওয়া যায়?</b>
<b>প্রতিদিন সকাল ৯টা থেকে রাত ১২টা পর্যন্ত।</b>`, {
      parse_mode: 'HTML',
      ...backToMenuKeyboard()
    });
  });

  bot.action('support', async (ctx) => {
    await ctx.answerCbQuery();
    await safeReply(ctx, `<b>কাস্টমার সাপোর্ট</b>

<b>কোনো প্রশ্ন বা সহায়তার প্রয়োজন হলে আমাদের অ্যাডমিনের সাথে যোগাযোগ করুন।</b>

👨‍💻 <b>Admin:</b> ${config.supportUsername}

<b>অথবা, আপনি সরাসরি এখানে মেসেজ লিখে পাঠাতে পারেন।</b>`, {
      parse_mode: 'HTML',
      ...backToMenuKeyboard()
    });
  });

  // Command Menu
  bot.telegram.setMyCommands([
    { command: 'start', description: 'মেইন মেনু' },
    { command: 'courses', description: 'কোর্সসমূহ' },
    { command: 'subs', description: 'সাবস্ক্রিপশন' },
    { command: 'orders', description: 'আমার অর্ডার' },
    { command: 'faq', description: 'FAQ' },
    { command: 'support', description: 'সাপোর্ট' }
  ]).catch(err => logger.warn('setMyCommands failed', err));

  // Command handlers
  bot.command('courses', async (ctx) => {
    await safeReply(ctx, `📚 <b>Digital Courses</b>\n\n<b>আপনি কোন কোর্সটি নিতে চান?</b>`, {
      parse_mode: 'HTML',
      ...coursesKeyboard()
    });
  });

  bot.command('subs', async (ctx) => {
    await safeReply(ctx, `⭐ <b>Premium Subscription</b>\n\n<b>আপনার পছন্দের প্ল্যান বেছে নিন।</b>`, {
      parse_mode: 'HTML',
      ...subsKeyboard()
    });
  });

  bot.command('orders', async (ctx) => {
    // reuse my_orders logic by triggering callback style
    const list = getUserOrders(ctx.from.id);
    if (!list.length) {
      return safeReply(ctx, `📦 <b>My Orders</b>\n\n<b>আপনার এখনো কোনো অর্ডার নেই।</b>`, {
        parse_mode: 'HTML',
        ...backToMenuKeyboard()
      });
    }
    let msg = `📦 <b>My Orders</b>\n\n`;
    list.forEach((o, i) => {
      const p = getProduct(o.product);
      msg += `${i + 1}. 🆔 <b>Order ID:</b> <code>${o.order_id}</code>\n📦 <b>Product:</b> <b>${escapeHtml(p?.title || o.product)}</b>\n💵 <b>Price:</b> <b>${escapeHtml(o.price)}</b>\n📌 <b>Status:</b> <b>${o.status}</b>\n\n`;
    });
    await safeReply(ctx, msg.trim(), { parse_mode: 'HTML', ...backToMenuKeyboard() });
  });

  bot.command('faq', async (ctx) => {
    await safeReply(ctx, `❓ <b>Frequently Asked Questions</b>\n\n<b>১. ডেলিভারি পেতে কত সময় লাগে?</b>\n<b>সাধারণত ৫–১০ মিনিটের মধ্যে।</b>\n\n<b>২. কোন পেমেন্ট মেথড সাপোর্ট করে?</b>\n<b>bKash এবং Nagad (Personal - Send Money)।</b>\n\n<b>৩. Refund পাওয়া যায় কি?</b>\n<b>Digital Product হওয়ায় Refund প্রযোজ্য নয়।</b>\n\n<b>৪. সাপোর্ট কখন পাওয়া যায়?</b>\n<b>প্রতিদিন সকাল ৯টা থেকে রাত ১২টা পর্যন্ত।</b>`, {
      parse_mode: 'HTML',
      ...backToMenuKeyboard()
    });
  });

  bot.command('support', async (ctx) => {
    await safeReply(ctx, `<b>কাস্টমার সাপোর্ট</b>\n\n<b>কোনো প্রশ্ন বা সহায়তার প্রয়োজন হলে আমাদের অ্যাডমিনের সাথে যোগাযোগ করুন।</b>\n\n👨‍💻 <b>Admin:</b> ${config.supportUsername}\n\n<b>অথবা, আপনি সরাসরি এখানে মেসেজ লিখে পাঠাতে পারেন।</b>`, {
      parse_mode: 'HTML',
      ...backToMenuKeyboard()
    });
  });

  bot.catch((err) => logger.error('Bot error', err));
  return bot;
}

module.exports = { createBot };
