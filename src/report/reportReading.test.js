import { describe, it, expect } from 'vitest';
import { readingFor } from './reportReading.js';

const ind = (key, values, extra = {}) => ({
  key,
  items: values.map((value, i) => ({ label: `r${i}`, value, n: 10, sampled: false, atLeast: false })),
  unavailable: [],
  median: values.length ? [...values].sort((a, b) => a - b)[values.length >> 1] : null,
  ...extra,
});
const summary = { allSolo: false, analyzed: 3 };
const keys = (lines) => lines.map((l) => l.key);

describe('readingFor', () => {
  it('says so when nothing was measured', () => {
    expect(readingFor(ind('ci', []), summary)).toEqual([{ key: 'none', params: { count: 3 } }]);
  });

  it('single repository vs range', () => {
    expect(keys(readingFor(ind('ci', [50]), summary))).toEqual(['single']);
    expect(readingFor(ind('ci', [10, 20, 30]), summary)[0]).toEqual({ key: 'range', params: { count: 3, min: 10, max: 30, median: 20 } });
  });

  it('flags an outlier only above twice the median and with a non-zero median', () => {
    expect(keys(readingFor(ind('commits', [10, 12, 40]), summary))).toContain('outlier');
    expect(keys(readingFor(ind('commits', [10, 12, 15]), summary))).not.toContain('outlier');
    expect(keys(readingFor(ind('commits', [0, 0, 9]), summary))).not.toContain('outlier');
  });

  it('solo class explains approval and concentration', () => {
    const solo = { allSolo: true, analyzed: 3 };
    expect(keys(readingFor(ind('approved', [0, 0, 0]), solo))).toContain('solo');
    expect(keys(readingFor(ind('ci', [0, 0, 0]), solo))).not.toContain('solo');
  });

  it('AI indicators always carry the lower-bound note', () => {
    expect(keys(readingFor(ind('aiCommits', [14, 15, 85]), summary))).toContain('lowerBound');
  });

  it('reports sampled and unavailable counts', () => {
    const i = ind('leadTime', [1, 2]);
    i.items[0].sampled = true;
    i.unavailable = ['x'];
    const lines = readingFor(i, summary);
    expect(lines.find((l) => l.key === 'sampled').params.count).toBe(1);
    expect(lines.find((l) => l.key === 'unavailable').params.count).toBe(1);
  });
});
