/**
 * Course Nibo — Premium Digital Store Bot + Groq AI
 * Compact Single File Version
 */
const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const Groq = require('groq-sdk');
require('dotenv').config();

const {
  BOT_TOKEN, ADMIN_ID, BKASH_NUMBER, NAGAD_NUMBER,
  SUPPORT_USERNAME, PORT = 3000, GROQ_API_KEY
} = process.env;

if (!BOT_TOKEN || !ADMIN_ID || !BKASH_NUMBER || !NAGAD_NUMBER || !SUPPORT_USERNAME) {
  console.error('❌ Missing required environment variables!');
  process.exit(1);
}

const app = express();
app.get('/', (req, res) => res.send('✅ Course Nibo Bot is running'));
app.listen(PORT, () => console.log(`Web server on port ${PORT}`));

const bot = new Telegraf(BOT_TOKEN);
const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

const SYSTEM_PROMPT = `তুমি Course Nibo-এর অফিসিয়াল প্রিমিয়াম সাপোর্ট অ্যাসিস্ট্যান্ট।
তোমার নাম নেই। তুমি শুধু ব্র্যান্ডের প্রতিনিধি হিসেবে কথা বলবে।
স্টাইল:
- প্রফেশনাল, বিনয়ী ও আত্মবিশ্বাসী
- উত্তর সংক্ষিপ্ত কিন্তু পরিপূর্ণ (৩-৫ লাইন)
- অপ্রয়োজনীয় ইমোজি কম ব্যবহার করবে
- গ্রাহককে সম্মানজনকভাবে সম্বোধন করবে
**Formatting Rule (খুব গুরুত্বপূর্ণ):**
- সব টাইটেল, হেডিং এবং গুরুত্বপূর্ণ অংশ <b>bold</b> করবে (Telegram HTML)
- প্রোডাক্ট নাম, প্রাইস, অর্ডার আইডি অবশ্যই <b>bold</b> থাকবে
- Use <b>text</b> tags, markdown **text** নয়
জ্ঞান:
- Complete Japanese Language → ১৯৯ টাকা
- Banglay IELTS → ২৯৯ টাকা
- ChatGPT Go (3 Month) → ৩৫০ টাকা
- কোটি টাকার বিজনেস ফর্মুলা → ১৯৯ টাকা
- Video Editing Course By Rafayat Rakib → ১৯৯ টাকা
- Video Editing with After Effects & Premiere Pro Batch 2 → ২৯৯ টাকা
পেমেন্ট: bKash ও Nagad (Send Money)
ডেলিভারি: সাধারণত ৫-১০ মিনিট
রিফান্ড: Digital প্রোডাক্ট হওয়ায় প্রযোজ্য নয়
**Repetition Rule:**
যদি ইউজার একই প্রশ্ন বারবার করে, politely স্বীকার করবে (যেমন: "আপনি আগেও এই বিষয়ে জিজ্ঞাসা করেছেন...") এবং নতুনভাবে সাহায্যের প্রস্তাব দেবে। একই উত্তর বারবার দেবে না।
Be dynamic and varied in language.`;

async function getAIResponse(msg) {
  if (!groq) return null;
  try {
    const res = await groq.chat.completions.create({
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: msg }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.65,
      max_tokens: 450
    });
    return res.choices[0]?.message?.content || null;
  } catch (e) {
    console.error('Groq Error:', e.message);
    return null;
  }
}

const PRODUCTS = {
  japanese: { title: 'Complete Japanese Language', price: '199 BDT', photo: 'https://files.catbox.moe/u23flr.png', access: 'https://drive.google.com/drive/folders/1FhGMWbEhC2mlwS-cyyidqA8IG2gkxW2z?usp=drive_link' },
  ielts: { title: 'Banglay IELTS', price: '299 BDT', photo: 'https://files.catbox.moe/yrzo1e.png', access: 'https://t.me/+DMbXkww55TdmYTdl' },
  chatgpt_1m: { title: 'ChatGPT Go (3 Month)', price: '350 BDT', photo: 'https://files.catbox.moe/tziyuw.png', access: 'Gmail: lee.4l3x+1@yandex.com\nPassword: I am Asif01580' },
  business: { title: 'কোটি টাকার বিজনেস ফর্মুলা 🚀💰', price: '199 BDT', photo: 'https://files.catbox.moe/0uedgs.png', access: 'https://t.me/+uq_znvl5DUFmY2I1' },
  editing: { title: '🟢 Video Editing Course By Rafayat Rakib', price: '199 BDT', photo: 'https://files.catbox.moe/jqwbtt.png', access: 'https://drive.google.com/drive/folders/1WPhr-AXO1MzsZuJ6PMEeQsqaVJ5OIpf4?usp=drive_link' },
  premiere: { title: 'Video Editing with After Effects and Premiere Pro Batch 2', price: '299 BDT', photo: 'https://files.catbox.moe/h5u7j0.png', access: 'https://t.me/+NZDDhunzLXU2NTVl' }
};

