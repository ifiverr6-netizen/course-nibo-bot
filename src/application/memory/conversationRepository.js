const { db } = require('../../database/db');
const logger = require('../../infrastructure/logger');


/* =========================================================
   CONFIGURATION
========================================================= */

const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_SUMMARY_LENGTH = 1200;
const MAX_NAME_LENGTH = 120;


/* =========================================================
   NORMALIZATION HELPERS
========================================================= */

function normalizeCustomerId(customerId) {
  const id = Number(customerId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error('Invalid customer ID');
  }

  return id;
}


function normalizeText(value, maxLength = MAX_MESSAGE_LENGTH) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .trim()
    .slice(0, maxLength);
}


function normalizeHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter((message) => {
      return (
        message &&
        typeof message === 'object' &&
        typeof message.role === 'string' &&
        typeof message.content === 'string'
      );
    })
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: normalizeText(message.content),
      timestamp: Number(message.timestamp) || Date.now()
    }));
}


/* =========================================================
   DEFAULT MEMORY
========================================================= */

function createDefaultConversation(customerId) {
  return {
    customerId: normalizeCustomerId(customerId),

    customerName: '',

    selectedProduct: null,

    conversationStage: 'Greeting',

    paymentStatus: 'none',

    customerIntent: 'unknown',

    conversationSummary: '',

    customerEmotion: 'neutral',

    messageHistory: [],

    lastUpdated: Date.now()
  };
}


/* =========================================================
   DATABASE ROW → MEMORY OBJECT
========================================================= */

function mapRowToConversation(row) {
  if (!row) {
    return null;
  }

  let messageHistory = [];

  try {
    const parsed = JSON.parse(
      row.message_history || '[]'
    );

    messageHistory = normalizeHistory(parsed);
  } catch (err) {
    logger.warn(
      `Invalid message history for customer ${row.customer_id}`
    );

    messageHistory = [];
  }

  return {
    customerId: row.customer_id,

    customerName: normalizeText(
      row.customer_name,
      MAX_NAME_LENGTH
    ),

    selectedProduct:
      row.selected_product || null,

    conversationStage:
      row.conversation_stage || 'Greeting',

    paymentStatus:
      row.payment_status || 'none',

    customerIntent:
      row.customer_intent || 'unknown',

    conversationSummary:
      normalizeText(
        row.conversation_summary,
        MAX_SUMMARY_LENGTH
      ),

    customerEmotion:
      row.customer_emotion || 'neutral',

    messageHistory,

    lastUpdated:
      Number(row.last_updated) || Date.now()
  };
}


/* =========================================================
   GET CONVERSATION
========================================================= */

function getConversation(customerId) {
  const id = normalizeCustomerId(customerId);

  const row = db
    .prepare(`
      SELECT
        customer_id,
        customer_name,
        selected_product,
        conversation_stage,
        payment_status,
        customer_intent,
        conversation_summary,
        customer_emotion,
        message_history,
        last_updated
      FROM conversations
      WHERE customer_id = ?
    `)
    .get(id);

  if (!row) {
    return createDefaultConversation(id);
  }

  return mapRowToConversation(row);
}


/* =========================================================
   SAVE CONVERSATION
========================================================= */

function saveConversation(memory) {
  if (!memory || !memory.customerId) {
    throw new Error(
      'Cannot save conversation without customerId'
    );
  }

  const customerId =
    normalizeCustomerId(memory.customerId);

  const customerName =
    normalizeText(
      memory.customerName,
      MAX_NAME_LENGTH
    );

  const selectedProduct =
    memory.selectedProduct || null;

  const conversationStage =
    normalizeText(
      memory.conversationStage || 'Greeting',
      100
    );

  const paymentStatus =
    normalizeText(
      memory.paymentStatus || 'none',
      100
    );

  const customerIntent =
    normalizeText(
      memory.customerIntent || 'unknown',
      100
    );

  const conversationSummary =
    normalizeText(
      memory.conversationSummary || '',
      MAX_SUMMARY_LENGTH
    );

  const customerEmotion =
    normalizeText(
      memory.customerEmotion || 'neutral',
      100
    );

  const messageHistory =
    normalizeHistory(
      memory.messageHistory
    );

  const lastUpdated =
    Date.now();


  db.prepare(`
    INSERT INTO conversations (
      customer_id,
      customer_name,
      selected_product,
      conversation_stage,
      payment_status,
      customer_intent,
      conversation_summary,
      customer_emotion,
      message_history,
      last_updated
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

    ON CONFLICT(customer_id)
    DO UPDATE SET
      customer_name = excluded.customer_name,
      selected_product = excluded.selected_product,
      conversation_stage = excluded.conversation_stage,
      payment_status = excluded.payment_status,
      customer_intent = excluded.customer_intent,
      conversation_summary = excluded.conversation_summary,
      customer_emotion = excluded.customer_emotion,
      message_history = excluded.message_history,
      last_updated = excluded.last_updated
  `).run(
    customerId,
    customerName,
    selectedProduct,
    conversationStage,
    paymentStatus,
    customerIntent,
    conversationSummary,
    customerEmotion,
    JSON.stringify(messageHistory),
    lastUpdated
  );


  /*
   * Keep the in-memory object synchronized with the
   * normalized values that were actually saved.
   */
  memory.customerId = customerId;
  memory.customerName = customerName;
  memory.selectedProduct = selectedProduct;
  memory.conversationStage = conversationStage;
  memory.paymentStatus = paymentStatus;
  memory.customerIntent = customerIntent;
  memory.conversationSummary = conversationSummary;
  memory.customerEmotion = customerEmotion;
  memory.messageHistory = messageHistory;
  memory.lastUpdated = lastUpdated;


  return memory;
}


