// GitLab REST v4 + GraphQL, one service per host (gitlab.com or an allowed
// instance, docs/ESTUDO_GITLAB.md). Same method names and return shapes as
// githubService, so useRepository and the utils don't branch on the platform:
// `owner` is the namespace (it may contain subgroups: "g/sub"), `repo` the
// project. Both arrive validated by parseRepoRef; the project id is their
// encoded full path. Counts and lists THROW on failure (never a fake zero),
// as in githubService.
import { getToken } from './tokens.js';
import {
  toRepoData, toRestCommit, weeklySeries, punchCard, codeFrequency, contributorStats,
  profileFromListings, toRestPullRequest, toReviewNodes, toWorkflowRuns, toRelease, isGitlabBot, WEEK_MS,
} from '../utils/gitlabData.js';
import { toPullRequestStats } from '../utils/prReviewStats.js';
import {
  GITLAB_PER_PAGE, GITLAB_TREE_MAX_PAGES, GITLAB_COMMIT_MAX_PAGES, GITLAB_BRANCH_MAX_PAGES, GITLAB_COMMIT_WEEKS,
  GITHUB_PER_PAGE_COMMITS, GITHUB_PER_PAGE_RECENT_PRS, CLOSED_PR_SCAN, MERGED_PR_SAMPLE,
} from '../constants.js';
import { TAGS_PAGE } from '../utils/projectPractices.js';

// Several fetchers read the same request (the year of commits feeds four
// charts; the project and its listings feed health). It is shared for this
// long, enough for one analysis, then dropped.
const SHARED_MS = 60_000;
const TOKEN_CHECK_TIMEOUT_MS = 10_000;

function httpError(label, status, code) {
  return Object.assign(new Error(`GitLab ${label} failed: HTTP ${status}`), { status, ...(code && { code }) });
}

