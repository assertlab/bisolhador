import { describe, it, expect } from 'vitest';
import {
  percentile, formatDuration, analyzeLeadTime, leadTimeDays, toPullRequestStats, analyzeReviewMetrics, normalizeSnapshotProcessMetrics,
} from './prReviewStats.js';

const HOUR = 60 * 60 * 1000;
const T0 = Date.UTC(2026, 9, 1);
const iso = (ms) => new Date(ms).toISOString();

// REST /pulls?state=closed item
const restPr = ({ login = 'a', type = 'User', hours, mergedAtMs = T0 } = {}) => ({
  user: { login, type },
  created_at: iso(mergedAtMs - (hours ?? 1) * HOUR),
  merged_at: hours == null ? null : iso(mergedAtMs),
});

// GraphQL merged-PR node (githubService.fetchPullRequestReviewStats)
const user = (login) => ({ login, __typename: /\[bot\]$/.test(login) ? 'Bot' : 'User' });
const node = ({ author = 'a', mergedBy = 'a', approvedBy = [], comments = [], reviewComments = 0, mergedAtMs = T0, additions = 10, deletions = 5, readyAtMs, firstReviews = [] } = {}) => ({
  additions,
  deletions,
  readyForReview: { nodes: readyAtMs == null ? [] : [{ createdAt: iso(readyAtMs) }] },
  firstReviews: { nodes: firstReviews.map(([login, ms]) => ({ submittedAt: iso(ms), author: user(login) })) },
  author: author === null ? null : user(author),
  mergedBy: mergedBy ? { login: mergedBy } : null,
  createdAt: iso(mergedAtMs - HOUR),
  mergedAt: iso(mergedAtMs),
  comments: { totalCount: comments.length, nodes: comments.map((c) => ({ author: user(c) })) },
  reviews: {
    nodes: [
      ...approvedBy.map((r) => ({ state: 'APPROVED', author: user(r), comments: { totalCount: 0 } })),
      ...(reviewComments ? [{ state: 'COMMENTED', author: user('rev'), comments: { totalCount: reviewComments } }] : []),
    ],
  },
});

describe('percentile / formatDuration', () => {
  it('median and p90 with interpolation', () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBeCloseTo(9.1);
    expect(percentile([], 0.5)).toBeNull();
  });

  it.each([[2.46, { value: 2.5, unit: 'hours' }], [24, { value: 1, unit: 'days' }], [36, { value: 1.5, unit: 'days' }]])('%s h → %j', (h, out) => {
    expect(formatDuration(h)).toEqual(out);
  });
});

describe('analyzeLeadTime (median over merged PRs, not mean over created ones)', () => {
  it('median + p90 + n; unmerged PRs ignored', () => {
    const prs = [restPr({ hours: 1 }), restPr({ hours: 2 }), restPr({ hours: 100 }), restPr({ hours: null })];
    expect(analyzeLeadTime(prs)).toMatchObject({ value: 2, unit: 'hours', count: 2, medianHours: 2, n: 3, method: 'median' });
  });

  it('one slow PR does not drag the result like the mean did', () => {
    const prs = [1, 1, 1, 1, 500].map((hours) => restPr({ hours }));
    expect(analyzeLeadTime(prs).medianHours).toBe(1); // mean would be 100.8 h
  });

  it('excludes bots (dependabot PRs merge in minutes)', () => {
    const prs = [restPr({ hours: 48 }), restPr({ login: 'dependabot[bot]', type: 'Bot', hours: 0.1 })];
    expect(analyzeLeadTime(prs)).toMatchObject({ value: 2, unit: 'days', n: 1, botsExcluded: 1 });
  });

  it('keeps only the 50 most recently merged', () => {
    const prs = Array.from({ length: 60 }, (_, i) => restPr({ hours: i < 10 ? 1000 : 1, mergedAtMs: T0 - i * HOUR * (i < 10 ? -1 : 1) }));
    expect(analyzeLeadTime(prs).n).toBe(50);
  });

  it('no merged PRs → N/A with reason (not a fake 0)', () => {
    expect(analyzeLeadTime([restPr({ hours: null })])).toMatchObject({ value: 'N/A', count: null, n: 0, reason: 'noMerged', method: 'median' });
  });

  it('records the sample source; Benchmark gets days only for the current method', () => {
    const lt = analyzeLeadTime([restPr({ hours: 36 })], 'graphql');
    expect(lt.source).toBe('graphql');
    expect(leadTimeDays(lt)).toBe(1.5);
    expect(leadTimeDays({ value: 7.7, unit: 'hours', count: 7.7 })).toBeNull(); // old mean, no method
  });

  it('request failed → unavailable "error", no method (never persisted as measured)', () => {
    expect(analyzeLeadTime(null)).toEqual({ value: 'N/A', unit: '', count: null, n: 0, reason: 'error' });
  });
});

