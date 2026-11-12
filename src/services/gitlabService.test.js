import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createGitlabService, checkGitlabToken } from './gitlabService.js';
import { GITLAB_TREE_MAX_PAGES } from '../constants.js';

// fetch is stubbed: each test lists the responses by URL fragment.
const store = {};
let routes;
let calls;

function reply(body, { status = 200, headers = {} } = {}) {
  return { ok: status >= 200 && status < 300, status, headers: new Headers(headers), json: async () => body };
}

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  vi.stubGlobal('localStorage', { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; } });
  calls = [];
  routes = [];
  vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
    calls.push({ url: String(url), headers: init.headers ?? {}, body: init.body });
    const route = routes.find(([match]) => (typeof match === 'function' ? match(String(url), init) : String(url).includes(match)));
    if (!route) throw new Error(`unexpected request ${url}`);
    return typeof route[1] === 'function' ? route[1](String(url), init) : route[1];
  }));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const page = (n, prefix = 'f') => Array.from({ length: n }, (_, i) => ({ path: `${prefix}${i}`, type: 'blob', name: `${prefix}${i}` }));

describe('createGitlabService: requests', () => {
  it('a namespace with subgroups becomes one encoded project id; the token only goes to its own host', async () => {
    store['gitlab_token:gitlab.cin.ufpe.br'] = 'cin-token';
    routes = [
      ['/api/graphql', reply({ data: { project: { archived: false, issuesEnabled: true, mergeRequestsEnabled: true, visibility: 'public' } } })],
      ['/projects/', reply({ path_with_namespace: 'g/sub/p', visibility: 'public', default_branch: 'main', created_at: '2020-01-01T00:00:00Z' })],
    ];
    const cin = createGitlabService('gitlab.cin.ufpe.br');
    const data = await cin.fetchRepository('g/sub', 'p');
    expect(data).toMatchObject({ full_name: 'g/sub/p', private: false });
    const rest = calls.find((c) => c.url.includes('/projects/'));
    expect(rest.url).toBe('https://gitlab.cin.ufpe.br/api/v4/projects/g%2Fsub%2Fp?license=true');
    expect(rest.headers).toEqual({ 'PRIVATE-TOKEN': 'cin-token' });
    expect(JSON.parse(calls.find((c) => c.url.endsWith('/api/graphql')).body).variables).toEqual({ p: 'g/sub/p' });

    calls.length = 0;
    await createGitlabService('gitlab.com').fetchRepository('g', 'p');
    expect(calls.every((c) => c.url.startsWith('https://gitlab.com/') && !('PRIVATE-TOKEN' in c.headers))).toBe(true);
  });

  it('project flags failing (GraphQL) leaves the features enabled, not an error', async () => {
    routes = [
      ['/api/graphql', reply({}, { status: 500 })],
      ['/projects/', reply({ path_with_namespace: 'g/p', visibility: 'internal' })],
    ];
    const data = await createGitlabService('gitlab.com').fetchRepository('g', 'p');
    expect(data).toMatchObject({ private: true, has_issues: true, has_pull_requests: true });
  });

  it('a failed project request throws (never an empty project)', async () => {
    routes = [['/api/graphql', reply({ data: { project: null } })], ['/projects/', reply({ message: '404' }, { status: 404 })]];
    await expect(createGitlabService('gitlab.com').fetchRepository('g', 'p')).rejects.toThrow(/404/);
  });

  it('counts come from X-Total; without it (over 10k) the count throws, never a guess', async () => {
    routes = [
      ['state=all', reply([], { headers: { 'x-total': '7539' } })],
      ['state=merged', reply([{}])],
    ];
    const gl = createGitlabService('gitlab.com');
    await expect(gl.fetchPullRequests('g', 'p')).resolves.toBe(7539);
    await expect(gl.fetchMergedPRsCount('g', 'p')).rejects.toThrow(/total not reported/);
  });

  it('issue counts: one issues_statistics request for open and closed', async () => {
    routes = [['issues_statistics', reply({ statistics: { counts: { all: 5, opened: 2, closed: 3 } } })]];
    const gl = createGitlabService('gitlab.com');
    expect(await Promise.all([gl.fetchOpenIssuesCount('g', 'p'), gl.fetchClosedIssuesCount('g', 'p')])).toEqual([2, 3]);
    expect(calls).toHaveLength(1);
  });

  it('the year of commits is read once for the four charts that need it', async () => {
    routes = [['/repository/commits?since=', reply([{ id: 'a', author_name: 'Ana', author_email: 'a@x', authored_date: new Date().toISOString(), parent_ids: ['p'], stats: { additions: 1, deletions: 0 } }])]];
    const gl = createGitlabService('gitlab.com');
    const [activity, punch, freq, people] = await Promise.all([
      gl.fetchCommitActivity('g', 'p'), gl.fetchPunchCard('g', 'p'), gl.fetchCodeFrequency('g', 'p'), gl.fetchContributorStats('g', 'p'),
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('with_stats=true');
    expect(activity.all.at(-1)).toBe(1);
    expect(punch).toHaveLength(1);
    expect(freq.at(-1)[1]).toBe(1);
    expect(people[0].author.login).toBe('Ana');
  });

  it('past the commit page cap the year is incomplete: the charts are TOO_LARGE, never older weeks read as zero', async () => {
    routes = [['/repository/commits?since=', () => reply(page(100).map((_, i) => ({ id: String(i), author_name: 'A', authored_date: new Date().toISOString(), parent_ids: ['p'] })))]];
    const gl = createGitlabService('gitlab.com');
    for (const name of ['fetchCommitActivity', 'fetchPunchCard', 'fetchCodeFrequency', 'fetchContributorStats']) {
      await expect(gl[name]('g', 'p')).rejects.toMatchObject({ code: 'TOO_LARGE' });
    }
  });

  it('the all-time contributor fallback flags bots by name/e-mail', async () => {
    routes = [['/repository/contributors', reply([{ name: 'GitLab Renovate Bot', email: 'x@y', commits: 9 }, { name: 'Ana', email: 'a@x', commits: 3 }])]];
    const list = await createGitlabService('gitlab.com').fetchContributors('g', 'p');
    expect(list.map((c) => [c.login, c.type])).toEqual([['GitLab Renovate Bot', 'Bot'], ['Ana', 'User']]);
  });

  it('saving a token after an anonymous analysis does not reuse the anonymous answers', async () => {
    routes = [['issues_statistics', reply({ statistics: { counts: { opened: 1, closed: 1 } } })]];
    const gl = createGitlabService('gitlab.com');
    await gl.fetchOpenIssuesCount('g', 'p');
    store['gitlab_token:gitlab.com'] = 't';
    await gl.fetchOpenIssuesCount('g', 'p');
    expect(calls).toHaveLength(2);
    expect(calls[1].headers).toEqual({ 'PRIVATE-TOKEN': 't' });
  });

  it(`the tree stops at ${GITLAB_TREE_MAX_PAGES} pages and says it is truncated`, async () => {
    routes = [['/repository/tree?recursive=true', () => reply(page(100))]];
    const tree = await createGitlabService('gitlab.com').fetchRepositoryTree('g', 'p', 'main');
    expect(calls).toHaveLength(GITLAB_TREE_MAX_PAGES);
    expect(tree).toMatchObject({ truncated: true });
    expect(tree.tree).toHaveLength(GITLAB_TREE_MAX_PAGES * 100);
  });

  it('a small tree is complete', async () => {
    routes = [['/repository/tree?recursive=true', reply(page(3))]];
    expect(await createGitlabService('gitlab.com').fetchRepositoryTree('g', 'p', 'main')).toMatchObject({ truncated: false });
  });

  it('health files from targeted listings; an absent .gitlab/ directory (404) is "no template", not a failure', async () => {
    routes = [
      ['issue_templates', reply({ message: '404 Tree Not Found' }, { status: 404 })],
      ['merge_request_templates', reply([{ type: 'blob', name: 'Default.md', path: '.gitlab/merge_request_templates/Default.md' }])],
      ['/repository/tree?per_page=100', reply([{ type: 'blob', name: 'README.md', path: 'README.md' }])],
      ['/projects/g%2Fp?license=true', reply({ license: { key: 'mit' } })],
    ];
    const gl = createGitlabService('gitlab.com');
    const { files } = await gl.fetchCommunityProfile('g', 'p');
    expect(files).toMatchObject({ readme: { path: 'README.md' }, license: { key: 'mit' }, issue_template: null, pull_request_template: { path: '.gitlab/merge_request_templates/Default.md' } });
    expect(await gl.hasIssueTemplateDirectory('g', 'p')).toBe(false);
  });

  it('a listing failing for another reason throws (unknown, not absent)', async () => {
    routes = [['/repository/tree', reply({}, { status: 500 })], ['/projects/', reply({})]];
    await expect(createGitlabService('gitlab.com').fetchCommunityProfile('g', 'p')).rejects.toThrow(/500/);
  });

  it('review stats: a failed size query only marks PR size as failed', async () => {
    routes = [[
      '/api/graphql',
      (url, init) => (JSON.parse(init.body).query.includes('diffStatsSummary')
        ? reply({}, { status: 502 })
        : reply({ data: { project: { mergeRequests: { nodes: [{ iid: 1, createdAt: '2026-11-01T00:00:00Z', mergedAt: '2026-11-02T00:00:00Z', author: { username: 'ana' }, approvedBy: { nodes: [{ username: 'bia' }] }, notes: { nodes: [] } }] } } } })),
    ]];
    const [pr] = await createGitlabService('gitlab.com').fetchPullRequestReviewStats('g', 'p');
    expect(pr).toMatchObject({ approvedByOther: true, sizeFailed: true, changedLines: null });
  });

  it('pipelines of the default branch as Actions runs', async () => {
    routes = [['/pipelines?ref=main&scope=finished', reply([{ source: 'push', status: 'success' }], { headers: { 'x-total': '1' } })]];
    expect(await createGitlabService('gitlab.com').fetchActionRuns('g', 'p', 'main')).toMatchObject({ total_count: 1, workflow_runs: [{ event: 'push', conclusion: 'success' }] });
  });

  it('has no AI context fetcher yet (useRepository skips it)', () => {
    expect(createGitlabService('gitlab.com').fetchAiRepoContext).toBeUndefined();
  });
});

describe('checkGitlabToken', () => {
  it.each([
    [reply({ scopes: ['read_api'], active: true, expires_at: '2026-12-01' }), { ok: true, expiresAt: '2026-12-01' }],
    [reply({ scopes: ['read_user'], active: true }), { ok: false, reason: 'scope' }],
    [reply({ scopes: ['read_api'], active: false }), { ok: false, reason: 'inactive' }],
    [reply({}, { status: 401 }), { ok: false, reason: 'invalid' }],
    [reply({ error: 'insufficient_scope' }, { status: 403 }), { ok: false, reason: 'scope' }],
  ])('%#', async (response, expected) => {
    routes = [['/personal_access_tokens/self', response]];
    expect(await checkGitlabToken('gitlab.cin.ufpe.br', 't')).toMatchObject(expected);
    expect(calls[0]).toMatchObject({ url: 'https://gitlab.cin.ufpe.br/api/v4/personal_access_tokens/self', headers: { 'PRIVATE-TOKEN': 't' } });
  });
});
