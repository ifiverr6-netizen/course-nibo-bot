const { Markup } = require('telegraf');

const {
  getCourseProducts,
  getSubscriptionProducts
} = require('../../domain/products');


/*
 * =========================================================
 * MAIN MENU
 * =========================================================
 */

function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '📚 কোর্সসমূহ',
        'view_courses'
      ),
      Markup.button.callback(
        '⭐ সাবস্ক্রিপশন',
        'view_subs'
      )
    ],
    [
      Markup.button.callback(
        '📦 আমার অর্ডার',
        'my_orders'
      ),
      Markup.button.callback(
        '❓ FAQ',
        'faq'
      )
    ],
    [
      Markup.button.callback(
        '🎧 সাপোর্ট',
        'support'
      )
    ]
  ]);
}


/*
 * =========================================================
 * BACK TO MAIN MENU
 * =========================================================
 */

function backToMenuKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '🔙 মূল মেনুতে ফিরে যান',
        'main_menu'
      )
    ]
  ]);
}


/*
 * =========================================================
 * COURSES KEYBOARD
 * =========================================================
 *
 * Layout:
 *
 * 1 | 2
 * 3 | 4
 * 5 | 6
 *
 */

function coursesKeyboard() {
  const courses =
    getCourseProducts();

  const buttons = [];

  for (
    let i = 0;
    i < courses.length;
    i += 2
  ) {
    const row = [];

    const first =
      courses[i];

    const second =
      courses[i + 1];


    if (first) {
      row.push(
        Markup.button.callback(
          `${i + 1}. ${first.shortTitle || first.title}`,
          `buy_${first.code}`
        )
      );
    }


    if (second) {
      row.push(
        Markup.button.callback(
          `${i + 2}. ${second.shortTitle || second.title}`,
          `buy_${second.code}`
        )
      );
    }


    if (row.length) {
      buttons.push(row);
    }
  }


  buttons.push([
    Markup.button.callback(
      '🔙 মূল মেনুতে ফিরে যান',
      'main_menu'
    )
  ]);


  return Markup.inlineKeyboard(
    buttons
  );
}


/*
 * =========================================================
 * SUBSCRIPTIONS KEYBOARD
 * =========================================================
 */

function subsKeyboard() {
  const subscriptions =
    getSubscriptionProducts();

  const buttons = [];

  for (
    let i = 0;
    i < subscriptions.length;
    i += 2
  ) {
    const row = [];

    const first =
      subscriptions[i];

    const second =
      subscriptions[i + 1];


    if (first) {
      row.push(
        Markup.button.callback(
          `${i + 1}. ${first.shortTitle || first.title}`,
          `buy_${first.code}`
        )
      );
    }


    if (second) {
      row.push(
        Markup.button.callback(
          `${i + 2}. ${second.shortTitle || second.title}`,
          `buy_${second.code}`
        )
      );
    }


    if (row.length) {
      buttons.push(row);
    }
  }


  buttons.push([
    Markup.button.callback(
      '🔙 মূল মেনুতে ফিরে যান',
      'main_menu'
    )
  ]);


  return Markup.inlineKeyboard(
    buttons
  );
}


/*
 * =========================================================
 * PRODUCT ACTIONS
 * =========================================================
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


/*
 * =========================================================
 * ADMIN APPROVAL
 * =========================================================
 */

function adminApprovalKeyboard(
  orderId
) {
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