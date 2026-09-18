const logger =
  require('../logger');


/*
 * =========================================================
 * APPLICATION ERROR
 * =========================================================
 */

class AppError extends Error {
  constructor(
    message,
    statusCode = 500,
    options = {}
  ) {
    super(
      String(
        message ||
        'Application error'
      )
    );

    this.name =
      'AppError';

    this.statusCode =
      Number.isInteger(
        statusCode
      )
        ? statusCode
        : 500;

    this.isOperational =
      options.isOperational !== undefined
        ? Boolean(
            options.isOperational
          )
        : true;

    this.code =
      options.code ||
      null;

    this.details =
      options.details ||
      null;

    if (
      Error.captureStackTrace
    ) {
      Error.captureStackTrace(
        this,
        AppError
      );
    }
  }
}


/*
 * =========================================================
 * NORMALIZE
 * =========================================================
 */

function normalizeError(
  error
) {
  if (
    error instanceof Error
  ) {
    return error;
  }

  if (
    typeof error === 'string'
  ) {
    return new Error(
      error
    );
  }

  try {
    return new Error(
      JSON.stringify(
        error
      )
    );
  } catch {
    return new Error(
      'Unknown application error'
    );
  }
}


/*
 * =========================================================
 * ERROR MESSAGE
 * =========================================================
 */

function getErrorMessage(
  error
) {
  const normalized =
    normalizeError(
      error
    );

  return (
    normalized.message ||
    'Unknown error'
  );
}


/*
 * =========================================================
 * HANDLE ERROR
 * =========================================================
 */

function handleError(
  error,
  context = ''
) {
  const normalized =
    normalizeError(
      error
    );

  const prefix =
    context
      ? `[${context}]`
      : '[Application]';


  if (
    normalized.isOperational
  ) {
    logger.warn(
      `${prefix} ${normalized.message}`,
      normalized.code
        ? {
            code:
              normalized.code
          }
        : undefined
    );

    return;
  }


  logger.error(
    `${prefix} Unexpected error`,
    normalized
  );
}


/*
 * =========================================================
 * ASYNC HANDLER
 * =========================================================
 */

function asyncHandler(
  handler,
  context = ''
) {
  return async (
    ...args
  ) => {
    try {
      return await handler(
        ...args
      );
    } catch (error) {
      handleError(
        error,
        context
      );

      return null;
    }
  };
}


/*
 * =========================================================
 * COMMON ERRORS
 * =========================================================
 */

function badRequest(
  message,
  code = 'BAD_REQUEST'
) {
  return new AppError(
    message,
    400,
    {
      code
    }
  );
}


function unauthorized(
  message = 'Unauthorized',
  code = 'UNAUTHORIZED'
) {
  return new AppError(
    message,
    401,
    {
      code
    }
  );
}


function forbidden(
  message = 'Forbidden',
  code = 'FORBIDDEN'
) {
  return new AppError(
    message,
    403,
    {
      code
    }
  );
}


function notFound(
  message = 'Not found',
  code = 'NOT_FOUND'
) {
  return new AppError(
    message,
    404,
    {
      code
    }
  );
}


function conflict(
  message = 'Conflict',
  code = 'CONFLICT'
) {
  return new AppError(
    message,
    409,
    {
      code
    }
  );
}


module.exports = {
  AppError,

  handleError,
  asyncHandler,

  getErrorMessage,
  normalizeError,

  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict
};
