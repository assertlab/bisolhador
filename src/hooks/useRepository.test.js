import { describe, it, expect, vi, beforeEach } from 'vitest';

// The whole data pipeline with the GitHub layer mocked: which requests are
// made, what the report says and whether the snapshot is saved.
const { github, gitlab, saveSearch, hasToken } = vi.hoisted(() => ({ github: {}, gitlab: {}, saveSearch: vi.fn(), hasToken: { value: false } }));
vi.mock('../services/githubService.js', () => ({ githubService: github }));
vi.mock('../services/gitlabService.js', () => ({ createGitlabService: () => gitlab }));
vi.mock('../services/tokens.js', () => ({ hasToken: () => hasToken.value }));
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
    fetchTagsCount: vi.fn(async () => 952),
    fetchTagDates: vi.fn(async () => { throw new Error('token only'); }),
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

  it('no releases but tags (no token): tag count recorded, cadence asks for a token; a tag failure changes nothing else', async () => {
    mockLinux();
    const report = await fetchRepositoryData('torvalds/linux');
    expect(github.fetchTagDates).not.toHaveBeenCalled();
    expect(report.stats).toMatchObject({ releases: 0, tags: 952 });
    expect(report.practices.releases).toMatchObject({ available: false, reason: 'tagsNoToken', tagsTotal: 952 });

    mockLinux({ fetchTagsCount: vi.fn(async () => { throw new Error('Tags failed: HTTP 500'); }) });
    const failed = await fetchRepositoryData('torvalds/linux');
    expect(failed.stats.tags).toBeUndefined();
    expect(failed.practices.releases).toMatchObject({ available: false, reason: 'noReleases' });
    expect(failed._warnings).toBeUndefined();
  });

  it('with a token, failed tag dates fall back to the count (not "no releases")', async () => {
    hasToken.value = true;
    try {
      mockLinux({ fetchPullRequestReviewStats: vi.fn(async () => null), fetchBranchActivity: vi.fn(async () => ({ totalCount: 1, branches: [], capped: false })), fetchAiRepoContext: vi.fn(async () => null) });
      const report = await fetchRepositoryData('torvalds/linux');
      expect(github.fetchTagDates).toHaveBeenCalledOnce();
      expect(report.stats.tags).toBe(952);
      expect(report.practices.releases).toMatchObject({ available: false, reason: 'tagDatesFailed', tagsTotal: 952 });
    } finally {
      hasToken.value = false;
    }
  });

  it('with releases, tags are not requested', async () => {
    mockLinux({ fetchReleases: vi.fn(async () => [{ tag_name: 'v1.0.0', created_at: '2026-10-01T00:00:00Z', published_at: '2026-10-01T00:00:00Z' }]) });
    const report = await fetchRepositoryData('torvalds/linux');
    expect(github.fetchTagsCount).not.toHaveBeenCalled();
    expect(report.stats.tags).toBeUndefined();
    expect(report.practices.releases.source).toBeUndefined();
  });
});

describe('fetchRepositoryData: repository input (RepoRef)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    saveSearch.mockReset().mockResolvedValue(42);
    for (const key of Object.keys(github)) delete github[key];
  });

  it.each([
    ['group/sub/project', 'REPO_HOST_REQUIRED'],
    ['https://example.com/a/b', 'REPO_HOST_NOT_ALLOWED'],
    ['../x/y', 'INVALID_REPO_INPUT'],
  ])('%s → %s, before any request', async (input, code) => {
    mockLinux();
    await expect(fetchRepositoryData(input)).rejects.toMatchObject({ code });
    expect(github.fetchRepository).not.toHaveBeenCalled();
    expect(saveSearch).not.toHaveBeenCalled();
  });

  it('a pasted GitHub URL analyzes the repository; the report keeps the canonical name and web URL', async () => {
    mockLinux();
    const report = await fetchRepositoryData('https://github.com/Torvalds/Linux/tree/master');
    expect(github.fetchRepository).toHaveBeenCalledWith('Torvalds', 'Linux');
    expect(github.fetchCommits).toHaveBeenCalledWith('torvalds', 'linux');
    expect(report.fullName).toBe('torvalds/linux');
    expect(report.url).toBe('https://github.com/torvalds/linux');
    expect(report.searchedName).toBeUndefined();
  });

  it('a renamed repository records the typed name as searchedName', async () => {
    mockLinux();
    const report = await fetchRepositoryData('linus/old-name');
    expect(report.searchedName).toBe('linus/old-name');
  });

  it('an unsafe canonical name from the API is refused, not used in requests', async () => {
    mockLinux({ fetchRepository: vi.fn(async () => ({ full_name: 'evil/../x', private: false })) });
    await expect(fetchRepositoryData('a/b')).rejects.toMatchObject({ code: 'UNSAFE_REPO_NAME', message: 'errors.repoNameUnsafe' });
    expect(github.fetchCommits).not.toHaveBeenCalled();
  });
});

