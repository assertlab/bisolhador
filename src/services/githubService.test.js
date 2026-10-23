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

  it('fetchBranches throws when the branch list fails (no more "0 branches, no zombies" ✅)', async () => {
    fetchMock.mockReturnValue(json({ message: 'rate limited' }, { status: 403 }));
    await expect(githubService.fetchBranches('react', 'react')).rejects.toThrow(/403/);
  });

  it('fetchBranches: zombies unknown (null) when any branch commit could not be checked', async () => {
    const old = new Date(Date.now() - 400 * 864e5).toISOString();
    fetchMock
      .mockReturnValueOnce(json([{ name: 'a', commit: { url: 'u/a' } }, { name: 'b', commit: { url: 'u/b' } }]))
      .mockReturnValueOnce(json({ commit: { author: { date: old } } }))
      .mockReturnValueOnce(json({ message: 'rate limited' }, { status: 403 }));
    await expect(githubService.fetchBranches('o', 'r')).resolves.toEqual({ count: 2, zombies: null });
  });

  it('fetchBranches: counts zombies when every branch was checked', async () => {
    const old = new Date(Date.now() - 400 * 864e5).toISOString();
    const fresh = new Date().toISOString();
    fetchMock
      .mockReturnValueOnce(json([{ name: 'a', commit: { url: 'u/a' } }, { name: 'b', commit: { url: 'u/b' } }]))
      .mockReturnValueOnce(json({ commit: { author: { date: old } } }))
      .mockReturnValueOnce(json({ commit: { author: { date: fresh } } }));
    await expect(githubService.fetchBranches('o', 'r')).resolves.toEqual({ count: 2, zombies: 1 });
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

  it('fetchReleasesCount throws on failure instead of returning 0', async () => {
    fetchMock.mockReturnValue(json({ message: 'boom' }, { status: 500 }));
    await expect(githubService.fetchReleasesCount('react', 'react')).rejects.toThrow(/500/);
  });
});
