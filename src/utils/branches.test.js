import { describe, it, expect } from 'vitest';
import { isLongLivedBranch, analyzeBranches } from './branches.js';

const NOW = Date.UTC(2026, 9, 23);
const daysAgo = (d) => new Date(NOW - d * 864e5).toISOString();
const branch = (name, ageDays, { protectedBranch = false } = {}) => ({ name, committedDate: daysAgo(ageDays), protected: protectedBranch });

describe('isLongLivedBranch (release/maintenance lines are not zombies)', () => {
  it.each([
    '0.3-stable', '17.0.1', '18-3-1', '18-3', 'v4', 'v4-dev', '5.x', '4.x', '1.2.x',
    'release/1.2', 'releases/2026-10', 'release-3.0',
    'stable', 'lts', 'gh-pages', 'main', 'master', 'develop', 'dev', 'trunk',
  ])('%s → long-lived', (name) => {
    expect(isLongLivedBranch(name)).toBe(true);
  });

  it.each(['feature/login', 'fix-typo', 'dependabot/npm/vite-8', 'wip', 'experiment-graphql', 'refactor', 'hotfix/login-crash', '123', '123-fix', '42-wip', '2024'])('%s → short-lived', (name) => {
    expect(isLongLivedBranch(name)).toBe(false);
  });
});

describe('analyzeBranches', () => {
  it('counts only short-lived branches inactive for more than 90 days', () => {
    const result = analyzeBranches([
      branch('main', 400),           // default branch
      branch('0.3-stable', 4000),    // release line
      branch('feature/old', 200),    // zombie
      branch('fix/older', 91),       // zombie
      branch('feature/recent', 10),  // active
      branch('locked', 300, { protectedBranch: true }), // protected
    ], { defaultBranch: 'main', nowMs: NOW });
    expect(result).toEqual({ zombies: 2, checked: 3, excludedDefault: 1, excludedLongLived: 1, excludedProtected: 1, unknownDate: 0 });
  });

  it('exactly 90 days is not yet a zombie', () => {
    expect(analyzeBranches([branch('feature/x', 90)], { defaultBranch: 'main', nowMs: NOW }).zombies).toBe(0);
  });

  it('a branch without a commit date is counted as unknownDate, not silently dropped', () => {
    const result = analyzeBranches([{ name: 'feature/x', committedDate: null, protected: false }], { defaultBranch: 'main', nowMs: NOW });
    expect(result).toEqual({ zombies: 0, checked: 0, excludedDefault: 0, excludedLongLived: 0, excludedProtected: 0, unknownDate: 1 });
  });
});