// A public GitLab project with subgroups, the way gitlabService answers (GitHub shapes).
function mockGitlab(overrides = {}) {
  for (const key of Object.keys(gitlab)) delete gitlab[key];
  Object.assign(gitlab, {
    fetchRepository: vi.fn(async () => ({
      full_name: 'g/sub/p', private: false, visibility: 'public', default_branch: 'main', description: 'd', language: null,
      created_at: '2020-01-01T00:00:00Z', pushed_at: '2026-11-01T00:00:00Z', owner: { type: 'Organization' },
      stargazers_count: 3, forks_count: 1, subscribers_count: null, has_issues: true, has_pull_requests: true,
    })),
    fetchCommits: vi.fn(async () => []),
    fetchBranchCount: vi.fn(async () => 2),
    fetchContributorStats: vi.fn(async () => []),
    fetchContributors: vi.fn(async () => []),
    fetchPullRequests: vi.fn(async () => 4),
    fetchMergedPRsCount: vi.fn(async () => 3),
    fetchOpenIssuesCount: vi.fn(async () => 1),
    fetchClosedIssuesCount: vi.fn(async () => 2),
    fetchRecentPullRequests: vi.fn(async () => []),
    fetchPullRequestStats: vi.fn(async () => []),
    fetchLanguages: vi.fn(async () => ({ Java: 80, Shell: 20 })),
    fetchCommunityProfile: vi.fn(async () => ({ files: { readme: { path: 'README.md' } } })),
    fetchRepositoryTree: vi.fn(async () => ({ tree: [], truncated: false })),
    fetchReleases: vi.fn(async () => []),
    fetchTagsCount: vi.fn(async () => 0),
    fetchCommitActivity: vi.fn(async () => ({ all: [] })),
    fetchCodeFrequency: vi.fn(async () => []),
    fetchPunchCard: vi.fn(async () => []),
    fetchActionRuns: vi.fn(async () => ({ total_count: 0, workflow_runs: [] })),
    ...overrides,
  });
}

