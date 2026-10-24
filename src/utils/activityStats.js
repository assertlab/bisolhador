// GitHub /stats/* endpoints (participation, punch_card, code_frequency) answer
// 202 while they compute, and 422 for very large repos (code_frequency). Until
// 2026-10 every non-200 became an array of zeros — a flat "no activity" line
// that was also persisted. githubService now throws an error with `code`;
// statsStatus maps the settled promise to what the UI says.

export const STATS_COMPUTING = 'COMPUTING';
export const STATS_TOO_LARGE = 'TOO_LARGE';

/** @returns {{status: 'ok'|'computing'|'tooLarge'|'error', data: any}} */
export function statsStatus(settled) {
  if (settled?.status === 'fulfilled') return { status: 'ok', data: settled.value };
  const code = settled?.reason?.code;
  return { status: code === STATS_COMPUTING ? 'computing' : code === STATS_TOO_LARGE ? 'tooLarge' : 'error', data: null };
}

export const PUNCH_CARD_MAX_COMMITS = 20000; // GitHub caps the statistic (linux, vscode: exactly 20,000)

/**
 * Commits per weekday from /stats/punch_card ([day 0=Sunday, hour, commits]):
 * all non-merge commits of the history, in each commit's own (author) time
 * zone — verified 2026-10: bisolhador's hours match BRT, totals match non-merge
 * commits; express sums ~5.7k (all time), capped at 20k (linux, vscode). Bots
 * can't be excluded by this API.
 * Replaces the 10 most recent commits ("renovate: 100% Friday").
 */
export function weekdaysFromPunchCard(punchCard) {
  if (!Array.isArray(punchCard)) return null;
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const entry of punchCard) {
    const [day, , commits] = entry ?? [];
    if (day >= 0 && day <= 6 && Number.isFinite(commits)) counts[day] += commits;
  }
  return { counts, total: counts.reduce((a, b) => a + b, 0) };
}

export const ADD_DELETE_WEEKS = 10;
export const ADD_DELETE_MIN_ACTIVE_WEEKS = 4;

/**
 * Additions/deletions ratio over the last 10 weeks of /stats/code_frequency
 * ([week, additions, deletions], deletions NEGATIVE). Was "Code Churn" with a
 * promise of "change quality" and labels like "Refatoração Agressiva" from 3
 * active weeks. Now a neutral description, and no ratio with fewer than 4
 * active weeks or no deletions (the old Infinity).
 */
export function addDeleteRatio(codeFrequency) {
  if (!Array.isArray(codeFrequency) || codeFrequency.length === 0) return { ratio: null, reason: 'noActivity' };
  const weeks = codeFrequency.slice(-ADD_DELETE_WEEKS);
  let additions = 0;
  let deletions = 0;
  let activeWeeks = 0;
  for (const [, add = 0, del = 0] of weeks) {
    additions += add;
    deletions += Math.abs(del);
    if (add !== 0 || del !== 0) activeWeeks++;
  }
  if (activeWeeks < ADD_DELETE_MIN_ACTIVE_WEEKS) return { ratio: null, reason: 'lowActivity', activeWeeks };
  if (deletions === 0) return { ratio: null, reason: 'noDeletions', activeWeeks };
  const value = additions / deletions;
  const categoryKey = value > 10 ? 'mostlyAdditions' : value >= 2 ? 'moreAdditions' : value >= 0.5 ? 'balanced' : 'moreDeletions';
  // String with 2 decimals: same shape as before (Benchmark/exports parse it)
  return { ratio: value.toFixed(2), categoryKey, activeWeeks };
}

/** Share of issues that are closed (open + closed), 0–100; null when not measurable. */
export function closedShare(open, closed) {
  if (open == null || closed == null || open + closed === 0) return null;
  return Math.round((closed / (open + closed)) * 100);
}

/** Reads closedShare from a report: number since 2026-10, "NN% resolvidas" before. */
export function closedShareOf(metrics) {
  const v = metrics?.resolutionRate;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}
