const { db } = require('../../database/db');
const logger = require('../../infrastructure/logger');


/* =========================================================
   CONFIGURATION
========================================================= */

const MAX_ORDER_ID_LENGTH = 100;
const MAX_USER_ID_LENGTH = 20;
const MAX_NAME_LENGTH = 120;
const MAX_USERNAME_LENGTH = 120;
const MAX_PRODUCT_LENGTH = 100;
const MAX_PRICE_LENGTH = 50;
const MAX_TRX_ID_LENGTH = 100;
const MAX_FILE_ID_LENGTH = 300;
const MAX_STATUS_LENGTH = 100;
const MAX_DATE_TEXT_LENGTH = 100;


/* =========================================================
   NORMALIZATION
========================================================= */

function normalizeRequiredText(
  value,
  fieldName,
  maxLength
) {
  if (
    value === null ||
    value === undefined
  ) {
    throw new Error(
      `${fieldName} is required`
    );
  }

  const text =
    String(value)
      .trim()
      .slice(0, maxLength);

  if (!text) {
    throw new Error(
      `${fieldName} cannot be empty`
    );
  }

  return text;
}


function normalizeOptionalText(
  value,
  maxLength
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const text =
    String(value)
      .trim()
      .slice(0, maxLength);

  return text || null;
}


function normalizeUserId(userId) {
  const id =
    Number(userId);

  if (
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    throw new Error(
      'Invalid user ID'
    );
  }

  return id;
}


function normalizeTimestamp(
  value,
  fallback = Date.now()
) {
  const timestamp =
    Number(value);

  if (
    !Number.isFinite(timestamp) ||
    timestamp < 0
  ) {
    return fallback;
  }

  return timestamp;
}


/* =========================================================
   ORDER NORMALIZATION
========================================================= */

function normalizeOrder(order) {
  if (
    !order ||
    typeof order !== 'object'
  ) {
    throw new Error(
      'Invalid order data'
    );
  }


  const normalized = {
    orderId:
      normalizeRequiredText(
        order.orderId,
        'orderId',
        MAX_ORDER_ID_LENGTH
      ),

    userId:
      normalizeUserId(
        order.userId
      ),

    customerName:
      normalizeRequiredText(
        order.customerName || 'Customer',
        'customerName',
        MAX_NAME_LENGTH
      ),

    username:
      normalizeOptionalText(
        order.username,
        MAX_USERNAME_LENGTH
      ),

    product:
      normalizeRequiredText(
        order.product,
        'product',
        MAX_PRODUCT_LENGTH
      ),

    price:
      normalizeRequiredText(
        order.price,
        'price',
        MAX_PRICE_LENGTH
      ),

    trxId:
      normalizeRequiredText(
        order.trxId,
        'trxId',
        MAX_TRX_ID_LENGTH
      ).toUpperCase(),

    screenshotFileId:
      normalizeRequiredText(
        order.screenshotFileId,
        'screenshotFileId',
        MAX_FILE_ID_LENGTH
      ),

    status:
      normalizeRequiredText(
        order.status || 'Pending Verification',
        'status',
        MAX_STATUS_LENGTH
      ),

    createdAt:
      normalizeTimestamp(
        order.createdAt
      ),

    createdAtText:
      normalizeOptionalText(
        order.createdAtText,
        MAX_DATE_TEXT_LENGTH
      )
  };


  return normalized;
}


/* =========================================================
   CREATE ORDER
========================================================= */

