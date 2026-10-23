import { describe, it, expect } from 'vitest';
import { analyzers } from './analyzers.js';

describe('calculateHealthScore (7 criteria)', () => {
  const allFiles = {
    readme: {}, license: {}, contributing: {}, code_of_conduct: {}, issue_template: {}, pull_request_template: {},
  };

  it('scores 100 with all 6 community files plus a description', () => {
    const { score, files } = analyzers.calculateHealthScore({ files: allFiles }, 'A repo');
    expect(score).toBe(100);
    expect(Object.values(files).every(Boolean)).toBe(true);
  });

  it('scores 0 with no profile and no description', () => {
    expect(analyzers.calculateHealthScore(null, null).score).toBe(0);
  });

  it('rounds items/7 to an integer percentage', () => {
    // 3 of 7 → 42.86 → 43
    const { score } = analyzers.calculateHealthScore({ files: { readme: {}, license: {} } }, 'desc');
    expect(score).toBe(43);
  });

  it('treats a whitespace-only description as missing', () => {
    expect(analyzers.calculateHealthScore(null, '   ').files.hasDescription).toBe(false);
  });

  it('treats null file entries (GitHub API shape) as missing', () => {
    const { files } = analyzers.calculateHealthScore({ files: { readme: null, license: {} } }, '');
    expect(files.hasReadme).toBe(false);
    expect(files.hasLicense).toBe(true);
  });
});

describe('calculateCodeChurn (additions/deletions, last 10 weeks)', () => {
  // Real /stats/code_frequency shape: deletions come NEGATIVE, e.g. [1792281600, 989, -1243].
  const week = (additions, deletions) => [0, additions, -deletions];

  it('is null without data', () => {
    expect(analyzers.calculateCodeChurn([])).toEqual({ ratio: null, category: null });
  });

  it.each([
    [[week(110, 10)], '11.00', 'Acúmulo Intenso (Pouca Refatoração)'],
    [[week(20, 10)], '2.00', 'Saudável (Evolução com Limpeza)'],
    [[week(10, 10)], '1.00', 'Refatoração Agressiva'],
    [[week(5, 0)], 'Infinity', 'Acúmulo Intenso (Pouca Refatoração)'],
    [[week(0, 0)], '0.00', 'Refatoração Agressiva'],
  ])('%j → ratio %s', (data, ratio, category) => {
    expect(analyzers.calculateCodeChurn(data)).toEqual({ ratio, category });
  });

  it('handles the real API sign convention (regression: active repos showed Infinity)', () => {
    expect(analyzers.calculateCodeChurn([[1792281600, 989, -1243]])).toEqual({ ratio: '0.80', category: 'Refatoração Agressiva' });
  });

  it('only counts the last 10 weeks', () => {
    // An old week with huge deletions must not affect the ratio.
    const data = [week(0, 1000), ...Array.from({ length: 10 }, () => week(30, 10))];
    expect(analyzers.calculateCodeChurn(data).ratio).toBe('3.00');
  });
});
