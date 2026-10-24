import { describe, it, expect } from 'vitest';
import {
  analyzeCiRuns, analyzeConventionalCommits, analyzeReleases, isConventionalCommit, isSemverTag, normalizeSnapshotPractices,
} from './projectPractices.js';

const T0 = Date.UTC(2026, 9, 24);
const iso = (ms) => new Date(ms).toISOString();
const run = (conclusion, minutes = 2, { event = 'push', at = T0 } = {}) => ({ conclusion, event, run_started_at: iso(at), updated_at: iso(at + minutes * 60000) });

describe('analyzeCiRuns', () => {
  it('success rate over conclusive runs; cancelled/skipped ignored; median duration', () => {
    const r = analyzeCiRuns({ total_count: 6, workflow_runs: [run('success', 1), run('success', 3), run('failure', 5), run('timed_out', 60), run('cancelled'), run('skipped')] });
    expect(r).toMatchObject({ available: true, successPercentage: 50, medianMinutes: 4, n: 4 });
  });

  it('pull_request runs are left out (main line only)', () => {
    const r = analyzeCiRuns({ total_count: 2, workflow_runs: [run('success'), run('failure', 1, { event: 'pull_request' })] });
    expect(r).toMatchObject({ successPercentage: 100, n: 1 });
  });

  it('no runs at all vs only inconclusive runs vs failed request', () => {
    expect(analyzeCiRuns({ total_count: 0, workflow_runs: [] })).toMatchObject({ available: false, reason: 'noRuns' });
    expect(analyzeCiRuns({ total_count: 1, workflow_runs: [run('cancelled')] })).toMatchObject({ available: false, reason: 'noConclusive' });
    expect(analyzeCiRuns(null)).toEqual({ available: false, reason: 'error' });
  });
});

describe('Conventional Commits', () => {
  it.each([
    ['feat: add login', true], ['fix(api): handle 404', true], ['feat!: drop node 16', true], ['chore(deps)!: bump', true],
    ['Fix: typo', false], ['feat:no space', false], ['update readme', false], ['Merge pull request #1', false], ['feature: x', false],
  ])('%j → %s', (msg, ok) => {
    expect(isConventionalCommit(msg)).toBe(ok);
  });

  it('only the subject line counts', () => {
    expect(isConventionalCommit('docs: explain\n\nBody without prefix')).toBe(true);
  });

  const commit = (message, { parents = 1, login = 'a', type = 'User' } = {}) => ({ commit: { message, author: { name: login } }, author: { login, type }, parents: Array(parents).fill({}) });
  it('share over non-merge human commits', () => {
    const r = analyzeConventionalCommits([
      commit('feat: a'), commit('fix: b'), commit('wip'), commit('Merge branch x', { parents: 2 }),
      commit('chore(deps): bump', { login: 'dependabot[bot]', type: 'Bot' }),
    ]);
    expect(r).toMatchObject({ available: true, percentage: 67, n: 3 });
  });

  it('failed request vs no commits', () => {
    expect(analyzeConventionalCommits(null)).toEqual({ available: false, reason: 'error' });
    expect(analyzeConventionalCommits([])).toMatchObject({ available: false, reason: 'noCommits' });
  });
});

describe('analyzeReleases', () => {
  const rel = (tag, daysAgo, extra = {}) => ({ tag_name: tag, created_at: iso(T0 - daysAgo * 86400000), published_at: iso(T0), draft: false, ...extra });

  it('dated by created_at (commit), not published_at (backfilled releases)', () => {
    const r = analyzeReleases([rel('v1.0.0', 100), rel('v1.1.0', 60), rel('v1.2.0', 20)], T0);
    expect(r).toMatchObject({ available: true, last12Months: 3, medianIntervalDays: 40, daysSinceLast: 20, semverPercentage: 100, n: 3 });
  });

  it('same-day releases (two maintained lines) are one release day', () => {
    const r = analyzeReleases([rel('v4.0.1', 90), rel('v5.0.1', 90), rel('v4.0.2', 30), rel('v5.0.2', 30)], T0);
    expect(r).toMatchObject({ last12Months: 4, medianIntervalDays: 60 });
  });

  it('only the last 12 months set the cadence; SemVer over all; drafts excluded', () => {
    const r = analyzeReleases([rel('v0.1.0', 900), rel('v0.2.0', 800), rel('nightly', 200), rel('v1.0.0', 100), rel('v9', 1, { draft: true })], T0);
    expect(r).toMatchObject({ last12Months: 2, medianIntervalDays: 100, daysSinceLast: 100, semverPercentage: 75, n: 4 });
  });

  it('a full page (100) inside the window is capped ("100+")', () => {
    const many = Array.from({ length: 100 }, (_, i) => rel(`v1.0.${i}`, i));
    expect(analyzeReleases(many, T0)).toMatchObject({ last12Months: 100, capped: true });
    expect(analyzeReleases(many.slice(0, 10), T0).capped).toBe(false);
  });

  it('no release in 12 months / none / failed', () => {
    expect(analyzeReleases([rel('v1.0.0', 500)], T0)).toMatchObject({ available: true, last12Months: 0, medianIntervalDays: null, daysSinceLast: 500 });
    expect(analyzeReleases([], T0)).toMatchObject({ available: false, reason: 'noReleases' });
    expect(analyzeReleases(null)).toEqual({ available: false, reason: 'error' });
  });

  it.each([['v1.2.3', true], ['1.0.0-rc.1+build.5', true], ['v1.2', false], ['release-1.2.3', false], ['01.2.3', false]])('SemVer %s → %s', (tag, ok) => {
    expect(isSemverTag(tag)).toBe(ok);
  });
});

describe('normalizeSnapshotPractices', () => {
  it('old reports and transient failures → not recorded; current-method data kept', () => {
    const ci = { available: true, successPercentage: 90, n: 10, method: 'v1' };
    const r = normalizeSnapshotPractices({ practices: { ci, commits: { available: false, reason: 'error' } } });
    expect(r.practices).toEqual({ ci, commits: { available: false, reason: 'snapshot' }, releases: { available: false, reason: 'snapshot' } });
    expect(normalizeSnapshotPractices({}).practices.ci).toEqual({ available: false, reason: 'snapshot' });
  });
});
