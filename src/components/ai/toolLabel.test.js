import { describe, expect, it } from 'vitest';
import { AI_TOOLS } from '../../utils/aiRegistry.js';
import { toolLabel } from './toolLabel.js';

describe('toolLabel', () => {
  it('translates the generic tool', () => {
    const t = (key) => `tr:${key}`;
    expect(toolLabel('generic', t)).toBe('tr:aiProcess.genericTool');
  });

  it('does not throw for generic without a translator', () => {
    expect(() => toolLabel('generic')).not.toThrow();
    expect(toolLabel('generic')).toBe('Agentes (genérico)');
  });

  it('returns the registry label of a known id', () => {
    const label = AI_TOOLS.find((tool) => tool.id === 'claude').label;
    expect(toolLabel('claude', () => 'x')).toBe(label);
  });

  it('returns the id of an unknown tool', () => {
    expect(toolLabel('nope', () => 'x')).toBe('nope');
  });
});
