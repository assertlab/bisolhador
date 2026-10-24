import { parseSafeRepoName } from './repoName.js';
import { isBot } from './contributors.js';
import { analyzeReviewMetrics, analyzeLeadTime } from './prReviewStats.js';
import { analyzeCiRuns, analyzeConventionalCommits } from './projectPractices.js';

// Classroom mode: the same indicators as the Dashboard, computed over a course
// period for a list of (public) team repositories. Nothing is persisted.
export const CLASSROOM_MAX_REPOS = 50;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Pasted text → repositories. Accepts "owner/repo" or GitHub URLs, one per
 * line or separated by commas/spaces; dedupes case-insensitively. Names must
 * pass parseSafeRepoName: they go into a search query (see githubService).
 */
export function parseRepoList(text) {
  const repos = [];
  const invalid = [];
  const seen = new Set();
  for (const raw of String(text ?? '').split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)) {
    const name = raw
      .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
      .replace(/\.git$/i, '')
      .split(/[?#]/)[0]
      .split('/').slice(0, 2).join('/');
    const parts = parseSafeRepoName(name);
    if (!parts) {
      invalid.push(raw);
      continue;
    }
    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      repos.push(parts.join('/'));
    }
  }
  return { repos: repos.slice(0, CLASSROOM_MAX_REPOS), invalid, truncated: repos.length > CLASSROOM_MAX_REPOS };
}

/** Valid course period (YYYY-MM-DD, from ≤ to), or null. Dates are UTC days. */
export function parsePeriod(from, to) {
  if (!DATE.test(from ?? '') || !DATE.test(to ?? '')) return null;
  const since = new Date(`${from}T00:00:00Z`);
  const until = new Date(`${to}T23:59:59Z`);
  if (Number.isNaN(since.getTime()) || Number.isNaN(until.getTime()) || since > until) return null;
  return { from, to, since: since.toISOString(), until: until.toISOString() };
}

// GraphQL history node → the REST commit shape analyzeConventionalCommits reads
const toRestCommit = (node) => {
  const login = node.author?.user?.login ?? null;
  return {
    parents: Array.from({ length: node.parents?.totalCount ?? 1 }),
    author: login ? { login, type: /\[bot\]$/i.test(login) ? 'Bot' : 'User' } : null,
    commit: { message: node.message, author: { name: node.author?.name ?? '' } },
  };
};

/**
 * Commit-side indicators over the period: commits (all, incl. merges/bots),
 * active authors and the top author's share among human non-merge commits
 * (a team-level concentration: no names are shown), Conventional Commits.
 */
export function analyzeCommitHistory(history) {
  if (!history) return { available: false, reason: 'error' };
  const rest = history.nodes.map(toRestCommit);
  const human = rest.filter((c) => c.parents.length <= 1 && !isBot(c.author) && !/(\[bot\]|\bbot\b)/i.test(c.commit.author.name));
  const byAuthor = new Map();
  for (const c of human) {
    const id = (c.author?.login ?? c.commit.author.name).toLowerCase();
    byAuthor.set(id, (byAuthor.get(id) ?? 0) + 1);
  }
  const top = Math.max(0, ...byAuthor.values());
  return {
    available: true,
    commits: history.totalCount,
    capped: history.capped,
    sampled: history.nodes.length,
    authors: byAuthor.size,
    topSharePercentage: human.length ? Math.round((top / human.length) * 100) : null,
    conventional: analyzeConventionalCommits(rest),
  };
}

/** Releases whose date (min of tag date and publication) falls in the period. */
export function releasesInPeriod(releases, period) {
  if (!Array.isArray(releases)) return null;
  const since = Date.parse(period.since);
  const until = Date.parse(period.until);
  return releases.filter((r) => {
    if (r.draft) return false;
    const at = Math.min(...[r.created_at, r.published_at].map(Date.parse).filter(Number.isFinite));
    return at >= since && at <= until;
  }).length;
}

const settled = (r) => (r?.status === 'fulfilled' ? r.value : null);

/**
 * One table row from the settled fetches of a repository. Each part fails on
 * its own (null → N/A in that column only).
 * @param {{history, prs, runs, releases}} results - Promise.allSettled results
 */
export function analyzeTeamRepo(results, period) {
  const prs = settled(results.prs);
  const review = prs ? analyzeReviewMetrics(prs.stats, 'error', { limit: Infinity }) : null;
  const leadTime = prs ? analyzeLeadTime(prs.stats, 'graphql', { limit: Infinity }) : null;
  const rp = review?.reviewProcess;
  return {
    commits: analyzeCommitHistory(settled(results.history)),
    prs: prs
      ? {
          available: true,
          merged: review.codeReview.n ?? 0, // human-authored, merged in the period
          capped: prs.issueCount > 100,
          approvedPercentage: rp?.available ? rp.coverage.approvedPercentage : null,
          firstReviewHours: rp?.available && rp.firstReview.n > 0 ? rp.firstReview.medianHours : null,
          prSizeLines: rp?.available && rp.prSize.n > 0 ? rp.prSize.medianLines : null,
          leadTimeHours: leadTime?.n > 0 ? leadTime.medianHours : null,
        }
      : { available: false, reason: 'error' },
    ci: analyzeCiRuns(settled(results.runs)),
    releases: releasesInPeriod(settled(results.releases), period),
  };
}
