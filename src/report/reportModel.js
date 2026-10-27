import { CLASSROOM_COLUMNS, aiToolIds, coherenceFlags, isPartialRow } from '../utils/classroomColumns.js';

// Indicators that get a comparison chart, in report order (column key → numeric value).
export const REPORT_INDICATORS = [
  'commits', 'authors', 'topShare', 'mergedPrs', 'approved', 'firstReview', 'leadTime',
  'prSize', 'ci', 'conventional', 'releases', 'aiCommits', 'aiPrs',
];

const COLUMNS = Object.fromEntries(CLASSROOM_COLUMNS.map((c) => [c.key, c]));

export function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const unitOf = (col) => (col.pct ? 'percent' : col.hours ? 'hours' : 'count');

// A, B, … Z, AA… for anonymized repositories
function letters(i) {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/**
 * Report input: a whitelist built from repository-level values only (the same ones the CSV
 * carries). Nothing per student is read here, so a template mistake cannot leak it.
 * @param {object} p
 * @param {string[]} p.repos - requested names, in order
 * @param {Record<string, object>} p.rows - useClassroomAnalysis rows by requested name
 * @param {(name: string) => string|null} p.duplicateOf
 * @param {{from: string, to: string}} p.period
 * @param {boolean} [p.anonymize] - "Repository A, B…" instead of names
 * @param {(index: string) => string} [p.anonymousLabel]
 */
export function buildReportModel({ repos, rows, duplicateOf, period, anonymize = false, anonymousLabel = (l) => `Repo ${l}` }) {
  const analyzed = repos.filter((name) => !duplicateOf(name) && rows[name]?.status === 'ok');
  const entries = analyzed.map((name, i) => ({
    name,
    row: rows[name],
    label: anonymize ? anonymousLabel(letters(i)) : rows[name].fullName ?? name,
  }));

  const indicators = REPORT_INDICATORS.map((key) => {
    const col = COLUMNS[key];
    const items = [];
    const unavailable = [];
    for (const { row, label } of entries) {
      const value = col.get(row);
      if (value == null) {
        unavailable.push(label);
        continue;
      }
      items.push({
        label,
        value,
        n: col.n ? col.n(row) : null,
        sampled: Boolean(col.sampled?.(row)),
        atLeast: Boolean(col.atLeast?.(row)),
      });
    }
    const values = items.map((i) => i.value);
    return { key, guide: col.guide, unit: unitOf(col), items, unavailable, median: median(values), max: values.length ? Math.max(...values) : null };
  });

  return {
    period,
    summary: {
      requested: repos.length,
      analyzed: entries.length,
      partial: entries.filter((e) => isPartialRow(e.row)).length,
      private: anonymize ? null : entries.filter((e) => e.row.isPrivate).length,
      allSolo: entries.length > 0 && entries.every((e) => e.row.commits.available && e.row.commits.authors === 1),
      failed: repos.filter((name) => !duplicateOf(name) && rows[name] && rows[name].status !== 'ok').length,
    },
    indicators,
    ai: entries.map(({ row, label }) => ({
      label,
      tools: aiToolIds(row),
      flags: coherenceFlags(row),
      badge: row.ai.available && row.ai.badge.applicable && row.ai.badge.total > 0
        ? { met: row.ai.badge.met, total: row.ai.badge.total, unverified: row.ai.badge.criteria.filter((c) => c.state === 'unverified').length }
        : null,
    })),
  };
}
