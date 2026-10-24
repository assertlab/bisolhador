import { parseFullReport } from './snapshotAdapter.js';
import { lastPerDay } from './benchmarkData.js';

// Timeline points from a repo's Supabase history. Until 2026-10 every row
// became a point on a category axis (16 searches in one afternoon took the
// width of months) and rows without a report became 0 — a fake "+100 ⭐"
// growth from 0. Now: rows with a report only, one point per (Recife) day,
// null = not measured (a gap in the line), real dates for a time axis.

const num = (x) => (Number.isFinite(x) ? x : null);

/** @param {Array<{created_at: string, full_report: unknown}>} history */
export function toTimelinePoints(history) {
  const points = (history ?? []).flatMap((row) => {
    const report = parseFullReport(row.full_report, 'Timeline');
    const date = new Date(row.created_at);
    if (!report || Number.isNaN(date.getTime())) return [];
    return [{
      date,
      stars: num(report.metrics?.stars),
      forks: num(report.metrics?.forks),
      subscribers: num(report.subscribers),
      healthScore: num(report.health?.score),
      openIssues: num(report.metrics?.openIssues),
    }];
  });
  return lastPerDay(points);
}

/**
 * Change of `key` between the first and last points that measured it, or
 * null with fewer than two. Signed: drops are shown as drops, not "+-X".
 */
export function growth(points, key) {
  const measured = (points ?? []).filter((p) => p[key] != null);
  if (measured.length < 2) return null;
  const first = measured[0];
  const last = measured[measured.length - 1];
  return { delta: last[key] - first[key], from: first.date, to: last.date };
}
