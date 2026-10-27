import { describe, it, expect } from 'vitest';
import { attentionPoints } from './reportAttention.js';

const fmt = (unit, v) => (unit === 'percent' ? `${v}%` : String(v));
const ind = (key, entries, unavailable = [], unit = 'count') => ({ key, unit, items: entries.map(([label, value]) => ({ label, value })), unavailable });
const base = (over = {}) => ({
  summary: { failed: 0, duplicates: 0, partialLabels: [], allSolo: false, ...over.summary },
  indicators: [
    ind('authors', [['a', 3], ['b', 2], ['s', 1]]),
    ind('topShare', [['a', 50], ['b', 80], ['s', 100]], [], 'percent'),
    ind('approved', [['a', 40], ['b', 0], ['s', 0]], [], 'percent'),
    ind('prSize', [['a', 100], ['b', 500], ['s', 120]]),
    ind('ci', [['a', 95], ['b', 60], ['s', 100]], [], 'percent'),
    ind('aiCommits', [['a', 40], ['b', 10], ['s', 0]], [], 'percent'),
    ind('firstReview', [], ['a', 'b', 's']),
    ...(over.indicators ?? []),
  ],
  ai: [
    { label: 'a', tools: ['claude'], flags: [] },
    { label: 'b', tools: ['claude'], flags: ['configWithoutDeclaration'] },
    { label: 's', tools: [], flags: null },
  ],
  ...over.rest,
});
const keys = (points) => points.map((p) => p.key);
const find = (points, key) => points.find((p) => p.key === key);

describe('attentionPoints', () => {
  it('lists each rule with the repositories and values, neutral and without ranking', () => {
    const points = attentionPoints(base(), fmt);
    expect(find(points, 'ciLow').params).toMatchObject({ names: 'b (60%)', threshold: 80 });
    expect(find(points, 'bigPrs').params).toMatchObject({ names: 'b (500)', threshold: 400 });
    expect(find(points, 'aiDisagree').params.names).toBe('b');
  });

  it('low declared share: a trace and under 25%, rounded, and 400 lines counts as "not small"', () => {
    const model = base();
    model.ai[1] = { label: 'b', tools: ['claude'], flags: [] };
    expect(find(attentionPoints(model, fmt), 'aiLowDeclared').params).toMatchObject({ names: 'b (10%)', threshold: 25 });
    model.indicators = model.indicators.map((i) => (i.key === 'prSize' ? ind('prSize', [['a', 400]]) : i));
    expect(find(attentionPoints(model, fmt), 'bigPrs').params.names).toBe('a (400)');
  });

  it('concentration and peer approval only count for teams of more than one author', () => {
    const points = attentionPoints(base(), fmt);
    expect(find(points, 'concentration').params.names).toBe('b (80%)'); // s is solo at 100%: not listed
    expect(find(points, 'noPeerApproval').params.names).toBe('b (0%)'); // s is solo at 0%: not listed
  });

  it('a class of individual projects gets no concentration, approval or first-review points', () => {
    const solo = base({
      summary: { allSolo: true },
      rest: {},
      indicators: [],
    });
    solo.indicators = solo.indicators.map((i) => (i.key === 'authors' ? ind('authors', [['a', 1], ['b', 1], ['s', 1]]) : i));
    const ks = keys(attentionPoints(solo, fmt));
    expect(ks).not.toContain('concentration');
    expect(ks).not.toContain('noPeerApproval');
    expect(find(attentionPoints(solo, fmt), 'unmeasuredAll')).toBeUndefined(); // first review n/d is expected
  });

  it('n/d goes in two lines at most: missing everywhere, and missing in some (with the repositories)', () => {
    const model = base();
    model.indicators.find((i) => i.key === 'ci').unavailable = ['x'];
    const points = attentionPoints(model, fmt);
    expect(points.filter((p) => p.key.startsWith('unmeasured'))).toHaveLength(2);
    expect(find(points, 'unmeasuredAll').indicators).toEqual(['firstReview']);
    expect(find(points, 'unmeasuredSome').entries).toEqual([{ indicator: 'ci', names: 'x' }]);
  });

  it('a repository with no merged PR is the signal, not four "not measured" lines', () => {
    const model = base();
    model.indicators.push(ind('mergedPrs', [['a', 5], ['b', 0]]));
    model.indicators.find((i) => i.key === 'prSize').unavailable = ['b'];
    const points = attentionPoints(model, fmt);
    expect(find(points, 'noMergedPrs').params.names).toBe('b');
    // prSize is n/d only for b (no PRs): not repeated as "not measured"
    expect((find(points, 'unmeasuredSome')?.entries ?? []).some((e) => e.indicator === 'prSize')).toBe(false);
  });

  it('a repository already listed as "sources disagree" is not listed again as low declared', () => {
    const points = attentionPoints(base(), fmt);
    expect(find(points, 'aiDisagree').params.names).toBe('b');
    expect(find(points, 'aiLowDeclared')).toBeUndefined(); // b was the only one under 25% with a trace
  });

  it('thresholds compare the printed (rounded) value: 79.6% prints as 80% and is not "below 80%"', () => {
    const model = base();
    model.indicators = model.indicators.map((i) => (i.key === 'ci' ? ind('ci', [['a', 79.6]], [], 'percent') : i));
    expect(find(attentionPoints(model, fmt), 'ciLow')).toBeUndefined();
    model.indicators = model.indicators.map((i) => (i.key === 'ci' ? ind('ci', [['a', 79.4]], [], 'percent') : i));
    expect(find(attentionPoints(model, fmt), 'ciLow').params.names).toBe('a (79.4%)');
  });

  it('partial samples and unanalyzed repositories are reported', () => {
    const points = attentionPoints(base({ summary: { failed: 1, duplicates: 2, partialLabels: ['a', 'b'] } }), fmt);
    expect(find(points, 'notAnalyzed').params.count).toBe(3);
    expect(find(points, 'partial').params).toMatchObject({ names: 'a, b', count: 2 });
  });

  it('a tool with a high declared share, or without AI traces, is not listed', () => {
    const model = base();
    model.ai[1] = { label: 'b', tools: ['claude'], flags: [] }; // b under 25% and with a trace: listed
    const names = find(attentionPoints(model, fmt), 'aiLowDeclared').params.names;
    expect(names).toContain('b');
    expect(names).not.toContain('a'); // 40%: above the threshold
    expect(names).not.toContain('s'); // 0% but no AI trace at all
  });

  it('nothing to report gives an empty list', () => {
    const quiet = base();
    quiet.indicators = [ind('authors', [['a', 2]]), ind('topShare', [['a', 50]], [], 'percent'), ind('approved', [['a', 50]], [], 'percent'), ind('prSize', [['a', 100]]), ind('ci', [['a', 99]], [], 'percent'), ind('aiCommits', [['a', 50]], [], 'percent'), ind('firstReview', [['a', 1]])];
    quiet.ai = [{ label: 'a', tools: ['claude'], flags: [] }];
    expect(attentionPoints(quiet, fmt)).toEqual([]);
  });
});
