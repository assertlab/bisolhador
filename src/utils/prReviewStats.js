import { isBot, round1 } from './contributors.js';
import { MERGED_PR_SAMPLE } from '../constants.js';

// PR process metrics: lead time, merged-without-approval rate and divergence.
// All three are measured over the latest merged PRs by humans (up to
// MERGED_PR_SAMPLE, by merge date, among the recently updated ones fetched).
// Before 2026-10 they used the 20 most recently *created* PRs: in active repos
// those are mostly still open, so lead time was biased low (or N/A) and the
// review rate read "0%" (react, express). Lead time was also a mean, often far
// above the median (react: ~19×).
//
// Persisted reports carry `method`; reports without it were measured the old
// way and are shown as "not recorded" (normalizeSnapshotProcessMetrics).
const LEAD_TIME_METHOD = 'median';
const REVIEW_METHOD = 'approval';

const HOUR_MS = 60 * 60 * 1000;
const toAuthor = (a) => (a ? { login: a.login, type: a.__typename } : null);
const byMergedDesc = (a, b) => Date.parse(b.merged_at) - Date.parse(a.merged_at);

/** Linear-interpolated percentile of an ascending array (p in [0, 1]). */
export function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** Hours → { value, unit }: hours under a day, days otherwise (one decimal). */
export function formatDuration(hours) {
  return hours < 24 ? { value: round1(hours), unit: 'hours' } : { value: round1(hours / 24), unit: 'days' };
}

/** The sample every metric uses: latest merged PRs by humans. */
function mergedSample(prs) {
  const merged = prs.filter((pr) => pr.merged_at && pr.created_at);
  const humans = merged.filter((pr) => !isBot(pr.user));
  return { sample: humans.sort(byMergedDesc).slice(0, MERGED_PR_SAMPLE), botsExcluded: merged.length - humans.length };
}

function leadTimeUnavailable(reason, extra = {}) {
  return { value: 'N/A', unit: '', count: null, n: 0, reason, ...extra };
}

/**
 * Lead time (creation → merge): median over the latest MERGED_PR_SAMPLE merged
 * PRs by humans, plus p90 and n. Input: the GraphQL merged sample (with a
 * token, same PRs as review/divergence) or the REST list of recently updated
 * closed PRs (githubService.fetchPullRequestStats). `source` records which, so
 * history can tell the samples apart. `count` mirrors `value` for old readers.
 *
 * @param {Array|null} prs - null when the request failed
 * @param {'graphql'|'rest'} source
 */
export function analyzeLeadTime(prs, source) {
  if (!Array.isArray(prs)) return leadTimeUnavailable('error');
  const { sample, botsExcluded } = mergedSample(prs);
  if (sample.length === 0) return leadTimeUnavailable('noMerged', { botsExcluded, source, method: LEAD_TIME_METHOD });
  const hours = sample.map((pr) => (Date.parse(pr.merged_at) - Date.parse(pr.created_at)) / HOUR_MS).sort((a, b) => a - b);
  const median = percentile(hours, 0.5);
  const { value, unit } = formatDuration(median);
  return {
    value, unit, count: value,
    medianHours: round1(median),
    p90Hours: round1(percentile(hours, 0.9)),
    n: sample.length,
    botsExcluded,
    source,
    method: LEAD_TIME_METHOD,
  };
}

/** Median lead time in days for comparisons (Benchmark); null when not measured with the current method. */
export function leadTimeDays(leadTime) {
  return leadTime?.method === LEAD_TIME_METHOD && leadTime.medianHours != null ? round1(leadTime.medianHours / 24) : null;
}

/**
 * Maps GraphQL merged-PR nodes (githubService.fetchPullRequestReviewStats) to
 * the fields the analyzers read. Bot comments and bot reviews don't count:
 * in react, 22 of 24 comments were from meta-cla/github-actions.
 */
