/**
 * Course Nibo
 * Product Catalog
 *
 * IMPORTANT:
 * - Product codes are used internally by the bot.
 * - Do not change product codes after orders exist in the database.
 * - Contact/payment credentials are NOT stored here.
 * - Contact/payment information comes from config/environment variables.
 */

const PRODUCTS = {
  japanese: {
    code: 'japanese',
    title: 'Complete Japanese Language',
    shortTitle: 'Complete Japanese Language',
    price: '199 BDT',
    photo: 'https://files.catbox.moe/u23flr.png',
    access:
      'https://drive.google.com/drive/folders/1FhGMWbEhC2mlwS-cyyidqA8IG2gkxW2z?usp=drive_link',
    category: 'course',
    courseOrder: 1,
    active: true
  },

  facebook_ads: {
    code: 'facebook_ads',
    title: 'Facebook Ads Mastery 2026',
    shortTitle: 'Facebook Ads Mastery 2026',
    price: '229 BDT',
    photo: 'https://i.ibb.co/hSvZws6/image.png',
    access: 'https://t.me/+LS07n9sL3AhmOTQ9',
    category: 'course',
    courseOrder: 2,
    active: true
  },

  ielts: {
    code: 'ielts',
    title: 'Banglay IELTS',
    shortTitle: 'Banglay IELTS',
    price: '299 BDT',
    photo: 'https://files.catbox.moe/yrzo1e.png',
    access: 'https://t.me/+DMbXkww55TdmYTdl',
    category: 'course',
    courseOrder: 3,
    active: true
  },

  business: {
    code: 'business',
    title: 'কোটি টাকার বিজনেস ফর্মুলা 🚀💰',
    shortTitle: 'কোটি টাকার বিজনেস ফর্মুলা',
    price: '199 BDT',
    photo: 'https://files.catbox.moe/0uedgs.png',
    access: 'https://t.me/+uq_znvl5DUFmY2I1',
    category: 'course',
    courseOrder: 4,
    active: true
  },

  editing: {
    code: 'editing',
    title: '🟢 Video Editing Course By Rafayat Rakib',
    shortTitle: 'Video Editing Course By Rafayat Rakib',
    price: '199 BDT',
    photo: 'https://files.catbox.moe/jqwbtt.png',
    access:
      'https://drive.google.com/drive/folders/1WPhr-AXO1MzsZuJ6PMEeQsqaVJ5OIpf4?usp=drive_link',
    category: 'course',
    courseOrder: 5,
    active: true
  },

  premiere: {
    code: 'premiere',
    title:
      'Video Editing with After Effects and Premiere Pro Batch 2',
    shortTitle:
      'Video Editing with After Effects and Premiere Pro Batch 2',
    price: '299 BDT',
    photo: 'https://files.catbox.moe/h5u7j0.png',
    access: 'https://t.me/+NZDDhunzLXU2NTVl',
    category: 'course',
    courseOrder: 6,
    active: true
  },

  gemini_pro: {
    code: 'gemini_pro',
    title: 'Gemini Pro (18 Month)',
    shortTitle: 'Gemini Pro (18 Month)',
    price: '350 BDT',
    photo: 'https://i.ibb.co/Rk2qdB4d/image.png',
    access: 'send massage in bot',
    category: 'subscription',
    subscriptionOrder: 1,
    active: true
  },

  chatgpt_1m: {
    code: 'chatgpt_1m',
    title: 'ChatGPT Go (3 Month)',
    shortTitle: 'ChatGPT Go (3 Month)',
    price: '350 BDT',
    photo: 'https://files.catbox.moe/tziyuw.png',
    access: 'Contact admin for credentials',
    category: 'subscription',
    subscriptionOrder: 2,
    active: true
  }
};

/**
 * Get one product by its internal code.
 */
function getProduct(code) {
  if (!code) return null;

  const product = PRODUCTS[String(code).trim()];

  if (!product || product.active === false) {
    return null;
  }

  return product;
}

/**
 * Return only active products.
 */
