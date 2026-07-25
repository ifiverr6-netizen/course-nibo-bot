const { db } = require('../../database/db');

function createOrder(order) {
  db.prepare(`
    INSERT INTO orders (
      order_id, user_id, customer_name, username, product, price,
      trx_id, screenshot_file_id, status, created_at, created_at_text
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    order.orderId,
    order.userId,
    order.customerName,
    order.username,
    order.product,
    order.price,
    order.trxId,
    order.screenshotFileId,
    order.status,
    order.createdAt,
    order.createdAtText
  );

  db.prepare('INSERT OR IGNORE INTO used_trx (trx_id) VALUES (?)').run(order.trxId);
}

function getOrder(orderId) {
  return db.prepare('SELECT * FROM orders WHERE order_id = ?').get(orderId);
}

function updateOrderStatus(orderId, status) {
  db.prepare('UPDATE orders SET status = ? WHERE order_id = ?').run(status, orderId);
}

function isTrxUsed(trxId) {
  const row = db.prepare('SELECT 1 FROM used_trx WHERE trx_id = ?').get(trxId);
  return !!row;
}

function getUserOrders(userId) {
  return db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(userId);
}

function findPendingOrder(userId, product) {
  return db.prepare(`
    SELECT * FROM orders 
    WHERE user_id = ? AND product = ? AND status = 'Pending Verification'
  `).get(userId, product);
}

module.exports = {
  createOrder,
  getOrder,
  updateOrderStatus,
  isTrxUsed,
  getUserOrders,
  findPendingOrder
};
