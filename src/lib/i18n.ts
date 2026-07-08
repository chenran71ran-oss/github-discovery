export type Locale = 'tr' | 'en';

const translations: Record<string, Record<Locale, string>> = {
  'site.title': { tr: 'GitHub Trends TR', en: 'GitHub Trends TR' },
  'site.tagline': { tr: 'Türkçe Analiz', en: 'Turkish Analysis' },
  'nav.home': { tr: 'Anasayfa', en: 'Home' },
  'nav.archive': { tr: 'Arşiv', en: 'Archive' },
  'nav.about': { tr: 'Hakkında', en: 'About' },
  'nav.languages': { tr: 'Diller', en: 'Languages' },
  'nav.search': { tr: 'Ara', en: 'Search' },
  'nav.categories': { tr: 'Kategoriler', en: 'Categories' },
  'hero.title': { tr: "GitHub'da Bugün Ne Trend?", en: "What's Trending on GitHub Today?" },
  'hero.subtitle': {
    tr: 'Yapay zeka destekli Türkçe analizlerle güncel açık kaynak projeleri keşfet',
    en: 'Discover trending open source projects with AI-powered Turkish analysis',
  },
  'stats.totalProjects': { tr: 'Toplam Proje', en: 'Total Projects' },
  'stats.newStars': { tr: 'Yeni Yıldız', en: 'New Stars' },
  'stats.languages': { tr: 'Programlama Dili', en: 'Languages' },
  'stats.topLang': { tr: 'En Popüler Dil', en: 'Top Language' },
  'period.daily': { tr: 'Günlük', en: 'Daily' },
  'period.weekly': { tr: 'Haftalık', en: 'Weekly' },
  'period.monthly': { tr: 'Aylık', en: 'Monthly' },
  'repo.detail': { tr: 'Detaylı İncele', en: 'View Details' },
  'repo.aiAnalysis': { tr: '🤖 Türkçe AI Analizi', en: '🤖 AI Analysis (Turkish)' },
  'repo.targetAudience': { tr: 'Hedef Kitle', en: 'Target Audience' },
  'repo.usageExample': { tr: 'Kullanım Örneği', en: 'Usage Example' },
  'repo.features': { tr: 'TEMEL OZELLIKLER', en: 'KEY FEATURES' },
  'newsletter.title': { tr: 'Günlük Trending Digest', en: 'Daily Trending Digest' },
  'newsletter.subtitle': {
    tr: "Her sabah GitHub'da trend olan projelerin Türkçe AI analizini doğrudan e-posta kutuna al.",
    en: 'Get daily trending GitHub repos with AI-powered Turkish analysis delivered to your inbox.',
  },
  'newsletter.button': { tr: 'Ücretsiz Abone Ol', en: 'Subscribe Free' },
  'newsletter.consent': {
    tr: "Abone olarak günlük GitHub Trending bültenini almayı kabul ediyorsun. Her e-postada tek tıkla çıkabilirsin.",
    en: 'By subscribing you agree to receive the daily GitHub Trending digest. Unsubscribe anytime with one click.',
  },
  'footer.powered': { tr: 'Cloudflare Workers AI ile oluşturuldu', en: 'Powered by Cloudflare Workers AI' },
  'empty.noData': { tr: 'Henüz veri yok', en: 'No data yet' },
  'empty.updatedAt': {
    tr: 'Veriler her gün 07:00 TR saatinde güncellenir.',
    en: 'Data is updated daily at 07:00 AM (Turkey time).',
  },
};

export function t(key: string, locale: Locale = 'tr'): string {
  return translations[key]?.[locale] ?? translations[key]?.tr ?? key;
}

export function getLocaleFromUrl(url: URL): Locale {
  return url.pathname.startsWith('/en') ? 'en' : 'tr';
}

export function localePath(path: string, locale: Locale): string {
  if (locale === 'en') return `/en${path === '/' ? '' : path}`;
  return path;
}