/* =========================================================
   ADD MESSAGE TO HISTORY
========================================================= */

function addMessageToHistory(
  memory,
  role,
  content
) {
  if (!memory) {
    return null;
  }

  if (!Array.isArray(memory.messageHistory)) {
    memory.messageHistory = [];
  }

  const normalizedRole =
    normalizeText(role, 30);

  const normalizedContent =
    normalizeText(
      content,
      MAX_MESSAGE_LENGTH
    );

  if (!normalizedRole || !normalizedContent) {
    return memory;
  }


  memory.messageHistory.push({
    role: normalizedRole,
    content: normalizedContent,
    timestamp: Date.now()
  });


  /*
   * Keep only the most recent messages.
   * This prevents the AI context from growing forever.
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


  memory.lastUpdated = Date.now();

  return memory;
}


/* =========================================================
   UPDATE MESSAGE HISTORY + SAVE
========================================================= */

function addAndSaveMessage(
  customerId,
  role,
  content
) {
  const memory =
    getConversation(customerId);

  addMessageToHistory(
    memory,
    role,
    content
  );

  saveConversation(memory);

  return memory;
}


/* =========================================================
   CLEAR MESSAGE HISTORY
========================================================= */

function clearMessageHistory(customerId) {
  const memory =
    getConversation(customerId);

  memory.messageHistory = [];

  memory.lastUpdated = Date.now();

  saveConversation(memory);

  return memory;
}


/* =========================================================
   UPDATE CUSTOMER NAME
========================================================= */

function updateCustomerName(
  customerId,
  customerName
) {
  const memory =
    getConversation(customerId);

  memory.customerName =
    normalizeText(
      customerName,
      MAX_NAME_LENGTH
    );

  saveConversation(memory);

  return memory;
}


/* =========================================================
   UPDATE SELECTED PRODUCT
========================================================= */

function updateSelectedProduct(
  customerId,
  productCode
) {
  const memory =
    getConversation(customerId);

  memory.selectedProduct =
    productCode
      ? normalizeText(productCode, 100)
      : null;

  saveConversation(memory);

  return memory;
}


/* =========================================================
   UPDATE CONVERSATION STAGE
========================================================= */

function updateConversationStage(
  customerId,
  stage
) {
  const memory =
    getConversation(customerId);

  memory.conversationStage =
    normalizeText(
      stage || 'Greeting',
      100
    );

  saveConversation(memory);

  return memory;
}


/* =========================================================
   UPDATE PAYMENT STATUS
========================================================= */

function updatePaymentStatus(
  customerId,
  status
) {
  const memory =
    getConversation(customerId);

  memory.paymentStatus =
    normalizeText(
      status || 'none',
      100
    );

  saveConversation(memory);

  return memory;
}


/* =========================================================
   UPDATE CUSTOMER INTENT
========================================================= */

function updateCustomerIntent(
  customerId,
  intent
) {
  const memory =
    getConversation(customerId);

  memory.customerIntent =
    normalizeText(
      intent || 'unknown',
      100
    );

  saveConversation(memory);

  return memory;
}


/* =========================================================
   UPDATE CUSTOMER EMOTION
========================================================= */

function updateCustomerEmotion(
  customerId,
  emotion
) {
  const memory =
    getConversation(customerId);

  memory.customerEmotion =
    normalizeText(
      emotion || 'neutral',
      100
    );

  saveConversation(memory);

  return memory;
}


/* =========================================================
   UPDATE CONVERSATION SUMMARY
========================================================= */

function updateConversationSummary(
  customerId,
  summary
) {
  const memory =
    getConversation(customerId);

  memory.conversationSummary =
    normalizeText(
      summary || '',
      MAX_SUMMARY_LENGTH
    );

  saveConversation(memory);

  return memory;
}


/* =========================================================
   RESET CONVERSATION
========================================================= */

function resetConversation(customerId) {
  const memory =
    createDefaultConversation(
      customerId
    );

  saveConversation(memory);

  return memory;
}


/* =========================================================
   EXPORT
========================================================= */

module.exports = {
  getConversation,
  saveConversation,

  addMessageToHistory,
  addAndSaveMessage,

  clearMessageHistory,

  updateCustomerName,
  updateSelectedProduct,
  updateConversationStage,
  updatePaymentStatus,
  updateCustomerIntent,
  updateCustomerEmotion,
  updateConversationSummary,

  resetConversation,

  normalizeHistory,
  normalizeText
};
