const DIVIDER = '━━━━━━━━━━━━━━━━━━';

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function nowBD() {
  return new Date().toLocaleString('en-BD', {
    timeZone: 'Asia/Dhaka',
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function generateOrderId() {
  const ts = Date.now().toString().slice(-8);
  const rand = Math.floor(10 + Math.random() * 90);
  return `ORD-${ts}${rand}`;
}

module.exports = { DIVIDER, escapeHtml, nowBD, generateOrderId };
