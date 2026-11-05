import { describe, it, expect, vi, beforeEach } from 'vitest';

// The whole data pipeline with the GitHub layer mocked: which requests are
// made, what the report says and whether the snapshot is saved.
const { github, saveSearch } = vi.hoisted(() => ({ github: {}, saveSearch: vi.fn() }));
vi.mock('../services/githubService.js', () => ({ githubService: github, hasGithubToken: () => false }));
vi.mock('../services/analytics.js', () => ({ default: { saveSearch } }));
vi.mock('../i18n.js', () => ({ default: { t: (key) => key } }));
vi.mock('../lib/chartSetup.js', () => ({ ensureChartSetup: () => Promise.resolve() }));

import { fetchRepositoryData } from './useRepository.js';

const statsError = (code) => Object.assign(new Error(`GitHub stats ${code}`), { code });
const tooLarge = () => Object.assign(new Error('Contributors failed: HTTP 403'), { code: 'TOO_LARGE' });
const SEARCH = ['fetchPullRequests', 'fetchMergedPRsCount', 'fetchOpenIssuesCount', 'fetchClosedIssuesCount'];

// torvalds/linux as GitHub answered it on 2026-11-05: a read-only mirror
// (PRs and issues off), /stats/contributors 504, /contributors 403 "too large".
function mockLinux(overrides = {}) {
  Object.assign(github, {
    fetchRepository: vi.fn(async () => ({
      full_name: 'torvalds/linux', private: false, default_branch: 'master', description: 'Linux kernel source tree',
      language: 'C', created_at: '2011-09-04T22:48:12Z', pushed_at: '2026-11-05T12:00:00Z', owner: { type: 'User' },
      stargazers_count: 200000, forks_count: 58000, subscribers_count: 8000,
      has_pull_requests: false, has_issues: false,
    })),
    fetchCommits: vi.fn(async () => []),
    fetchBranchCount: vi.fn(async () => 1),
    fetchContributorStats: vi.fn(async () => { throw new Error('Contributor stats failed: HTTP 504'); }),
    fetchContributors: vi.fn(async () => { throw tooLarge(); }),
    fetchRecentPullRequests: vi.fn(async () => []),
    fetchPullRequestStats: vi.fn(async () => []),
    fetchLanguages: vi.fn(async () => ({ C: 100 })),
    fetchCommunityProfile: vi.fn(async () => ({ files: { readme: {}, license: {} } })),
    fetchRepositoryTree: vi.fn(async () => ({ tree: [{ path: 'README', type: 'blob' }], truncated: false })),
    fetchReleases: vi.fn(async () => []),
    fetchCommitActivity: vi.fn(async () => ({ all: [] })),
    fetchCodeFrequency: vi.fn(async () => { throw statsError('TOO_LARGE'); }),
    fetchPunchCard: vi.fn(async () => []),
    fetchActionRuns: vi.fn(async () => ({ total_count: 0, workflow_runs: [] })),
    ...Object.fromEntries(SEARCH.map((name) => [name, vi.fn(async () => 7)])),
    ...overrides,
  });
}

describe('fetchRepositoryData: read-only mirrors and contributors GitHub won\'t list', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    saveSearch.mockReset().mockResolvedValue(42);
  });

  it('PRs/issues disabled: no Search requests, "disabled" instead of zeros', async () => {
    mockLinux();
    const report = await fetchRepositoryData('torvalds/linux');
    for (const name of [...SEARCH, 'fetchRecentPullRequests', 'fetchPullRequestStats']) expect(github[name]).not.toHaveBeenCalled();
    expect(report.features).toEqual({ pullRequests: false, issues: false });
    expect(report.stats).toMatchObject({ prs: null, merges: null, prsPerBranch: 'N/A' });
    expect(report.metrics).toMatchObject({ openIssues: null, closedIssues: null });
    expect(report.metrics.leadTime.reason).toBe('disabled');
    expect(report.codeReview.reason).toBe('disabled');
    expect(report.reviewProcess.reason).toBe('disabled');
  });

  it('contributors GitHub refuses to list (TOO_LARGE): no partial-data warning, snapshot saved as unavailable', async () => {
    mockLinux();
    const report = await fetchRepositoryData('torvalds/linux');
    expect(report._warnings).toBeUndefined();
    expect(report.busFactor).toEqual({ level: 'unavailable', reason: 'tooLarge' });
    expect(report.contributors).toBeNull();
    expect(saveSearch).toHaveBeenCalledOnce();
    expect(report.searchId).toBe(42);
  });

  it('any other contributor failure still warns and blocks the snapshot', async () => {
    mockLinux({ fetchContributors: vi.fn(async () => { throw new Error('Contributors failed: HTTP 403'); }) });
    const report = await fetchRepositoryData('torvalds/linux');
    expect(report._warnings).toEqual(['contributors']);
    expect(report.busFactor).toEqual({ level: 'unavailable' });
    expect(saveSearch).not.toHaveBeenCalled();
    expect(report.searchId).toBeNull();
  });

  it('PRs/issues enabled: the counts are requested and kept as measured', async () => {
    mockLinux({
      fetchRepository: vi.fn(async () => ({ full_name: 'o/r', private: false, default_branch: 'main', created_at: '2020-01-01T00:00:00Z', owner: { type: 'User' }, has_pull_requests: true, has_issues: true })),
    });
    const report = await fetchRepositoryData('o/r');
    for (const name of SEARCH) expect(github[name]).toHaveBeenCalledOnce();
    expect(report.features).toEqual({ pullRequests: true, issues: true });
    expect(report.stats).toMatchObject({ prs: 7, merges: 7 });
    expect(report.metrics.leadTime.reason).toBe('noMerged');
  });
});
