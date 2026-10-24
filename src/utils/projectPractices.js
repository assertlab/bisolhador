import { isBot } from './contributors.js';
import { percentile } from './prReviewStats.js';

// Project practices from public REST data (no token needed): CI health,
// Conventional Commits adherence, release cadence. Each returns
// { available: true, ... , n } or { available: false, reason }, plus `method`
// so persisted reports can be told apart from future changes.
export const PRACTICES_METHOD = 'v1';

const round1 = (x) => Math.round(x * 10) / 10;
const DAY_MS = 86_400_000;

// --- CI health -----------------------------------------------------------

// Counted outcomes. Cancelled/skipped/neutral/action_required/stale say
// nothing about whether the build is healthy.
const CI_PASS = new Set(['success']);
const CI_FAIL = new Set(['failure', 'timed_out', 'startup_failure']);

/**
 * GitHub Actions runs on the default branch (GET /actions/runs?branch=…&
 * status=completed): success rate and median duration. Runs triggered by
 * pull requests are left out even when the API returns them for the branch
 * filter: this measures the main line, not proposals.
 *
 * @param {{total_count: number, workflow_runs: Array}|null} response - null = request failed
 */
export function analyzeCiRuns(response) {
  if (!response) return { available: false, reason: 'error' };
  const runs = (response.workflow_runs ?? []).filter((r) => !String(r.event).startsWith('pull_request'));
  const counted = runs.filter((r) => CI_PASS.has(r.conclusion) || CI_FAIL.has(r.conclusion));
  if (counted.length === 0) {
    return { available: false, reason: (response.total_count ?? 0) === 0 ? 'noRuns' : 'noConclusive', method: PRACTICES_METHOD };
  }
  const durations = counted
    .map((r) => (Date.parse(r.updated_at) - Date.parse(r.run_started_at)) / 60000)
    .filter((m) => Number.isFinite(m) && m >= 0)
    .sort((a, b) => a - b);
  const dates = counted.map((r) => Date.parse(r.run_started_at)).filter(Number.isFinite);
  return {
    available: true,
    successPercentage: Math.round((counted.filter((r) => CI_PASS.has(r.conclusion)).length / counted.length) * 100),
    medianMinutes: durations.length ? round1(percentile(durations, 0.5)) : null,
    n: counted.length,
    since: dates.length ? new Date(Math.min(...dates)).toISOString() : null,
    method: PRACTICES_METHOD,
  };
}

// --- Conventional Commits --------------------------------------------------

// https://www.conventionalcommits.org: type(scope)!: description. Types are
// the common Angular set; projects with custom types would score lower.
const CONVENTIONAL = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([^)\n]+\))?!?: \S/;

export const isConventionalCommit = (message) => CONVENTIONAL.test(String(message ?? '').split('\n')[0]);

/**
 * Share of commit subjects following Conventional Commits, over the recent
 * commits of the default branch (GET /commits), without merges and bots.
 * @param {Array|null} commits - null = request failed
 */
export function analyzeConventionalCommits(commits) {
  if (!Array.isArray(commits)) return { available: false, reason: 'error' };
  const human = commits.filter((c) => (c.parents?.length ?? 1) <= 1 && !isBot(c.author) && !/\[bot\]/i.test(c.commit?.author?.name ?? ''));
  if (human.length === 0) return { available: false, reason: 'noCommits', method: PRACTICES_METHOD };
  const conventional = human.filter((c) => isConventionalCommit(c.commit?.message)).length;
  return { available: true, percentage: Math.round((conventional / human.length) * 100), n: human.length, method: PRACTICES_METHOD };
}

// --- Release cadence -------------------------------------------------------

const SEMVER = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;
export const isSemverTag = (tag) => SEMVER.test(String(tag ?? ''));

const RELEASE_WINDOW_DAYS = 365;
export const RELEASES_PAGE = 100; // githubService.fetchReleases per_page
const dayOf = (ms) => Math.floor(ms / DAY_MS);

/**
 * Published releases (GET /releases, drafts excluded), dated by `created_at`
 * — GitHub: "the date of the commit used for the release", not when the
 * release page was published (bisolhador backfilled 7 releases in one day;
 * by published_at that read "every 0.2 days").
 * - releases in the last 12 months, and the median interval between the
 *   distinct days with a release in that window (express ships 4.x and 5.x
 *   the same day: per-release gaps read "every 0.2 days"; over its latest 100
 *   releases, spanning 2014–2026, "every 4.5 days");
 * - days since the latest; share of SemVer tags.
 * Projects that only push tags (no GitHub releases) have no data here.
 * @param {Array|null} releases - null = request failed
 * @param {number} [nowMs]
 */
export function analyzeReleases(releases, nowMs = Date.now()) {
  if (!Array.isArray(releases)) return { available: false, reason: 'error' };
  const published = releases
    .filter((r) => !r.draft)
    .map((r) => ({ tag: r.tag_name, at: Date.parse(r.created_at ?? r.published_at) }))
    .filter((r) => Number.isFinite(r.at))
    .sort((a, b) => a.at - b.at);
  if (published.length === 0) return { available: false, reason: 'noReleases', method: PRACTICES_METHOD };
  const recent = published.filter((r) => r.at >= nowMs - RELEASE_WINDOW_DAYS * DAY_MS);
  const days = [...new Set(recent.map((r) => dayOf(r.at)))].sort((a, b) => a - b);
  const gaps = days.slice(1).map((d, i) => d - days[i]).sort((a, b) => a - b);
  return {
    available: true,
    last12Months: recent.length,
    // Full page (100) all inside the window: there are more ("100+")
    capped: releases.length >= RELEASES_PAGE && recent.length === published.length,
    medianIntervalDays: gaps.length ? round1(percentile(gaps, 0.5)) : null,
    daysSinceLast: Math.floor((nowMs - published[published.length - 1].at) / DAY_MS),
    semverPercentage: Math.round((published.filter((r) => isSemverTag(r.tag)).length / published.length) * 100),
    n: published.length,
    method: PRACTICES_METHOD,
  };
}

/**
 * Applied when a persisted full_report is shown: reports from before
 * v3.12.0 have no `practices` → "not recorded"; a transient failure saved
 * with the report ('error') → "not recorded" too (a snapshot isn't refetched).
 */
export function normalizeSnapshotPractices(report) {
  if (!report) return report;
  const settle = (p) => (p?.method === PRACTICES_METHOD ? p : { available: false, reason: 'snapshot' });
  const practices = report.practices ?? {};
  return { ...report, practices: { ci: settle(practices.ci), commits: settle(practices.commits), releases: settle(practices.releases) } };
}
