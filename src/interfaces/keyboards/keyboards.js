const { Markup } = require('telegraf');
const { getCourseProducts, getSubscriptionProducts } = require('../../domain/products');

function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📚 কোর্সসমূহ', 'view_courses')],
    [Markup.button.callback('⭐ সাবস্ক্রিপশন', 'view_subs')],
    [Markup.button.callback('📦 আমার অর্ডার', 'my_orders')],
    [Markup.button.callback('❓ FAQ', 'faq')],
    [Markup.button.callback('🎧 সাপোর্ট', 'support')]
  ]);
}

function backToMenuKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.callback('🔙 ফিরে যান', 'main_menu')]]);
}

function coursesKeyboard() {
  const buttons = getCourseProducts().map((p, i) => [
    Markup.button.callback(`${i + 1}. ${p.title}`, `buy_${p.code}`)
  ]);
  buttons.push([Markup.button.callback('🔙 ফিরে যান', 'main_menu')]);
  return Markup.inlineKeyboard(buttons);
}

function subsKeyboard() {
  const buttons = getSubscriptionProducts().map((p, i) => [
    Markup.button.callback(`${i + 1}. ${p.title}`, `buy_${p.code}`)
  ]);
  buttons.push([Markup.button.callback('🔙 ফিরে যান', 'main_menu')]);
  return Markup.inlineKeyboard(buttons);
}

function productActionsKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('💳 পেমেন্ট শুরু করুন', 'start_payment')],
    [Markup.button.callback('📋 অর্ডার করার নিয়ম', 'submit_trx')],
    [Markup.button.callback('📞 সাপোর্ট', 'support')],
    [Markup.button.callback('🔙 ফিরে যান', 'main_menu')]
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
