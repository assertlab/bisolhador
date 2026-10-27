import { REPORT_AI_LOW_DECLARED_PERCENT, REPORT_CI_LOW_PERCENT, TOP_SHARE_CRITICAL_PERCENT } from '../constants.js';
import { SMALL_PR_LINES } from '../utils/prReviewStats.js';

// "Pontos de atenção": conversation starters picked by rules over the repository-level numbers.
// Neutral wording, no grades, no ranking; each point says what was seen and, where it matters,
// what the number does not mean. Returns `{ key, params, indicator? }` under `report.attention.*`
// (`indicator` = a CLASSROOM_COLUMNS key whose label the renderer adds); the model's repository
// labels are already anonymized when requested, so nothing here needs to care.

const indicatorOf = (model, key) => model.indicators.find((i) => i.key === key);
const valueByLabel = (model, key) => new Map(indicatorOf(model, key).items.map((i) => [i.label, i.value]));

/**
 * @param {object} model - buildReportModel(...)
 * @param {(unit: string, value: number) => string} format - value formatter (locale bound)
 */
export function attentionPoints(model, format) {
  const { summary } = model;
  const points = [];
  const add = (key, names, extra = {}) => {
    if (names.length > 0) points.push({ key, params: { names: names.join(', '), count: names.length, ...extra.params }, ...(extra.indicator ? { indicator: extra.indicator } : {}) });
  };
  const withValue = (key, unit, pick) => {
    const byLabel = valueByLabel(model, key);
    return [...byLabel].filter(([label, v]) => pick(v, label)).map(([label, v]) => `${label} (${format(unit, v)})`);
  };

  const unanalyzed = summary.failed + summary.duplicates;
  if (unanalyzed > 0) points.push({ key: 'notAnalyzed', params: { count: unanalyzed } });
  add('partial', summary.partialLabels);

  // n/d per indicator. "First review" is expected to be empty when nobody else reviews (individual projects).
  for (const ind of model.indicators) {
    if (ind.unavailable.length === 0) continue;
    if (ind.key === 'firstReview' && summary.allSolo) continue;
    // In every repository: one line, not the whole class listed by name
    if (ind.items.length === 0) points.push({ key: 'unmeasuredAll', params: { count: ind.unavailable.length }, indicator: ind.key });
    else add('unmeasured', ind.unavailable, { indicator: ind.key });
  }

  add('aiDisagree', model.ai.filter((r) => r.flags?.length > 0).map((r) => r.label));
  const declared = valueByLabel(model, 'aiCommits');
  add(
    'aiLowDeclared',
    model.ai
      .filter((r) => r.tools?.length > 0 && declared.has(r.label) && declared.get(r.label) < REPORT_AI_LOW_DECLARED_PERCENT)
      .map((r) => `${r.label} (${format('percent', declared.get(r.label))})`),
    { params: { threshold: REPORT_AI_LOW_DECLARED_PERCENT } },
  );

  add('ciLow', withValue('ci', 'percent', (v) => v < REPORT_CI_LOW_PERCENT), { params: { threshold: REPORT_CI_LOW_PERCENT } });
  add('bigPrs', withValue('prSize', 'count', (v) => v > SMALL_PR_LINES), { params: { threshold: SMALL_PR_LINES } });

  // Only teams: with one author, 100% concentration and no one else to approve are the arrangement itself
  const authors = valueByLabel(model, 'authors');
  const teams = (label) => (authors.get(label) ?? 0) > 1;
  add('concentration', withValue('topShare', 'percent', (v, label) => teams(label) && v > TOP_SHARE_CRITICAL_PERCENT), { params: { threshold: TOP_SHARE_CRITICAL_PERCENT } });
  add('noPeerApproval', withValue('approved', 'percent', (v, label) => teams(label) && v === 0));

  return points;
}
