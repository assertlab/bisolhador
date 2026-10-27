import { describe, it, expect } from 'vitest';
import { axisTicks, cleanSeries } from './chartScale.js';

describe('axisTicks', () => {
  it('round steps starting at zero, top at or above the max', () => {
    expect(axisTicks(0)).toEqual([0, 1]);
    expect(axisTicks(4)).toEqual([0, 1, 2, 3, 4]);
    expect(axisTicks(7)).toEqual([0, 2, 4, 6, 8]);
    expect(axisTicks(23)).toEqual([0, 10, 20, 30]);
    expect(axisTicks(1234)).toEqual([0, 500, 1000, 1500]);
  });

  it('never more than ~5 ticks, even for large values', () => {
    for (const max of [3, 99, 480, 5000, 20000, 73000]) expect(axisTicks(max).length).toBeLessThanOrEqual(6);
  });

  it('a stored snapshot cannot make it loop or build millions of ticks (NaN, Infinity, 1e12)', () => {
    expect(axisTicks(NaN)).toEqual([0, 1]);
    expect(axisTicks(Infinity)).toEqual([0, 1]);
    expect(axisTicks(1e12).length).toBeLessThanOrEqual(8);
    expect(axisTicks(-5)).toEqual([0, 1]);
  });
});

describe('cleanSeries', () => {
  it('keeps finite positive numbers, everything else becomes an empty column', () => {
    expect(cleanSeries([3, NaN, -1, Infinity, null, undefined, '5', 0, 2.5])).toEqual([3, 0, 0, 0, 0, 0, 0, 0, 2.5]);
  });
});
