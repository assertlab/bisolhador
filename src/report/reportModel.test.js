import { describe, it, expect } from 'vitest';
import { buildReportModel, median, REPORT_INDICATORS } from './reportModel.js';

const ai = (over = {}) => ({
  available: true,
  config: { status: 'complete', entries: [] },
  commits: { available: true, percentage: 40, withAi: 4, n: 10 },
  prs: { available: true, percentage: null, byAgents: 0, n: 0 },
  tools: [{ id: 'claude', sources: ['commit'] }],
  coherence: { flags: [], unverified: [] },
  badge: { applicable: true, met: 3, total: 3, criteria: [{ state: 'met' }, { state: 'met' }, { state: 'met' }, { state: 'unverified' }, { state: 'unverified' }] },
  ...over,
});

const row = (fullName, over = {}) => ({
  status: 'ok',
  fullName,
  isPrivate: true,
  commits: { available: true, commits: 20, authors: 1, humanCommits: 20, topSharePercentage: 100, capped: false, conventional: { available: true, percentage: 80, n: 20 } },
  prs: { available: true, merged: 5, capped: false, approvedPercentage: 0, approvedN: 5, firstReviewHours: null, leadTimeHours: 2, prSizeLines: 40 },
  ci: { available: false },
  releases: { count: 1, capped: false },
  ai: ai(),
  students: [{ login: 'maria-silva', commits: 20 }],
  ...over,
});

const input = (extra = {}) => ({
  repos: ['a/one', 'a/two', 'a/dup', 'a/gone'],
  rows: { 'a/one': row('a/one'), 'a/two': row('a/two', { prs: { available: true, merged: 9, capped: true, approvedPercentage: 50, approvedN: 9, firstReviewHours: 3, leadTimeHours: 8, prSizeLines: 90 } }), 'a/dup': row('a/one'), 'a/gone': { status: 'notFound' } },
  duplicateOf: (n) => (n === 'a/dup' ? 'a/one' : null),
  period: { from: '2026-06-28', to: '2026-10-26' },
  ...extra,
});

describe('median', () => {
  it('handles empty, odd and even lists', () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe('buildReportModel', () => {
  it('counts analyzed, partial, private and failed repositories, skipping duplicates', () => {
    const { summary } = buildReportModel(input());
    expect(summary).toEqual({ requested: 4, duplicates: 1, analyzed: 2, partial: 1, private: 2, allSolo: true, failed: 1 });
  });

  it('builds one entry per indicator with median, max and unit', () => {
    const { indicators } = buildReportModel(input());
    expect(indicators.map((i) => i.key)).toEqual(REPORT_INDICATORS);
    const lead = indicators.find((i) => i.key === 'leadTime');
    expect(lead).toMatchObject({ unit: 'hours', median: 5, max: 8 });
    expect(indicators.find((i) => i.key === 'approved').unit).toBe('percent');
    expect(indicators.find((i) => i.key === 'prSize').unit).toBe('count');
  });

  it('unmeasured values go to `unavailable`, never to zero', () => {
    const { indicators } = buildReportModel(input());
    const first = indicators.find((i) => i.key === 'firstReview');
    expect(first.items.map((i) => i.label)).toEqual(['a/two']);
    expect(first.unavailable).toEqual(['a/one']);
    const ci = indicators.find((i) => i.key === 'ci');
    expect(ci.items).toEqual([]);
    expect(ci.median).toBeNull();
    expect(ci.unavailable).toHaveLength(2);
  });

  it('carries n and the sampled / at-least flags', () => {
    const { indicators } = buildReportModel(input());
    const merged = indicators.find((i) => i.key === 'mergedPrs').items;
    expect(merged.map((i) => i.atLeast)).toEqual([false, true]);
    const approved = indicators.find((i) => i.key === 'approved').items;
    expect(approved[1]).toMatchObject({ value: 50, n: 9, sampled: true });
  });

  it('AI section keeps the badge with its unassessed criteria', () => {
    const { ai: section } = buildReportModel(input());
    expect(section[0]).toMatchObject({ label: 'a/one', tools: ['claude'], badge: { met: 3, total: 3, unverified: 2 } });
  });

  it('anonymizes names and drops the private count', () => {
    const model = buildReportModel(input({ anonymize: true, anonymousLabel: (l) => `Repositório ${l}` }));
    expect(model.summary.private).toBeNull();
    expect(model.ai.map((a) => a.label)).toEqual(['Repositório A', 'Repositório B']);
    expect(JSON.stringify(model)).not.toContain('a/one');
  });

  it('never carries per-student data', () => {
    const json = JSON.stringify(buildReportModel(input()));
    expect(json).not.toContain('maria-silva');
    expect(json).not.toContain('students');
  });
});
