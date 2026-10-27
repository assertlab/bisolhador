import { describe, it, expect } from 'vitest';
import { axisTicks } from './chartScale.js';

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
});
