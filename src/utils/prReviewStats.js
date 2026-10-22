import { analyzers } from './analyzers.js';

// Self-merge rate and divergence need, per PR, who merged it and how many
// comments it got. The REST list (GET /repos/{o}/{r}/pulls) returns neither, so
// until 2026-10 both metrics were always 0. They now come from one GraphQL call
// (githubService.fetchPullRequestReviewStats), which requires a token.

/**
 * Maps GraphQL pull request nodes to the REST field names the analyzers read
 * (user, merged_by, created_at, merged_at, comments, review_comments).
 */
export function toPullRequestStats(nodes) {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((pr) => ({
    user: pr.author ? { login: pr.author.login } : null,
    merged_by: pr.mergedBy ? { login: pr.mergedBy.login } : null,
    created_at: pr.createdAt,
    merged_at: pr.mergedAt,
    comments: pr.comments?.totalCount ?? 0,
    review_comments: (pr.reviews?.nodes ?? []).reduce((sum, review) => sum + (review.comments?.totalCount ?? 0), 0),
  }));
}

const DIVERGENCE_UNAVAILABLE_KEY = {
  noToken: 'repo.divergenceNeedsToken',
  error: 'repo.divergenceUnavailable',
  snapshot: 'repo.divergenceUnavailable',
};

function unavailable(reason) {
  return {
    codeReview: { selfMergePercentage: null, color: 'gray', available: false, reason },
    divergence: { avg: null, categoryKey: DIVERGENCE_UNAVAILABLE_KEY[reason] },
  };
}

/**
 * Self-merge rate and divergence from the GraphQL-backed PR stats. Without
 * them, both are explicitly unavailable instead of showing a 0% that looks
 * like a real result. `codeReview.available`/`reason` describe both metrics.
 *
 * @param {Array|null} prStats - toPullRequestStats() output, or null
 * @param {'noToken'|'error'} [reason] - why prStats is null
 */
export function analyzeReviewMetrics(prStats, reason) {
  if (!prStats) return unavailable(reason);
  return {
    codeReview: { ...analyzers.analyzeCodeReview(prStats), available: true },
    divergence: analyzers.calculateDivergence(prStats),
  };
}

/**
 * Applied when a persisted full_report is shown. Two cases stop being "real":
 * - pre-fix reports (no `codeReview.available`): their values came from the
 *   REST list without merged_by/comments, so they were always 0 — wrong data;
 * - reports saved as unavailable (noToken/error): telling the viewer to add a
 *   token is useless, a snapshot is never refetched.
 * Both become reason 'snapshot'. Returns a new object; the input is untouched.
 */
export function normalizeSnapshotReviewMetrics(report) {
  if (report?.codeReview?.available === true) return report;
  const { codeReview, divergence } = unavailable('snapshot');
  return { ...report, codeReview, metrics: { ...report?.metrics, divergence } };
}