describe('toPullRequestStats', () => {
  it('counts human comments only and approvals from someone else', () => {
    const [pr] = toPullRequestStats([node({ author: 'a', approvedBy: ['b'], comments: ['meta-cla[bot]', 'github-actions[bot]', 'b'], reviewComments: 3 })]);
    expect(pr).toMatchObject({ user: { login: 'a', type: 'User' }, comments: 1, review_comments: 3, approvedByOther: true });
  });

  it('an approval submitted after the merge is not a review before it', () => {
    const n = node({ approvedBy: ['b'] });
    n.reviews.nodes[0].submittedAt = iso(T0 + HOUR);
    expect(toPullRequestStats([n])[0].approvedByOther).toBe(false);
    n.reviews.nodes[0].submittedAt = iso(T0 - HOUR);
    expect(toPullRequestStats([n])[0].approvedByOther).toBe(true);
  });

  it('author approving their own PR or a bot approving is not an approval', () => {
    expect(toPullRequestStats([node({ author: 'a', approvedBy: ['a'] })])[0].approvedByOther).toBe(false);
    expect(toPullRequestStats([node({ author: 'a', approvedBy: ['auto-approve[bot]'] })])[0].approvedByOther).toBe(false);
  });

  it('comments beyond the fetched page count as human', () => {
    const n = node({ comments: ['x[bot]'] });
    n.comments.totalCount = 150;
    expect(toPullRequestStats([n])[0].comments).toBe(149);
  });

  it.each([[null], [undefined], ['x']])('returns [] for non-array input (%j)', (input) => {
    expect(toPullRequestStats(input)).toEqual([]);
  });
});

describe('analyzeReviewMetrics', () => {
  it('react case: self-merged but approved by someone else is reviewed', () => {
    const stats = toPullRequestStats([
      node({ author: 'a', mergedBy: 'a', approvedBy: ['b'] }),
      node({ author: 'a', mergedBy: 'a', approvedBy: ['c'] }),
      node({ author: 'a', mergedBy: 'a' }),
      node({ author: 'c', mergedBy: 'd' }),
    ]);
    expect(analyzeReviewMetrics(stats).codeReview).toEqual({
      unapprovedPercentage: 50, selfMergePercentage: 75, color: 'red', available: true, n: 4, botsExcluded: 0, method: 'approval',
    });
  });

  it.each([[10, 'green'], [30, 'yellow'], [60, 'red']])('%s%% unapproved → %s', (pct, color) => {
    const prs = Array.from({ length: 10 }, (_, i) => node({ approvedBy: i < pct / 10 ? [] : ['b'] }));
    expect(analyzeReviewMetrics(toPullRequestStats(prs)).codeReview).toMatchObject({ unapprovedPercentage: pct, color });
  });

  it('divergence: human comments per merged PR, bot-authored PRs excluded', () => {
    const stats = toPullRequestStats([
      node({ comments: ['b', 'c', 'meta-cla[bot]'], reviewComments: 2 }),
      node({ comments: [] }),
      node({ author: 'renovate[bot]', comments: ['x', 'y', 'z'] }),
    ]);
    expect(analyzeReviewMetrics(stats).divergence).toEqual({ avg: 2, categoryKey: 'repo.divergenceMedium', n: 2, method: 'approval' });
  });

  it('no merged human PRs → unavailable with reason noMerged (not "0%")', () => {
    const { codeReview, divergence } = analyzeReviewMetrics(toPullRequestStats([node({ author: 'dependabot[bot]' })]));
    expect(codeReview).toMatchObject({ available: false, reason: 'noMerged', unapprovedPercentage: null, botsExcluded: 1 });
    expect(divergence).toMatchObject({ avg: null, categoryKey: 'repo.divergenceNone' });
  });

  it.each([
    ['noToken', 'repo.divergenceNeedsToken'],
    ['error', 'repo.divergenceUnavailable'],
  ])('null data: both unavailable with reason %s', (reason, categoryKey) => {
    expect(analyzeReviewMetrics(null, reason)).toEqual({
      codeReview: { unapprovedPercentage: null, selfMergePercentage: null, color: 'gray', available: false, reason },
      divergence: { avg: null, categoryKey },
      reviewProcess: { available: false, reason },
    });
  });
});

