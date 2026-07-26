const Groq = require('groq-sdk');
const config = require('../../config');
const { buildMessages } = require('./promptBuilder');
const logger = require('../../infrastructure/logger');

const groq = config.groqApiKey ? new Groq({ apiKey: config.groqApiKey }) : null;

async function generateReply(memory, userMessage) {
  if (!groq) return null;

  try {
    const messages = buildMessages(memory, userMessage);
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.6,
      max_tokens: 600,
      messages
    });
    return completion.choices[0]?.message?.content?.trim() || null;
  } catch (err) {
    logger.error('Sinthiya AI error', err);
    return null;
  }
}

module.exports = { generateReply };