function createOrder(order) {
  const normalized =
    normalizeOrder(order);


  /*
   * Order creation and Transaction ID registration
   * must succeed together.
   *
   * If one operation fails, neither operation is committed.
   */
  const createOrderTransaction =
    db.transaction(() => {

      /*
       * Check Order ID before INSERT.
       */
      const existingOrder =
        db.prepare(`
          SELECT order_id
          FROM orders
          WHERE order_id = ?
        `).get(
          normalized.orderId
        );


      if (existingOrder) {
        throw new Error(
          `Order already exists: ${normalized.orderId}`
        );
      }


      /*
       * Check Transaction ID before creating
       * the order.
       */
      const existingTrx =
        db.prepare(`
          SELECT trx_id
          FROM used_trx
          WHERE trx_id = ?
        `).get(
          normalized.trxId
        );


      if (existingTrx) {
        throw new Error(
          `Transaction ID already used: ${normalized.trxId}`
        );
      }


      /*
       * Create order.
       */
      db.prepare(`
        INSERT INTO orders (
          order_id,
          user_id,
          customer_name,
          username,
          product,
          price,
          trx_id,
          screenshot_file_id,
          status,
          created_at,
          created_at_text
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        normalized.orderId,
        normalized.userId,
        normalized.customerName,
        normalized.username,
        normalized.product,
        normalized.price,
        normalized.trxId,
        normalized.screenshotFileId,
        normalized.status,
        normalized.createdAt,
        normalized.createdAtText
      );


      /*
       * Reserve Transaction ID.
       */
      db.prepare(`
        INSERT INTO used_trx (
          trx_id
        )
        VALUES (?)
      `).run(
        normalized.trxId
      );
    });


  try {
    createOrderTransaction();

    return getOrder(
      normalized.orderId
    );
  } catch (err) {

    /*
     * Keep duplicate transaction/order errors
     * understandable for bot.js.
     */
    logger.warn(
      `Order creation failed: ${err.message}`
    );

    throw err;
  }
}


/* =========================================================
   GET ORDER
========================================================= */

function getOrder(orderId) {
  const normalizedOrderId =
    normalizeRequiredText(
      orderId,
      'orderId',
      MAX_ORDER_ID_LENGTH
    );


  return db.prepare(`
    SELECT
      order_id,
      user_id,
      customer_name,
      username,
      product,
      price,
      trx_id,
      screenshot_file_id,
      status,
      created_at,
      created_at_text
    FROM orders
    WHERE order_id = ?
  `).get(
    normalizedOrderId
  );
}


/* =========================================================
   UPDATE ORDER STATUS
========================================================= */

function updateOrderStatus(
  orderId,
  status
) {
  const normalizedOrderId =
    normalizeRequiredText(
      orderId,
      'orderId',
      MAX_ORDER_ID_LENGTH
    );

  const normalizedStatus =
    normalizeRequiredText(
      status,
      'status',
      MAX_STATUS_LENGTH
    );


  const result =
    db.prepare(`
      UPDATE orders
      SET status = ?
      WHERE order_id = ?
    `).run(
      normalizedStatus,
      normalizedOrderId
    );


  if (
    result.changes === 0
  ) {
    logger.warn(
      `Order status update skipped: order not found (${normalizedOrderId})`
    );

    return null;
  }


  return getOrder(
    normalizedOrderId
  );
}


/* =========================================================
   CHECK TRANSACTION ID
========================================================= */

function isTrxUsed(trxId) {
  if (
    trxId === null ||
    trxId === undefined
  ) {
    return false;
  }


  const normalizedTrxId =
    String(trxId)
      .trim()
      .toUpperCase();


  if (!normalizedTrxId) {
    return false;
  }


  const row =
    db.prepare(`
      SELECT trx_id
      FROM used_trx
      WHERE trx_id = ?
      LIMIT 1
    `).get(
      normalizedTrxId
    );


  return Boolean(row);
}


/* =========================================================
   GET USER ORDERS
========================================================= */

function getUserOrders(
  userId
) {
  const normalizedUserId =
    normalizeUserId(
      userId
    );


  return db.prepare(`
    SELECT
      order_id,
      user_id,
      customer_name,
      username,
      product,
      price,
      trx_id,
      screenshot_file_id,
      status,
      created_at,
      created_at_text
    FROM orders
    WHERE user_id = ?
    ORDER BY
      created_at DESC,
      rowid DESC
  `).all(
    normalizedUserId
  );
}


/* =========================================================
   FIND PENDING ORDER
========================================================= */

function findPendingOrder(
  userId,
  product
) {
  const normalizedUserId =
    normalizeUserId(
      userId
    );

  const normalizedProduct =
    normalizeRequiredText(
      product,
      'product',
      MAX_PRODUCT_LENGTH
    );


  return db.prepare(`
    SELECT
      order_id,
      user_id,
      customer_name,
      username,
      product,
      price,
      trx_id,
      screenshot_file_id,
      status,
      created_at,
      created_at_text
    FROM orders
    WHERE
      user_id = ?
      AND product = ?
      AND status = 'Pending Verification'
    ORDER BY
      created_at DESC,
      rowid DESC
    LIMIT 1
  `).get(
    normalizedUserId,
    normalizedProduct
  );
}


/* =========================================================
   GET PENDING ORDERS
========================================================= */

function getPendingOrders(
  userId
) {
  const normalizedUserId =
    normalizeUserId(
      userId
    );


  return db.prepare(`
    SELECT
      order_id,
      user_id,
      customer_name,
      username,
      product,
      price,
      trx_id,
      screenshot_file_id,
      status,
      created_at,
      created_at_text
    FROM orders
    WHERE
      user_id = ?
      AND status = 'Pending Verification'
    ORDER BY
      created_at DESC,
      rowid DESC
  `).all(
    normalizedUserId
  );
}


/* =========================================================
   COUNT USER ORDERS
========================================================= */

function countUserOrders(
  userId
) {
  const normalizedUserId =
    normalizeUserId(
      userId
    );


  const row =
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM orders
      WHERE user_id = ?
    `).get(
      normalizedUserId
    );


  return Number(
    row?.count || 0
  );
}


/* =========================================================
   CHECK ORDER OWNERSHIP
========================================================= */

function isOrderOwnedByUser(
  orderId,
  userId
) {
  const normalizedOrderId =
    normalizeRequiredText(
      orderId,
      'orderId',
      MAX_ORDER_ID_LENGTH
    );

  const normalizedUserId =
    normalizeUserId(
      userId
    );


  const row =
    db.prepare(`
      SELECT 1
      FROM orders
      WHERE
        order_id = ?
        AND user_id = ?
      LIMIT 1
    `).get(
      normalizedOrderId,
      normalizedUserId
    );


  return Boolean(row);
}


/* =========================================================
   EXPORT
========================================================= */

module.exports = {
  createOrder,
  getOrder,
  updateOrderStatus,

  isTrxUsed,

  getUserOrders,
  findPendingOrder,
  getPendingOrders,

  countUserOrders,
  isOrderOwnedByUser,

  normalizeOrder,
  normalizeUserId
};
