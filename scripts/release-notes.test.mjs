import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { releaseNotes } from './release-notes.mjs';

const changelog = `# Changelog

## [3.8.0] - 2026-10-23

### Fixed
- Contributors without bots.

---

## [3.7.1] - 2026-10-23

- N/A instead of 0.

---
`;
const readme = '## Últimas\n\n### v3.8.0 - Contribuidores Confiáveis\n- x\n';

describe('releaseNotes', () => {
  it('takes the CHANGELOG section and the README title for the version', () => {
    const { title, notes } = releaseNotes('v3.8.0', { changelog, readme });
    expect(title).toBe('v3.8.0 - Contribuidores Confiáveis');
    expect(notes).toContain('- Contributors without bots.');
    expect(notes).not.toContain('N/A instead of 0');
    expect(notes).toContain('blob/v3.8.0/docs/CHANGELOG.md');
  });

  it('falls back to the bare version when the README has no title for it', () => {
    expect(releaseNotes('v3.7.1', { changelog, readme }).title).toBe('v3.7.1');
  });

  it('fails clearly when the CHANGELOG has no section for the version', () => {
    expect(() => releaseNotes('v9.9.9', { changelog, readme })).toThrow(/no "## \[9\.9\.9\]" section/);
  });

  it('works on the real docs for the current release', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    const real = releaseNotes(`v${pkg.version}`, {
      changelog: readFileSync('docs/CHANGELOG.md', 'utf8'),
      readme: readFileSync('README.md', 'utf8'),
    });
    expect(real.title).toMatch(new RegExp(`^v${pkg.version} - .+`));
    expect(real.notes.length).toBeGreaterThan(100);
  });
});