describe('fetchRepositoryData: GitLab', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    saveSearch.mockReset().mockResolvedValue(42);
    hasToken.value = false;
  });

  it('a public project is analyzed with namespace "g/sub" and project "p", and never saved', async () => {
    mockGitlab({ detailsWithoutToken: true, fetchPullRequestReviewStats: vi.fn(async () => []), fetchBranchActivity: vi.fn(async () => ({ totalCount: 2, branches: [], capped: false })) });
    const report = await fetchRepositoryData('https://gitlab.com/g/sub/p/-/tree/main');
    expect(gitlab.fetchRepository).toHaveBeenCalledWith('g/sub', 'p');
    expect(gitlab.fetchCommits).toHaveBeenCalledWith('g/sub', 'p');
    expect(report).toMatchObject({ fullName: 'g/sub/p', provider: 'gitlab', host: 'gitlab.com', url: 'https://gitlab.com/g/sub/p', subscribers: null, searchId: null });
    expect(report.stats).toMatchObject({ prs: 4, merges: 3 });
    expect(saveSearch).not.toHaveBeenCalled();
    // No token needed for the GraphQL details on GitLab
    expect(gitlab.fetchPullRequestReviewStats).toHaveBeenCalledWith('g/sub', 'p');
    expect(gitlab.fetchBranchActivity).toHaveBeenCalled();
    expect(report.codeReview.reason).not.toBe('noToken');
  });

  it.each(['internal', 'private'])('a %s project is refused before any other request (internal counts as private)', async (visibility) => {
    mockGitlab({ fetchRepository: vi.fn(async () => ({ full_name: 'g/p', private: true, visibility })) });
    await expect(fetchRepositoryData('gitlab.com/g/p')).rejects.toMatchObject({ code: 'PRIVATE_REPO_UNSUPPORTED', message: 'errors.gitlabNotPublic', final: true });
    expect(gitlab.fetchCommits).not.toHaveBeenCalled();
    expect(saveSearch).not.toHaveBeenCalled();
  });

  it('the REST MR list (lead-time fallback) is requested only when the review query fails', async () => {
    const detailed = { detailsWithoutToken: true, fetchBranchActivity: vi.fn(async () => ({ totalCount: 2, branches: [], capped: false })), fetchTagDates: vi.fn(async () => ({ total: 0, dates: [], fullPage: false })) };
    mockGitlab({ ...detailed, fetchPullRequestReviewStats: vi.fn(async () => []) });
    await fetchRepositoryData('gitlab.com/g/sub/p');
    expect(gitlab.fetchPullRequestStats).not.toHaveBeenCalled();

    mockGitlab({ ...detailed, fetchPullRequestReviewStats: vi.fn(async () => { throw new Error('GraphQL 502'); }) });
    const report = await fetchRepositoryData('gitlab.com/g/sub/p');
    expect(gitlab.fetchPullRequestStats).toHaveBeenCalledWith('g/sub', 'p');
    expect(report.metrics.leadTime).toMatchObject({ source: 'rest' });
    expect(report._warnings).toEqual(['prReviewStats']);
  });

  it.each([
    [{ code: 'TOKEN_REJECTED', host: 'gitlab.com' }, 'TOKEN_REJECTED', 'errors.tokenRejected'],
    [{ code: 'NOT_FOUND', status: 404 }, 'REPO_NOT_FOUND', 'errors.repoNotFoundGitlab'],
    [{ code: 'NOT_FOUND', status: 404, withToken: true }, 'REPO_NOT_FOUND', 'errors.repoNotFoundGitlabToken'],
  ])('fetchRepository failing with %j → %s, final (not retried)', async ({ withToken, ...failure }, code, message) => {
    hasToken.value = Boolean(withToken);
    mockGitlab({ fetchRepository: vi.fn(async () => { throw Object.assign(new Error('x'), failure); }) });
    await expect(fetchRepositoryData('gitlab.com/g/p')).rejects.toMatchObject({ code, message, final: true, i18nKey: message });
    expect(gitlab.fetchCommits).not.toHaveBeenCalled();
  });

  it('an unknown visibility is refused too, as "couldn\'t confirm" (retryable), not "not public"', async () => {
    mockGitlab({ fetchRepository: vi.fn(async () => ({ full_name: 'g/p', private: null, visibility: null })) });
    await expect(fetchRepositoryData('gitlab.com/g/p')).rejects.toMatchObject({ code: 'VISIBILITY_UNKNOWN', message: 'errors.visibilityUnknown' });
    expect(gitlab.fetchCommits).not.toHaveBeenCalled();
  });

  it('with a token, review stats are requested and the AI context is skipped (no GitLab fetcher yet)', async () => {
    hasToken.value = true;
    mockGitlab({ fetchPullRequestReviewStats: vi.fn(async () => []), fetchBranchActivity: vi.fn(async () => ({ totalCount: 2, branches: [], capped: false })), fetchTagDates: vi.fn(async () => ({ total: 0, dates: [], fullPage: false })) });
    const report = await fetchRepositoryData('gitlab.com/g/p'); // the API answers with the canonical g/sub/p
    expect(gitlab.fetchPullRequestReviewStats).toHaveBeenCalledWith('g/sub', 'p');
    expect(report._warnings).toBeUndefined();
  });
});

describe('fetchRepositoryData: GitHub reports carry the provider', () => {
  it('provider github, host github.com', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockLinux();
    const report = await fetchRepositoryData('torvalds/linux');
    expect(report).toMatchObject({ provider: 'github', host: 'github.com', subscribers: 8000 });
  });
});

describe('fetchRepositoryData: GitHub repository not found', () => {
  it('404 → REPO_NOT_FOUND with the GitHub text', async () => {
    mockLinux({ fetchRepository: vi.fn(async () => { throw Object.assign(new Error('HTTP error! status: 404'), { code: 'NOT_FOUND', status: 404 }); }) });
    await expect(fetchRepositoryData('o/r')).rejects.toMatchObject({ code: 'REPO_NOT_FOUND', message: 'errors.repoNotFound' });
  });
});
