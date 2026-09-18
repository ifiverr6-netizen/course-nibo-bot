const {
  getDatabase
} = require('../../database/db');

const logger =
  require('../../infrastructure/logger');


/* =========================================================
   CONSTANTS
========================================================= */

const MAX_HISTORY_MESSAGES = 20;

const MAX_MESSAGE_LENGTH = 4000;

const MAX_SUMMARY_LENGTH = 1200;

const DEFAULT_STAGE = 'Greeting';


/* =========================================================
   HELPERS
========================================================= */

/**
 * Convert any value into a safe string.
 */
function safeString(value = '') {
  return String(value ?? '').trim();
}


/**
 * Normalize customer name.
 */
function normalizeCustomerName(name) {
  const value =
    safeString(name);

  if (!value) {
    return 'Customer';
  }

  return value.slice(0, 100);
}


/**
 * Normalize conversation stage.
 */
function normalizeStage(stage) {
  const value =
    safeString(stage);

  return value
    ? value.slice(0, 100)
    : DEFAULT_STAGE;
}


/**
 * Keep conversation summary within a safe size.
 */
function normalizeSummary(summary) {
  const value =
    safeString(summary);

  if (!value) {
    return 'নতুন conversation';
  }

  return value.slice(
    0,
    MAX_SUMMARY_LENGTH
  );
}


/**
 * Normalize selected product.
 *
 * This intentionally does not validate against products.js.
 * Product validation belongs to the domain layer.
 */
function normalizeSelectedProduct(product) {
  const value =
    safeString(product);

  return value
    ? value.slice(0, 100)
    : null;
}


/**
 * Normalize one history message.
 */
function normalizeHistoryMessage(message) {
  if (!message || typeof message !== 'object') {
    return null;
  }

  const role =
    safeString(message.role);

  const content =
    safeString(message.content);

  if (!role || !content) {
    return null;
  }


  /*
   * Only conversation roles that are useful
   * for the AI context are accepted.
   */
  const allowedRoles = new Set([
    'user',
    'assistant',
    'system'
  ]);

  if (!allowedRoles.has(role)) {
    return null;
  }


  return {
    role,
    content:
      content.slice(
        0,
        MAX_MESSAGE_LENGTH
      )
  };
}


/**
 * Normalize complete memory object.
 */
function normalizeMemory(memory = {}, userId = null) {
  const source =
    memory &&
    typeof memory === 'object'
      ? memory
      : {};


  const history =
    Array.isArray(
      source.messageHistory
    )
      ? source.messageHistory
          .map(normalizeHistoryMessage)
          .filter(Boolean)
          .slice(-MAX_HISTORY_MESSAGES)
      : [];


  return {
    userId:
      source.userId ??
      userId ??
      null,

    customerName:
      normalizeCustomerName(
        source.customerName
      ),

    selectedProduct:
      normalizeSelectedProduct(
        source.selectedProduct
      ),

    conversationStage:
      normalizeStage(
        source.conversationStage
      ),

    conversationSummary:
      normalizeSummary(
        source.conversationSummary
      ),

    paymentStatus:
      safeString(
        source.paymentStatus
      ).slice(0, 50) || null,

    messageHistory:
      history,

    updatedAt:
      source.updatedAt ||
      Date.now()
  };
}


/* =========================================================
   DATABASE HELPERS
========================================================= */

function ensureDatabase() {
  const db =
    getDatabase();

  if (!db) {
    throw new Error(
      'Database is not initialized.'
    );
  }

  return db;
}


/* =========================================================
   GET CONVERSATION
========================================================= */

function getConversation(userId) {
  const db =
    ensureDatabase();


  try {
    const row =
      db
        .prepare(
          `
          SELECT *
          FROM conversations
          WHERE user_id = ?
          LIMIT 1
          `
        )
        .get(userId);


    if (!row) {
      return normalizeMemory(
        {},
        userId
      );
    }


    let parsedHistory = [];


    if (row.message_history) {
      try {
        parsedHistory =
          JSON.parse(
            row.message_history
          );
      } catch (err) {
        logger.warn(
          `Invalid message history for user ${userId}`
        );

        parsedHistory = [];
      }
    }


    return normalizeMemory(
      {
        userId:
          row.user_id,

        customerName:
          row.customer_name,

        selectedProduct:
          row.selected_product,

        conversationStage:
          row.conversation_stage,

        conversationSummary:
          row.conversation_summary,

        paymentStatus:
          row.payment_status,

        messageHistory:
          parsedHistory,

        updatedAt:
          row.updated_at
      },
      userId
    );
  } catch (err) {
    logger.error(
      `Failed to get conversation for user ${userId}`,
      err
    );

    /*
     * Return a clean memory object instead of
     * crashing the complete Telegram update.
     */
    return normalizeMemory(
      {},
      userId
    );
  }
}


/* =========================================================
   SAVE CONVERSATION
========================================================= */