export function toPullRequestStats(nodes) {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((pr) => {
    const comments = pr.comments?.nodes ?? [];
    const botComments = comments.filter((c) => isBot(toAuthor(c.author))).length;
    const humanReviews = (pr.reviews?.nodes ?? []).filter((r) => r.author && !isBot(toAuthor(r.author)));
    // An approval submitted after the merge doesn't count as review before it
    const approvedBeforeMerge = (r) => r.state === 'APPROVED' && r.author.login !== pr.author?.login
      && !(r.submittedAt && pr.mergedAt && Date.parse(r.submittedAt) > Date.parse(pr.mergedAt));
    return {
      user: toAuthor(pr.author),
      merged_by: pr.mergedBy ? { login: pr.mergedBy.login } : null,
      created_at: pr.createdAt,
      merged_at: pr.mergedAt,
      // totalCount beyond the fetched page is assumed human
      comments: (pr.comments?.totalCount ?? comments.length) - botComments,
      review_comments: humanReviews.reduce((sum, r) => sum + (r.comments?.totalCount ?? 0), 0),
      approvedByOther: humanReviews.some(approvedBeforeMerge),
    };
  });
}

const levelColor = (pct) => (pct < 20 ? 'green' : pct < 50 ? 'yellow' : 'red');

const DIVERGENCE_UNAVAILABLE_KEY = {
  noToken: 'repo.divergenceNeedsToken',
  error: 'repo.divergenceUnavailable',
  snapshot: 'repo.divergenceUnavailable',
};

function unavailable(reason) {
  return {
    codeReview: { unapprovedPercentage: null, selfMergePercentage: null, color: 'gray', available: false, reason },
    divergence: { avg: null, categoryKey: DIVERGENCE_UNAVAILABLE_KEY[reason] },
  };
}

function divergenceCategory(avg) {
  if (avg < 1) return 'repo.divergenceLow';
  if (avg <= 5) return 'repo.divergenceMedium';
  return 'repo.divergenceHigh';
}

/**
 * Review metrics over the latest merged PRs by humans:
 * - codeReview.unapprovedPercentage: merged without an APPROVED review from
 *   someone other than the author (what "reviewed" means). Self-merge alone
 *   isn't it: in react, 65 of 66 self-merges had been approved by someone else.
 * - divergence: human comments per PR.
 * Without data both are explicitly unavailable, never a 0% that looks real.
 *
 * @param {Array|null} prStats - toPullRequestStats() output, or null
 * @param {'noToken'|'error'} [reason] - why prStats is null
 */
export function analyzeReviewMetrics(prStats, reason) {
  if (!prStats) return unavailable(reason);
  const { sample, botsExcluded } = mergedSample(prStats);
  const n = sample.length;
  if (n === 0) {
    return {
      codeReview: { unapprovedPercentage: null, selfMergePercentage: null, color: 'gray', available: false, reason: 'noMerged', n, botsExcluded, method: REVIEW_METHOD },
      divergence: { avg: null, categoryKey: 'repo.divergenceNone', n, method: REVIEW_METHOD },
    };
  }
  const unapproved = Math.round((sample.filter((pr) => !pr.approvedByOther).length / n) * 100);
  const selfMerged = Math.round((sample.filter((pr) => pr.user && pr.merged_by?.login === pr.user.login).length / n) * 100);
  const avg = sample.reduce((sum, pr) => sum + pr.comments + pr.review_comments, 0) / n;
  return {
    codeReview: { unapprovedPercentage: unapproved, selfMergePercentage: selfMerged, color: levelColor(unapproved), available: true, n, botsExcluded, method: REVIEW_METHOD },
    divergence: { avg: round1(avg), categoryKey: divergenceCategory(avg), n, method: REVIEW_METHOD },
  };
}

/**
 * Applied when a persisted full_report is shown. Values without the current
 * `method` were measured over recently *created* PRs (mean lead time, self-merge
 * rate, bots included; before v3.6.4 review metrics were always 0) and aren't
 * comparable: they become "not recorded" (reason 'snapshot'). Reports saved as
 * unavailable for noToken/error also become 'snapshot': a snapshot is never
 * refetched, so "add a token" is useless. Returns a new object.
 */
export function normalizeSnapshotProcessMetrics(report) {
  const metrics = { ...report?.metrics };
  let { codeReview } = report ?? {};
  if (codeReview?.method !== REVIEW_METHOD) {
    const fallback = unavailable('snapshot');
    codeReview = fallback.codeReview;
    metrics.divergence = fallback.divergence;
  }
  if (metrics.leadTime?.method !== LEAD_TIME_METHOD) metrics.leadTime = leadTimeUnavailable('snapshot');
  return { ...report, codeReview, metrics };
}
