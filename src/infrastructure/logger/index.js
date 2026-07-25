const levels = {
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  success: '\x1b[32m'
};
const reset = '\x1b[0m';

function log(level, message, meta) {
  const time = new Date().toISOString();
  const color = levels[level] || '';
  const prefix = `${color}[${time}] [${level.toUpperCase()}]${reset}`;
  if (meta instanceof Error) {
    console[level === 'error' ? 'error' : 'log'](prefix, message, '-', meta.stack || meta.message);
  } else if (meta !== undefined) {
    console.log(prefix, message, meta);
  } else {
    console.log(prefix, message);
  }
}

module.exports = {
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
  success: (msg, meta) => log('success', msg, meta)
};
