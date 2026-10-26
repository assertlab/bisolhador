import { describe, it, expect, vi } from 'vitest';
import i18next from 'i18next';
import pt from '../locales/pt.json';
import en from '../locales/en.json';
import { loadLocale, markLocaleInUse, changeLanguageWithLocales } from './lazyLocales.js';

// Slow en chunks: each import waits until its gate is opened.
const gates = vi.hoisted(() => {
  const gate = () => { let open; const promise = new Promise((r) => { open = r; }); return { promise, open }; };
  return { aiGuide: gate(), guide: gate() };
});
vi.mock('../locales/aiGuide.en.json', async () => { await gates.aiGuide.promise; return { default: { aiGuide: { title: 'AI EN' } } }; });
vi.mock('../locales/guide.en.json', async () => { await gates.guide.promise; return { default: { guide: { title: 'Guide EN' } } }; });

async function makeI18n() {
  const instance = i18next.createInstance();
  await instance.init({ lng: 'pt', fallbackLng: 'pt', resources: structuredClone({ pt: { translation: pt }, en: { translation: en } }) });
  return instance;
}

describe('language switch with slow lazy bundles', () => {
  it('a slow switch that resolves late does not override a newer choice', async () => {
    const i18n = await makeI18n();
    await loadLocale(i18n, 'aiGuide', 'pt');
    const release = markLocaleInUse('aiGuide');
    const toEn = changeLanguageWithLocales(i18n, 'en'); // waits for the en chunk
    await changeLanguageWithLocales(i18n, 'pt'); // pt already loaded: switches now
    gates.aiGuide.open();
    await toEn;
    release();
    expect(i18n.language).toBe('pt');
  });

  it('a lone slow switch still ends in the requested language, with its texts', async () => {
    const i18n = await makeI18n();
    await loadLocale(i18n, 'guide', 'pt');
    const release = markLocaleInUse('guide');
    const toEn = changeLanguageWithLocales(i18n, 'en');
    expect(i18n.language).toBe('pt');
    gates.guide.open();
    await toEn;
    release();
    expect(i18n.language).toBe('en');
    expect(i18n.t('guide.title')).toBe('Guide EN');
  });
});
