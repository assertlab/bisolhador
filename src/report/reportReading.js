// "Leitura desta turma": template sentences with numbers, chosen by rules. No LLM, no grades,
// no rankings: position in the class is described by range and median only. Returns
// `{ key, params }` pairs under `report.reading.*`; the renderer translates them.

const OUTLIER_FACTOR = 2;

/**
 * @param {object} indicator - one entry of buildReportModel(...).indicators
 * @param {{ allSolo: boolean, analyzed: number }} summary
 */
export function readingFor(indicator, summary) {
  const { key, items, unavailable } = indicator;
  const lines = [];
  if (items.length === 0) return [{ key: 'none', params: { count: summary.analyzed } }];

  const values = items.map((i) => i.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (items.length === 1) lines.push({ key: 'single', params: { label: items[0].label, value: items[0].value } });
  else lines.push({ key: 'range', params: { count: items.length, min, max, median: indicator.median } });

  // One repository far above the middle of the class (only when the middle is not zero)
  if (items.length >= 3 && indicator.median > 0 && max >= OUTLIER_FACTOR * indicator.median) {
    const top = items.find((i) => i.value === max);
    lines.push({ key: 'outlier', params: { label: top.label, value: max, median: indicator.median } });
  }

  if (summary.allSolo && (key === 'approved' || key === 'topShare' || key === 'authors')) lines.push({ key: 'solo' });
  if (key === 'aiCommits' || key === 'aiPrs') lines.push({ key: 'lowerBound' });
  if (items.some((i) => i.sampled || i.atLeast)) lines.push({ key: 'sampled', params: { count: items.filter((i) => i.sampled || i.atLeast).length } });
  if (unavailable.length > 0) lines.push({ key: 'unavailable', params: { count: unavailable.length } });
  return lines;
}
