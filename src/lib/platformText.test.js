import { describe, it, expect, vi } from 'vitest';
import { withPlatform } from './platformText.js';
import pt from '../locales/pt.json';
import en from '../locales/en.json';
import reportPt from '../locales/report.pt.json';
import reportEn from '../locales/report.en.json';

describe('withPlatform', () => {
  it('GitLab reports ask for the gitlab context; GitHub and snapshots without provider keep the same t', () => {
    const t = vi.fn((key) => key);
    withPlatform(t, 'gitlab')('stats.issuesDisabled', { count: 2 });
    expect(t).toHaveBeenCalledWith('stats.issuesDisabled', expect.objectContaining({ context: 'gitlab', count: 2 }));
    expect(withPlatform(t, 'github')).toBe(t);
    expect(withPlatform(t, undefined)).toBe(t);
  });
});

// Every `<key>_gitlab` variant: its base key exists (i18next falls back to it) and both languages have it.
function variants(tree, prefix = '') {
  return Object.entries(tree).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === 'object' ? variants(v, path) : [path];
  });
}

describe('GitLab text variants', () => {
  it.each([['main', pt, en], ['report', reportPt, reportEn]])('%s locale: base key present, pt and en in sync', (_, ptTree, enTree) => {
    const ptKeys = variants(ptTree);
    const enKeys = new Set(variants(enTree));
    const gitlab = ptKeys.filter((k) => /_gitlab$/.test(k));
    expect(gitlab.length).toBeGreaterThan(0);
    for (const key of gitlab) {
      expect(ptKeys, key).toContain(key.replace(/_gitlab$/, ''));
      expect(enKeys.has(key), key).toBe(true);
    }
    expect([...enKeys].filter((k) => /_gitlab$/.test(k)).sort()).toEqual(gitlab.sort());
  });

  it('no GitLab variant mentions GitHub', () => {
    for (const tree of [pt, en, reportPt, reportEn]) {
      for (const key of variants(tree).filter((k) => /_gitlab$/.test(k))) {
        const value = key.split('.').reduce((node, part) => node[part], tree);
        expect(value, key).not.toMatch(/GitHub/);
      }
    }
  });
});

// Any component can end up inside a report: they all use usePlatformTranslation (same `t` outside
// a report) and PlatformTrans instead of Trans, or the `_gitlab` variants are skipped silently.
describe('components use the platform-aware t', () => {
  const files = import.meta.glob('../components/**/*.jsx', { query: '?raw', import: 'default', eager: true });

  it('no component imports useTranslation directly', () => {
    expect(Object.keys(files).length).toBeGreaterThan(20);
    for (const [path, source] of Object.entries(files)) {
      expect(/import\s*\{[^}]*\buseTranslation\b[^}]*\}\s*from\s*['"]react-i18next['"]/.test(source), path).toBe(false);
    }
  });

  it('no component imports Trans directly (PlatformTrans carries the platform t)', () => {
    for (const [path, source] of Object.entries(files)) {
      expect(/import\s*\{[^}]*\bTrans\b[^}]*\}\s*from\s*['"]react-i18next['"]/.test(source), path).toBe(false);
    }
  });
});

describe('gitlabLimits', () => {
  it('numbers from the constants, formatted per language', async () => {
    const { gitlabLimits } = await import('./platformText.js');
    expect(gitlabLimits('pt-BR')).toMatchObject({ commitCap: '1.000', treeCap: '1.000', countLimit: '10.000' });
    expect(gitlabLimits('en-US')).toMatchObject({ commitCap: '1,000', countLimit: '10,000' });
  });

  it('a GitLab t fills them in; the context survives a caller passing context: undefined (<Trans> does)', () => {
    const t = vi.fn((key) => key);
    withPlatform(t, 'gitlab')('x', { context: undefined, count: 1 });
    expect(t.mock.calls[0][1]).toMatchObject({ context: 'gitlab', count: 1, commitCap: expect.any(String) });
  });
});
