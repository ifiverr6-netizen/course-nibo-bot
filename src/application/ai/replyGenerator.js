const Groq = require('groq-sdk');

const config = require('../../config');
const logger = require('../../infrastructure/logger');

const {
  buildMessages
} = require('./promptBuilder');


/* =========================================================
   CONFIGURATION
========================================================= */

const MODEL =
  'openai/gpt-oss-120b';

const TEMPERATURE = 0.6;

const MAX_TOKENS = 600;

const REQUEST_TIMEOUT_MS = 20000;

const MAX_USER_MESSAGE_LENGTH = 4000;


/* =========================================================
   GROQ CLIENT
========================================================= */

const groq =
  config.groqApiKey
    ? new Groq({
        apiKey: config.groqApiKey
      })
    : null;


/* =========================================================
   HELPERS
========================================================= */

/**
 * Safely convert anything into a string.
 */
function toSafeString(value = '') {
  return String(value ?? '').trim();
}


/**
 * Prevent extremely large user messages from
 * unnecessarily consuming AI context.
 */
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


/**
 * Validate the generated AI response.
 */
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


/**
 * Create an AbortController timeout.
 *
 * Groq SDK supports passing request options through
 * the request configuration.
 */
function createTimeoutSignal() {
  if (
    typeof AbortController ===
    'undefined'
  ) {
    return null;
  }

  const controller =
    new AbortController();

  const timer =
    setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

  return {
    controller,
    timer
  };
}


/* =========================================================
   MAIN AI FUNCTION
========================================================= */

async function generateReply(
  memory = {},
  userMessage = ''
) {
  /*
   * No API key means AI is unavailable.
   * The bot will use its normal fallback flow.
   */
  if (!groq) {
    logger.warn(
      'Sinthiya AI is unavailable: GROQ_API_KEY is not configured.'
    );

    return null;
  }


  const normalizedMessage =
    normalizeUserMessage(
      userMessage
    );


  if (!normalizedMessage) {
    return null;
  }


  try {
    /* -----------------------------------------------------
       Build conversation messages
    ----------------------------------------------------- */

    const messages =
      buildMessages(
        memory,
        normalizedMessage
      );


    if (
      !Array.isArray(messages) ||
      messages.length === 0
    ) {
      logger.warn(
        'Sinthiya AI received an empty message list.'
      );

      return null;
    }


    /* -----------------------------------------------------
       Request timeout
    ----------------------------------------------------- */

    const timeout =
      createTimeoutSignal();


    let completion;


    try {
      const requestOptions = {
        model: MODEL,

        /*
         * Moderate temperature keeps Sinthiya natural
         * without making responses unnecessarily random.
         */
        temperature: TEMPERATURE,

        /*
         * Enough room for a complete customer response,
         * while still keeping replies concise.
         */
        max_tokens: MAX_TOKENS,

        messages
      };


      /*
       * Attach AbortSignal when supported.
       */
      if (timeout?.controller?.signal) {
        requestOptions.signal =
          timeout.controller.signal;
      }


      completion =
        await groq.chat.completions.create(
          requestOptions
        );
    } finally {
      if (timeout?.timer) {
        clearTimeout(
          timeout.timer
        );
      }
    }


    /* -----------------------------------------------------
       Extract response
    ----------------------------------------------------- */

    const reply =
      extractAssistantReply(
        completion
      );


    if (!reply) {
      logger.warn(
        'Sinthiya AI returned an empty response.'
      );

      return null;
    }


    return reply;
  } catch (err) {
    /* -----------------------------------------------------
       Timeout
    ----------------------------------------------------- */

    if (
      err?.name ===
      'AbortError'
    ) {
      logger.warn(
        'Sinthiya AI request timed out.'
      );

      return null;
    }


    /* -----------------------------------------------------
       API / Network Error
    ----------------------------------------------------- */

    const status =
      err?.status ||
      err?.statusCode ||
      err?.response?.status ||
      null;


    const message =
      err?.message ||
      'Unknown AI error';


    logger.error(
      `Sinthiya AI error${status ? ` (${status})` : ''}: ${message}`
    );


    return null;
  }
}


/* =========================================================
   EXPORT
========================================================= */

module.exports = {
  generateReply
};
