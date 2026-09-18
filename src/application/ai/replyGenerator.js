const Groq = require('groq-sdk');

const config = require('../../config');
const logger = require('../../infrastructure/logger');

const {
  buildMessages
} = require('./promptBuilder');


/* =========================================================
   CONFIGURATION
========================================================= */

const GROQ_MODEL = 'openai/gpt-oss-120b';

const OPENROUTER_MODEL = 'openrouter/free';

const TEMPERATURE = 0.6;

const MAX_TOKENS = 600;

const REQUEST_TIMEOUT_MS = 20000;

const MAX_USER_MESSAGE_LENGTH = 4000;


/* =========================================================
   API CLIENTS
========================================================= */

const groq =
  config.groqApiKey
    ? new Groq({
        apiKey: config.groqApiKey
      })
    : null;


/*
 * OpenRouter API key Render Environment Variable থেকে নেওয়া হবে।
 *
 * Render → Environment → OPENROUTER_API_KEY
 */
const openRouterApiKey =
  process.env.OPENROUTER_API_KEY || '';


/* =========================================================
   HELPERS
========================================================= */

function toSafeString(value = '') {
  return String(value ?? '').trim();
}


function normalizeUserMessage(message = '') {
  const text = toSafeString(message);

  if (!text) {
    return '';
  }

  if (text.length <= MAX_USER_MESSAGE_LENGTH) {
    return text;
  }

  return text.slice(
    0,
    MAX_USER_MESSAGE_LENGTH
  );
}


function extractAssistantReply(completion) {
  if (!completion) {
    return null;
  }

  const choices =
    Array.isArray(completion.choices)
      ? completion.choices
      : [];

  if (!choices.length) {
    return null;
  }

  const message =
    choices[0]?.message;

  if (!message) {
    return null;
  }

  const content =
    message.content;

  if (
    typeof content !== 'string'
  ) {
    return null;
  }

  const reply =
    content.trim();

  if (!reply) {
    return null;
  }

  return reply;
}


function createAbortController() {
  if (
    typeof AbortController ===
    'undefined'
  ) {
    return null;
  }

  return new AbortController();
}


/* =========================================================
   GROQ AI
========================================================= */

async function generateGroqReply(messages) {
  if (!groq) {
    logger.warn(
      'Groq API unavailable: GROQ_API_KEY is not configured.'
    );

    return null;
  }

  const controller =
    createAbortController();

  const timer =
    controller
      ? setTimeout(() => {
          controller.abort();
        }, REQUEST_TIMEOUT_MS)
      : null;

  try {
    const requestOptions = {
      model: GROQ_MODEL,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      messages
    };

    if (controller?.signal) {
      requestOptions.signal =
        controller.signal;
    }

    const completion =
      await groq.chat.completions.create(
        requestOptions
      );

    const reply =
      extractAssistantReply(
        completion
      );

    if (!reply) {
      logger.warn(
        'Groq returned an empty response.'
      );

      return null;
    }

    return reply;
  } catch (err) {
    if (
      err?.name ===
      'AbortError'
    ) {
      logger.warn(
        'Groq request timed out.'
      );
    } else {
      const status =
        err?.status ||
        err?.statusCode ||
        err?.response?.status ||
        null;

      const message =
        err?.message ||
        'Unknown Groq error';

      logger.error(
        `Groq AI error${status ? ` (${status})` : ''}: ${message}`
      );
    }

    return null;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}


/* =========================================================
   OPENROUTER FREE AI
========================================================= */

async function generateOpenRouterReply(messages) {
  if (!openRouterApiKey) {
    logger.warn(
      'OpenRouter unavailable: OPENROUTER_API_KEY is not configured.'
    );

    return null;
  }

  const controller =
    createAbortController();

  const timer =
    controller
      ? setTimeout(() => {
          controller.abort();
        }, REQUEST_TIMEOUT_MS)
      : null;

  try {
    const response =
      await fetch(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',

          headers: {
            'Authorization':
              `Bearer ${openRouterApiKey}`,

            'Content-Type':
              'application/json',

            'HTTP-Referer':
              'https://course-nibo-bot.onrender.com',

            'X-Title':
              'Course Nibo Sinthiya AI'
          },

          body: JSON.stringify({
            model: OPENROUTER_MODEL,
            temperature: TEMPERATURE,
            max_tokens: MAX_TOKENS,
            messages
          }),

          signal:
            controller?.signal
        }
      );

    if (!response.ok) {
      const errorText =
        await response.text()
          .catch(() => '');

      logger.error(
        `OpenRouter API error (${response.status}): ${errorText.slice(0, 500)}`
      );

      return null;
    }

    const completion =
      await response.json();

    const reply =
      extractAssistantReply(
        completion
      );

    if (!reply) {
      logger.warn(
        'OpenRouter returned an empty response.'
      );

      return null;
    }

    return reply;
  } catch (err) {
    if (
      err?.name ===
      'AbortError'
    ) {
      logger.warn(
        'OpenRouter request timed out.'
      );
    } else {
      logger.error(
        `OpenRouter AI error: ${
          err?.message ||
          'Unknown error'
        }`
      );
    }

    return null;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}


/* =========================================================
   MAIN SINTHIYA FUNCTION
========================================================= */

async function generateReply(
  memory = {},
  userMessage = ''
) {
  const normalizedMessage =
    normalizeUserMessage(
      userMessage
    );

  if (!normalizedMessage) {
    return null;
  }


  /* -------------------------------------------------------
     Build AI conversation
  ------------------------------------------------------- */

  let messages;

  try {
    messages =
      buildMessages(
        memory,
        normalizedMessage
      );
  } catch (err) {
    logger.error(
      `Failed to build Sinthiya AI messages: ${
        err?.message ||
        'Unknown error'
      }`
    );

    return null;
  }


  if (
    !Array.isArray(messages) ||
    messages.length === 0
  ) {
    logger.warn(
      'Sinthiya AI received an empty message list.'
    );

    return null;
  }


  /* -------------------------------------------------------
     1. Try Groq first
  ------------------------------------------------------- */

  const groqReply =
    await generateGroqReply(
      messages
    );

  if (groqReply) {
    logger.info(
      'Sinthiya replied using Groq AI.'
    );

    return groqReply;
  }


  /* -------------------------------------------------------
     2. Groq failed → OpenRouter Free fallback
  ------------------------------------------------------- */

  logger.warn(
    'Groq failed. Trying OpenRouter Free fallback...'
  );

  const openRouterReply =
    await generateOpenRouterReply(
      messages
    );

  if (openRouterReply) {
    logger.info(
      'Sinthiya replied using OpenRouter Free AI.'
    );

    return openRouterReply;
  }


  /* -------------------------------------------------------
     3. Both AI providers failed
  ------------------------------------------------------- */

  logger.error(
    'All Sinthiya AI providers failed.'
  );

  return null;
}


/* =========================================================
   EXPORT
========================================================= */

module.exports = {
  generateReply
};