export function createGitlabService(host) {
  const API = `https://${host}/api/v4`;
  const tokenRef = { provider: 'gitlab', host };
  // The token for THIS host only: a gitlab.cin.ufpe.br token never goes to gitlab.com.
  const headers = () => {
    const token = getToken(tokenRef);
    return token ? { 'PRIVATE-TOKEN': token } : {};
  };
  const projectId = (owner, repo) => encodeURIComponent(`${owner}/${repo}`);

  // Keyed by whether a token was sent too: saving a token right after an
  // anonymous analysis must not reuse the anonymous answers. Expired entries
  // are swept on every insert, so analyzed projects don't stay in memory.
  const shared = new Map();
  function once(key, load) {
    const now = Date.now();
    const fullKey = `${getToken(tokenRef) ? 'auth' : 'anon'}:${key}`;
    const hit = shared.get(fullKey);
    if (hit && now - hit.at < SHARED_MS) return hit.promise;
    for (const [k, entry] of shared) if (now - entry.at >= SHARED_MS) shared.delete(k);
    const promise = load();
    shared.set(fullKey, { at: now, promise });
    promise.catch(() => shared.delete(fullKey)); // a failure isn't reused
    return promise;
  }

  async function request(path, label, { notFound } = {}) {
    const response = await fetch(`${API}${path}`, { headers: headers() });
    if (response.status === 404 && notFound !== undefined) return { response, body: notFound };
    if (!response.ok) throw httpError(label, response.status);
    return { response, body: await response.json() };
  }
  const json = async (path, label, opts) => (await request(path, label, opts)).body;

  // X-Total of a response. GitLab omits it above 10,000 items: then the count
  // is unknown (throws → N/A), never a guess.
  function totalOf(response, label) {
    const total = response.headers.get('x-total');
    if (total === null || !Number.isFinite(Number(total))) throw new Error(`GitLab ${label}: total not reported (over 10,000?)`);
    return Number(total);
  }

  const totalOrNull = (response, label) => {
    try {
      return totalOf(response, label);
    } catch {
      return null;
    }
  };

  async function count(path, label) {
    const sep = path.includes('?') ? '&' : '?';
    const { response } = await request(`${path}${sep}per_page=1`, label);
    return totalOf(response, label);
  }

  // Pages of 100 up to maxPages; `capped` when the last page read was full.
  // `total`: page 1's X-Total, null when GitLab didn't report it.
  async function paged(path, label, maxPages, { notFound } = {}) {
    const items = [];
    let total = null;
    const sep = path.includes('?') ? '&' : '?';
    for (let page = 1; page <= maxPages; page++) {
      const { response, body } = await request(`${path}${sep}per_page=${GITLAB_PER_PAGE}&page=${page}`, label, notFound !== undefined && page === 1 ? { notFound } : {});
      if (page === 1) total = totalOrNull(response, label);
      if (!Array.isArray(body)) return { items: body, capped: false, total };
      items.push(...body);
      if (body.length < GITLAB_PER_PAGE) return { items, capped: false, total };
    }
    return { items, capped: true, total };
  }

  async function graphql(query, variables, label) {
    const response = await fetch(`https://${host}/api/graphql`, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) throw httpError(`GraphQL ${label}`, response.status);
    const body = await response.json();
    if (!body.data) throw new Error(`GitLab GraphQL ${label} failed: ${body.errors?.[0]?.message ?? 'no data'}`);
    if (body.errors?.length) console.warn(`[gitlabService] GraphQL ${label} returned partial data:`, body.errors[0].message);
    return body.data;
  }

  const project = (owner, repo) => once(`project:${owner}/${repo}`, () => json(`/projects/${projectId(owner, repo)}?license=true`, 'project'));

  // The last 52 weeks of commits on the default branch, with line stats.
  const yearOfCommits = (owner, repo) => once(`commits:${owner}/${repo}`, () => {
    const since = new Date(Date.now() - GITLAB_COMMIT_WEEKS * WEEK_MS).toISOString();
    return paged(`/projects/${projectId(owner, repo)}/repository/commits?since=${encodeURIComponent(since)}&with_stats=true`, 'commits', GITLAB_COMMIT_MAX_PAGES, { notFound: [] });
  });
  // The charts need the WHOLE year: past the page cap the older weeks would
  // read as zero commits. Then they are "too large" (code TOO_LARGE, explained
  // by each chart, as GitHub's 422), and contributors fall back to GitLab's
  // all-time list (partial).
  const wholeYearOfCommits = async (owner, repo) => {
    const { items, capped } = await yearOfCommits(owner, repo);
    if (capped) throw Object.assign(new Error(`GitLab commits: more than ${GITLAB_COMMIT_MAX_PAGES * GITLAB_PER_PAGE} in ${GITLAB_COMMIT_WEEKS} weeks`), { code: 'TOO_LARGE' });
    return items;
  };

  // A directory listing; null when the directory doesn't exist.
  const listing = (owner, repo, path) => json(
    `/projects/${projectId(owner, repo)}/repository/tree?per_page=${GITLAB_PER_PAGE}${path ? `&path=${encodeURIComponent(path)}` : ''}`,
    `tree ${path || '/'}`,
    { notFound: null },
  );
  const issueTemplates = (owner, repo) => once(`issueTemplates:${owner}/${repo}`, () => listing(owner, repo, '.gitlab/issue_templates'));

  const issueStats = (owner, repo) => once(`issues:${owner}/${repo}`, async () => {
    const data = await json(`/projects/${projectId(owner, repo)}/issues_statistics`, 'issues statistics');
    const counts = data?.statistics?.counts;
    if (!Number.isFinite(counts?.opened) || !Number.isFinite(counts?.closed)) throw new Error('GitLab issues statistics: no counts');
    return counts;
  });

  return {
    provider: 'gitlab',
    host,
    // Review stats (GraphQL), branch activity and tag dates work without a
    // token on public projects (measured 2026-11-12): useRepository asks for them anyway.
    detailsWithoutToken: true,
    // The weekday counts cover the last 52 weeks (from commits), not the whole history
    punchCardWindow: '52w',

    // Project + the flags the anonymous REST response leaves out (archived,
    // issues/MRs enabled). A failed GraphQL leaves them unknown (enabled).
    async fetchRepository(owner, repo) {
      const [data, flags] = await Promise.all([
        project(owner, repo),
        graphql('query($p: ID!) { project(fullPath: $p) { archived issuesEnabled mergeRequestsEnabled visibility } }', { p: `${owner}/${repo}` }, 'project flags')
          .then((d) => d.project)
          .catch((error) => {
            console.warn('[gitlabService] Project flags unavailable:', error.message);
            return null;
          }),
      ]);
      return toRepoData(data, flags);
    },

    // The latest commits of the default branch (activity list, Conventional Commits, AI traces).
    async fetchCommits(owner, repo) {
      const list = await json(`/projects/${projectId(owner, repo)}/repository/commits?per_page=${GITHUB_PER_PAGE_COMMITS}`, 'commits', { notFound: [] });
      return list.map(toRestCommit);
    },

    async fetchBranchCount(owner, repo) {
      return count(`/projects/${projectId(owner, repo)}/repository/branches`, 'branches');
    },

    async fetchBranchActivity(owner, repo) {
      const { items, capped, total } = await paged(`/projects/${projectId(owner, repo)}/repository/branches`, 'branches', GITLAB_BRANCH_MAX_PAGES);
      return {
        // No X-Total: unknown when the list was cut at the cap
        totalCount: total ?? (capped ? null : items.length),
        capped,
        scanMax: GITLAB_BRANCH_MAX_PAGES * GITLAB_PER_PAGE,
        branches: items.map((b) => ({ name: b.name, protected: Boolean(b.protected), committedDate: b.commit?.committed_date ?? null })),
      };
    },

    // No /stats on GitLab: computed from the year of commits (TOO_LARGE past the cap).
    async fetchContributorStats(owner, repo) {
      const items = await wholeYearOfCommits(owner, repo);
      return contributorStats(items, { weeks: GITLAB_COMMIT_WEEKS });
    },

    // Fallback (all-time, by e-mail): GitLab's own contributor list.
    async fetchContributors(owner, repo) {
      const { items } = await paged(`/projects/${projectId(owner, repo)}/repository/contributors?order_by=commits&sort=desc`, 'contributors', 1);
      // type 'Bot' so peopleFromContributors leaves bots out (no "[bot]" suffix on GitLab)
      return items.map((c) => ({ login: c.name || c.email, avatar_url: null, contributions: c.commits, type: isGitlabBot({ name: c.name, email: c.email }) ? 'Bot' : 'User' }));
    },

    async fetchPullRequests(owner, repo) {
      return count(`/projects/${projectId(owner, repo)}/merge_requests?state=all`, 'merge requests');
    },

    async fetchMergedPRsCount(owner, repo) {
      return count(`/projects/${projectId(owner, repo)}/merge_requests?state=merged`, 'merged merge requests');
    },

    // Percentages, not bytes: the chart normalizes by the total either way.
    async fetchLanguages(owner, repo) {
      return json(`/projects/${projectId(owner, repo)}/languages`, 'languages');
    },

    async fetchOpenIssuesCount(owner, repo) {
      return (await issueStats(owner, repo)).opened;
    },

    async fetchClosedIssuesCount(owner, repo) {
      return (await issueStats(owner, repo)).closed;
    },

    // No community profile on GitLab: root + .gitlab/ template listings (non-recursive).
    async fetchCommunityProfile(owner, repo) {
      const [data, root, issues, mergeRequests] = await Promise.all([
        project(owner, repo),
        listing(owner, repo, ''),
        issueTemplates(owner, repo),
        listing(owner, repo, '.gitlab/merge_request_templates'),
      ]);
      return profileFromListings({ root, issueTemplates: issues, mergeRequestTemplates: mergeRequests, project: data });
    },

    async hasIssueTemplateDirectory(owner, repo) {
      return Boolean(profileFromListings({ issueTemplates: await issueTemplates(owner, repo) }).files.issue_template);
    },

    async fetchRecentPullRequests(owner, repo) {
      const list = await json(`/projects/${projectId(owner, repo)}/merge_requests?state=all&order_by=created_at&sort=desc&per_page=${GITHUB_PER_PAGE_RECENT_PRS}`, 'recent merge requests');
      return list.map(toRestPullRequest);
    },

    // Lead time without a token: recently updated merged MRs (REST).
    async fetchPullRequestStats(owner, repo) {
      const list = await json(`/projects/${projectId(owner, repo)}/merge_requests?state=merged&order_by=updated_at&sort=desc&per_page=${CLOSED_PR_SCAN}`, 'merged merge requests');
      return list.map(toRestPullRequest);
    },

    // Review metrics: the latest merged MRs by merge date (GitLab can sort by
    // it). Two queries, so a failed size query only makes PR size unavailable.
    async fetchPullRequestReviewStats(owner, repo) {
      const list = (fields) => `query($p: ID!, $n: Int!) { project(fullPath: $p) {
        mergeRequests(state: merged, first: $n, sort: MERGED_AT_DESC) { nodes { iid ${fields} } } } }`;
      const core = list(`createdAt mergedAt author { username bot } mergeUser { username }
        approvedBy { nodes { username bot } }
        notes(first: 50) { nodes { system body createdAt author { username bot } } }`);
      const size = list('diffStatsSummary { additions deletions }');
      const variables = { p: `${owner}/${repo}`, n: MERGED_PR_SAMPLE };
      const [coreRes, sizeRes] = await Promise.allSettled([graphql(core, variables, 'MR review stats'), graphql(size, variables, 'MR sizes')]);
      if (coreRes.status === 'rejected') throw coreRes.reason;
      const nodes = coreRes.value.project?.mergeRequests?.nodes;
      if (!Array.isArray(nodes)) throw new Error('GitLab GraphQL MR review stats failed: no merge requests');
      const sizes = sizeRes.status === 'fulfilled'
        ? new Map((sizeRes.value.project?.mergeRequests?.nodes ?? []).filter(Boolean).map((n) => [n.iid, n]))
        : null;
      if (!sizes) console.warn('[gitlabService] MR sizes failed:', sizeRes.reason?.message);
      // An MR missing from the size list (updated between the queries) has no size: left out of that indicator.
      return toPullRequestStats(toReviewNodes(nodes.map((n) => n && { ...n, ...(sizes ? sizes.get(n.iid) : { sizeFailed: true }) })));
    },

    // Finished pipelines of the default branch (CI health). The Dashboard
    // counts push pipelines, as it counts push runs on GitHub.
    async fetchActionRuns(owner, repo, branch) {
      const { response, body } = await request(`/projects/${projectId(owner, repo)}/pipelines?ref=${encodeURIComponent(branch)}&scope=finished&per_page=50`, 'pipelines');
      return toWorkflowRuns(body, totalOrNull(response, 'pipelines'));
    },

    async fetchReleases(owner, repo) {
      const list = await json(`/projects/${projectId(owner, repo)}/releases?per_page=100`, 'releases');
      return list.map(toRelease);
    },

    async fetchReleasesCount(owner, repo) {
      return count(`/projects/${projectId(owner, repo)}/releases`, 'releases');
    },

    async fetchTagsCount(owner, repo) {
      return count(`/projects/${projectId(owner, repo)}/repository/tags`, 'tags');
    },

    // REST already has tag dates on GitLab (annotated tag date, else the commit's).
    async fetchTagDates(owner, repo) {
      const { response, body: list } = await request(`/projects/${projectId(owner, repo)}/repository/tags?order_by=updated&sort=desc&per_page=${TAGS_PAGE}`, 'tags');
      return {
        total: totalOf(response, 'tags'),
        dates: list.map((t) => ({ name: t.name, date: t.created_at ?? t.commit?.committed_date ?? null })).filter((t) => t.date),
        fullPage: list.length >= TAGS_PAGE,
      };
    },

    async fetchCommitActivity(owner, repo) {
      const items = await wholeYearOfCommits(owner, repo);
      return weeklySeries(items, { weeks: GITLAB_COMMIT_WEEKS });
    },

    async fetchPunchCard(owner, repo) {
      const items = await wholeYearOfCommits(owner, repo);
      return punchCard(items);
    },

    async fetchCodeFrequency(owner, repo) {
      const items = await wholeYearOfCommits(owner, repo);
      return codeFrequency(items, { weeks: GITLAB_COMMIT_WEEKS });
    },

    // Recursive tree, capped: past the cap it is `truncated` and the maturity
    // detectors say "not verified". Health doesn't depend on it.
    async fetchRepositoryTree(owner, repo, defaultBranch) {
      if (!defaultBranch) return { tree: [], truncated: false };
      const { items, capped } = await paged(`/projects/${projectId(owner, repo)}/repository/tree?recursive=true&ref=${encodeURIComponent(defaultBranch)}`, 'tree', GITLAB_TREE_MAX_PAGES, { notFound: [] });
      return { tree: items.map((e) => ({ path: e.path, type: e.type })), truncated: capped };
    },

    // AI in the Process on GitLab (config files, GitLab Duo) isn't mapped yet:
    // no fetchAiRepoContext, so useRepository skips it and the section shows
    // those checks as not verified, never as absent.
  };
}

/**
 * Checks a token on its own host: GET /personal_access_tokens/self.
 * → { ok, scopes, expiresAt, active } or throws (network, 401 → invalid).
 * Only legacy tokens with read_api are supported (docs/ESTUDO_GITLAB.md, 2.1).
 */
export async function checkGitlabToken(host, token) {
  const response = await fetch(`https://${host}/api/v4/personal_access_tokens/self`, {
    headers: { 'PRIVATE-TOKEN': token },
    signal: AbortSignal.timeout(TOKEN_CHECK_TIMEOUT_MS),
  });
  if (response.status === 401) return { ok: false, reason: 'invalid' };
  // insufficient_scope: a token without read_api/api
  if (response.status === 403) return { ok: false, reason: 'scope' };
  if (!response.ok) throw httpError('token check', response.status);
  const data = await response.json();
  const scopes = Array.isArray(data.scopes) ? data.scopes : [];
  if (data.revoked || data.active === false) return { ok: false, reason: 'inactive', expiresAt: data.expires_at ?? null };
  if (!scopes.includes('read_api') && !scopes.includes('api')) return { ok: false, reason: 'scope', scopes };
  return { ok: true, scopes, expiresAt: data.expires_at ?? null };
}
