import { describe, it, expect } from 'vitest';
import { statsStatus, weekdaysFromPunchCard, addDeleteRatio, closedShare, closedShareOf } from './activityStats.js';

describe('statsStatus (202 / 422 / failure are not "no activity")', () => {
  const rejected = (code) => ({ status: 'rejected', reason: Object.assign(new Error('x'), { code }) });
  it.each([
    [{ status: 'fulfilled', value: [1] }, 'ok'],
    [rejected('COMPUTING'), 'computing'],
    [rejected('TOO_LARGE'), 'tooLarge'],
    [rejected(undefined), 'error'],
    [undefined, 'error'],
  ])('%j → %s', (settled, status) => {
    expect(statsStatus(settled).status).toBe(status);
  });
});

describe('weekdaysFromPunchCard', () => {
  it('sums hours into days (0 = Sunday)', () => {
    expect(weekdaysFromPunchCard([[0, 9, 2], [0, 10, 3], [5, 14, 10], [6, 23, 1]])).toEqual({ counts: [5, 0, 0, 0, 0, 10, 1], total: 16 });
  });
  it('ignores malformed entries; non-array → null', () => {
    expect(weekdaysFromPunchCard([[9, 0, 5], null, [1, 0, 'x'], [1, 0, 2]])).toEqual({ counts: [0, 2, 0, 0, 0, 0, 0], total: 2 });
    expect(weekdaysFromPunchCard(null)).toBeNull();
  });
});

describe('addDeleteRatio (was "Code Churn")', () => {
  // Real /stats/code_frequency shape: deletions come NEGATIVE.
  const week = (add, del) => [0, add, -del];
  const active = (n, add, del) => Array.from({ length: n }, () => week(add, del));

  it('ratio over the last 10 weeks with a neutral category', () => {
    expect(addDeleteRatio(active(10, 300, 100))).toEqual({ ratio: '3.00', categoryKey: 'moreAdditions', activeWeeks: 10 });
    expect(addDeleteRatio(active(5, 1100, 100))).toMatchObject({ categoryKey: 'mostlyAdditions' });
    expect(addDeleteRatio(active(5, 100, 100))).toMatchObject({ ratio: '1.00', categoryKey: 'balanced' });
    expect(addDeleteRatio(active(5, 10, 100))).toMatchObject({ categoryKey: 'moreDeletions' });
  });

  it('only the last 10 weeks count', () => {
    expect(addDeleteRatio([...active(20, 1, 1000), ...active(10, 200, 100)]).ratio).toBe('2.00');
  });

  it('fewer than 4 active weeks → no ratio (bisolhador "Refatoração Agressiva" from 3 weeks)', () => {
    expect(addDeleteRatio([...active(7, 0, 0), ...active(3, 10, 100)])).toEqual({ ratio: null, reason: 'lowActivity', activeWeeks: 3 });
  });

  it('no deletions → no ratio (was Infinity)', () => {
    expect(addDeleteRatio(active(5, 100, 0))).toMatchObject({ ratio: null, reason: 'noDeletions' });
  });

  it('empty → no activity', () => {
    expect(addDeleteRatio([])).toEqual({ ratio: null, reason: 'noActivity' });
  });
});

describe('closedShare', () => {
  it('closed / (open + closed), rounded; null when unmeasurable', () => {
    expect(closedShare(25, 75)).toBe(75);
    expect(closedShare(0, 0)).toBeNull();
    expect(closedShare(null, 3)).toBeNull();
  });

  it('reads old reports ("82% resolvidas") and new numbers', () => {
    expect(closedShareOf({ resolutionRate: '82% resolvidas' })).toBe(82);
    expect(closedShareOf({ resolutionRate: 82 })).toBe(82);
    expect(closedShareOf({ resolutionRate: 'N/A' })).toBeNull();
    expect(closedShareOf(undefined)).toBeNull();
  });
});