const getProduct = (code) => PRODUCTS[code] || { title: 'Premium Service', price: 'N/A', photo: '', access: 'N/A' };
const userStates = new Map();
const orders = new Map();
const usedTrxIds = new Set();
const DIVIDER = '━━━━━━━━━━━━━━━━━━';
const TRX_ID_REGEX = /^[A-Za-z0-9]{8,10}$/;
const SUPPORT_COOLDOWN_MS = 5 * 60 * 1000;

const getState = (id) => userStates.get(id) || {};
const setState = (id, patch) => userStates.set(id, { ...getState(id), ...patch });
const resetState = (id) => {
  const prev = getState(id);
  userStates.set(id, { step: 'home', lastSupportMessage: prev.lastSupportMessage || 0, lastUserMessage: '' });
};
const escapeHtml = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const generateOrderId = () => `ORD-${Date.now().toString().slice(-8)}${Math.floor(10 + Math.random() * 90)}`;
const nowBD = () => new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short' });
const isAdmin = (ctx) => ctx.from && ctx.from.id.toString() === ADMIN_ID.toString();

function findPendingOrder(userId, code) {
  for (const o of orders.values()) {
    if (o.userId === userId && o.product === code && o.status === 'Pending Verification') return o;
  }
  return null;
}
function getUserOrders(userId) {
  return Array.from(orders.values()).filter(o => o.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
}

const mainMenuKeyboard = () => Markup.inlineKeyboard([
  [Markup.button.callback('📚 Digital Courses', 'view_courses')],
  [Markup.button.callback('⭐ Premium Subscription', 'view_subs')],
  [Markup.button.callback('📦 My Orders', 'my_orders')],
  [Markup.button.callback('❓ FAQ', 'faq')],
  [Markup.button.callback('🎧 Live Support', 'support')]
]);
const backToMenuKeyboard = () => Markup.inlineKeyboard([[Markup.button.callback('🔙 Main Menu', 'main_menu')]]);

async function safeReply(ctx, text, extra = {}) {
  try { return await ctx.reply(text, extra); } catch (e) { console.error('Reply failed:', e.message); }
}
async function safeSend(chatId, text, extra = {}) {
  try { return await bot.telegram.sendMessage(chatId, text, extra); } catch (e) { console.error(`Send to ${chatId} failed:`, e.message); }
}

function welcomeText(name) {
  return `👋 <b>আসসালামু আলাইকুম, ${escapeHtml(name)}!</b>\n🌟 <b>Course Nibo</b>-তে আপনাকে আন্তরিক স্বাগতম।\n${DIVIDER}\n📚 <b>আমাদের সার্ভিসসমূহ</b>\n✨ Premium Digital Courses\n🤖 ChatGPT Go\n🎬 Video Editing Courses\n💼 Business Formula\n${DIVIDER}\n💎 <b>কেন আমাদের বেছে নেবেন?</b>\n✅ দ্রুত ডেলিভারি\n✅ বিশ্বস্ত সার্ভিস\n✅ নিরাপদ পেমেন্ট\n✅ ২৪/৭ সাপোর্ট\n${DIVIDER}\n👇 <u><b>নিচের মেনু থেকে আপনার পছন্দের অপশন নির্বাচন করুন।</b></u>`;
}

bot.start((ctx) => {
  resetState(ctx.from.id);
  safeReply(ctx, welcomeText(ctx.from.first_name || 'Customer'), { parse_mode: 'HTML', ...mainMenuKeyboard() });
});

bot.action('main_menu', async (ctx) => {
  await ctx.answerCbQuery();
  resetState(ctx.from.id);
  safeReply(ctx, welcomeText(ctx.from.first_name || 'Customer'), { parse_mode: 'HTML', ...mainMenuKeyboard() });
});

bot.action('view_courses', async (ctx) => {
  await ctx.answerCbQuery();
  safeReply(ctx, `📚 <b>Digital Courses</b>\n${DIVIDER}\n\nআপনি কোন কোর্সটি নিতে চান?`, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('🇯🇵 Complete Japanese Language — 199 BDT', 'buy_japanese')],
      [Markup.button.callback('📘 Banglay IELTS — 299 BDT', 'buy_ielts')],
      [Markup.button.callback('💰 কোটি টাকার বিজনেস ফর্মুলা — 199 BDT', 'buy_business')],
      [Markup.button.callback('🎬 Video Editing by Rafayat Rakib — 199 BDT', 'buy_editing')],
      [Markup.button.callback('🎥 Premiere Pro + After Effects — 299 BDT', 'buy_premiere')],
      [Markup.button.callback('🔙 Main Menu', 'main_menu')]
    ])
  });
});

