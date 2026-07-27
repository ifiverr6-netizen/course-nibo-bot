// ★ Central theme file — সব icon/status এক জায়গায়, ভবিষ্যতে বদলাতে হলে শুধু এই ফাইলেই এডিট করলেই হবে
// bot.js / promptBuilder.js যেখানেই emoji ব্যবহার হয়, এখান থেকে import করে ব্যবহার করা উচিত

const ICONS = {
  course: '📚',
  price: '💰',
  delivery: '🚚',
  orderId: '🆔',
  payment: '💳',
  support: '📞',
  product: '📦',
  celebrate: '🎉',
  time: '⏱️'
};

// raw DB status string → user-facing colored badge
// ⚠️ raw status string (updateOrderStatus / findPendingOrder-এ ব্যবহৃত) অপরিবর্তিত রাখতে হবে,
// শুধু ডিসপ্লের সময় রঙিন ব্যাজ দেখানো হবে
function statusBadge(rawStatus) {
  if (!rawStatus) return rawStatus;
  if (rawStatus.startsWith('Pending')) return `🟡 <b>${rawStatus}</b>`;
  if (rawStatus.startsWith('Delivered')) return `🟢 <b>${rawStatus}</b>`;
  if (rawStatus.startsWith('Rejected')) return `🔴 <b>${rawStatus}</b>`;
  return `<b>${rawStatus}</b>`;
}

module.exports = { ICONS, statusBadge };
