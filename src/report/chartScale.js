// Axis ticks for the vector column charts: round steps, at most ~4 intervals, top = first tick >= max.
const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 50000];

export function axisTicks(max) {
  const top = Math.max(1, max);
  const step = STEPS.find((s) => top / s <= 4) ?? 100000;
  const ticks = [];
  for (let v = 0; ; v += step) {
    ticks.push(v);
    if (v >= top) break;
  }
  return ticks;
}
