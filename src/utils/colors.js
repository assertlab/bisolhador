// Golden angle (~137.508°) — rotating hue by this amount per seed keeps
// consecutive generated colors maximally distinct from each other, instead
// of clustering the way a fixed step (e.g. 360/n) or random hues would.
const GOLDEN_ANGLE = 137.508;

// Deterministic, visually-distinct color per integer seed (e.g. an item's
// index in a list) — same seed always produces the same color, unlike
// Math.random(), so re-renders and reloads stay consistent.
export function generateColor(seed) {
  const hue = (seed * GOLDEN_ANGLE) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}
