import { describe, it, expect } from 'vitest';
import { AI_TOOLS, GITIGNORE_AI_PATTERNS, GITIGNORE_AI_EXAMPLES } from './aiRegistry.js';
import { detectConfig, gitignoreHidesAi, toolsFromCoauthors } from './aiTraces.js';

// The display fields (rendered by /guia/ia) must describe what the detectors actually match.
const samplesOf = (show) => {
  if (show.startsWith('**/')) return [show.slice(3), `docs/${show.slice(3)}`];
  if (show.endsWith('/')) return [show.slice(0, -1), `${show}example.md`];
  return [show];
};

describe('registry display fields', () => {
  it('every config entry has a `show` that its own pattern matches, and that resolves to its tool', () => {
    for (const tool of AI_TOOLS) {
      for (const c of tool.config) {
        expect(typeof c.show, `${tool.id} ${c.re}`).toBe('string');
        for (const path of samplesOf(c.show)) {
          expect(c.re.test(path), `${tool.id}: ${path}`).toBe(true);
          expect(detectConfig([path])[0]?.toolId, path).toBe(tool.id);
        }
      }
    }
  });

  it('every co-author entry has examples that its e-mail (and name rule) match', () => {
    for (const tool of AI_TOOLS) {
      for (const c of tool.coauthors) {
        expect(c.examples?.length, tool.id).toBeGreaterThan(0);
        expect(Boolean(c.name), `${tool.id}: name rule shown`).toBe(Boolean(c.nameShow));
        if (c.name) expect(['contains', 'prefix']).toContain(c.nameMatch);
        for (const example of c.examples) {
          const email = example.replace('<id>+', '12345+');
          expect(c.email.test(email), `${tool.id}: ${email}`).toBe(true);
          const name = c.nameMatch === 'prefix' ? `${c.nameShow} (model)` : `Model ${c.nameShow ?? ''}`;
          expect(toolsFromCoauthors([{ name, email }]), `${tool.id}: ${email}`).toEqual([tool.id]);
        }
      }
    }
  });

  it('one .gitignore example per pattern, each matched by its pattern and detected', () => {
    expect(GITIGNORE_AI_EXAMPLES).toHaveLength(GITIGNORE_AI_PATTERNS.length);
    GITIGNORE_AI_EXAMPLES.forEach((line, i) => {
      const concrete = line.replaceAll('*', '.conf.yml');
      expect(GITIGNORE_AI_PATTERNS[i].test(concrete), line).toBe(true);
      expect(gitignoreHidesAi(concrete), line).toEqual([concrete]);
    });
  });
});
