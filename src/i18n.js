import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import pt from './locales/pt.json';
import en from './locales/en.json';

const SUPPORTED = ['pt', 'en'];

// Browsers report regional codes ('pt-BR', 'en-US'), and the detector caches
// them in localStorage. Without normalizing, i18n.language was 'pt-BR', every
// `i18n.language === 'pt'` check failed and Brazilian users got US dates and
// numbers ("12/18/2025, 06:09 PM") under Portuguese text (until v3.9.1).
// Anything else ('es', 'fr') falls back to Portuguese.
export function normalizeLanguage(lng) {
  const base = String(lng ?? '').toLowerCase().split(/[-_]/)[0];
  return SUPPORTED.includes(base) ? base : 'pt';
}

/** Intl/toLocaleString locale for the current UI language. */
export function intlLocale(lng = i18n.language) {
  return normalizeLanguage(lng) === 'en' ? 'en-US' : 'pt-BR';
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      pt: { translation: pt },
      en: { translation: en },
    },
    supportedLngs: SUPPORTED,
    detection: { convertDetectedLanguage: normalizeLanguage },
    fallbackLng: 'pt',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
  });

// Screen readers and browser translation read <html lang>; index.html ships "en".
const syncHtmlLang = (lng) => {
  if (typeof document !== 'undefined') document.documentElement.lang = intlLocale(lng);
};
syncHtmlLang(i18n.language);
i18n.on('languageChanged', syncHtmlLang);

export default i18n;
