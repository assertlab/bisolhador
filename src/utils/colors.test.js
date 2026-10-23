import { describe, it, expect } from 'vitest';
import { generateColor, withAlpha } from './colors.js';

describe('withAlpha', () => {
  it('hsl → valid hsla (appending a hex alpha to hsl() was invalid CSS)', () => {
    expect(withAlpha(generateColor(0), 0.5)).toBe('hsla(0, 70%, 50%, 0.5)');
    expect(withAlpha('hsl(137.508, 70%, 50%)', 0.125)).toBe('hsla(137.508, 70%, 50%, 0.125)');
  });

  it('leaves other color formats untouched', () => {
    expect(withAlpha('#ff0000', 0.5)).toBe('#ff0000');
  });
});
