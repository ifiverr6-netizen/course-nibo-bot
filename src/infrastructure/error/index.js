const logger = require('../logger');

class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

function handleError(error, context = '') {
  if (error && error.isOperational) {
    logger.warn(`${context}: ${error.message}`);
  } else {
    logger.error(`${context}: Unexpected error`, error);
  }
}

module.exports = { AppError, handleError };
