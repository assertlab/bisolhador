import { describe, it, expect } from 'vitest';
import { statsStatus, weekdaysFromPunchCard, addDeleteRatio, closedShare, closedShareOf, normalizeSnapshotActivity, addDeleteRatioOf, recentCommitsOf } from './activityStats.js';

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

describe('normalizeSnapshotActivity (reading persisted full_report)', () => {
  const series = (data) => ({ datasets: [{ data }] });

  it('transient statuses become "not recorded" (a snapshot is never refetched)', () => {
    const r = normalizeSnapshotActivity({ charts: { activity: null, activityStatus: 'computing', weekdays: null, weekdaysStatus: 'error' }, codeChurn: { ratio: null, reason: 'computing' } });
    expect(r.charts).toMatchObject({ activityStatus: 'snapshot', weekdaysStatus: 'snapshot' });
    expect(r.codeChurn.reason).toBe('snapshot');
  });

  it('keeps meaningful statuses and measured data', () => {
    const report = { charts: { activity: series([1, 2]), activityStatus: 'ok', weekdaysStatus: 'ok' }, codeChurn: { ratio: null, reason: 'tooLarge' } };
    const r = normalizeSnapshotActivity(report);
    expect(r.charts.activity).toBe(report.charts.activity);
    expect(r.codeChurn.reason).toBe('tooLarge');
  });

  it('old report: all-zero series without status (a saved 202) → not recorded; real series kept', () => {
    expect(normalizeSnapshotActivity({ charts: { activity: series([0, 0, 0]) }, codeChurn: {} }).charts).toEqual({ activity: null, activityStatus: 'snapshot' });
    expect(normalizeSnapshotActivity({ charts: { activity: series([0, 3]) }, codeChurn: {} }).charts.activity.datasets[0].data).toEqual([0, 3]);
  });

  it('old-method churn (judgment category, no categoryKey) → not recorded; input untouched', () => {
    const old = { charts: {}, codeChurn: { ratio: '0.50', category: 'Refatoração Agressiva' } };
    const copy = structuredClone(old);
    expect(normalizeSnapshotActivity(old).codeChurn).toEqual({ ratio: null, reason: 'snapshot' });
    expect(old).toEqual(copy);
  });

  it('addDeleteRatioOf: number only for the current method', () => {
    expect(addDeleteRatioOf({ codeChurn: { ratio: '1.95', categoryKey: 'balanced' } })).toBe(1.95);
    expect(addDeleteRatioOf({ codeChurn: { ratio: '1.95', category: 'x' } })).toBeNull();
    expect(addDeleteRatioOf({ codeChurn: { ratio: null, reason: 'tooLarge' } })).toBeNull();
  });
});

describe('recentCommitsOf (failed request is not "no commits")', () => {
  const commit = (sha) => ({ sha });
  it('fulfilled: the latest commits, capped at the limit', () => {
    const value = Array.from({ length: 15 }, (_, i) => commit(String(i)));
    expect(recentCommitsOf({ status: 'fulfilled', value }, 10)).toEqual(value.slice(0, 10));
  });
  it('fulfilled with [] (empty repository, 409): a real empty list', () => {
    expect(recentCommitsOf({ status: 'fulfilled', value: [] }, 10)).toEqual([]);
  });
  it('rejected or missing: null (unavailable), never []', () => {
    expect(recentCommitsOf({ status: 'rejected', reason: new Error('HTTP 500') }, 10)).toBeNull();
    expect(recentCommitsOf(undefined, 10)).toBeNull();
  });
});