describe('normalizeSnapshotProcessMetrics (reading persisted full_report)', () => {
  const current = {
    reviewProcess: { available: true, firstReview: { medianHours: 5, p90Hours: 30, n: 40 }, method: 'ready-first-review' },
    codeReview: { unapprovedPercentage: 40, selfMergePercentage: 70, color: 'yellow', available: true, n: 50, method: 'approval' },
    metrics: {
      stars: 3,
      leadTime: { value: 6, unit: 'days', count: 6, n: 50, method: 'median' },
      divergence: { avg: 0.4, categoryKey: 'repo.divergenceLow', n: 50, method: 'approval' },
    },
  };

  it('keeps values measured with the current method', () => {
    expect(normalizeSnapshotProcessMetrics(current)).toEqual(current);
  });

  it('old method (created PRs, mean, self-merge) → not recorded', () => {
    const old = {
      codeReview: { selfMergePercentage: 79, color: 'red', available: true },
      metrics: { leadTime: { value: 2.5, unit: 'hours', count: 2.5 }, divergence: { avg: 1.2, categoryKey: 'repo.divergenceMedium' } },
    };
    const normalized = normalizeSnapshotProcessMetrics(old);
    expect(normalized.codeReview).toMatchObject({ available: false, reason: 'snapshot', unapprovedPercentage: null });
    expect(normalized.metrics.divergence).toEqual({ avg: null, categoryKey: 'repo.divergenceUnavailable' });
    expect(normalized.metrics.leadTime).toMatchObject({ value: 'N/A', reason: 'snapshot' });
  });

  it.each(['noToken', 'error'])('saved as unavailable (%s) → "snapshot" (a token cannot refetch it)', (reason) => {
    const saved = { codeReview: { available: false, reason }, metrics: { divergence: { avg: null } } };
    expect(normalizeSnapshotProcessMetrics(saved).codeReview.reason).toBe('snapshot');
  });

  it('noMerged is a measured fact and survives', () => {
    const saved = { codeReview: { available: false, reason: 'noMerged', method: 'approval' }, metrics: { leadTime: { value: 'N/A', reason: 'noMerged', method: 'median' } } };
    const normalized = normalizeSnapshotProcessMetrics(saved);
    expect(normalized.codeReview.reason).toBe('noMerged');
    expect(normalized.metrics.leadTime.reason).toBe('noMerged');
  });

  it('does not mutate the input or drop other fields', () => {
    const old = { fullName: 'o/r', codeReview: { selfMergePercentage: 0 }, metrics: { stars: 3, leadTime: { value: 1 } } };
    const copy = structuredClone(old);
    const normalized = normalizeSnapshotProcessMetrics(old);
    expect(old).toEqual(copy);
    expect(normalized.fullName).toBe('o/r');
    expect(normalized.metrics.stars).toBe(3);
  });
});

