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

