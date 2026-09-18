const { db } = require('../../database/db');
const logger = require('../../infrastructure/logger');


/* =========================================================
   CONFIGURATION
========================================================= */

const MAX_STEP_LENGTH = 60;
const MAX_PRODUCT_LENGTH = 100;
const MAX_ORDER_ID_LENGTH = 100;
const MAX_FILE_ID_LENGTH = 300;


/* =========================================================
   DEFAULT STATE
========================================================= */

function createDefaultState(userId) {
  return {
    userId: normalizeUserId(userId),

    step: 'home',

    product: null,

    orderId: null,

    screenshotFileId: null,

    lastSupportMessage: 0
  };
}


/* =========================================================
   NORMALIZATION
========================================================= */

function normalizeUserId(userId) {
  const id = Number(userId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error('Invalid user ID');
  }

  return id;
}


function normalizeText(value, maxLength) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const text = String(value)
    .trim()
    .slice(0, maxLength);

  return text || null;
}


function normalizeStep(step) {
  const normalized =
    normalizeText(
      step,
      MAX_STEP_LENGTH
    );

  return normalized || 'home';
}


function normalizeTimestamp(value) {
  const timestamp = Number(value);

  if (
    !Number.isFinite(timestamp) ||
    timestamp < 0
  ) {
    return 0;
  }

  return timestamp;
}


/* =========================================================
   DATABASE ROW → STATE
========================================================= */

function mapRowToState(row) {
  if (!row) {
    return null;
  }

  return {
    userId: normalizeUserId(
      row.user_id
    ),

    step: normalizeStep(
      row.step
    ),

    product:
      normalizeText(
        row.product,
        MAX_PRODUCT_LENGTH
      ),

    orderId:
      normalizeText(
        row.order_id,
        MAX_ORDER_ID_LENGTH
      ),

    screenshotFileId:
      normalizeText(
        row.screenshot_file_id,
        MAX_FILE_ID_LENGTH
      ),

    lastSupportMessage:
      normalizeTimestamp(
        row.last_support_message
      )
  };
}


/* =========================================================
   GET USER STATE
========================================================= */

function getUserState(userId) {
  const id =
    normalizeUserId(userId);

  const row = db
    .prepare(`
      SELECT
        user_id,
        step,
        product,
        order_id,
        screenshot_file_id,
        last_support_message
      FROM user_states
      WHERE user_id = ?
    `)
    .get(id);

  if (!row) {
    return createDefaultState(id);
  }

  return mapRowToState(row);
}


/* =========================================================
   SAVE / SET USER STATE
========================================================= */

function setUserState(
  userId,
  updates = {}
) {
  const id =
    normalizeUserId(userId);

  if (
    !updates ||
    typeof updates !== 'object'
  ) {
    return getUserState(id);
  }

  /*
   * Read the current state first.
   * This is important because setUserState()
   * is used with partial updates throughout bot.js.
   */
  const current =
    getUserState(id);


  const next = {
    userId: id,

    step:
      Object.prototype.hasOwnProperty.call(
        updates,
        'step'
      )
        ? normalizeStep(updates.step)
        : current.step,

    product:
      Object.prototype.hasOwnProperty.call(
        updates,
        'product'
      )
        ? normalizeText(
            updates.product,
            MAX_PRODUCT_LENGTH
          )
        : current.product,

    orderId:
      Object.prototype.hasOwnProperty.call(
        updates,
        'orderId'
      )
        ? normalizeText(
            updates.orderId,
            MAX_ORDER_ID_LENGTH
          )
        : current.orderId,

    screenshotFileId:
      Object.prototype.hasOwnProperty.call(
        updates,
        'screenshotFileId'
      )
        ? normalizeText(
            updates.screenshotFileId,
            MAX_FILE_ID_LENGTH
          )
        : current.screenshotFileId,

    lastSupportMessage:
      Object.prototype.hasOwnProperty.call(
        updates,
        'lastSupportMessage'
      )
        ? normalizeTimestamp(
            updates.lastSupportMessage
          )
        : current.lastSupportMessage
  };


  db.prepare(`
    INSERT INTO user_states (
      user_id,
      step,
      product,
      order_id,
      screenshot_file_id,
      last_support_message
    )
    VALUES (?, ?, ?, ?, ?, ?)

    ON CONFLICT(user_id)
    DO UPDATE SET
      step = excluded.step,
      product = excluded.product,
      order_id = excluded.order_id,
      screenshot_file_id = excluded.screenshot_file_id,
      last_support_message = excluded.last_support_message
  `).run(
    next.userId,
    next.step,
    next.product,
    next.orderId,
    next.screenshotFileId,
    next.lastSupportMessage
  );


  return next;
}


