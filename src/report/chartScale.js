// Axis ticks for the vector column charts: round steps, at most ~4 intervals, top = first tick >= max.
// The series can come from a stored snapshot (untrusted shape): a non-finite or huge value must not loop or
// build millions of ticks, so it is clamped.
const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 50000];
const MAX_TICKS = 8;

export function axisTicks(max) {
  const top = Number.isFinite(max) ? Math.max(1, max) : 1;
  const step = STEPS.find((s) => top / s <= 4) ?? Math.ceil(top / 4);
  const ticks = [];
  for (let v = 0; ticks.length < MAX_TICKS; v += step) {
    ticks.push(v);
    if (v >= top) break;
  }
  return ticks;
}

/** Column heights: only finite, non-negative numbers count; anything else is an empty column. */
export const cleanSeries = (values) => values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
