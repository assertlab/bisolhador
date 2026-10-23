import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { githubService } from './githubService.js';

const json = (body, { status = 200, headers = {} } = {}) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers }));

describe('githubService: failures are errors, not zeros', () => {
  let fetchMock;
  beforeEach(() => {
    // No token in tests; silence the storage wrapper's warning.
    vi.stubGlobal('localStorage', { getItem: () => null });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe.each([
    ['fetchOpenIssuesCount', 'is:issue+is:open'],
    ['fetchClosedIssuesCount', 'is:issue+is:closed'],
    ['fetchPullRequests', 'type:pr'],
    ['fetchMergedPRsCount', 'is:pr+is:merged'],
  ])('%s', (method, qualifiers) => {
    it('returns total_count and queries the repo with the right qualifiers', async () => {
      fetchMock.mockReturnValue(json({ total_count: 876 }));
      await expect(githubService[method]('react', 'react')).resolves.toBe(876);
      expect(fetchMock.mock.calls[0][0]).toContain(`q=repo:react/react+${qualifiers}`);
    });

    it('throws on an HTTP error instead of returning 0/null (e.g. 422 for a renamed repo)', async () => {
      fetchMock.mockReturnValue(json({ message: 'Validation Failed' }, { status: 422 }));
      await expect(githubService[method]('facebook', 'react')).rejects.toThrow(/422/);
    });

    it('throws on a network error', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
      await expect(githubService[method]('react', 'react')).rejects.toThrow();
    });
  });

  describe('fetchCommunityProfile', () => {
    it('returns the profile', async () => {
      fetchMock.mockReturnValue(json({ health_percentage: 100, files: {} }));
      await expect(githubService.fetchCommunityProfile('react', 'react')).resolves.toMatchObject({ health_percentage: 100 });
    });

    it('returns null on 404 (GitHub has no community profile for forks): "unavailable", not an error', async () => {
      fetchMock.mockReturnValue(json({ message: 'Not Found' }, { status: 404 }));
      await expect(githubService.fetchCommunityProfile('someone', 'fork')).resolves.toBeNull();
    });

    it('throws on other errors (rate limit, 5xx)', async () => {
      fetchMock.mockReturnValue(json({ message: 'rate limited' }, { status: 403 }));
      await expect(githubService.fetchCommunityProfile('react', 'react')).rejects.toThrow(/403/);
    });
  });

  describe('fetchBranchCount (no token)', () => {
    it('reads the exact total from the Link header (per_page=1)', async () => {
      fetchMock.mockReturnValue(json([{}], { headers: { link: '<https://api.github.com/repositories/1/branches?per_page=1&page=1011>; rel="last"' } }));
      await expect(githubService.fetchBranchCount('react', 'react')).resolves.toBe(1011);
      expect(fetchMock.mock.calls[0][0]).toContain('per_page=1');
    });

    it('single page → array length', async () => {
      fetchMock.mockReturnValue(json([{ name: 'main' }]));
      await expect(githubService.fetchBranchCount('o', 'r')).resolves.toBe(1);
    });

    it('throws on failure (no more "0 branches, no zombies ✅")', async () => {
      fetchMock.mockReturnValue(json({ message: 'rate limited' }, { status: 403 }));
      await expect(githubService.fetchBranchCount('o', 'r')).rejects.toThrow(/403/);
    });
  });

  describe('fetchBranchActivity (token, GraphQL)', () => {
    const page = (names, { hasNextPage = false, totalCount = names.length } = {}) => json({
      data: { repository: { refs: {
        totalCount,
        pageInfo: { hasNextPage, endCursor: 'c' },
        nodes: names.map((name) => ({ name, branchProtectionRule: name === 'locked' ? { id: 'x' } : null, target: { committedDate: '2020-01-01T00:00:00Z' } })),
      } } },
    });

    it('follows pagination and maps name / protected / committedDate', async () => {
      fetchMock.mockReturnValueOnce(page(['a', 'locked'], { hasNextPage: true, totalCount: 3 })).mockReturnValueOnce(page(['b'], { totalCount: 3 }));
      const result = await githubService.fetchBranchActivity('o', 'r');
      expect(result.totalCount).toBe(3);
      expect(result.capped).toBe(false);
      expect(result.branches).toEqual([
        { name: 'a', protected: false, committedDate: '2020-01-01T00:00:00Z' },
        { name: 'locked', protected: true, committedDate: '2020-01-01T00:00:00Z' },
        { name: 'b', protected: false, committedDate: '2020-01-01T00:00:00Z' },
      ]);
      const vars = JSON.parse(fetchMock.mock.calls[1][1].body).variables;
      expect(vars).toEqual({ owner: 'o', name: 'r', after: 'c' });
    });

    it('throws when GraphQL returns no data', async () => {
      fetchMock.mockReturnValue(json({ errors: [{ message: 'Could not resolve' }] }));
      await expect(githubService.fetchBranchActivity('o', 'r')).rejects.toThrow(/Could not resolve/);
    });
  });

  describe('fetchRepositoryTree', () => {
    it('returns the tree and the truncated flag', async () => {
      fetchMock.mockReturnValue(json({ tree: [{ path: 'a' }], truncated: true }));
      await expect(githubService.fetchRepositoryTree('o', 'r', 'main')).resolves.toEqual({ tree: [{ path: 'a' }], truncated: true });
    });

    it('422 (too large) → root level only, reported as truncated', async () => {
      fetchMock.mockReturnValueOnce(json({ message: 'too large' }, { status: 422 })).mockReturnValueOnce(json({ tree: [{ path: 'README.md' }] }));
      await expect(githubService.fetchRepositoryTree('o', 'r', 'main')).resolves.toEqual({ tree: [{ path: 'README.md' }], truncated: true });
    });

    it('throws on failure instead of an empty tree (which read as "no tests, no CI")', async () => {
      fetchMock.mockReturnValue(json({ message: 'rate limited' }, { status: 403 }));
      await expect(githubService.fetchRepositoryTree('o', 'r', 'main')).rejects.toThrow(/403/);
    });
  });

  it('fetchReleasesCount: single page (no Link header) counts the first response, no second request', async () => {
    fetchMock.mockReturnValue(json([{ id: 1 }]));
    await expect(githubService.fetchReleasesCount('o', 'r')).resolves.toBe(1);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('fetchReleasesCount: reads the total from the Link header', async () => {
    fetchMock.mockReturnValue(json([{ id: 1 }], { headers: { link: '<https://api.github.com/repositories/1/releases?per_page=1&page=137>; rel="last"' } }));
    await expect(githubService.fetchReleasesCount('o', 'r')).resolves.toBe(137);
  });

  describe('fetchContributorStats', () => {
    it('returns the stats', async () => {
      fetchMock.mockReturnValue(json([{ author: { login: 'a' }, total: 3, weeks: [] }]));
      await expect(githubService.fetchContributorStats('o', 'r')).resolves.toHaveLength(1);
    });

    it('202 (GitHub still computing) throws at once, no waiting: the caller falls back', async () => {
      fetchMock.mockReturnValue(json({}, { status: 202 }));
      await expect(githubService.fetchContributorStats('o', 'r')).rejects.toThrow(/202/);
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('empty repository (204) → []', async () => {
      fetchMock.mockReturnValue(Promise.resolve(new Response(null, { status: 204 })));
      await expect(githubService.fetchContributorStats('o', 'r')).resolves.toEqual([]);
    });
  });

  it('fetchContributors asks for 100 per page and throws on failure', async () => {
    fetchMock.mockReturnValue(json({ message: 'rate limited' }, { status: 403 }));
    await expect(githubService.fetchContributors('o', 'r')).rejects.toThrow(/403/);
    expect(fetchMock.mock.calls[0][0]).toContain('per_page=100');
  });

  it('fetchReleasesCount throws on failure instead of returning 0', async () => {
    fetchMock.mockReturnValue(json({ message: 'boom' }, { status: 500 }));
    await expect(githubService.fetchReleasesCount('react', 'react')).rejects.toThrow(/500/);
  });
});
