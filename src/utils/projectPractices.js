import { isBot, round1 } from './contributors.js';
import { DAY_MS } from '../constants.js';
import { percentile } from './prReviewStats.js';

// Project practices from public REST data (no token needed): CI health,
// Conventional Commits adherence, release cadence. Each returns
// { available: true, ... , n } or { available: false, reason }, plus `method`
// so persisted reports can be told apart from future changes.
export const PRACTICES_METHOD = 'v1';


// --- CI health -----------------------------------------------------------

// Counted outcomes. Cancelled/skipped/neutral/action_required/stale say
// nothing about whether the build is healthy.
const CI_PASS = new Set(['success']);
const CI_FAIL = new Set(['failure', 'timed_out', 'startup_failure']);

/**
 * GitHub Actions runs triggered by pushes to the default branch (GET
 * /actions/runs?branch=…&event=push&status=completed): success rate and
 * median duration. Only push runs: the branch filter alone also returned
 * CodeQL/Scorecard schedules, Dependabot "dynamic" runs, issue bots and PR
 * runs from forks whose branch has the same name (vite: 88% → 83%).
 *
 * @param {{total_count: number, workflow_runs: Array}|null} response - null = request failed
 */
// Only Classroom reports `capped` (a sample of the period's runs); the Dashboard result keeps its shape.
const cappedOf = (response) => (response.capped == null ? {} : { capped: response.capped === true });

export function analyzeCiRuns(response, { events = ['push'] } = {}) {
  if (!response) return { available: false, reason: 'error' };
  const runs = (response.workflow_runs ?? []).filter((r) => events.includes(r.event)); // server filters too (Dashboard)
  const counted = runs.filter((r) => CI_PASS.has(r.conclusion) || CI_FAIL.has(r.conclusion));
  if (counted.length === 0) {
    return { available: false, reason: (response.total_count ?? 0) === 0 ? 'noRuns' : 'noConclusive', n: 0, ...cappedOf(response), method: PRACTICES_METHOD };
  }
  const durations = counted
    .map((r) => (Date.parse(r.updated_at) - Date.parse(r.run_started_at)) / 60000)
    .filter((m) => Number.isFinite(m) && m >= 0)
    .sort((a, b) => a - b);
  return {
    available: true,
    successPercentage: Math.round((counted.filter((r) => CI_PASS.has(r.conclusion)).length / counted.length) * 100),
    medianMinutes: durations.length ? round1(percentile(durations, 0.5)) : null,
    n: counted.length,
    ...cappedOf(response),
    method: PRACTICES_METHOD,
  };
}

/** Triggers the Classroom CI indicator counts (see ciRunsForBranch). */
const DEPENDENCY_BOTS = /^(dependabot|renovate)/i;

export const CLASSROOM_CI_EVENTS = ['push', 'pull_request', 'merge_group'];

/**
 * Classroom CI: runs that exercise the default branch, whatever the trigger. A repository whose
 * required checks run only on `pull_request` (no `push` workflow) has no push runs on the branch
 * at all, which made its CI look absent. Kept:
 * - push to the branch;
 * - pull_request from a branch of the same repository (fork PRs are left out) not opened by Dependabot or
 *   Renovate (their runs lack secrets and fail for reasons unrelated to the project; other bots, such as
 *   a coding agent, are the team's work and count). The target branch
 *   is checked only when GitHub reports it: `pull_requests` is empty on nearly every completed run
 *   (measured on a real repository: 1 of 20), so most PR runs can't be tied to a target. PRs to other
 *   branches of the same repository therefore count too;
 * - merge_group on the branch's queue.
 * Schedules and Dependabot "dynamic" runs are not the project's build for that branch.
 */
export function ciRunsForBranch(runs, branch) {
  return (runs ?? []).filter((r) => {
    if (r.event === 'push') return r.head_branch === branch;
    if (r.event === 'pull_request') {
      const sameRepo = r.head_repository?.full_name != null && r.head_repository.full_name === r.repository?.full_name;
      const targets = r.pull_requests ?? [];
      const bases = targets.map((pr) => pr.base?.ref).filter(Boolean);
      return sameRepo && !DEPENDENCY_BOTS.test(r.actor?.login ?? '') && (bases.length === 0 || bases.includes(branch));
    }
    if (r.event === 'merge_group') return String(r.head_branch ?? '').startsWith(`gh-readonly-queue/${branch}/`);
    return false;
  });
}

// --- Conventional Commits --------------------------------------------------

// https://www.conventionalcommits.org: type(scope)!: description. Types are
// the common Angular set; projects with custom types would score lower.
const CONVENTIONAL = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([^)\n]+\))?!?: \S/;

export const isConventionalCommit = (message) => CONVENTIONAL.test(String(message ?? '').split('\n')[0]);

// Any "prefix: summary" subject: the Linux kernel's "subsystem: summary"
// ("vfs: fix …", "net/mlx5, bpf: …"), and Conventional Commits too (a subset).
// Measured next to CC so a project with another convention doesn't read as
// one without any (torvalds/linux: 0% CC, 92% "prefix: summary").
const PREFIXED = /^[\w./+-]+(?:,\s*[\w./+-]+)*(\([^)\n]+\))?!?: \S/;

export const isPrefixedCommit = (message) => PREFIXED.test(String(message ?? '').split('\n')[0]);

/**
 * Share of commit subjects following Conventional Commits, over the recent
 * commits of the default branch (GET /commits), without merges and bots.
 * @param {Array|null} commits - null = request failed
 */
