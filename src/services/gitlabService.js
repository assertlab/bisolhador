// GitLab REST v4 + GraphQL, one service per host (gitlab.com or an allowed
// instance, docs/ESTUDO_GITLAB.md). Same method names and return shapes as
// githubService, so useRepository and the utils don't branch on the platform:
// `owner` is the namespace (it may contain subgroups: "g/sub"), `repo` the
// project. Both arrive validated by parseRepoRef; the project id is their
// encoded full path. Counts and lists THROW on failure (never a fake zero),
// as in githubService.
import { getToken, tokenRejectedError, rateLimitedError } from './tokens.js';
import {
  toRepoData, toRestCommit, weeklySeries, punchCard, codeFrequency, contributorStats,
  profileFromListings, toRestPullRequest, toReviewNodes, toWorkflowRuns, toRelease, isGitlabBot, WEEK_MS,
  toHistoryNode, classroomPipelines,
} from '../utils/gitlabData.js';
import { toPullRequestStats } from '../utils/prReviewStats.js';
import {
  GITLAB_PER_PAGE, GITLAB_PAGE_PARALLEL, GITLAB_TREE_MAX_PAGES, GITLAB_COMMIT_MAX_PAGES, GITLAB_BRANCH_MAX_PAGES, GITLAB_COMMIT_WEEKS,
  GITHUB_PER_PAGE_COMMITS, GITHUB_PER_PAGE_RECENT_PRS, CLOSED_PR_SCAN, MERGED_PR_SAMPLE, GITLAB_MR_NOTES,
  CLASSROOM_COMMIT_PAGES, CLASSROOM_CI_RUN_PAGES, CLASSROOM_PR_SCAN, CLASSROOM_GITLAB_MR_PAGE, GITLAB_GROUP_MAX_PAGES,
  AUTHORSHIP_MAX_PATHS, AUTHORSHIP_COMMITS_PER_PATH,
} from '../constants.js';
import { withExponentialBackoff } from '../utils/retry.js';
import { TAGS_PAGE, NO_CI_RUNS } from '../utils/projectPractices.js';
import { CONTEXT_DIRS } from '../utils/aiRegistry.js';

