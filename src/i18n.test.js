import { describe, it, expect } from 'vitest';
import { normalizeLanguage, intlLocale } from './i18n.js';

describe('normalizeLanguage (browser codes → supported UI language)', () => {
  it.each([
    ['pt-BR', 'pt'], ['pt', 'pt'], ['pt_PT', 'pt'], ['PT-br', 'pt'],
    ['en-US', 'en'], ['en-GB', 'en'], ['en', 'en'],
    ['es-ES', 'pt'], ['fr', 'pt'], [undefined, 'pt'], ['', 'pt'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeLanguage(input)).toBe(expected);
  });
});

describe('intlLocale', () => {
  it.each([['pt', 'pt-BR'], ['pt-BR', 'pt-BR'], ['en', 'en-US'], ['en-GB', 'en-US'], ['es', 'pt-BR']])('%s → %s', (lng, locale) => {
    expect(intlLocale(lng)).toBe(locale);
  });
});