bot.action('view_subs', async (ctx) => {
  await ctx.answerCbQuery();
  safeReply(ctx, `⭐ <b>Premium Subscription</b>\n${DIVIDER}\n\nআপনার পছন্দের প্ল্যান বেছে নিন।`, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('🤖 ChatGPT Go (3 Month) — 350 BDT', 'buy_chatgpt_1m')],
      [Markup.button.callback('🔙 Main Menu', 'main_menu')]
    ])
  });
});

function productCardCaption(product, orderId) {
  return `🛒 <b>Order Summary</b>\n${DIVIDER}\n\n📦 Product: <b>${escapeHtml(product.title)}</b>\n💵 Price: <b>${escapeHtml(product.price)}</b>\n🆔 <b>Order ID:</b> <code>${orderId}</code>\n\n${DIVIDER}\n💳 <b>Payment Method</b>\n\n🟢 <b>bKash (Send Money):</b> <code>${BKASH_NUMBER}</code>\n🟠 <b>Nagad (Send Money):</b> <code>${NAGAD_NUMBER}</code>\n\n${DIVIDER}\n🚚 <b>Delivery:</b> যাচাই সম্পন্ন হওয়ার সাথে সাথেই এই চ্যাটে প্রোডাক্ট পাঠানো হবে।\n\n👇 <b>পেমেন্টের স্ক্রিনশট</b> পাঠিয়ে শুরু করুন।\nনিয়ম দেখতে নিচের বাটনে ক্লিক করুন।`;
}

bot.action(/^buy_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const code = ctx.match[1];
  const userId = ctx.from.id;
  const product = getProduct(code);
  const existing = findPendingOrder(userId, code);

  if (existing) {
    return safeReply(ctx, `⏳ <b>একটি অর্ডার ইতিমধ্যে যাচাইয়ের অপেক্ষায় আছে</b>\n${DIVIDER}\n\n📦 <b>Product:</b> <b>${escapeHtml(product.title)}</b>\n🆔 <b>Order ID:</b> <code>${existing.orderId}</code>\n\nঅনুগ্রহ করে যাচাই সম্পন্ন হওয়া পর্যন্ত <b>অপেক্ষা</b> করুন।`, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📦 My Orders', 'my_orders')],
        [Markup.button.callback('🔙 Main Menu', 'main_menu')]
      ])
    });
  }

  const orderId = generateOrderId();
  setState(userId, { step: 'awaiting_screenshot', product: code, orderId, screenshotFileId: null });

  try {
    await ctx.replyWithPhoto(product.photo, {
      caption: productCardCaption(product, orderId),
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📋 অর্ডার করার নিয়ম', 'submit_trx')],
        [Markup.button.callback('🔙 Main Menu', 'main_menu')]
      ])
    });
  } catch {
    safeReply(ctx, productCardCaption(product, orderId), {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📋 অর্ডার করার নিয়ম', 'submit_trx')],
        [Markup.button.callback('🔙 Main Menu', 'main_menu')]
      ])
    });
  }
});