function getAllProducts() {
  return Object.values(PRODUCTS).filter(
    (product) => product.active !== false
  );
}

/**
 * Return courses in fixed 1 → 2 → 3 → 4 order.
 */
function getCourseProducts() {
  return getAllProducts()
    .filter((product) => product.category === 'course')
    .sort((a, b) => {
      const orderA = Number.isFinite(a.courseOrder)
        ? a.courseOrder
        : Number.MAX_SAFE_INTEGER;

      const orderB = Number.isFinite(b.courseOrder)
        ? b.courseOrder
        : Number.MAX_SAFE_INTEGER;

      return orderA - orderB;
    });
}

/**
 * Return subscriptions in fixed order.
 */
function getSubscriptionProducts() {
  return getAllProducts()
    .filter((product) => product.category === 'subscription')
    .sort((a, b) => {
      const orderA = Number.isFinite(a.subscriptionOrder)
        ? a.subscriptionOrder
        : Number.MAX_SAFE_INTEGER;

      const orderB = Number.isFinite(b.subscriptionOrder)
        ? b.subscriptionOrder
        : Number.MAX_SAFE_INTEGER;

      return orderA - orderB;
    });
}

/**
 * Normalize user text before product matching.
 */
function normalizeProductSearchText(text = '') {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Detect a product from customer text.
 *
 * Important:
 * This is only product detection.
 * It does NOT create orders, payments, or delivery.
 */
function findProductByText(text = '') {
  const lower = normalizeProductSearchText(text);

  if (!lower) return null;

  const aliases = {
    japanese: [
      'japanese',
      'japanese language',
      'complete japanese',
      'জাপানিজ',
      'জাপানি',
      'জাপানিজ ল্যাঙ্গুয়েজ',
      'জাপানিজ ল্যাঙ্গুয়েজ'
    ],

    facebook_ads: [
      'facebook ads',
      'facebook ad',
      'fb ads',
      'fb ad',
      'ফেসবুক অ্যাডস',
      'ফেসবুক এডস',
      'ফেসবুক বিজ্ঞাপন'
    ],

    ielts: [
      'ielts',
      'banglay ielts',
      'বাংলায় ielts',
      'বাংলায় ielts',
      'আইইএলটিএস'
    ],

    business: [
      'business formula',
      'business course',
      'বিজনেস',
      'বিজনেস ফর্মুলা',
      'কোটি টাকার বিজনেস',
      'কোটি টাকার বিজনেস ফর্মুলা'
    ],

    editing: [
      'rafayat rakib',
      'rafayat',
      'video editing rafayat',
      'রাফায়েত',
      'রাফায়েত',
      'রাফায়েত রাকিব',
      'রাফায়েত রাকিব'
    ],

    premiere: [
      'premiere pro',
      'after effects',
      'after effect',
      'premiere',
      'batch 2',
      'এফেক্টস',
      'প্রিমিয়ার',
      'প্রিমিয়ার'
    ],

    gemini_pro: [
      'gemini',
      'gemini pro',
      'জেমিনি',
      'জেমিনি প্রো'
    ],

    chatgpt_1m: [
      'chatgpt',
      'chat gpt',
      'chatgpt go',
      'gpt go',
      'জিপিটি',
      'চ্যাটজিপিটি',
      'চ্যাট জিপিটি'
    ]
  };

  for (const [productCode, productAliases] of Object.entries(aliases)) {
    if (
      productAliases.some((alias) =>
        lower.includes(normalizeProductSearchText(alias))
      )
    ) {
      return getProduct(productCode);
    }
  }

  return null;
}

/**
 * Check whether a product belongs to the course category.
 */
function isCourse(product) {
  return Boolean(product && product.category === 'course');
}

/**
 * Check whether a product belongs to the subscription category.
 */
function isSubscription(product) {
  return Boolean(
    product && product.category === 'subscription'
  );
}

module.exports = {
  PRODUCTS,
  getProduct,
  getAllProducts,
  getCourseProducts,
  getSubscriptionProducts,
  findProductByText,
  isCourse,
  isSubscription
};
