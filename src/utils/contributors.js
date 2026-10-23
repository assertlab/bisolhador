import { calculateBusFactor } from './busFactor.js';
import {
  TOP_SHARE_CRITICAL_PERCENT,
  TOP_SHARE_WARNING_PERCENT,
  CONTRIBUTORS_RECENT_WEEKS,
  CONTRIBUTORS_MIN_RECENT_COMMITS,
} from '../constants.js';

const WEEK_SECONDS = 7 * 24 * 3600;

// dependabot[bot], renovate[bot], github-actions… are automation, not people:
// counting them made "renovate[bot]" a key developer and a "user" in the UI.
export function isBot(author) {
  if (!author) return false;
  return author.type === 'Bot' || /\[bot\]$/i.test(author.login || '');
}

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
  return { allTime: allTime.sort(byCommitsDesc), recent: recent.sort(byCommitsDesc), botsExcluded };
}

/** Fallback from GET /contributors: all-time only, no time window. */
export function peopleFromContributors(contributors) {
  const people = (contributors ?? []).filter((c) => !isBot(c));
  return {
    allTime: people.map((c) => ({ login: c.login, avatar_url: c.avatar_url, commits: c.contributions })).sort(byCommitsDesc),
    recent: null,
    botsExcluded: (contributors ?? []).length - people.length,
  };
}

export function topShareLevel(percentage) {
  if (percentage == null) return 'none';
  if (percentage > TOP_SHARE_CRITICAL_PERCENT) return 'critical';
  if (percentage > TOP_SHARE_WARNING_PERCENT) return 'warning';
  return 'healthy';
}

const round1 = (n) => Math.round(n * 10) / 10;

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

  const { busFactor, riskLevel, keyDevelopers } = calculateBusFactor(
    group.map((p) => ({ login: p.login, avatar_url: p.avatar_url, contributions: p.commits })),
  );
  const table = group.map((p) => ({ ...p, percentage: total > 0 ? round1((p.commits / total) * 100) : 0 }));
  const top = table[0]
    ? { login: table[0].login, avatar_url: table[0].avatar_url, percentage: table[0].percentage, level: topShareLevel(table[0].percentage) }
    : null;

  return {
    window,
    source,
    partial: source !== 'stats',
    botsExcluded: people.botsExcluded,
    peopleCount: group.length,
    busFactor: group.length ? busFactor : 0,
    riskLevel,
    keyDevelopers,
    top,
    table,
  };
}
