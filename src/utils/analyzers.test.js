import { describe, it, expect } from 'vitest';
import { analyzers } from './analyzers.js';


// analyzeCodeReview/calculateDivergence receive GraphQL-backed data mapped by
// toPullRequestStats (see prReviewStats.test.js), not the REST /pulls list,
// which has no merged_by/comments.
const HOUR = 60 * 60 * 1000;
const pr = ({ author = 'a', mergedBy, createdAt = 0, mergedAfterMs, comments = 0, reviewComments = 0 } = {}) => ({
  user: { login: author },
  merged_by: mergedBy ? { login: mergedBy } : null,
  created_at: new Date(createdAt).toISOString(),
  merged_at: mergedAfterMs == null ? null : new Date(createdAt + mergedAfterMs).toISOString(),
  comments,
  review_comments: reviewComments,
});

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

describe('analyzeCodeReview (self-merge rate)', () => {
  it('is gray with no merged PRs', () => {
    expect(analyzers.analyzeCodeReview([])).toEqual({ selfMergePercentage: 0, color: 'gray' });
    expect(analyzers.analyzeCodeReview([pr()])).toEqual({ selfMergePercentage: 0, color: 'gray' });
    expect(analyzers.analyzeCodeReview(null)).toEqual({ selfMergePercentage: 0, color: 'gray' });
  });

  it.each([
    // [self-merged, merged by someone else, percentage, color]
    [1, 9, 10, 'green'],
    [1, 4, 20, 'yellow'],
    [4, 6, 40, 'yellow'],
    [1, 1, 50, 'red'],
    [3, 0, 100, 'red'],
  ])('%i self + %i reviewed → %i%% %s', (self, reviewed, percentage, color) => {
    const prs = [
      ...Array.from({ length: self }, () => pr({ author: 'a', mergedBy: 'a', mergedAfterMs: HOUR })),
      ...Array.from({ length: reviewed }, () => pr({ author: 'a', mergedBy: 'b', mergedAfterMs: HOUR })),
    ];
    expect(analyzers.analyzeCodeReview(prs)).toEqual({ selfMergePercentage: percentage, color });
  });
});

describe('calculateLeadTime', () => {
  it.each([[null], [undefined], [{}]])('is N/A for non-array input (%j)', (input) => {
    expect(analyzers.calculateLeadTime(input)).toEqual({ value: 'N/A', unit: '' });
  });

  it('is N/A with no merged PRs', () => {
    expect(analyzers.calculateLeadTime([pr()])).toEqual({ value: 'N/A', unit: '' });
  });

  it('reports hours below 24h, rounded to one decimal', () => {
    const prs = [pr({ mergedAfterMs: 2 * HOUR }), pr({ mergedAfterMs: 3 * HOUR })];
    expect(analyzers.calculateLeadTime(prs)).toEqual({ value: 2.5, unit: 'hours', count: 2.5 });
  });

  it('switches to days at exactly 24h', () => {
    expect(analyzers.calculateLeadTime([pr({ mergedAfterMs: 24 * HOUR })])).toEqual({ value: 1, unit: 'days', count: 1 });
    expect(analyzers.calculateLeadTime([pr({ mergedAfterMs: 36 * HOUR })])).toEqual({ value: 1.5, unit: 'days', count: 1.5 });
  });

  it('ignores unmerged PRs in the average', () => {
    expect(analyzers.calculateLeadTime([pr({ mergedAfterMs: HOUR }), pr()]).value).toBe(1);
  });
});

describe('calculateDivergence (comments per PR)', () => {
  it('is "none" with no PRs', () => {
    expect(analyzers.calculateDivergence([])).toEqual({ avg: 0, categoryKey: 'repo.divergenceNone' });
  });

  it.each([
    [0, 'repo.divergenceLow'],
    [1, 'repo.divergenceMedium'],
    [5, 'repo.divergenceMedium'],
    [6, 'repo.divergenceHigh'],
  ])('average %i → %s', (avg, categoryKey) => {
    expect(analyzers.calculateDivergence([pr({ comments: avg })])).toEqual({ avg, categoryKey });
  });

  it('sums issue and review comments', () => {
    expect(analyzers.calculateDivergence([pr({ comments: 1, reviewComments: 2 })]).avg).toBe(3);
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
