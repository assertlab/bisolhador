import { parseFullReport } from './snapshotAdapter.js';
import { normalizeSnapshotProcessMetrics, leadTimeDays, formatDuration } from './prReviewStats.js';
import { SNAPSHOT_TIMEZONE } from '../constants.js';
import { addDeleteRatioOf } from './activityStats.js';

// Benchmark data from a repo's Supabase history (get_repo_history: id,
// created_at, full_report — no flat columns). Until 2026-10 the Benchmark read
// the LAST row even when it had no report, turned every missing value into 0
// (fork health "0%", "0 ⭐" points in the line) and showed old-method values
// (mean lead time, self-merge, all-time bus factor with bots) next to new ones.
// Now: the most recent row WITH a report, null = not measured (shown as N/A),
// and the same "not recorded" rules as the Dashboard.

const DAY_FORMAT = new Intl.DateTimeFormat('en-CA', { timeZone: SNAPSHOT_TIMEZONE });
const dayKey = (date) => DAY_FORMAT.format(date);

/** Keeps the last point of each day (Recife), sorted: 16 searches in one afternoon are one point. */
export function lastPerDay(points) {
  const byDay = new Map();
  for (const p of [...points].sort((a, b) => a.date - b.date)) byDay.set(dayKey(p.date), p);
  return [...byDay.values()];
}

function metricsOf(report) {
  const r = normalizeSnapshotProcessMetrics(report);
  // busFactorAnalysis.window exists since v3.8.0 (12-month window, bots
  // excluded); before, the percentage came from the first 30 contributors,
  // bots included (busFactorAnalysis itself is older: it can't be the marker).
  const busFactorMeasured = Boolean(r.busFactorAnalysis?.window) && r.busFactor?.percentage != null;
  return {
    stars: r.metrics?.stars ?? null,
    forks: r.metrics?.forks ?? null,
    openIssues: r.metrics?.openIssues ?? null,
    closedIssues: r.metrics?.closedIssues ?? null,
    healthScore: r.health?.score ?? null,
    leadTime: leadTimeDays(r.metrics?.leadTime), // days, for the chart
    leadTimeHours: leadTimeDays(r.metrics?.leadTime) == null ? null : r.metrics.leadTime.medianHours, // for text
    divergence: r.metrics?.divergence?.avg ?? null,
    codeChurnRatio: addDeleteRatioOf(r), // old-method ratios (no categoryKey) → null
    busFactorPercentage: busFactorMeasured ? r.busFactor.percentage : null,
    busFactorTopContributor: busFactorMeasured ? r.busFactor.topContributor || '' : '',
    language: r.language || r.primaryLanguage || r.charts?.techStack?.[0]?.language || null,
  };
}

/**
 * @param {{fullName: string, color: string}} repo
 * @param {Array<{created_at: string, full_report: unknown}>} history - oldest first
 * @returns benchmark repo, or null when no row has a report
 */
export function toBenchmarkRepo(repo, history) {
  const withReport = (history ?? [])
    .map((row) => ({ date: new Date(row.created_at), report: parseFullReport(row.full_report, `Benchmark ${repo.fullName}`) }))
    .filter((row) => row.report && !Number.isNaN(row.date.getTime()));
  if (withReport.length === 0) return null;
  const latest = withReport.reduce((a, b) => (b.date > a.date ? b : a));
  return {
    fullName: repo.fullName,
    color: repo.color,
    ...metricsOf(latest.report),
    lastUpdate: latest.date,
    history: lastPerDay(withReport.map(({ date, report }) => {
      const m = metricsOf(report);
      return { date, stars: m.stars, forks: m.forks, openIssues: m.openIssues, closedIssues: m.closedIssues, leadTime: m.leadTime, codeChurnRatio: m.codeChurnRatio };
    })),
  };
}

/** Lead time as text in the best unit ("7.7 horas", "1,4 dia"); the chart keeps days. */
export function leadTimeText(hours, t, locale) {
  if (hours == null) return 'N/A';
  const { value, unit } = formatDuration(hours);
  return `${value.toLocaleString(locale)} ${t('units.' + unit, { count: value })}`;
}

/** Days between the oldest and newest data among the compared repos (null with < 2 repos). */
export function dataAgeSpreadDays(repos) {
  const dates = (repos ?? []).map((r) => r.lastUpdate?.getTime()).filter(Number.isFinite);
  if (dates.length < 2) return null;
  return Math.floor((Math.max(...dates) - Math.min(...dates)) / 86_400_000);
}