/* =========================================================
   RESET USER STATE
========================================================= */

function resetUserState(userId) {
  const id =
    normalizeUserId(userId);

  const state =
    createDefaultState(id);

  db.prepare(`
    INSERT INTO user_states (
      user_id,
      step,
      product,
      order_id,
      screenshot_file_id,
      last_support_message
    )
    VALUES (?, ?, ?, ?, ?, ?)

    ON CONFLICT(user_id)
    DO UPDATE SET
      step = excluded.step,
      product = excluded.product,
      order_id = excluded.order_id,
      screenshot_file_id = excluded.screenshot_file_id,
      last_support_message = excluded.last_support_message
  `).run(
    state.userId,
    state.step,
    state.product,
    state.orderId,
    state.screenshotFileId,
    state.lastSupportMessage
  );

  return state;
}


/* =========================================================
   CLEAR ACTIVE ORDER DATA
========================================================= */

function clearOrderState(userId) {
  return setUserState(
    userId,
    {
      step: 'home',
      product: null,
      orderId: null,
      screenshotFileId: null
    }
  );
}


/* =========================================================
   SET PAYMENT FLOW
========================================================= */

function startPaymentState(
  userId,
  product,
  orderId
) {
  return setUserState(
    userId,
    {
      step: 'awaiting_screenshot',
      product,
      orderId,
      screenshotFileId: null
    }
  );
}


/* =========================================================
   SET SCREENSHOT STATE
========================================================= */

function setScreenshotState(
  userId,
  screenshotFileId
) {
  return setUserState(
    userId,
    {
      step: 'awaiting_trx',
      screenshotFileId
    }
  );
}


/* =========================================================
   SET SUPPORT COOLDOWN
========================================================= */

function setSupportMessageTime(
  userId,
  timestamp = Date.now()
) {
  return setUserState(
    userId,
    {
      lastSupportMessage:
        timestamp
    }
  );
}


/* =========================================================
   CHECK SUPPORT COOLDOWN
========================================================= */

function canSendSupportMessage(
  userId,
  cooldownMs
) {
  const state =
    getUserState(userId);

  const cooldown =
    Number(cooldownMs);

  if (
    !Number.isFinite(cooldown) ||
    cooldown <= 0
  ) {
    return true;
  }

  const now =
    Date.now();

  return (
    now -
      state.lastSupportMessage >=
    cooldown
  );
}


/* =========================================================
   VALIDATE ACTIVE PAYMENT STATE
========================================================= */

function hasActiveOrderState(
  userId
) {
  const state =
    getUserState(userId);

  return Boolean(
    state.product &&
    state.orderId &&
    (
      state.step ===
        'awaiting_screenshot' ||
      state.step ===
        'awaiting_trx'
    )
  );
}


/* =========================================================
   DATABASE ERROR SAFE WRAPPER
========================================================= */

function safeGetUserState(userId) {
  try {
    return getUserState(userId);
  } catch (err) {
    logger.error(
      `Failed to get user state: ${err.message}`
    );

    return createDefaultState(userId);
  }
}


/* =========================================================
   EXPORT
========================================================= */

module.exports = {
  getUserState,
  setUserState,
  resetUserState,

  clearOrderState,

  startPaymentState,
  setScreenshotState,

  setSupportMessageTime,
  canSendSupportMessage,

  hasActiveOrderState,

  safeGetUserState,

  normalizeUserId,
  normalizeText
};
