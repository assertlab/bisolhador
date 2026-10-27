// GitHub /stats/* endpoints (participation, punch_card, code_frequency) answer
// 202 while they compute, and 422 for very large repos (code_frequency). Until
// 2026-10 every non-200 became an array of zeros — a flat "no activity" line
// that was also persisted. githubService now throws an error with `code`;
// statsStatus maps the settled promise to what the UI says.

export const STATS_COMPUTING = 'COMPUTING';
export const STATS_TOO_LARGE = 'TOO_LARGE';

const STATUS_BY_CODE = { [STATS_COMPUTING]: 'computing', [STATS_TOO_LARGE]: 'tooLarge' };

/** @returns {{status: 'ok'|'computing'|'tooLarge'|'error', data: any}} */
export function statsStatus(settled) {
  if (settled?.status === 'fulfilled') return { status: 'ok', data: settled.value };
  return { status: STATUS_BY_CODE[settled?.reason?.code] ?? 'error', data: null };
}

export const WEEKDAYS_MIN_SAMPLE = 50; // fewer commits: shown, with a small-sample note
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

// Statuses that only make sense live: a snapshot is never fetched again, so
// "try again in a moment" becomes "not recorded when this was analyzed".
const TRANSIENT = new Set(['computing', 'error']);
const settle = (status) => (TRANSIENT.has(status) ? 'snapshot' : status);

/**
 * Applied when a persisted full_report is shown (useSnapshot).
 * - transient statuses (computing/error) → 'snapshot';
 * - activity saved before 2026-10 without a status and all zeros: a 202 was
 *   saved as 52 zeros then, indistinguishable from an idle repo → not recorded;
 * - additions/deletions without categoryKey/reason: old method (no 4-week
 *   minimum, judgment labels) → not recorded.
 * Returns a new object; the input is untouched.
 */
export function normalizeSnapshotActivity(report) {
  if (!report) return report;
  const charts = { ...report.charts };
  const series = charts.activity?.datasets?.[0]?.data;
  if (charts.activityStatus) {
    charts.activityStatus = settle(charts.activityStatus);
  } else if (!Array.isArray(series) || series.every((v) => !v)) {
    charts.activity = null;
    charts.activityStatus = 'snapshot';
  }
  if (charts.weekdaysStatus) charts.weekdaysStatus = settle(charts.weekdaysStatus);
  const churn = report.codeChurn;
  const codeChurn = churn?.categoryKey || churn?.reason
    ? { ...churn, ...(churn.reason && { reason: settle(churn.reason) }) }
    : { ratio: null, reason: 'snapshot' };
  return { ...report, charts, codeChurn };
}

/** Same old-method rule for history readers (Benchmark): ratio or null. */
export function addDeleteRatioOf(report) {
  const churn = report?.codeChurn;
  if (!churn?.categoryKey) return null;
  const n = parseFloat(churn.ratio);
  return Number.isFinite(n) ? n : null;
}

/**
 * Latest commits for the activity list from the settled /commits request.
 * A failed request is null (unavailable), never [] — that would read as a
 * repository with no commits. An empty repository (409) is fulfilled with [].
 * @returns {object[]|null}
 */
export function recentCommitsOf(settled, limit) {
  return settled?.status === 'fulfilled' ? settled.value.slice(0, limit) : null;
}

/**
 * The weekly commit series as the Dashboard chart shows it (and the PDF report draws it): young
 * projects are trimmed to their age plus a small buffer, then to start two weeks before the first
 * commit; older ones show up to 52 weeks. Labels are dd/mm, one per week, the last being `now`.
 * @param {number[]} raw - GitHub's `all` series (oldest first, up to 52)
 * @param {string|undefined} createdAt - repository creation date (ISO)
 * @param {Date} [now]
 * @returns {{ values: number[], labels: string[], weeksOld: number }}
 */
export function trimCommitSeries(raw, createdAt, now = new Date()) {
  let weeksOld = 52;
  const created = createdAt ? new Date(createdAt) : null;
  if (created && !Number.isNaN(created.getTime())) weeksOld = Math.ceil((now - created) / (1000 * 60 * 60 * 24 * 7));
  const maxWeeksToShow = Math.min(weeksOld + 4, 52); // small buffer for context
  let itemsToShow = Math.min(raw.length, maxWeeksToShow);
  const firstNonZeroIndex = raw.findIndex((value) => value > 0);
  let startIndex = 0;
  if (firstNonZeroIndex !== -1) {
    startIndex = Math.max(0, firstNonZeroIndex - 2); // 2 weeks of context before the activity
    itemsToShow = Math.min(raw.length - startIndex, itemsToShow);
  } else if (weeksOld < 52) {
    startIndex = Math.max(0, raw.length - itemsToShow); // young and silent: only the recent period
  }
  const values = raw.slice(startIndex, startIndex + itemsToShow);
  const labels = [];
  for (let i = values.length - 1; i >= 0; i -= 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - i * 7);
    labels.push(`${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`);
  }
  return { values, labels, weeksOld };
}
