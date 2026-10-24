import { describe, it, expect } from 'vitest';
import { toTimelinePoints, growth } from './timelineData.js';

const row = (created_at, stars, extra = {}) => ({
  created_at,
  full_report: stars === undefined ? null : { metrics: { stars, forks: 1, ...extra.metrics }, subscribers: 2, health: { score: 50 } },
});

describe('toTimelinePoints', () => {
  it('rows without a report are skipped, not plotted as 0', () => {
    const pts = toTimelinePoints([row('2026-10-01T12:00:00Z', 100), row('2026-10-02T12:00:00Z'), row('2026-10-03T12:00:00Z', 105)]);
    expect(pts.map((p) => p.stars)).toEqual([100, 105]);
  });

  it('one point per day: the last search of the afternoon wins', () => {
    const pts = toTimelinePoints([row('2026-10-01T13:00:00Z', 1), row('2026-10-01T15:00:00Z', 2), row('2026-10-01T18:00:00Z', 3)]);
    expect(pts).toHaveLength(1);
    expect(pts[0].stars).toBe(3);
  });

  it('a value not measured is null (gap), not 0', () => {
    const [p] = toTimelinePoints([row('2026-10-01T12:00:00Z', 10, { metrics: { openIssues: null } })]);
    expect(p.openIssues).toBeNull();
  });

  it('sorted by date even if the input is not', () => {
    const pts = toTimelinePoints([row('2026-10-03T12:00:00Z', 3), row('2026-10-01T12:00:00Z', 1)]);
    expect(pts.map((p) => p.stars)).toEqual([1, 3]);
  });
});

describe('growth', () => {
  const pts = (...stars) => stars.map((s, i) => ({ date: new Date(Date.UTC(2026, 9, i + 1)), stars: s }));

  it('signed: a drop is negative (the UI printed "+-5")', () => {
    expect(growth(pts(100, 95), 'stars').delta).toBe(-5);
    expect(growth(pts(100, 130), 'stars').delta).toBe(30);
  });

  it('uses the first and last points that measured the value', () => {
    expect(growth(pts(null, 100, null, 110, null), 'stars').delta).toBe(10);
  });

  it('fewer than two measured points → null', () => {
    expect(growth(pts(100), 'stars')).toBeNull();
    expect(growth(pts(null, null), 'stars')).toBeNull();
  });
});