export function analyzeConventionalCommits(commits) {
  if (!Array.isArray(commits)) return { available: false, reason: 'error' };
  // Unlinked authors (author null): fall back to the name ("renovate[bot]", "Renovate Bot")
  const human = commits.filter((c) => (c.parents?.length ?? 1) <= 1 && !isBot(c.author) && !/(\[bot\]|\bbot\b)/i.test(c.commit?.author?.name ?? ''));
  if (human.length === 0) return { available: false, reason: 'noCommits', n: 0, method: PRACTICES_METHOD };
  const share = (test) => Math.round((human.filter((c) => test(c.commit?.message)).length / human.length) * 100);
  return {
    available: true,
    percentage: share(isConventionalCommit),
    // Same commits, any "prefix: summary" subject (CC included). Absent in snapshots before v3.24.0.
    prefixedPercentage: share(isPrefixedCommit),
    n: human.length,
    method: PRACTICES_METHOD,
  };
}

// --- Release cadence -------------------------------------------------------

// Optional monorepo package prefix: create-vite@7.0.0, @scope/pkg@1.2.3
const SEMVER = /^(?:(?:@[\w.-]+\/)?[\w.-]+@)?v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;
export const isSemverTag = (tag) => SEMVER.test(String(tag ?? ''));

const RELEASE_WINDOW_DAYS = 365;
export const RELEASES_PAGE = 100; // githubService.fetchReleases per_page
const dayOf = (ms) => Math.floor(ms / DAY_MS);

/**
 * Published releases (GET /releases, drafts excluded), dated by the earlier
 * of created_at (the tag's date: tagger date for annotated tags, else the
 * commit's) and published_at. published_at alone reads backfilled releases as
 * the backfill day (bisolhador: 7 in one day → "every 0.2 days"); created_at
 * alone reads a re-created tag as its new date (express v5.0.1: 6 months after
 * it was published).
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
    .map((r) => ({ tag: r.tag_name, at: Math.min(...[r.created_at, r.published_at].map(Date.parse).filter(Number.isFinite)) }));
  return cadence(published, { fullPage: releases.length >= RELEASES_PAGE, nowMs });
}

// Shared by releases and tags. items: [{ tag, at }]. fullPage: the source
// returned a full page, so a page entirely inside the window means "N+".
function cadence(items, { fullPage, nowMs }) {
  const dated = items.filter((r) => Number.isFinite(r.at)).sort((a, b) => a.at - b.at);
  if (dated.length === 0) return { available: false, reason: 'noReleases', method: PRACTICES_METHOD };
  const recent = dated.filter((r) => r.at >= nowMs - RELEASE_WINDOW_DAYS * DAY_MS);
  const days = [...new Set(recent.map((r) => dayOf(r.at)))].sort((a, b) => a - b);
  const gaps = days.slice(1).map((d, i) => d - days[i]).sort((a, b) => a - b);
  return {
    available: true,
    last12Months: recent.length,
    // Full page (100) all inside the window: there are more ("100+")
    capped: fullPage && recent.length === dated.length,
    medianIntervalDays: gaps.length ? round1(percentile(gaps, 0.5)) : null,
    daysSinceLast: Math.floor((nowMs - dated[dated.length - 1].at) / DAY_MS),
    semverPercentage: Math.round((dated.filter((r) => isSemverTag(r.tag)).length / dated.length) * 100),
    n: dated.length,
    method: PRACTICES_METHOD,
  };
}

// --- Release cadence from tags (projects without GitHub releases) ----------

// Pre-release tags: v7.3-rc7, 1.0.0-beta.1, v2.0a1, 3.1.0.dev2, nightly…
// Left out of the tag cadence: torvalds/linux tags every -rc weekly, which
// would read "a release every 7 days" instead of one per ~9 weeks.
const PRERELEASE_TAG = /(?:^|[-._\d])(?:rc|alpha|beta|pre|preview|dev|snapshot|nightly|canary|next)(?=$|[-._+\d])|\d[ab]\d+$/i;
export const isPrereleaseTag = (tag) => PRERELEASE_TAG.test(String(tag ?? ''));
export const TAGS_PAGE = 100; // githubService.fetchTagDates `first`

/**
 * Release cadence for projects that only push tags (0 GitHub releases), when
 * the project has tags. Same fields as analyzeReleases plus source 'tags':
 * stable tags only (pre-releases out), dated by the tagger date of annotated
 * tags, else the tagged commit's date (fetchTagDates). Without a token there
 * are no dates (the REST tag list has none): unavailable, reason
 * 'tagsNoToken', with the tag count; with a token whose date query failed,
 * reason 'tagDatesFailed'. `tagsTotal` = every tag on GitHub.
 *
 * @param {{ total: number, dates: Array<{name: string, date: string}>|null, fullPage?: boolean, datesFailed?: boolean }} tags
 */
export function analyzeTagCadence(tags, nowMs = Date.now()) {
  const tagsTotal = tags.total;
  if (!tags.dates) return { available: false, reason: tags.datesFailed ? 'tagDatesFailed' : 'tagsNoToken', source: 'tags', tagsTotal, method: PRACTICES_METHOD };
  const stable = tags.dates.filter((t) => !isPrereleaseTag(t.name)).map((t) => ({ tag: t.name, at: Date.parse(t.date) }));
  const result = cadence(stable, { fullPage: Boolean(tags.fullPage), nowMs });
  if (!result.available) return { ...result, reason: 'noStableTags', source: 'tags', tagsTotal };
  return { ...result, source: 'tags', tagsTotal, prereleasesExcluded: tags.dates.length - stable.length };
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
