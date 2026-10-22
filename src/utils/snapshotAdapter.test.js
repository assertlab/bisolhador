import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseFullReport, createMockRepoData } from './snapshotAdapter.js';

describe('parseFullReport', () => {
  afterEach(() => vi.restoreAllMocks());

  it('parses a JSON string', () => {
    expect(parseFullReport('{"metrics":{"stars":10}}', 'test')).toEqual({ metrics: { stars: 10 } });
  });

  it('returns an already-parsed object as is (Supabase jsonb column)', () => {
    const report = { metrics: { stars: 10 } };
    expect(parseFullReport(report, 'test')).toBe(report);
  });

  it.each([null, undefined, ''])('returns null for empty value %j', (value) => {
    expect(parseFullReport(value, 'test')).toBeNull();
  });

  it('returns null and warns with the caller context on malformed JSON', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseFullReport('{not json', 'Timeline')).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain('[Timeline]');
  });
});

describe('createMockRepoData', () => {
  it('builds the dashboard shape from flat snapshot columns', () => {
    const data = createMockRepoData({ repo_name: 'owner/repo', stars: 5, forks: 2 });
    expect(data.fullName).toBe('owner/repo');
    expect(data.url).toBe('https://github.com/owner/repo');
    expect(data.metrics).toMatchObject({ stars: 5, forks: 2, openIssues: 0 });
  });

  it('falls back to N/A without a repo name', () => {
    expect(createMockRepoData({}).fullName).toBe('N/A');
  });
});
