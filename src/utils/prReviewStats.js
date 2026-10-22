import { analyzers } from './analyzers.js';

// Self-merge rate and divergence need, per PR, who merged it and how many
// comments it got. The REST list (GET /repos/{o}/{r}/pulls) returns neither, so
// those two metrics were always 0. GraphQL returns both in one call, but only
// with a token — see githubService.fetchPullRequestReviewStats.

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
};

/**
 * Self-merge rate and divergence from the GraphQL-backed PR stats. Without
 * them (no token, or the request failed), both are explicitly unavailable
 * instead of showing a 0% that looks like a real result.
 *
 * @param {Array|null} prStats - toPullRequestStats() output, or null
 * @param {'noToken'|'error'} [reason] - why prStats is null
 */
export function analyzeReviewMetrics(prStats, reason) {
  if (!prStats) {
    return {
      codeReview: { selfMergePercentage: null, color: 'gray', available: false, reason },
      divergence: { avg: null, categoryKey: DIVERGENCE_UNAVAILABLE_KEY[reason], available: false, reason },
    };
  }
  return {
    codeReview: { ...analyzers.analyzeCodeReview(prStats), available: true },
    divergence: { ...analyzers.calculateDivergence(prStats), available: true },
  };
}