bot.action('submit_trx', async (ctx) => {
  await ctx.answerCbQuery();
  safeReply(ctx, `📝 <b>অর্ডার সম্পন্ন করার নিয়ম</b>\n${DIVIDER}\n\n<b>ধাপ ১️⃣ — পেমেন্টের স্ক্রিনশট পাঠান</b>\n<b>ধাপ ২️⃣ — Transaction ID (৮–১০ অক্ষর) পাঠান</b>\n<b>ধাপ ৩️⃣ — ভেরিফিকেশনের জন্য অপেক্ষা করুন</b>\n<b>ধাপ ৪️⃣ — প্রোডাক্ট গ্রহণ করুন</b>\n\n${DIVIDER}\nসঠিক Screenshot ও Transaction ID পাঠালে দ্রুত ভেরিফিকেশন সম্পন্ন হবে।`, { parse_mode: 'HTML' });
});

bot.on('photo', async (ctx) => {
  const userId = ctx.from.id;
  const state = getState(userId);
  const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;

  if (state.step === 'awaiting_screenshot') {
    setState(userId, { step: 'awaiting_trx', screenshotFileId: fileId });
    return safeReply(ctx, `✅ <b>Payment Screenshot Received</b>\n${DIVIDER}\n\nএখন আপনার ৮–১০ অক্ষরের <b>Transaction ID</b> লিখে পাঠান।`, { parse_mode: 'HTML' });
  }
  if (state.step === 'awaiting_trx') {
    setState(userId, { screenshotFileId: fileId });
    return safeReply(ctx, `✅ <b>Screenshot Updated</b>\n\nএখন আপনার Transaction ID লিখে পাঠান।`, { parse_mode: 'HTML' });
  }
  return safeReply(ctx, `⚠️ <b>কোনো সক্রিয় অর্ডার পাওয়া যায়নি</b>\n\nদয়া করে প্রথমে মেনু থেকে একটি <b>প্রোডাক্ট সিলেক্ট</b> করুন।`, { parse_mode: 'HTML', ...backToMenuKeyboard() });
});

bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const userName = ctx.from.first_name || 'Customer';
  const username = ctx.from.username;
  const text = ctx.message.text.trim();
  const state = getState(userId);
  const isValidTrx = TRX_ID_REGEX.test(text);

  if (state.lastUserMessage &&
      state.lastUserMessage.trim().toLowerCase() === text.toLowerCase() &&
      state.step !== 'awaiting_screenshot' &&
      state.step !== 'awaiting_trx' &&
      !isValidTrx) {
    await safeReply(ctx, `আপনি <b>একই মেসেজ</b> আবার পাঠিয়েছেন।\n\nআমি কি আপনাকে আরও কোনোভাবে সাহায্য করতে পারি? অন্য কোনো প্রশ্ন বা বিস্তারিত বলুন।`, { parse_mode: 'HTML' });
    setState(userId, { lastUserMessage: text });
    return;
  }

  if (isValidTrx) {
    if (state.step !== 'awaiting_screenshot' && state.step !== 'awaiting_trx') {
      return safeReply(ctx, `⚠️ <b>কোনো সক্রিয় অর্ডার পাওয়া যায়নি</b>\n\nপ্রথমে মেনু থেকে একটি প্রোডাক্ট সিলেক্ট করুন।`, { parse_mode: 'HTML', ...backToMenuKeyboard() });
    }
    if (state.step === 'awaiting_screenshot' || !state.screenshotFileId) {
      return safeReply(ctx, `⚠️ <b>প্রথমে Payment Screenshot পাঠান</b>\n\nScreenshot পাঠানোর পরই Transaction ID গ্রহণ করা হবে।`, { parse_mode: 'HTML' });
    }
    if (usedTrxIds.has(text)) {
      return safeReply(ctx, `❌ <b>এই Transaction ID ইতিমধ্যে ব্যবহৃত হয়েছে</b>\n\nঅনুগ্রহ করে সঠিক ও নতুন <b>Transaction ID</b> পাঠান।`, { parse_mode: 'HTML' });
    }

    const { product: productCode, orderId, screenshotFileId } = state;
    const product = getProduct(productCode);
    usedTrxIds.add(text);

    const order = {
      orderId, userId, customerName: userName, username: username || null,
      product: productCode, price: product.price, trxId: text,
      screenshotFileId, status: 'Pending Verification',
      createdAt: Date.now(), createdAtText: nowBD()
    };
    orders.set(orderId, order);

    await safeReply(ctx, `🎉 <b>ধন্যবাদ, ${escapeHtml(userName)}!</b>\n${DIVIDER}\n\nআপনার Transaction ID সফলভাবে গ্রহণ করা হয়েছে।\n\n🆔 <b>Order ID:</b> <code>${orderId}</code>\n📦 <b>Product:</b> <b>${escapeHtml(product.title)}</b>\n📌 Status: <b>Pending Verification</b>\n\n⏳ <b>সাধারণত ৫–১০ মিনিটের মধ্যে ভেরিফাই হয়ে যায়।</b>`, { parse_mode: 'HTML', ...backToMenuKeyboard() });

    try {
      await bot.telegram.sendPhoto(ADMIN_ID, screenshotFileId, {
        caption: `🆕 <b>New Order Received</b>\n${DIVIDER}\n\n👤 <b>Customer:</b> ${escapeHtml(userName)}\n🆔 <b>Telegram ID:</b> <code>${userId}</code>\n🔗 Username: ${username ? '@' + escapeHtml(username) : 'N/A'}\n\n${DIVIDER}\n📦 <b>Order ID:</b> <code>${orderId}</code>\n🛍️ <b>Product:</b> <b>${escapeHtml(product.title)}</b>\n💵 <b>Price:</b> <b>${escapeHtml(product.price)}</b>\n💳 <b>Transaction ID:</b> <code>${escapeHtml(text)}</code>\n🕒 <b>Time:</b> ${order.createdAtText}`,
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✅ Approve', `approve_${orderId}`), Markup.button.callback('❌ Reject', `reject_${orderId}`)]
        ])
      });
    } catch (e) {
      console.error('Failed to notify admin:', e.message);
    }

    resetState(userId);
    setState(userId, { lastUserMessage: text });
    return;
  }

  if (!isAdmin(ctx)) {
    await bot.telegram.forwardMessage(ADMIN_ID, ctx.chat.id, ctx.message.message_id).catch(() => {});
    const aiReply = await getAIResponse(text);
    if (aiReply) {
      await safeReply(ctx, aiReply, { parse_mode: 'HTML' });
    } else {
      const now = Date.now();
      if (now - (state.lastSupportMessage || 0) > SUPPORT_COOLDOWN_MS) {
        setState(userId, { lastSupportMessage: now });
        await safeReply(ctx, `✅ <b>মেসেজ গ্রহণ করা হয়েছে</b>\n\nআমাদের টিম যত দ্রুত সম্ভব আপনার সাথে যোগাযোগ করবে।`, { parse_mode: 'HTML' });
      }
    }
  }
  setState(userId, { lastUserMessage: text });
});

bot.action('my_orders', async (ctx) => {
  await ctx.answerCbQuery();
  const list = getUserOrders(ctx.from.id);
  if (!list.length) {
    return safeReply(ctx, `📦 <b>My Orders</b>\n${DIVIDER}\n\nআপনার এখনো কোনো অর্ডার নেই।`, { parse_mode: 'HTML', ...backToMenuKeyboard() });
  }
  let msg = `📦 <b>My Orders</b>\n${DIVIDER}\n\n`;
  list.forEach((o, i) => {
    const p = getProduct(o.product);
    msg += `${i + 1}. 🆔 <b>Order ID:</b> <code>${o.orderId}</code>\n📦 Product: <b>${escapeHtml(p.title)}</b>\n💵 <b>Price:</b> ${escapeHtml(o.price)}\n📌 <b>Status:</b> ${o.status}\n🕒 ${o.createdAtText}\n\n`;
  });
  safeReply(ctx, msg.trim(), { parse_mode: 'HTML', ...backToMenuKeyboard() });
});