function saveConversation(memory = {}) {
  const db =
    ensureDatabase();


  const normalized =
    normalizeMemory(
      memory,
      memory.userId
    );


  if (!normalized.userId) {
    logger.warn(
      'Cannot save conversation without userId.'
    );

    return false;
  }


  try {
    const historyJson =
      JSON.stringify(
        normalized.messageHistory
      );


    db
      .prepare(
        `
        INSERT INTO conversations (
          user_id,
          customer_name,
          selected_product,
          conversation_stage,
          conversation_summary,
          payment_status,
          message_history,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)

        ON CONFLICT(user_id)
        DO UPDATE SET
          customer_name = excluded.customer_name,
          selected_product = excluded.selected_product,
          conversation_stage = excluded.conversation_stage,
          conversation_summary = excluded.conversation_summary,
          payment_status = excluded.payment_status,
          message_history = excluded.message_history,
          updated_at = excluded.updated_at
        `
      )
      .run(
        normalized.userId,
        normalized.customerName,
        normalized.selectedProduct,
        normalized.conversationStage,
        normalized.conversationSummary,
        normalized.paymentStatus,
        historyJson,
        Date.now()
      );


    /*
     * Keep the passed object synchronized with the
     * normalized state used by the database.
     */
    Object.assign(
      memory,
      normalized
    );


    return true;
  } catch (err) {
    logger.error(
      `Failed to save conversation for user ${normalized.userId}`,
      err
    );

    return false;
  }
}


/* =========================================================
   ADD MESSAGE TO HISTORY
========================================================= */

function addMessageToHistory(
  memory,
  role,
  content
) {
  if (
    !memory ||
    typeof memory !== 'object'
  ) {
    return false;
  }


  const normalizedRole =
    safeString(role);

  const normalizedContent =
    safeString(content);


  if (
    !normalizedRole ||
    !normalizedContent
  ) {
    return false;
  }


  const message =
    normalizeHistoryMessage({
      role:
        normalizedRole,
      content:
        normalizedContent
    });


  if (!message) {
    return false;
  }


  if (
    !Array.isArray(
      memory.messageHistory
    )
  ) {
    memory.messageHistory = [];
  }


  /*
   * Prevent accidental duplicate consecutive
   * messages from polluting the AI context.
   */
  const lastMessage =
    memory.messageHistory[
      memory.messageHistory.length - 1
    ];


  if (
    lastMessage &&
    lastMessage.role === message.role &&
    lastMessage.content === message.content
  ) {
    return false;
  }


  memory.messageHistory.push(
    message
  );


  /*
   * Keep only the latest messages.
   */
  if (
    memory.messageHistory.length >
    MAX_HISTORY_MESSAGES
  ) {
    memory.messageHistory =
      memory.messageHistory.slice(
        -MAX_HISTORY_MESSAGES
      );
  }


  memory.updatedAt =
    Date.now();


  return true;
}


/* =========================================================
   CLEAR MESSAGE HISTORY
========================================================= */

function clearMessageHistory(memory) {
  if (
    !memory ||
    typeof memory !== 'object'
  ) {
    return false;
  }


  memory.messageHistory = [];

  memory.updatedAt =
    Date.now();


  return true;
}


/* =========================================================
   UPDATE CONVERSATION SUMMARY
========================================================= */

function updateConversationSummary(
  memory,
  summary
) {
  if (
    !memory ||
    typeof memory !== 'object'
  ) {
    return false;
  }


  memory.conversationSummary =
    normalizeSummary(
      summary
    );

  memory.updatedAt =
    Date.now();


  return true;
}


/* =========================================================
   UPDATE CUSTOMER NAME
========================================================= */

function updateCustomerName(
  memory,
  customerName
) {
  if (
    !memory ||
    typeof memory !== 'object'
  ) {
    return false;
  }


  memory.customerName =
    normalizeCustomerName(
      customerName
    );

  memory.updatedAt =
    Date.now();


  return true;
}


/* =========================================================
   UPDATE SELECTED PRODUCT
========================================================= */

function updateSelectedProduct(
  memory,
  productCode
) {
  if (
    !memory ||
    typeof memory !== 'object'
  ) {
    return false;
  }


  memory.selectedProduct =
    normalizeSelectedProduct(
      productCode
    );

  memory.updatedAt =
    Date.now();


  return true;
}


/* =========================================================
   UPDATE CONVERSATION STAGE
========================================================= */

function updateConversationStage(
  memory,
  stage
) {
  if (
    !memory ||
    typeof memory !== 'object'
  ) {
    return false;
  }


  memory.conversationStage =
    normalizeStage(
      stage
    );

  memory.updatedAt =
    Date.now();


  return true;
}


/* =========================================================
   UPDATE PAYMENT STATUS
========================================================= */

function updatePaymentStatus(
  memory,
  status
) {
  if (
    !memory ||
    typeof memory !== 'object'
  ) {
    return false;
  }


  memory.paymentStatus =
    safeString(
      status
    ).slice(0, 50) || null;

  memory.updatedAt =
    Date.now();


  return true;
}


/* =========================================================
   DELETE / RESET MEMORY
========================================================= */

function resetConversation(userId) {
  const db =
    ensureDatabase();


  try {
    db
      .prepare(
        `
        DELETE FROM conversations
        WHERE user_id = ?
        `
      )
      .run(userId);


    return true;
  } catch (err) {
    logger.error(
      `Failed to reset conversation for user ${userId}`,
      err
    );

    return false;
  }
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  getConversation,
  saveConversation,
  addMessageToHistory,

  clearMessageHistory,
  updateConversationSummary,
  updateCustomerName,
  updateSelectedProduct,
  updateConversationStage,
  updatePaymentStatus,

  resetConversation,

  normalizeMemory,
  normalizeHistoryMessage
};
