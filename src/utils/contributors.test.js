import { describe, it, expect } from 'vitest';
import { isBot, peopleFromStats, peopleFromContributors, analyzeContributors, topShareLevel, normalizeSnapshotContributors } from './contributors.js';

const WEEK = 7 * 24 * 3600;
const NOW = Date.UTC(2026, 9, 23) / 1000; // 2026-10-23, in seconds like the API
// /stats/contributors entry: weeks oldest → newest, w = week start (unix s), c = commits
const statsEntry = (login, weeklyCommits, { type = 'User' } = {}) => ({
  author: { login, avatar_url: `https://avatars/${login}`, type },
  total: weeklyCommits.reduce((a, b) => a + b, 0),
  weeks: weeklyCommits.map((c, i) => ({ w: NOW - (weeklyCommits.length - 1 - i) * WEEK, a: 0, d: 0, c })),
});
const old = (n) => [...Array(100).fill(0).map((_, i) => (i === 0 ? n : 0)), ...Array(60).fill(0)]; // all commits > 1 year ago
const recent = (n) => [...Array(100).fill(0), ...Array(59).fill(0), n]; // all commits this week

describe('isBot', () => {
  it.each([
    [{ login: 'dependabot[bot]', type: 'Bot' }, true],
    [{ login: 'renovate[bot]', type: 'User' }, true],
    [{ login: 'github-actions', type: 'Bot' }, true],
    [{ login: 'gaearon', type: 'User' }, false],
    [null, false],
  ])('%j → %s', (author, expected) => {
    expect(isBot(author)).toBe(expected);
  });
});

describe('peopleFromStats', () => {
  it('splits all-time and last-52-weeks commits, humans only, sorted', () => {
    const result = peopleFromStats([
      statsEntry('tj', old(500)),
      statsEntry('dependabot[bot]', recent(80), { type: 'Bot' }),
      statsEntry('alice', recent(30)),
      statsEntry('bob', recent(10)),
    ], { nowSeconds: NOW });
    expect(result.allTime.map((p) => [p.login, p.commits])).toEqual([['tj', 500], ['alice', 30], ['bob', 10]]);
    expect(result.recent.map((p) => [p.login, p.commits])).toEqual([['alice', 30], ['bob', 10]]);
    expect(result.botsExcluded).toBe(1);
  });

  it('skips entries without an author (deleted accounts)', () => {
    const result = peopleFromStats([{ author: null, total: 5, weeks: [] }, statsEntry('a', recent(1))], { nowSeconds: NOW });
    expect(result.allTime.map((p) => p.login)).toEqual(['a']);
  });
});

describe('peopleFromContributors (REST fallback: all-time only)', () => {
  it('maps contributions, excludes bots, has no recent window', () => {
    const result = peopleFromContributors([
      { login: 'a', avatar_url: 'x', contributions: 5, type: 'User' },
      { login: 'renovate[bot]', avatar_url: 'y', contributions: 9, type: 'Bot' },
    ]);
    expect(result).toEqual({ allTime: [{ login: 'a', avatar_url: 'x', commits: 5 }], recent: null, botsExcluded: 1, capped: false });
  });
});

describe('analyzeContributors', () => {
  it('uses the last 12 months when there is enough recent activity (not a maintainer gone since 2014)', () => {
    const people = peopleFromStats([statsEntry('tj', old(500)), statsEntry('alice', recent(30)), statsEntry('bob', recent(25))], { nowSeconds: NOW });
    const a = analyzeContributors(people, { source: 'stats' });
    expect(a.window).toBe('recent');
    expect(a.top.login).toBe('alice');
    expect(a.keyDevelopers.map((d) => d.login)).toEqual(['alice', 'bob']);
  });

  it('falls back to all-time when recent activity is too small to support a conclusion', () => {
    const people = peopleFromStats([statsEntry('tj', old(500)), statsEntry('alice', recent(2))], { nowSeconds: NOW });
    const a = analyzeContributors(people, { source: 'stats' });
    expect(a.window).toBe('allTime');
    expect(a.top.login).toBe('tj');
  });

  it('REST fallback is all-time and marked partial', () => {
    const a = analyzeContributors(peopleFromContributors([{ login: 'a', avatar_url: 'x', contributions: 5 }]), { source: 'contributors' });
    expect(a).toMatchObject({ window: 'allTime', partial: true });
  });

  it('top share and table percentages use the same denominator', () => {
    const people = peopleFromStats([statsEntry('alice', recent(60)), statsEntry('bob', recent(40))], { nowSeconds: NOW });
    const a = analyzeContributors(people, { source: 'stats' });
    expect(a.top).toEqual({ login: 'alice', avatar_url: 'https://avatars/alice', percentage: 60, level: 'warning' });
    expect(a.table.map((p) => p.percentage)).toEqual([60, 40]);
  });

  it('flags lists capped at the top 100 contributors (both sources are)', () => {
    const many = Array.from({ length: 100 }, (_, i) => statsEntry(`p${i}`, recent(1)));
    expect(analyzeContributors(peopleFromStats(many, { nowSeconds: NOW }), { source: 'stats' }).capped).toBe(true);
  });

  it('no humans → none', () => {
    const a = analyzeContributors({ allTime: [], recent: [], botsExcluded: 2 }, { source: 'stats' });
    expect(a).toMatchObject({ busFactor: 0, top: null, botsExcluded: 2 });
  });
});

describe('topShareLevel (single threshold set for Dashboard and Benchmark)', () => {
  it.each([[61, 'critical'], [60, 'warning'], [41, 'warning'], [40, 'healthy'], [null, 'none']])('%s%% → %s', (pct, level) => {
    expect(topShareLevel(pct)).toBe(level);
  });
});

describe('normalizeSnapshotContributors (reading persisted full_report)', () => {
  it('pre-v3.8.0 data (no window) → not recorded, input untouched', () => {
    const old = { fullName: 'o/r', contributors: [{ login: 'a' }], busFactor: { level: 'critical', percentage: 90 }, busFactorAnalysis: { busFactor: 1, keyDevelopers: [] } };
    const copy = structuredClone(old);
    expect(normalizeSnapshotContributors(old)).toEqual({ fullName: 'o/r', contributors: null, busFactor: { level: 'notRecorded' }, busFactorAnalysis: null });
    expect(old).toEqual(copy);
  });

  it('current-method data is kept', () => {
    const current = { busFactor: { level: 'healthy', percentage: 20 }, busFactorAnalysis: { window: 'recent' }, contributors: [] };
    expect(normalizeSnapshotContributors(current)).toBe(current);
  });
});