bot.action(/^approve_(.+)$/, async (ctx) => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery('🚫 Unauthorized', { show_alert: true });
  await ctx.answerCbQuery();
  const orderId = ctx.match[1];
  const order = orders.get(orderId);
  if (!order) return safeReply(ctx, `⚠️ Order <code>${orderId}</code> not found.`, { parse_mode: 'HTML' });
  if (order.status !== 'Pending Verification') {
    return safeReply(ctx, `⚠️ <b>Already processed.</b>\nCurrent status: ${order.status}`, { parse_mode: 'HTML' });
  }
  order.status = 'Delivered ✅';
  const product = getProduct(order.product);
  await ctx.editMessageReplyMarkup(undefined).catch(() => {});
  await safeReply(ctx, `✅ Order <code>${orderId}</code> approved and delivered.`, { parse_mode: 'HTML' });
  await safeSend(order.userId, `🎉 <b>Payment Verified!</b>\n${DIVIDER}\n\n📦 Product: <b>${escapeHtml(product.title)}</b>\n✅ Status: Delivered\n\n🔗 Access:\n${product.access}\n\n${DIVIDER}\n🙏 আমাদের থেকে কেনাকাটার জন্য ধন্যবাদ!\nকোনো সমস্যা হলে ${SUPPORT_USERNAME} এ যোগাযোগ করুন।`, { parse_mode: 'HTML' });
});

bot.action(/^reject_(.+)$/, async (ctx) => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery('🚫 Unauthorized', { show_alert: true });
  await ctx.answerCbQuery();
  const orderId = ctx.match[1];
  const order = orders.get(orderId);
  if (!order) return safeReply(ctx, `⚠️ Order <code>${orderId}</code> not found.`, { parse_mode: 'HTML' });
  if (order.status !== 'Pending Verification') {
    return safeReply(ctx, `⚠️ <b>Already processed.</b>\nCurrent status: ${order.status}`, { parse_mode: 'HTML' });
  }
  order.status = 'Rejected ❌';
  const product = getProduct(order.product);
  await ctx.editMessageReplyMarkup(undefined).catch(() => {});
  await safeReply(ctx, `❌ Order <code>${orderId}</code> rejected.`, { parse_mode: 'HTML' });
  await safeSend(order.userId, `❌ <b>Payment Verification Failed</b>\n${DIVIDER}\n\n🆔 Order ID: <code>${orderId}</code>\n📦 Product: <b>${escapeHtml(product.title)}</b>\n\nআপনার প্রদত্ত তথ্য যাচাই করা যায়নি। সঠিক Screenshot ও Transaction ID দিয়ে পুনরায় চেষ্টা করুন।`, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('🎧 Contact Support', 'support')],
      [Markup.button.callback('🔙 Main Menu', 'main_menu')]
    ])
  });
});

bot.action('faq', async (ctx) => {
  await ctx.answerCbQuery();
  safeReply(ctx, `❓ <b>Frequently Asked Questions</b>\n${DIVIDER}\n\n<b>১. ডেলিভারি পেতে কত সময় লাগে?</b>\nসাধারণত ৫–১০ মিনিটের মধ্যে।\n\n<b>২. কোন পেমেন্ট মেথড সাপোর্ট করে?</b>\nbKash এবং Nagad।\n\n<b>৩. Refund পাওয়া যায় কি?</b>\nDigital Product হওয়ায় Refund প্রযোজ্য নয়।\n\n<b>৪. সাপোর্ট কখন পাওয়া যায়?</b>\nপ্রতিদিন সকাল ৯টা থেকে রাত ১২টা পর্যন্ত।`, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('🎧 Customer Support', 'support')],
      [Markup.button.callback('🔙 Main Menu', 'main_menu')]
    ])
  });
});

bot.action('support', async (ctx) => {
  await ctx.answerCbQuery();
  safeReply(ctx, `<b>কাস্টমার সাপোর্ট</b>\n\nকোনো প্রশ্ন বা সহায়তার প্রয়োজন হলে আমাদের অ্যাডমিনের সাথে যোগাযোগ করুন।\n\n👨‍💻 <b>Admin:</b> ${SUPPORT_USERNAME}\n\n<i>অথবা, আপনি সরাসরি এখানে মেসেজ লিখে পাঠাতে পারেন।</i>`, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('❓ FAQ', 'faq')],
      [Markup.button.callback('🔙 Main Menu', 'main_menu')]
    ])
  });
});

bot.catch((err, ctx) => console.error(`Bot error for ${ctx.updateType}:`, err));
bot.launch();
console.log('✅ Course Nibo Premium Bot + Groq AI is running.');
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
