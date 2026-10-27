import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import i18next from 'i18next';
import pt from '../locales/pt.json';
import en from '../locales/en.json';
import guidePt from '../locales/guide.pt.json';
import guideEn from '../locales/guide.en.json';
import aiGuideEn from '../locales/aiGuide.en.json';
import { LAZY_LOCALE_NAMES, bundleLanguage, isLocaleLoaded, loadLocale, markLocaleInUse, changeLanguageWithLocales } from './lazyLocales.js';

async function makeI18n(lng = 'pt') {
  const instance = i18next.createInstance();
  await instance.init({ lng, fallbackLng: 'pt', resources: structuredClone({ pt: { translation: pt }, en: { translation: en } }) });
  return instance;
}

describe('lazy locale bundles', () => {
  it('the main locales do not carry the page-only namespaces (they would go back into the entry bundle)', () => {
    for (const name of LAZY_LOCALE_NAMES) {
      expect(pt, name).not.toHaveProperty(name);
      expect(en, name).not.toHaveProperty(name);
    }
  });
});

// Source files (no tests) under src/, comments stripped.
function sourceFiles() {
  const files = [];
  const walk = (dir) => readdirSync(dir).forEach((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.jsx?$/.test(p) && !p.endsWith('.test.js')) files.push(p);
  });
  walk(fileURLToPath(new URL('..', import.meta.url)));
  return files.map((file) => [file, readFileSync(file, 'utf8').replace(/^\s*(\/\/|\*|\/\*).*$/gm, '')]);
}

const keyPaths = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) => (
  v && typeof v === 'object' && !Array.isArray(v) ? keyPaths(v, `${prefix}${k}.`) : [`${prefix}${k}`]
));

describe('lazy locale bundles: source guards', () => {
  it('only lazyLocales.js imports the page-only files (a static import would put them back in a shared chunk)', () => {
    for (const [file, text] of sourceFiles()) {
      if (file.endsWith(join('lib', 'lazyLocales.js'))) continue;
      expect(text, file).not.toMatch(/locales\/(guide|aiGuide|report)\.(pt|en)\.json/);
    }
  });

  it('only the pages that load a bundle read its keys (anywhere else they would render raw)', () => {
    // The PDF reports (src/report/) load guide + report themselves (generateReport.js, generateRepoReport.js)
    // before rendering, so everything under src/report/ may read those keys
    const owners = {
      guide: [join('pages', 'Guide.jsx'), `${join('src', 'report')}/`],
      aiGuide: [join('pages', 'AiGuide.jsx')],
      report: [`${join('src', 'report')}/`],
    };
    for (const [file, text] of sourceFiles()) {
      for (const [name, ownerFiles] of Object.entries(owners)) {
        if (ownerFiles.some((owner) => file.includes(owner))) continue;
        expect(text, file).not.toMatch(new RegExp(`(?:\\bt\\(|i18nKey=\\{?)\\s*['"\`]${name}\\.`));
      }
    }
  });

  it('the main pt and en locales have the same keys', () => {
    expect(keyPaths(en).sort()).toEqual(keyPaths(pt).sort());
  });
});

describe('lazy locale bundles: loader', () => {
  it('maps UI languages to a bundle language like intlLocale does', () => {
    expect(bundleLanguage('en')).toBe('en');
    expect(bundleLanguage('en-US')).toBe('en');
    expect(bundleLanguage('pt-BR')).toBe('pt');
    expect(bundleLanguage('es')).toBe('pt');
    expect(bundleLanguage(undefined)).toBe('pt');
  });

  it('registers the requested language only, merged into the translation namespace', async () => {
    const i18n = await makeI18n('en');
    expect(isLocaleLoaded(i18n, 'guide')).toBe(false);
    expect(i18n.t('guide.title')).toBe('guide.title');

    await loadLocale(i18n, 'guide');
    expect(isLocaleLoaded(i18n, 'guide', 'en')).toBe(true);
    expect(isLocaleLoaded(i18n, 'guide', 'pt')).toBe(false);
    expect(i18n.t('guide.title')).toBe(guideEn.guide.title);
    expect(i18n.t('header.title')).toBe(en.header.title); // main texts untouched

    await loadLocale(i18n, 'guide', 'pt');
    expect(i18n.t('guide.title', { lng: 'pt' })).toBe(guidePt.guide.title);
  });

  it('rejects an unknown bundle name', async () => {
    await expect(loadLocale(await makeI18n(), 'nope')).rejects.toThrow('nope');
  });

  it('a language switch loads the bundles of mounted pages before changing language', async () => {
    const i18n = await makeI18n('pt');
    await loadLocale(i18n, 'aiGuide');
    const release = markLocaleInUse('aiGuide');
    let loadedWhenChanged = null;
    i18n.on('languageChanged', () => { loadedWhenChanged = isLocaleLoaded(i18n, 'aiGuide', 'en'); });

    await changeLanguageWithLocales(i18n, 'en');
    release();
    expect(loadedWhenChanged).toBe(true);
    expect(i18n.t('aiGuide.title')).toBe(aiGuideEn.aiGuide.title);
    expect(isLocaleLoaded(i18n, 'guide', 'en')).toBe(false); // not mounted, not fetched
  });
});
