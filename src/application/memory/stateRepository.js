const { db } = require('../../database/db');

function getUserState(userId) {
  const row = db.prepare('SELECT * FROM user_states WHERE user_id = ?').get(userId);
  if (!row) {
    return { step: 'home', product: null, orderId: null, screenshotFileId: null, lastSupportMessage: 0 };
  }
  return {
    step: row.step,
    product: row.product,
    orderId: row.order_id,
    screenshotFileId: row.screenshot_file_id,
    lastSupportMessage: row.last_support_message || 0
  };
}

function setUserState(userId, patch) {
  const current = getUserState(userId);
  const next = { ...current, ...patch };

  db.prepare(`
    INSERT INTO user_states (user_id, step, product, order_id, screenshot_file_id, last_support_message)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      step = excluded.step,
      product = excluded.product,
      order_id = excluded.order_id,
      screenshot_file_id = excluded.screenshot_file_id,
      last_support_message = excluded.last_support_message
  `).run(
    userId,
    next.step,
    next.product,
    next.orderId,
    next.screenshotFileId,
    next.lastSupportMessage
  );
}

function resetUserState(userId) {
  const current = getUserState(userId);
  setUserState(userId, {
    step: 'home',
    product: null,
    orderId: null,
    screenshotFileId: null,
    lastSupportMessage: current.lastSupportMessage || 0
  });
}

module.exports = {
  getUserState,
  setUserState,
  resetUserState
};
