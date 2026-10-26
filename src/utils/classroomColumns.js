import { configChecked } from './aiProcess.js';
import { toolLabel } from '../components/ai/toolLabel.js';

// Classroom table/CSV columns: header key, guide entry, raw value, and whether the
// value comes from a capped sample (shown with "*" / "+"). Rows that failed for a
// part show N/A in that column only. `n` (percentage columns): the count the
// percentage was computed over, exported as the next CSV column. Fetch succeeded
// = the sample size, 0 for an empty sample; null ('' in the CSV) only when the
// part failed or wasn't measured. Screen-only rendering (`show` with JSX)
// is added in pages/Classroom.jsx.
const commitsCapped = (r) => r.commits.available && r.commits.capped;
const conventionalOf = (r) => (r.commits.available && r.commits.conventional.available ? r.commits.conventional : null);
// Empty samples carry n: 0 (analyzeConventionalCommits, analyzeCiRuns); a failed fetch has no n.
const conventionalN = (r) => (r.commits.available ? r.commits.conventional.n ?? null : null);

// Tools with a trace of the repository's own use (template-only tools are listed in the expanded row).
// null when no source could be read.
export function aiToolIds(r) {
  if (!r.ai.available) return null;
  const { config, commits, prs, tools } = r.ai;
  if (!configChecked(config.status) && !commits.available && !prs.available) return null;
  return tools.filter((tool) => tool.sources.length > 0).map((tool) => tool.id);
}

// "Sources disagree" needs measured commits (no rule fires otherwise): N/A, not "—", when they weren't.
export function coherenceFlags(r) {
  if (!r.ai.available || r.ai.coherence.unverified.includes('commits')) return null;
  return r.ai.coherence.flags;
}

export const CLASSROOM_COLUMNS = [
  { key: 'commits', guide: 'commit-activity', get: (r) => (r.commits.available ? r.commits.commits : null) },
  { key: 'authors', guide: 'contributors', get: (r) => (r.commits.available ? r.commits.authors : null), sampled: commitsCapped },
  { key: 'topShare', guide: 'bus-factor', get: (r) => r.commits.topSharePercentage, pct: true, n: (r) => (r.commits.available ? r.commits.humanCommits : null), sampled: commitsCapped },
  { key: 'mergedPrs', guide: 'prs-merges', get: (r) => (r.prs.available ? r.prs.merged : null), atLeast: (r) => r.prs.capped },
  { key: 'approved', guide: 'review-coverage', get: (r) => r.prs.approvedPercentage, pct: true, n: (r) => (r.prs.available ? r.prs.approvedN : null), sampled: (r) => r.prs.capped },
  { key: 'firstReview', guide: 'first-review', get: (r) => r.prs.firstReviewHours, hours: true, sampled: (r) => r.prs.capped },
  { key: 'leadTime', guide: 'lead-time', get: (r) => r.prs.leadTimeHours, hours: true, sampled: (r) => r.prs.capped },
  { key: 'prSize', guide: 'pr-size', get: (r) => r.prs.prSizeLines, sampled: (r) => r.prs.capped },
  { key: 'ci', guide: 'ci-health', get: (r) => (r.ci.available ? r.ci.successPercentage : null), pct: true, n: (r) => r.ci.n ?? null },
  { key: 'conventional', guide: 'conventional-commits', get: (r) => conventionalOf(r)?.percentage ?? null, pct: true, n: conventionalN, sampled: commitsCapped },
  { key: 'releases', guide: 'release-cadence', get: (r) => r.releases?.count ?? null, atLeast: (r) => r.releases?.capped },
  // AI in the Process (repository level only; per student stays in the expanded row, never in the CSV).
  // `show`/`csv` replace the default number formatting; `count` adds the n behind a percentage on screen.
  { key: 'aiTools', guide: 'ai-tools', get: aiToolIds, show: (ids, t) => (ids.length ? ids.map((id) => toolLabel(id, t)).join(', ') : '—'), csv: (ids, t) => ids.map((id) => toolLabel(id, t)).join(', ') },
  { key: 'aiCommits', guide: 'ai-commits', get: (r) => r.ai.commits.percentage, pct: true, count: (r) => [r.ai.commits.withAi, r.ai.commits.n], n: (r) => (r.ai.commits.available ? r.ai.commits.n : null), sampled: commitsCapped },
  { key: 'aiPrs', guide: 'ai-prs', get: (r) => r.ai.prs.percentage, pct: true, count: (r) => [r.ai.prs.byAgents, r.ai.prs.n], n: (r) => (r.ai.prs.available ? r.ai.prs.n : null), sampled: (r) => r.prs.capped },
  { key: 'aiCoherence', guide: 'ai-coherence', get: coherenceFlags, csv: (flags, t) => flags.map((f) => t(`aiProcess.coherence.${f}`)).join(' ') },
  { key: 'aiBadge', guide: 'ai-badge', get: (r) => (r.ai.badge.applicable && r.ai.badge.total > 0 ? r.ai.badge : null), show: (b) => `${b.met}/${b.total}`, csv: (b, t) => t('aiProcess.badge.score', { met: b.met, total: b.total }), na: '—' },
];

export const isPartialRow = (row) => CLASSROOM_COLUMNS.some((c) => c.sampled?.(row) || c.atLeast?.(row));

/**
 * CSV rows (header → value) for the requested repositories, in order. Raw numbers (hours, %, counts)
 * with the unit in the header, so a spreadsheet can sort/average them; '' when unavailable.
 * Repository level only: per-student rows never go into the CSV.
 * @param {string[]} repos - requested names
 * @param {Record<string, object>} rows - useClassroomAnalysis rows, by requested name
 * @param {(name: string) => string|null} duplicateOf - first requested name resolving to the same repository
 * @param {Function} t - i18next translator
 */
export function classroomCsvRows(repos, rows, duplicateOf, t) {
  return repos.map((name) => {
    const row = rows[name];
    const dup = duplicateOf(name);
    const status = dup ? 'duplicate' : row?.status ?? 'pending';
    const ok = status === 'ok';
    const base = {
      [t('classroom.columns.repo')]: row?.fullName ?? name,
      [t('classroom.csv.visibility')]: row?.status === 'ok' ? t(row.isPrivate ? 'classroom.csv.private' : 'classroom.csv.public') : '',
      [t('classroom.columns.status')]: t(`classroom.status.${status}`, { name: dup }),
    };
    for (const col of CLASSROOM_COLUMNS) {
      const v = ok ? col.get(row) : null;
      base[t(`classroom.csv.${col.key}`)] = v == null ? '' : col.csv ? col.csv(v, t) : v;
      if (col.n) base[t(`classroom.csv.${col.key}N`)] = (ok ? col.n(row) : null) ?? '';
    }
    base[t('classroom.csv.partial')] = ok && isPartialRow(row) ? t('classroom.csv.yes') : '';
    return base;
  });
}
