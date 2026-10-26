import { calculateBusFactor } from './busFactor.js';
import {
  TOP_SHARE_CRITICAL_PERCENT,
  TOP_SHARE_WARNING_PERCENT,
  CONTRIBUTORS_RECENT_WEEKS,
  CONTRIBUTORS_MIN_RECENT_COMMITS,
} from '../constants.js';

const WEEK_SECONDS = 7 * 24 * 3600;
// Both GitHub sources return at most the top 100 contributors.
const CAPPED_AT = 100;

// dependabot[bot], renovate[bot], github-actions… are automation, not people:
// counting them made "renovate[bot]" a key developer and a "user" in the UI.
export function isBot(author) {
  if (!author) return false;
  return author.type === 'Bot' || /\[bot\]$/i.test(author.login || '');
}

// A git author name that looks like a bot ("renovate[bot]", "release bot"): commit authors without a login.
const BOT_NAME = /(\[bot\]|\bbot\b)/i;
export const isBotName = (name) => BOT_NAME.test(name ?? '');

const byCommitsDesc = (a, b) => b.commits - a.commits;

/**
 * From GET /stats/contributors (top contributors with weekly commits).
 * Returns humans with all-time and last-N-weeks commit counts.
 */
export function peopleFromStats(stats, { nowSeconds = Date.now() / 1000, recentWeeks = CONTRIBUTORS_RECENT_WEEKS } = {}) {
  const since = nowSeconds - recentWeeks * WEEK_SECONDS;
  const allTime = [];
  const recent = [];
  let botsExcluded = 0;
  for (const entry of stats ?? []) {
    if (!entry?.author) continue;
    if (isBot(entry.author)) {
      botsExcluded++;
      continue;
    }
    const person = { login: entry.author.login, avatar_url: entry.author.avatar_url };
    allTime.push({ ...person, commits: entry.total });
    const recentCommits = (entry.weeks ?? []).filter((w) => w.w >= since).reduce((sum, w) => sum + w.c, 0);
    if (recentCommits > 0) recent.push({ ...person, commits: recentCommits });
  }
  return { allTime: allTime.sort(byCommitsDesc), recent: recent.sort(byCommitsDesc), botsExcluded, capped: (stats ?? []).length >= CAPPED_AT };
}

/** Fallback from GET /contributors: all-time only, no time window. */
export function peopleFromContributors(contributors) {
  const people = (contributors ?? []).filter((c) => !isBot(c));
  return {
    allTime: people.map((c) => ({ login: c.login, avatar_url: c.avatar_url, commits: c.contributions })).sort(byCommitsDesc),
    recent: null,
    botsExcluded: (contributors ?? []).length - people.length,
    capped: (contributors ?? []).length >= CAPPED_AT,
  };
}

// One style/label table for every place that shows the top-contributor level.
const HEALTHY_STYLE = { bar: 'bg-green-500', text: 'text-green-700 dark:text-green-400', badge: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', labelKey: 'benchmark.riskLow' };
export const TOP_SHARE_STYLE = {
  critical: { bar: 'bg-red-500', text: 'text-red-700 dark:text-red-400', badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', labelKey: 'benchmark.riskCritical' },
  warning: { bar: 'bg-yellow-500', text: 'text-yellow-700 dark:text-yellow-400', badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', labelKey: 'benchmark.riskModerate' },
  healthy: HEALTHY_STYLE,
  none: HEALTHY_STYLE,
};

export function topShareLevel(percentage) {
  if (percentage == null) return 'none';
  if (percentage > TOP_SHARE_CRITICAL_PERCENT) return 'critical';
  if (percentage > TOP_SHARE_WARNING_PERCENT) return 'warning';
  return 'healthy';
}

export const round1 = (n) => Math.round(n * 10) / 10;

/**
 * One analysis for every contributor indicator on screen (Pareto bus factor
 * card, top-contributor concentration, table), over the SAME people and window.
 * window: 'recent' (last 12 months) when there's enough recent activity,
 * else 'allTime'. partial: true when only the REST fallback was available.
 */
export function analyzeContributors(people, { source }) {
  const recentTotal = (people.recent ?? []).reduce((sum, p) => sum + p.commits, 0);
  const window = people.recent && recentTotal >= CONTRIBUTORS_MIN_RECENT_COMMITS ? 'recent' : 'allTime';
  const group = window === 'recent' ? people.recent : people.allTime;
  const total = group.reduce((sum, p) => sum + p.commits, 0);

  const { busFactor, riskLevel, keyDevelopers } = calculateBusFactor(group);
  const table = group.map((p) => ({ ...p, percentage: total > 0 ? round1((p.commits / total) * 100) : 0 }));
  const top = table[0]
    ? { login: table[0].login, avatar_url: table[0].avatar_url, percentage: table[0].percentage, level: topShareLevel(table[0].percentage) }
    : null;

  return {
    window,
    source,
    partial: source !== 'stats',
    botsExcluded: people.botsExcluded,
    capped: Boolean(people.capped),
    peopleCount: group.length,
    busFactor,
    riskLevel,
    keyDevelopers,
    top,
    table,
  };
}

/**
 * Applied when a persisted full_report is shown. Contributor data saved before
 * v3.8.0 (first 30 contributors, all-time, bots included — no
 * `busFactorAnalysis.window`) becomes "not recorded" instead of being shown
 * next to current-method snapshots. Returns a new object.
 */
export function normalizeSnapshotContributors(report) {
  // 'unavailable' = the fetch failed when it was saved: keep saying that
  if (!report || report.busFactorAnalysis?.window || report.busFactor?.level === 'unavailable') return report;
  return { ...report, contributors: null, busFactor: { level: 'notRecorded' }, busFactorAnalysis: null };
}
