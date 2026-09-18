const { Markup } = require('telegraf');
const {
  getCourseProducts,
  getSubscriptionProducts
} = require('../../domain/products');

/**
 * Main menu
 * Clean, compact and professional layout.
 */
function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('📚 কোর্সসমূহ', 'view_courses'),
      Markup.button.callback('⭐ সাবস্ক্রিপশন', 'view_subs')
    ],
    [
      Markup.button.callback('📦 আমার অর্ডার', 'my_orders'),
      Markup.button.callback('❓ FAQ', 'faq')
    ],
    [
      Markup.button.callback('🎧 সাপোর্ট', 'support')
    ]
  ]);
}

/**
 * Single back-to-menu button
 */
function backToMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔙 মূল মেনুতে ফিরে যান', 'main_menu')]
  ]);
}

/**
 * Course list
 *
 * Course order comes from products.js.
 * Every course is numbered automatically:
 * 1, 2, 3, 4...
 *
 * Callback format is kept compatible with bot.js:
 * buy_<product_code>
 */
function coursesKeyboard() {
  const courses = getCourseProducts();

  const buttons = courses.map((product, index) => [
    Markup.button.callback(
      `${index + 1}. ${product.shortTitle || product.title}`,
      `buy_${product.code}`
    )
  ]);

  buttons.push([
    Markup.button.callback(
      '🔙 মূল মেনুতে ফিরে যান',
      'main_menu'
    )
  ]);

  return Markup.inlineKeyboard(buttons);
}

/**
 * Subscription list
 *
 * Same numbering system as courses.
 */
function subsKeyboard() {
  const subscriptions = getSubscriptionProducts();

  const buttons = subscriptions.map((product, index) => [
    Markup.button.callback(
      `${index + 1}. ${product.shortTitle || product.title}`,
      `buy_${product.code}`
    )
  ]);

  buttons.push([
    Markup.button.callback('🔙 মূল মেনুতে ফিরে যান', 'main_menu')
  ]);

  return Markup.inlineKeyboard(buttons);
}

/**
 * Product card action buttons
 *
 * Existing callback names are preserved so bot.js
 * does not break.
 */
function productActionsKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '💳 পেমেন্ট শুরু করুন',
        'start_payment'
      )
    ],
    [
      Markup.button.callback(
        '📋 অর্ডার করার নিয়ম',
        'submit_trx'
      )
    ],
    [
      Markup.button.callback(
        '📞 সাপোর্ট',
        'support'
      )
    ],
    [
      Markup.button.callback(
        '🔙 মূল মেনু',
        'main_menu'
      )
    ]
  ]);
}

/**
 * Admin order approval controls
 */
function adminApprovalKeyboard(orderId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '✅ Approve',
        `approve_${orderId}`
      ),
      Markup.button.callback(
        '❌ Reject',
        `reject_${orderId}`
      )
    ]
  ]);
}

module.exports = {
  mainMenuKeyboard,
  backToMenuKeyboard,
  coursesKeyboard,
  subsKeyboard,
  productActionsKeyboard,
  adminApprovalKeyboard
};
