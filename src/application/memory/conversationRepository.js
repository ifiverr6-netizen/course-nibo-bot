const { db } = require('../../database/db');

function getConversation(customerId) {
  const row = db.prepare('SELECT * FROM conversations WHERE customer_id = ?').get(customerId);
  if (!row) {
    return {
      customerId,
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
  return {
    customerId: row.customer_id,
    customerName: row.customer_name || '',
    selectedProduct: row.selected_product,
    conversationStage: row.conversation_stage || 'Greeting',
    paymentStatus: row.payment_status || 'none',
    customerIntent: row.customer_intent || 'unknown',
    conversationSummary: row.conversation_summary || '',
    customerEmotion: row.customer_emotion || 'neutral',
    messageHistory: JSON.parse(row.message_history || '[]'),
    lastUpdated: row.last_updated
  };
}

function saveConversation(memory) {
  db.prepare(`
    INSERT INTO conversations (
      customer_id, customer_name, selected_product, conversation_stage,
      payment_status, customer_intent, conversation_summary,
      customer_emotion, message_history, last_updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(customer_id) DO UPDATE SET
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
    memory.customerId,
    memory.customerName,
    memory.selectedProduct,
    memory.conversationStage,
    memory.paymentStatus,
    memory.customerIntent,
    memory.conversationSummary,
    memory.customerEmotion,
    JSON.stringify(memory.messageHistory || []),
    Date.now()
  );
}

function addMessageToHistory(memory, role, content) {
  memory.messageHistory.push({ role, content, timestamp: Date.now() });
  if (memory.messageHistory.length > 12) {
    memory.messageHistory = memory.messageHistory.slice(-12);
  }
}

module.exports = {
  getConversation,
  saveConversation,
  addMessageToHistory
};
