const COLORS = {
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  success: '\x1b[32m',
  debug: '\x1b[35m'
};

const RESET =
  '\x1b[0m';


function timestamp() {
  return new Date().toISOString();
}


function normalizeMessage(
  message
) {
  if (
    message === null ||
    message === undefined
  ) {
    return '';
  }

  if (
    message instanceof Error
  ) {
    return message.message;
  }

  return String(message);
}


function formatMeta(
  meta
) {
  if (
    meta === undefined ||
    meta === null
  ) {
    return '';
  }

  if (
    meta instanceof Error
  ) {
    return (
      meta.stack ||
      meta.message
    );
  }

  if (
    typeof meta === 'string'
  ) {
    return meta;
  }

  try {
    return JSON.stringify(
      meta
    );
  } catch {
    return String(meta);
  }
}


function log(
  level,
  message,
  meta
) {
  const color =
    COLORS[level] || '';

  const prefix =
    `${color}[${timestamp()}] ` +
    `[${level.toUpperCase()}]${RESET}`;

  const text =
    normalizeMessage(
      message
    );

  const metadata =
    formatMeta(
      meta
    );

  const output =
    metadata
      ? `${prefix} ${text} ${metadata}`
      : `${prefix} ${text}`;


  if (
    level === 'error'
  ) {
    console.error(
      output
    );
    return;
  }

  if (
    level === 'warn'
  ) {
    console.warn(
      output
    );
    return;
  }

  console.log(
    output
  );
}


function info(
  message,
  meta
) {
  log(
    'info',
    message,
    meta
  );
}


function warn(
  message,
  meta
) {
  log(
    'warn',
    message,
    meta
  );
}


function error(
  message,
  meta
) {
  log(
    'error',
    message,
    meta
  );
}


function success(
  message,
  meta
) {
  log(
    'success',
    message,
    meta
  );
}


function debug(
  message,
  meta
) {
  if (
    String(
      process.env.DEBUG || ''
    ).toLowerCase() !== 'true'
  ) {
    return;
  }

  log(
    'debug',
    message,
    meta
  );
}


function child(
  context = {}
) {
  const base =
    context &&
    typeof context === 'object'
      ? context
      : {};

  function mergeMeta(
    meta
  ) {
    if (
      meta &&
      typeof meta === 'object' &&
      !(
        meta instanceof Error
      )
    ) {
      return {
        ...base,
        ...meta
      };
    }

    return {
      ...base,
      meta
    };
  }

  return {
    info:
      (message, meta) =>
        info(
          message,
          mergeMeta(meta)
        ),

    warn:
      (message, meta) =>
        warn(
          message,
          mergeMeta(meta)
        ),

    error:
      (message, meta) =>
        error(
          message,
          mergeMeta(meta)
        ),

    success:
      (message, meta) =>
        success(
          message,
          mergeMeta(meta)
        ),

    debug:
      (message, meta) =>
        debug(
          message,
          mergeMeta(meta)
        )
  };
}


module.exports = {
  info,
  warn,
  error,
  success,
  debug,
  child
};
