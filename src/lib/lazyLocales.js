// Page-only texts kept out of the entry bundle: /guia (guide.*) and /guia/ia (aiGuide.*) are about
// half of each locale. Every file below becomes its own chunk (dynamic import, no manualChunks),
// fetched by the page that needs it, for the active language only, and merged into the
// 'translation' namespace, so call sites keep t('guide.…') / t('aiGuide.…').
const BUNDLES = {
  guide: {
    pt: () => import('../locales/guide.pt.json'),
    en: () => import('../locales/guide.en.json'),
  },
  aiGuide: {
    pt: () => import('../locales/aiGuide.pt.json'),
    en: () => import('../locales/aiGuide.en.json'),
  },
};

export const LAZY_LOCALE_NAMES = Object.keys(BUNDLES);

/** Bundle language for a UI language: same rule as intlLocale (anything but English → pt). */
export function bundleLanguage(lng) {
  return String(lng ?? '').toLowerCase().startsWith('en') ? 'en' : 'pt';
}

export function isLocaleLoaded(i18n, name, lng = i18n.language) {
  return i18n.getResource(bundleLanguage(lng), 'translation', name) !== undefined;
}

/** Fetches and registers one bundle (no-op when already there). Rejects if the chunk fails to load. */
export async function loadLocale(i18n, name, lng = i18n.language) {
  const target = bundleLanguage(lng);
  const loaders = BUNDLES[name];
  if (!loaders) throw new Error(`Unknown lazy locale "${name}"`);
  if (isLocaleLoaded(i18n, name, target)) return;
  const module = await loaders[target]();
  i18n.addResourceBundle(target, 'translation', module.default, true, true);
}

// Bundles used by mounted pages (useLazyLocale), so a language switch can fetch them first.
const inUse = new Map();

export function markLocaleInUse(name) {
  inUse.set(name, (inUse.get(name) ?? 0) + 1);
  return () => {
    const n = inUse.get(name) - 1;
    if (n > 0) inUse.set(name, n);
    else inUse.delete(name);
  };
}

/**
 * Changes the language after the bundles of the mounted pages are loaded in it, so the page
 * swaps text in one render instead of flashing the loading state. A failed load doesn't block
 * the switch: the page then shows its own error state. Only the latest call switches.
 */
let switchSeq = 0;

export async function changeLanguageWithLocales(i18n, lng) {
  const seq = ++switchSeq;
  await Promise.allSettled([...inUse.keys()].map((name) => loadLocale(i18n, name, lng)));
  // EN then PT quickly: PT (already loaded) switches first; the late EN load must not undo it.
  if (seq !== switchSeq) return undefined;
  return i18n.changeLanguage(lng);
}
