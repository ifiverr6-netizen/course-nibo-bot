const PRODUCTS = {
  japanese: {
    code: 'japanese',
    title: 'Complete Japanese Language',
    price: '199 BDT',
    photo: 'https://files.catbox.moe/u23flr.png',
    access: 'https://drive.google.com/drive/folders/1FhGMWbEhC2mlwS-cyyidqA8IG2gkxW2z?usp=drive_link',
    category: 'course'
  },
  facebook_ads: {
  code: 'facebook_ads',
  title: 'Facebook Ads Mastery 2026',
  price: '229 BDT',                     // ← তোমার price বসাও
  photo: 'https://files.catbox.moe/nu6r5l.png',  // ← photo link দাও
  access: 'https://t.me/+LS07n9sL3AhmOTQ9',      // ← access link
  category: 'course'
},

gemini_pro: {
  code: 'gemini_pro',
  title: 'Gemini Pro (18 Month)',
  price: '350 BDT',                     // ← price বসাও
  photo: 'https://files.catbox.moe/s5rmcf.png',
  access: 'send massage in bot',  // ← credentials
  category: 'subscription'
},
  ielts: {
    code: 'ielts',
    title: 'Banglay IELTS',
    price: '299 BDT',
    photo: 'https://files.catbox.moe/yrzo1e.png',
    access: 'https://t.me/+DMbXkww55TdmYTdl',
    category: 'course'
  },
  chatgpt_1m: {
    code: 'chatgpt_1m',
    title: 'ChatGPT Go (3 Month)',
    price: '350 BDT',
    photo: 'https://files.catbox.moe/tziyuw.png',
    access: 'Gmail: lee.4l3x+1@yandex.com\nPassword: I am Asif01580',
    category: 'subscription'
  },
  business: {
    code: 'business',
    title: 'কোটি টাকার বিজনেস ফর্মুলা 🚀💰',
    price: '199 BDT',
    photo: 'https://files.catbox.moe/0uedgs.png',
    access: 'https://t.me/+uq_znvl5DUFmY2I1',
    category: 'course'
  },
  editing: {
    code: 'editing',
    title: '🟢 Video Editing Course By Rafayat Rakib',
    price: '199 BDT',
    photo: 'https://files.catbox.moe/jqwbtt.png',
    access: 'https://drive.google.com/drive/folders/1WPhr-AXO1MzsZuJ6PMEeQsqaVJ5OIpf4?usp=drive_link',
    category: 'course'
  },
  premiere: {
    code: 'premiere',
    title: 'Video Editing with After Effects and Premiere Pro Batch 2',
    price: '299 BDT',
    photo: 'https://files.catbox.moe/h5u7j0.png',
    access: 'https://t.me/+NZDDhunzLXU2NTVl',
    category: 'course'
  }
};

function getProduct(code) {
  return PRODUCTS[code] || null;
}

function getAllProducts() {
  return Object.values(PRODUCTS);
}

function getCourseProducts() {
  return getAllProducts().filter(p => p.category === 'course');
}

function getSubscriptionProducts() {
  return getAllProducts().filter(p => p.category === 'subscription');
}

function findProductByText(text = '') {
  const lower = text.toLowerCase();
  return getAllProducts().find(p => {
    if (lower.includes(p.code)) return true;
    if (lower.includes(p.title.toLowerCase())) return true;
    // common keywords
    if (p.code === 'chatgpt_1m' && (lower.includes('chatgpt') || lower.includes('জিপিটি') || lower.includes('gpt'))) return true;
    if (p.code === 'japanese' && (lower.includes('japanese') || lower.includes('জাপানিজ') || lower.includes('জাপানি'))) return true;
    if (p.code === 'ielts' && lower.includes('ielts')) return true;
    if (p.code === 'business' && (lower.includes('বিজনেস') || lower.includes('business') || lower.includes('কোটি'))) return true;
    if (p.code === 'editing' && (lower.includes('rafayat') || lower.includes('রাফায়েত'))) return true;
    if (p.code === 'premiere' && (lower.includes('premiere') || lower.includes('after effect'))) return true;
    if (p.code === 'facebook_ads' && (lower.includes('facebook ads') || lower.includes('fb ads') || lower.includes('ফেসবুক অ্যাডস') || lower.includes('ফেসবুক এডস'))) return true;
    if (p.code === 'gemini_pro' && (lower.includes('gemini') || lower.includes('জেমিনি') || lower.includes('gemini pro'))) return true;
    return false;
  });
}

module.exports = {
  PRODUCTS,
  getProduct,
  getAllProducts,
  getCourseProducts,
  getSubscriptionProducts,
  findProductByText
};