// Several fetchers read the same request (the year of commits feeds four
// charts; the project and its listings feed health). It is shared for this
// long, enough for one analysis, then dropped.
const SHARED_MS = 60_000;
const TOKEN_CHECK_TIMEOUT_MS = 10_000;
const AUTHORSHIP_PARALLEL = 3; // AI-config paths queried at once per project

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

  // 401 with a token = the token was refused (TOKEN_REJECTED); 404 = NOT_FOUND (or invisible without login)
  // 429 = RATE_LIMITED (no reset time: GitLab doesn't expose its RateLimit headers through CORS)
  const failure = (label, response) => {
    const { status } = response;
    if (status === 401 && getToken(tokenRef)) return tokenRejectedError(host, `GitLab ${label}`);
    return rateLimitedError(response, host, `GitLab ${label}`) ?? httpError(label, status, status === 404 ? 'NOT_FOUND' : undefined);
  };

  async function request(path, label, { notFound } = {}) {
    const response = await fetch(`${API}${path}`, { headers: headers() });
    if (response.status === 404 && notFound !== undefined) return { response, body: notFound };
    if (!response.ok) throw failure(label, response);
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

  // X-Total-Pages of page 1, null when GitLab didn't report it (commits, some pipelines, over 10,000 items).
  const pagesOrNull = (response) => {
    const pages = Number(response.headers.get('x-total-pages'));
    return response.headers.get('x-total-pages') !== null && Number.isInteger(pages) && pages > 0 ? pages : null;
  };

  // Pages of 100 up to maxPages, never past it. `total`: page 1's X-Total, null when not reported.
  // Page 1 first; then pages 2+ GITLAB_PAGE_PARALLEL at a time, in page order:
  //  - X-Total-Pages known: only the pages that exist; `capped` when there are more than maxPages.
  //  - unknown: stops at the first short page (later pages of that batch are empty);
  //    `capped` when maxPages were read and the last one was full.
  async function paged(path, label, maxPages, { notFound } = {}) {
    const sep = path.includes('?') ? '&' : '?';
    const pageUrl = (n) => `${path}${sep}per_page=${GITLAB_PER_PAGE}&page=${n}`;
    const first = await request(pageUrl(1), label, notFound !== undefined ? { notFound } : {});
    const total = totalOrNull(first.response, label);
    if (!Array.isArray(first.body)) return { items: first.body, capped: false, total };
    const items = [...first.body];
    if (first.body.length < GITLAB_PER_PAGE) return { items, capped: false, total };
    const knownPages = pagesOrNull(first.response);
    const last = Math.min(knownPages ?? maxPages, maxPages);
    for (let start = 2; start <= last; start += GITLAB_PAGE_PARALLEL) {
      const numbers = Array.from({ length: Math.min(GITLAB_PAGE_PARALLEL, last - start + 1) }, (_, i) => start + i);
      const bodies = await Promise.all(numbers.map((n) => json(pageUrl(n), label)));
      for (const body of bodies) {
        const list = Array.isArray(body) ? body : [];
        items.push(...list);
        if (list.length < GITLAB_PER_PAGE) return { items, capped: false, total };
      }
    }
    return { items, capped: knownPages === null || knownPages > maxPages, total };
  }

  async function graphql(query, variables, label) {
    const response = await fetch(`https://${host}/api/graphql`, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) throw failure(`GraphQL ${label}`, response);
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
  // Root listing, shared by health and the AI context
  const rootListing = (owner, repo) => once(`root:${owner}/${repo}`, () => listing(owner, repo, ''));
  // A file's text at HEAD; null when it doesn't exist
  const rawFile = async (owner, repo, path) => {
    const response = await fetch(`${API}/projects/${projectId(owner, repo)}/repository/files/${encodeURIComponent(path)}/raw?ref=HEAD`, { headers: headers() });
    if (response.status === 404) return null;
    if (!response.ok) throw failure(`file ${path}`, response);
    return response.text();
  };

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
        rootListing(owner, repo),
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
        notes(first: ${GITLAB_MR_NOTES}) { nodes { system body createdAt author { username bot } } }`);
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

    // --- Classroom (period-bounded; same shapes as githubService) ----------

    // Default-branch commits between since/until (ISO), up to maxPages × 100, retried like GitHub's.
    // No X-Total on commits: totalCount is what was read, a minimum when capped (totalIsMinimum).
    async fetchCommitHistoryInPeriod(owner, repo, since, until, maxPages = CLASSROOM_COMMIT_PAGES) {
      const { items, capped } = await withExponentialBackoff(() => paged(
        `/projects/${projectId(owner, repo)}/repository/commits?since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}`,
        'commits in period', maxPages, { notFound: [] },
      ), 2, 1000);
      return { totalCount: items.length, totalIsMinimum: capped, nodes: items.map(toHistoryNode), capped };
    },

    // MRs merged in the period, by merge date (GitLab filters on it server-side),
    // with the same review fields as the Dashboard. Up to CLASSROOM_PR_SCAN.
    async fetchMergedPullRequestsInPeriod(owner, repo, since, until) {
      const query = `query($p: ID!, $a: Time, $b: Time, $after: String) { project(fullPath: $p) {
        mergeRequests(state: merged, mergedAfter: $a, mergedBefore: $b, first: ${CLASSROOM_GITLAB_MR_PAGE}, after: $after, sort: MERGED_AT_DESC) {
          pageInfo { hasNextPage endCursor }
          nodes { iid createdAt mergedAt author { username bot } mergeUser { username }
            approvedBy { nodes { username bot } }
            notes(first: ${GITLAB_MR_NOTES}) { nodes { system body createdAt author { username bot } } }
            diffStatsSummary { additions deletions } } } } }`;
      const nodes = [];
      let after = null;
      for (;;) {
        // Retried like GitHub's: one transient 5xx shouldn't lose every MR of the repository
        const data = await withExponentialBackoff(() => graphql(query, { p: `${owner}/${repo}`, a: since, b: until, after }, 'merged MRs in period'), 2, 1000);
        const conn = data.project?.mergeRequests;
        if (!conn) throw new Error('GitLab GraphQL merged MRs in period failed: project not found');
        nodes.push(...conn.nodes.filter(Boolean));
        if (!conn.pageInfo.hasNextPage || nodes.length >= CLASSROOM_PR_SCAN) return { stats: toPullRequestStats(toReviewNodes(nodes)), capped: conn.pageInfo.hasNextPage };
        after = conn.pageInfo.endCursor;
      }
    },

    // Finished pipelines CREATED in the period (as GitHub's runs: a retry later
    // doesn't move them) that exercise the default branch (classroomPipelines),
    // as Actions runs. `capped` = more than the pages read. CI/CD turned off
    // (403/404 on page 1) = no pipelines, as Actions disabled on GitHub.
    async fetchCiRunsInPeriod(owner, repo, branch, fromDate, toDate) {
      let result;
      try {
        result = await paged(
          `/projects/${projectId(owner, repo)}/pipelines?scope=finished&created_after=${encodeURIComponent(`${fromDate}T00:00:00Z`)}&created_before=${encodeURIComponent(`${toDate}T23:59:59Z`)}`,
          'pipelines in period', CLASSROOM_CI_RUN_PAGES,
        );
      } catch (error) {
        if (error.status === 403 || error.status === 404) return { ...NO_CI_RUNS };
        throw error;
      }
      const { items, capped } = result;
      const kept = classroomPipelines(items, branch);
      return { ...toWorkflowRuns(kept, kept.length), capped };
    },

    /**
     * Who touched each AI-config path on the default branch, for Classroom's per-student view: the
     * last AUTHORSHIP_COMMITS_PER_PATH commits of each path (max AUTHORSHIP_MAX_PATHS paths, one REST
     * request each, AUTHORSHIP_PARALLEL at a time). Same shape as githubService's: { path, commits:
     * [{ login, name, email, date }], complete }, mapped from toHistoryNode (GitLab commits carry no
     * account: `login` is the author name; bots get "[bot]"). A path whose request failed, 404 included,
     * is unknown (no commits, `complete: false`), never "nobody". If every path failed, it throws (the
     * caller shows the column as n/d), carrying TOKEN_REJECTED when that was the cause.
     */
    async fetchAiConfigAuthorship(owner, repo, paths) {
      const list = (paths ?? []).slice(0, AUTHORSHIP_MAX_PATHS);
      const failures = [];
      const one = async (path) => {
        try {
          const items = await withExponentialBackoff(
            () => json(`/projects/${projectId(owner, repo)}/repository/commits?path=${encodeURIComponent(path)}&per_page=${AUTHORSHIP_COMMITS_PER_PATH}`, 'config authorship'),
            1, 500,
          );
          const commits = items.map((c) => {
            const node = toHistoryNode(c);
            return { login: node.author.user?.login ?? null, name: node.author.name, email: node.author.email, date: node.committedDate };
          });
          return { path, commits, complete: items.length < AUTHORSHIP_COMMITS_PER_PATH };
        } catch (error) {
          failures.push(error);
          return { path, commits: [], complete: false };
        }
      };
      // A few at a time: 3 repositories run in parallel already (Classroom), so no burst against the instance
      const out = [];
      for (let i = 0; i < list.length; i += AUTHORSHIP_PARALLEL) out.push(...await Promise.all(list.slice(i, i + AUTHORSHIP_PARALLEL).map(one)));
      if (list.length > 0 && failures.length === list.length) throw failures.find((e) => e.code === 'TOKEN_REJECTED') ?? failures[0];
      if (failures.length > 0) console.warn(`[gitlabService] config authorship: ${failures.length} of ${list.length} paths failed:`, failures[0].message);
      return out;
    },

    // Projects of a group and its subgroups, for the Classroom import (with the
    // user's token, internal and private ones they can see are included).
    // with_shared=false: projects shared INTO the group from elsewhere stay out.
    async fetchGroupProjects(group, maxPages = GITLAB_GROUP_MAX_PAGES) {
      const { items, capped } = await paged(`/groups/${encodeURIComponent(group)}/projects?include_subgroups=true&with_shared=false&order_by=path&sort=asc`, 'group projects', maxPages);
      // Same shape as githubService.fetchOwnerRepositories, fullName as written in the Classroom list
      return { repos: items.map((p) => ({ fullName: `${host}/${p.path_with_namespace}`, archived: Boolean(p.archived) })), capped };
    },

    /**
     * AI context in the shape of githubService.fetchAiRepoContext (parseAiRepoContext reads it):
     * .gitignore and .claude/settings.json text, and the listing of each CONTEXT_DIRS directory
     * (alias d<i>; '' = root) whose top level exists at the root (most projects: 1–4 requests).
     * `listings: false` (Dashboard, which has the tree) reads only the two files.
     * GitLab reports no template repository: the template part is marked unread and
     * `templateUnsupported` tells the coherence rule that origins can never be checked here.
     * A failed or possibly truncated part (a full page of 100) is a partial error on its alias
     * ("not verified"), never "absent". Transient failures get one retry.
     */
    async fetchAiRepoContext(owner, repo, { listings = true } = {}) {
      const unreadTemplate = { path: ['repository', 'templateRepository'], message: 'GitLab reports no template repository' };
      const root = await rootListing(owner, repo);
      if (root === null) return { repository: { templateRepository: null }, errors: [unreadTemplate], templateUnsupported: true };
      const full = (entries) => entries.length >= GITLAB_PER_PAGE; // only the first page was read
      const topLevel = new Set(root.filter((e) => e.type === 'tree').map((e) => e.name));
      const rootFiles = new Set(root.filter((e) => e.type === 'blob').map((e) => e.name));
      const errors = [unreadTemplate];
      const unread = (alias, message) => errors.push({ path: ['repository', alias], message });
      const repository = { templateRepository: null, workflows: null };
      if (listings) {
        repository.d0 = { entries: root.map((e) => ({ name: e.name, type: e.type })) };
        if (full(root)) unread('d0', 'root listing may be truncated');
      }
      const settled = async (alias, load) => {
        try {
          repository[alias] = await withExponentialBackoff(load, 1, 500);
        } catch (error) {
          if (error.code === 'TOKEN_REJECTED') throw error;
          repository[alias] = null;
          unread(alias, error.message);
        }
      };
      // A file missing from a root page that may be truncated isn't "absent": not verified
      const readFile = (alias, path, present) => {
        if (present) return settled(alias, async () => ({ text: await rawFile(owner, repo, path) }));
        if (full(root)) unread(alias, `${path}: root listing may be truncated`);
        return null;
      };
      await Promise.all([
        ...(listings ? CONTEXT_DIRS : []).map((dir, i) => {
          if (!dir || !topLevel.has(dir.split('/')[0])) return null;
          return settled(`d${i}`, async () => {
            const entries = await listing(owner, repo, dir);
            if (entries && full(entries)) throw new Error(`${dir}: listing may be truncated`);
            return entries ? { entries: entries.map((e) => ({ name: e.name, type: e.type })) } : null;
          });
        }),
        readFile('gitignore', '.gitignore', rootFiles.has('.gitignore')),
        topLevel.has('.claude')
          ? settled('claudeSettings', async () => {
            const text = await rawFile(owner, repo, '.claude/settings.json');
            return text == null ? null : { text };
          })
          : readFile('claudeSettings', '.claude/settings.json', false),
      ]);
      return { repository, errors, templateUnsupported: true };
    },
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
