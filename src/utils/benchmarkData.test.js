import { describe, it, expect } from 'vitest';
import { toBenchmarkRepo, lastPerDay, dataAgeSpreadDays } from './benchmarkData.js';

const repo = { fullName: 'o/r', color: 'hsl(0, 70%, 50%)' };
const row = (created_at, report) => ({ created_at, full_report: report === undefined ? null : report });
const current = (over = {}) => ({
  metrics: {
    stars: 100, forks: 10, openIssues: 5, closedIssues: 50,
    leadTime: { value: 1.5, unit: 'days', medianHours: 36, n: 50, method: 'median' },
    divergence: { avg: 0.7, n: 50, method: 'approval' },
  },
  codeReview: { available: true, method: 'approval' },
  health: { score: 86 },
  codeChurn: { ratio: '1.20', category: 'growth' },
  busFactor: { level: 'warning', topContributor: 'alice', percentage: 45 },
  busFactorAnalysis: { busFactor: 2, window: 'recent' },
  charts: { techStack: [{ language: 'JavaScript' }] },
  ...over,
});

describe('toBenchmarkRepo', () => {
  it('uses the most recent row WITH a report (a newer row without one used to zero everything)', () => {
    const r = toBenchmarkRepo(repo, [row('2026-10-01T12:00:00Z', current()), row('2026-10-05T12:00:00Z')]);
    expect(r).toMatchObject({ stars: 100, healthScore: 86, leadTime: 1.5, divergence: 0.7, busFactorPercentage: 45, language: 'JavaScript', codeChurnRatio: 1.2 });
    expect(r.lastUpdate.toISOString()).toBe('2026-10-01T12:00:00.000Z');
  });

  it('missing values are null (N/A), not 0: fork health, failed counts', () => {
    const r = toBenchmarkRepo(repo, [row('2026-10-01T12:00:00Z', current({ health: { score: null }, metrics: { stars: 3, openIssues: null } }))]);
    expect(r).toMatchObject({ healthScore: null, openIssues: null, closedIssues: null, forks: null, stars: 3 });
  });

  it('old-method values are not recorded: mean lead time, self-merge divergence, bus factor before v3.8.0', () => {
    const old = current({
      metrics: { stars: 1, leadTime: { value: 7.7, unit: 'hours', count: 7.7 }, divergence: { avg: 1.2 } },
      codeReview: { selfMergePercentage: 79, available: true },
      busFactorAnalysis: { busFactor: 3, keyDevelopers: [], riskLevel: 'low' }, // pre-v3.8.0 shape: no window
    });
    expect(toBenchmarkRepo(repo, [row('2026-06-01T12:00:00Z', old)])).toMatchObject({ leadTime: null, divergence: null, busFactorPercentage: null, busFactorTopContributor: '' });
  });

  it('churn "Infinity" (old rows) → null', () => {
    const r = toBenchmarkRepo(repo, [row('2026-10-01T12:00:00Z', current({ codeChurn: { ratio: 'Infinity', category: 'x' } }))]);
    expect(r).toMatchObject({ codeChurnRatio: null, codeChurnCategory: '' });
  });

  it('reads double-encoded reports (stored as JSON text until v3.8.0)', () => {
    expect(toBenchmarkRepo(repo, [row('2026-10-01T12:00:00Z', JSON.stringify(current()))]).stars).toBe(100);
  });

  it('no row with a report → null (shown as "no history")', () => {
    expect(toBenchmarkRepo(repo, [row('2026-10-01T12:00:00Z')])).toBeNull();
    expect(toBenchmarkRepo(repo, [])).toBeNull();
  });

  it('history: one point per day, rows without report skipped (no fake "0 ⭐" dips)', () => {
    const r = toBenchmarkRepo(repo, [
      row('2026-10-01T13:00:00Z', current({ metrics: { stars: 1 } })),
      row('2026-10-01T18:00:00Z', current({ metrics: { stars: 2 } })),
      row('2026-10-02T13:00:00Z'),
      row('2026-10-03T13:00:00Z', current({ metrics: { stars: 3 } })),
    ]);
    expect(r.history.map((p) => p.stars)).toEqual([2, 3]);
  });
});

describe('lastPerDay', () => {
  it('days are Recife days: 01:00 UTC belongs to the previous day', () => {
    const pts = [{ date: new Date('2026-10-01T20:00:00Z'), v: 1 }, { date: new Date('2026-10-02T01:00:00Z'), v: 2 }];
    expect(lastPerDay(pts).map((p) => p.v)).toEqual([2]);
  });
});

describe('dataAgeSpreadDays', () => {
  it('gap between oldest and newest data', () => {
    const at = (iso) => ({ lastUpdate: new Date(iso) });
    expect(dataAgeSpreadDays([at('2026-06-15T00:00:00Z'), at('2026-10-23T00:00:00Z')])).toBe(130);
    expect(dataAgeSpreadDays([at('2026-10-23T00:00:00Z')])).toBeNull();
  });
});
