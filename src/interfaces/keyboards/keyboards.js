const { Markup } = require('telegraf');
const { getCourseProducts, getSubscriptionProducts } = require('../../domain/products');

function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📚 Digital Courses', 'view_courses')],
    [Markup.button.callback('⭐ Premium Subscription', 'view_subs')],
    [Markup.button.callback('📦 My Orders', 'my_orders')],
    [Markup.button.callback('❓ FAQ', 'faq')],
    [Markup.button.callback('🎧 Live Support', 'support')]
  ]);
}

function backToMenuKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.callback('🔙 Main Menu', 'main_menu')]]);
}

function coursesKeyboard() {
  const buttons = getCourseProducts().map(p => [
    Markup.button.callback(p.title, `buy_${p.code}`)
  ]);
  buttons.push([Markup.button.callback('🔙 Main Menu', 'main_menu')]);
  return Markup.inlineKeyboard(buttons);
}

function subsKeyboard() {
  const buttons = getSubscriptionProducts().map(p => [
    Markup.button.callback(p.title, `buy_${p.code}`)
  ]);
  buttons.push([Markup.button.callback('🔙 Main Menu', 'main_menu')]);
  return Markup.inlineKeyboard(buttons);
}

function productActionsKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('💳 পেমেন্ট শুরু করুন', 'start_payment')],
    [Markup.button.callback('📋 অর্ডার করার নিয়ম', 'submit_trx')],
    [Markup.button.callback('🔙 Main Menu', 'main_menu')]
  ]);
}

function adminApprovalKeyboard(orderId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Approve', `approve_${orderId}`),
      Markup.button.callback('❌ Reject', `reject_${orderId}`)
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
