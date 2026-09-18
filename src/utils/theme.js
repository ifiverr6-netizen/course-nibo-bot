/*
 * =========================================================
 * TELEGRAM UI THEME
 * =========================================================
 */

const ICONS = {
  course: '📚',
  price: '💰',
  delivery: '🚚',
  orderId: '🆔',
  payment: '💳',
  support: '📞',
  product: '📦',
  celebrate: '🎉',
  time: '⏱️',

  pending: '🟡',
  delivered: '🟢',
  rejected: '🔴',

  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️'
};


/*
 * =========================================================
 * STATUS BADGE
 * =========================================================
 *
 * IMPORTANT:
 * This function only changes presentation.
 *
 * Database status remains unchanged.
 */

function statusBadge(
  rawStatus
) {
  if (
    rawStatus === null ||
    rawStatus === undefined
  ) {
    return '';
  }

  const status =
    String(
      rawStatus
    ).trim();

  if (!status) {
    return '';
  }


  if (
    status.startsWith(
      'Pending'
    )
  ) {
    return (
      `${ICONS.pending} ` +
      `<b>${status}</b>`
    );
  }


  if (
    status.startsWith(
      'Delivered'
    )
  ) {
    return (
      `${ICONS.delivered} ` +
      `<b>${status}</b>`
    );
  }


  if (
    status.startsWith(
      'Rejected'
    )
  ) {
    return (
      `${ICONS.rejected} ` +
      `<b>${status}</b>`
    );
  }


  if (
    status
      .toLowerCase()
      .includes('cancel')
  ) {
    return (
      `${ICONS.rejected} ` +
      `<b>${status}</b>`
    );
  }


  if (
    status
      .toLowerCase()
      .includes('process')
  ) {
    return (
      `${ICONS.pending} ` +
      `<b>${status}</b>`
    );
  }


  return `<b>${status}</b>`;
}


module.exports = {
  ICONS,
  statusBadge
};