describe('reviewProcess: coverage, time to first review, PR size', () => {
  const H = HOUR;
  it('first review by someone else, from "ready for review" (drafts are not waiting yet)', () => {
    const stats = toPullRequestStats([
      // created T0-10h, ready T0-4h, reviewed T0-2h → 2h
      node({ readyAtMs: T0 - 4 * H, firstReviews: [['b', T0 - 2 * H]] }),
      // not a draft: created T0-1h (helper), reviewed T0-0.5h → 0.5h
      node({ firstReviews: [['c', T0 - 0.5 * H]] }),
      // only the author and a bot "reviewed" → no review
      node({ firstReviews: [['a', T0 - 0.9 * H], ['ci[bot]', T0 - 0.8 * H]] }),
    ]);
    stats[0].created_at = iso(T0 - 10 * H);
    const { reviewProcess } = analyzeReviewMetrics(stats);
    expect(reviewProcess.firstReview).toEqual({ medianHours: 1.3, p90Hours: 1.9, n: 2 });
    expect(reviewProcess.coverage).toMatchObject({ reviewedPercentage: 67, n: 3 });
  });

  it('coverage: approved by someone else is the complement of the "unapproved" badge', () => {
    const stats = toPullRequestStats([node({ approvedBy: ['b'] }), node({ approvedBy: ['c'] }), node(), node()]);
    const { codeReview, reviewProcess } = analyzeReviewMetrics(stats);
    expect(reviewProcess.coverage.approvedPercentage).toBe(50);
    expect(codeReview.unapprovedPercentage).toBe(50);
  });

  it('PR size: median changed lines and share under 400', () => {
    const stats = toPullRequestStats([node({ additions: 10, deletions: 0 }), node({ additions: 300, deletions: 50 }), node({ additions: 900, deletions: 100 })]);
    expect(analyzeReviewMetrics(stats).reviewProcess.prSize).toEqual({ medianLines: 350, smallPercentage: 67, n: 3 });
  });

  it('timing/size query failed → those indicators unavailable, not "0% reviewed"', () => {
    const nodes = [node({ firstReviews: [['b', T0 - 0.5 * HOUR]] }), node()].map((n) => ({ ...n, timingFailed: true, sizeFailed: true }));
    const { reviewProcess } = analyzeReviewMetrics(toPullRequestStats(nodes));
    expect(reviewProcess.firstReview).toMatchObject({ unavailable: true, n: 0 });
    expect(reviewProcess.coverage.reviewedPercentage).toBeNull();
    expect(reviewProcess.prSize).toMatchObject({ unavailable: true, n: 0 });
  });

  it('a PR missing from a loaded timing list is left out, the rest still counts', () => {
    const nodes = [node({ firstReviews: [['b', T0 - 0.5 * HOUR]] }), { ...node(), timingUnknown: true }];
    const { reviewProcess } = analyzeReviewMetrics(toPullRequestStats(nodes));
    expect(reviewProcess.firstReview).toMatchObject({ medianHours: 0.5, n: 1 });
    expect(reviewProcess.coverage.reviewedPercentage).toBe(100);
  });

  it('a review after the merge is not a first review (same rule as approvals)', () => {
    const [pr] = toPullRequestStats([node({ firstReviews: [['b', T0 + HOUR]] })]);
    expect(pr.firstReviewAt).toBeNull();
  });

  it('approved % is the exact complement of the badge (no 101%)', () => {
    const prs = Array.from({ length: 8 }, (_, i) => node({ approvedBy: i < 1 ? ['b'] : [] }));
    const { codeReview, reviewProcess } = analyzeReviewMetrics(toPullRequestStats(prs));
    expect(codeReview.unapprovedPercentage + reviewProcess.coverage.approvedPercentage).toBe(100);
  });

  it('old snapshots (no reviewProcess) → not recorded', () => {
    expect(normalizeSnapshotProcessMetrics({ metrics: {} }).reviewProcess).toEqual({ available: false, reason: 'snapshot' });
  });
});
