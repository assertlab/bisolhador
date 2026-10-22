import { describe, it, expect } from 'vitest';
import { toPullRequestStats, analyzeReviewMetrics, normalizeSnapshotReviewMetrics } from './prReviewStats.js';
import { analyzers } from './analyzers.js';

// Shape returned by the GraphQL query in githubService.fetchPullRequestReviewStats.
const node = ({ author = 'a', mergedBy = null, merged = true, comments = 0, reviewComments = [] } = {}) => ({
  author: author === null ? null : { login: author },
  mergedBy: mergedBy ? { login: mergedBy } : null,
  createdAt: '2026-10-01T00:00:00Z',
  mergedAt: merged ? '2026-10-01T05:00:00Z' : null,
  comments: { totalCount: comments },
  reviews: { nodes: reviewComments.map((n) => ({ comments: { totalCount: n } })) },
});

describe('toPullRequestStats (GraphQL → REST-like shape the analyzers expect)', () => {
  it('maps author, mergedBy, dates and comment counts', () => {
    expect(toPullRequestStats([node({ author: 'a', mergedBy: 'b', comments: 2, reviewComments: [1, 3] })])).toEqual([{
      user: { login: 'a' },
      merged_by: { login: 'b' },
      created_at: '2026-10-01T00:00:00Z',
      merged_at: '2026-10-01T05:00:00Z',
      comments: 2,
      review_comments: 4,
    }]);
  });

  it('keeps deleted (ghost) authors and unmerged PRs as null', () => {
    const [pr] = toPullRequestStats([node({ author: null, merged: false })]);
    expect(pr.user).toBeNull();
    expect(pr.merged_by).toBeNull();
    expect(pr.merged_at).toBeNull();
  });

  it.each([[null], [undefined], ['x']])('returns [] for non-array input (%j)', (input) => {
    expect(toPullRequestStats(input)).toEqual([]);
  });

  // These were `it.fails` in analyzers.test.js against the REST /pulls list,
  // which has no merged_by/comments. With the GraphQL data they now work.
  it('lets analyzeCodeReview detect self-merges', () => {
    const stats = toPullRequestStats([node({ author: 'a', mergedBy: 'a' }), node({ author: 'a', mergedBy: 'a' })]);
    expect(analyzers.analyzeCodeReview(stats)).toEqual({ selfMergePercentage: 100, color: 'red' });
  });

  it('lets calculateDivergence count PR discussion', () => {
    const stats = toPullRequestStats([node({ comments: 4, reviewComments: [4] }), node({ comments: 2 })]);
    expect(analyzers.calculateDivergence(stats)).toEqual({ avg: 5, categoryKey: 'repo.divergenceMedium' });
  });
});

describe('analyzeReviewMetrics', () => {
  it('computes both metrics and marks them available when data exists', () => {
    const stats = toPullRequestStats([node({ author: 'a', mergedBy: 'b', comments: 1 })]);
    expect(analyzeReviewMetrics(stats)).toEqual({
      codeReview: { selfMergePercentage: 0, color: 'green', available: true },
      divergence: { avg: 1, categoryKey: 'repo.divergenceMedium' },
    });
  });

  it.each([
    ['noToken', 'repo.divergenceNeedsToken'],
    ['error', 'repo.divergenceUnavailable'],
  ])('marks both unavailable with reason %s (no fake 0%%)', (reason, categoryKey) => {
    expect(analyzeReviewMetrics(null, reason)).toEqual({
      codeReview: { selfMergePercentage: null, color: 'gray', available: false, reason },
      divergence: { avg: null, categoryKey },
    });
  });
});

describe('normalizeSnapshotReviewMetrics (reading persisted full_report)', () => {
  const report = (codeReview, divergence) => ({ codeReview, metrics: { divergence } });
  const UNAVAILABLE = {
    codeReview: { selfMergePercentage: null, color: 'gray', available: false, reason: 'snapshot' },
    divergence: { avg: null, categoryKey: 'repo.divergenceUnavailable' },
  };

  it('treats pre-fix snapshots (no `available`) as unavailable: their 0% came from data without merged_by', () => {
    const legacy = report({ selfMergePercentage: 0, color: 'green' }, { avg: 0, categoryKey: 'repo.divergenceLow' });
    const normalized = normalizeSnapshotReviewMetrics(legacy);
    expect(normalized.codeReview).toEqual(UNAVAILABLE.codeReview);
    expect(normalized.metrics.divergence).toEqual(UNAVAILABLE.divergence);
  });

  it.each(['noToken', 'error'])('rewrites reason %s to "snapshot" (adding a token cannot refetch a snapshot)', (reason) => {
    const saved = report({ ...UNAVAILABLE.codeReview, reason }, { avg: null, categoryKey: 'repo.divergenceNeedsToken' });
    const normalized = normalizeSnapshotReviewMetrics(saved);
    expect(normalized.codeReview.reason).toBe('snapshot');
    expect(normalized.metrics.divergence.categoryKey).toBe('repo.divergenceUnavailable');
  });

  it('keeps real measured values', () => {
    const saved = report({ selfMergePercentage: 79, color: 'red', available: true }, { avg: 0.7, categoryKey: 'repo.divergenceLow' });
    expect(normalizeSnapshotReviewMetrics(saved)).toEqual(saved);
  });

  it('does not touch other fields or mutate the input', () => {
    const legacy = { fullName: 'o/r', codeReview: { selfMergePercentage: 0 }, metrics: { stars: 3, divergence: { avg: 0 } } };
    const copy = structuredClone(legacy);
    const normalized = normalizeSnapshotReviewMetrics(legacy);
    expect(legacy).toEqual(copy);
    expect(normalized.fullName).toBe('o/r');
    expect(normalized.metrics.stars).toBe(3);
  });
});
