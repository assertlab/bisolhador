import { REPORT_AI_LOW_DECLARED_PERCENT, REPORT_CI_LOW_PERCENT, TOP_SHARE_CRITICAL_PERCENT } from '../constants.js';
import { SMALL_PR_LINES } from '../utils/prReviewStats.js';

// "Pontos de atenção": conversation starters picked by rules over the repository-level numbers.
// Neutral wording, no grades, no ranking; each point says what was seen and, where it matters,
// what the number does not mean. Returns `{ key, params?, indicators?, entries? }` under `report.attention.*`
// (indicator keys are CLASSROOM_COLUMNS keys whose labels the renderer adds); thresholds compare the
// rounded value, which is what the list prints, so a line never contradicts its own number; the model's repository
// labels are already anonymized when requested, so nothing here needs to care.

const PR_DERIVED = new Set(['approved', 'firstReview', 'leadTime', 'prSize', 'aiPrs']);
const indicatorOf = (model, key) => model.indicators.find((i) => i.key === key);
const valueByLabel = (model, key) => new Map((indicatorOf(model, key)?.items ?? []).map((i) => [i.label, i.value]));

/**
 * @param {object} model - buildReportModel(...)
 * @param {(unit: string, value: number) => string} format - value formatter (locale bound)
 */
export function attentionPoints(model, format) {
  const { summary } = model;
  const points = [];
  const add = (key, names, extra = {}) => {
    if (names.length > 0) points.push({ key, params: { names: names.join(', '), count: names.length, ...extra.params } });
  };
  const withValue = (key, unit, pick) => {
    const byLabel = valueByLabel(model, key);
    return [...byLabel].filter(([label, v]) => pick(v, label)).map(([label, v]) => `${label} (${format(unit, v)})`);
  };

  const unanalyzed = summary.failed + summary.duplicates;
  if (unanalyzed > 0) points.push({ key: 'notAnalyzed', params: { count: unanalyzed } });
  add('partial', summary.partialLabels);

  // No merged PR in the period is the signal; the PR-derived indicators then have nothing to measure
  // (expected n/d), so they don't repeat it as "not measured".
  const noPrs = new Set([...valueByLabel(model, 'mergedPrs')].filter(([, v]) => v === 0).map(([label]) => label));
  add('noMergedPrs', [...noPrs]);

  // n/d, in two lines at most (a wall of "not measured" bullets would bury the real signals):
  // indicators missing in every repository, and indicators missing in some. "First review" is expected
  // to be empty when nobody else reviews (individual projects).
  const everywhere = [];
  const somewhere = [];
  for (const ind of model.indicators) {
    if (ind.key === 'firstReview' && summary.allSolo) continue;
    const missing = ind.unavailable.filter((label) => !(PR_DERIVED.has(ind.key) && noPrs.has(label)));
    if (missing.length === 0) continue;
    if (ind.items.length === 0 && missing.length === ind.unavailable.length) everywhere.push(ind.key);
    else somewhere.push({ indicator: ind.key, names: missing.join(', ') });
  }
  if (everywhere.length > 0) points.push({ key: 'unmeasuredAll', indicators: everywhere });
  if (somewhere.length > 0) points.push({ key: 'unmeasuredSome', entries: somewhere });

  const disagree = model.ai.filter((r) => r.flags?.length > 0).map((r) => r.label);
  add('aiDisagree', disagree);
  // Not repeated for a repository already listed above: "config without declaration" is that same condition
  const declared = valueByLabel(model, 'aiCommits');
  add(
    'aiLowDeclared',
    model.ai
      .filter((r) => r.tools?.length > 0 && !disagree.includes(r.label) && declared.has(r.label) && Math.round(declared.get(r.label)) < REPORT_AI_LOW_DECLARED_PERCENT)
      .map((r) => `${r.label} (${format('percent', declared.get(r.label))})`),
    { params: { threshold: REPORT_AI_LOW_DECLARED_PERCENT } },
  );

  add('ciLow', withValue('ci', 'percent', (v) => Math.round(v) < REPORT_CI_LOW_PERCENT), { params: { threshold: REPORT_CI_LOW_PERCENT } });
  add('bigPrs', withValue('prSize', 'count', (v) => Math.round(v) >= SMALL_PR_LINES), { params: { threshold: SMALL_PR_LINES } });

  // Only teams: with one author, 100% concentration and no one else to approve are the arrangement itself
  const authors = valueByLabel(model, 'authors');
  const teams = (label) => (authors.get(label) ?? 0) > 1;
  add('concentration', withValue('topShare', 'percent', (v, label) => teams(label) && Math.round(v) > TOP_SHARE_CRITICAL_PERCENT), { params: { threshold: TOP_SHARE_CRITICAL_PERCENT } });
  add('noPeerApproval', withValue('approved', 'percent', (v, label) => teams(label) && v === 0));

  return points;
}
