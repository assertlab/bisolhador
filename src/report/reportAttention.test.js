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
    expect(find(points, 'aiLowDeclared').params).toMatchObject({ names: 'b (10%)', threshold: 25 });
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
    expect(attentionPoints(solo, fmt).some((p) => p.key === 'unmeasured' && p.indicator === 'firstReview')).toBe(false);
  });

  it('an unmeasured indicator is listed with its repositories (n/d), never as zero', () => {
    const model = base();
    model.indicators.find((i) => i.key === 'ci').unavailable = ['x'];
    const p = attentionPoints(model, fmt).find((q) => q.key === 'unmeasured' && q.indicator === 'ci');
    expect(p.params).toMatchObject({ names: 'x', count: 1 });
  });

  it('an indicator unmeasured in every repository is one line, not a list of names', () => {
    const p = attentionPoints(base(), fmt).find((q) => q.indicator === 'firstReview');
    expect(p).toMatchObject({ key: 'unmeasuredAll', params: { count: 3 } });
    expect(p.params.names).toBeUndefined();
  });

  it('partial samples and unanalyzed repositories are reported', () => {
    const points = attentionPoints(base({ summary: { failed: 1, duplicates: 2, partialLabels: ['a', 'b'] } }), fmt);
    expect(find(points, 'notAnalyzed').params.count).toBe(3);
    expect(find(points, 'partial').params).toMatchObject({ names: 'a, b', count: 2 });
  });

  it('a tool with a high declared share, or without AI traces, is not listed', () => {
    const points = attentionPoints(base(), fmt);
    expect(find(points, 'aiLowDeclared').params.names).not.toContain('a');
    expect(find(points, 'aiLowDeclared').params.names).not.toContain('s');
  });

  it('nothing to report gives an empty list', () => {
    const quiet = base();
    quiet.indicators = [ind('authors', [['a', 2]]), ind('topShare', [['a', 50]], [], 'percent'), ind('approved', [['a', 50]], [], 'percent'), ind('prSize', [['a', 100]]), ind('ci', [['a', 99]], [], 'percent'), ind('aiCommits', [['a', 50]], [], 'percent'), ind('firstReview', [['a', 1]])];
    quiet.ai = [{ label: 'a', tools: ['claude'], flags: [] }];
    expect(attentionPoints(quiet, fmt)).toEqual([]);
  });
});
