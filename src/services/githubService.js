// GitHub Service - Modern ES6 Module for API calls
// Migrated from v1-legacy/src/modules/githubAPI.js

import { getItem } from "../utils/storage.js";
import { withExponentialBackoff } from "../utils/retry.js";
import { toPullRequestStats } from "../utils/prReviewStats.js";
import {
  GITHUB_PER_PAGE_COMMITS,
  BRANCH_SCAN_MAX,
  GITHUB_PER_PAGE_RECENT_PRS,
  CLOSED_PR_SCAN,
  MERGED_PR_SCAN,
  GITHUB_PER_PAGE_CONTRIBUTORS,
  GITHUB_PER_PAGE_RELEASES,
} from "../constants.js";

const GITHUB_BASE_URL = "https://api.github.com";
const MIN_PR_PAGE = 6; // classroom PR scan: smallest page before giving up

export function hasGithubToken() {
  return Boolean(getItem("github_token"));
}

function getHeaders() {
  const token = getItem("github_token");
  const headers = {
    Accept: "application/vnd.github.v3+json",
  };
  if (token) {
    headers["Authorization"] = `token ${token}`;
  }
  return headers;
}

function lastPageFromLink(linkHeader) {
  const match = linkHeader?.match(/<([^>]+)>;\s*rel="last"/);
  if (!match) return null;
  const page = Number(new URL(match[1]).searchParams.get("page"));
  return Number.isFinite(page) && page > 0 ? page : null;
}

// POST a query to the GitHub GraphQL API (token required). owner/repo always
// go in `variables`, never interpolated into the query. Returns `data`;
// throws when there is none; partial errors (data + errors) are logged.
async function graphql(query, variables, label) {
  const response = await fetch(`${GITHUB_BASE_URL}/graphql`, {
    method: "POST",
    headers: { ...getHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) {
    throw new Error(`GraphQL ${label} failed: HTTP ${response.status}`);
  }
  const body = await response.json();
  if (!body.data) {
    throw new Error(`GraphQL ${label} failed: ${body.errors?.[0]?.message ?? "no data"}`);
  }
  if (body.errors?.length) {
    console.warn(`[githubService] GraphQL ${label} returned partial data:`, body.errors[0].message);
  }
  return body.data;
}

function statsError(code, path, status) {
  const error = new Error(`GitHub stats ${path} ${code}${status ? `: HTTP ${status}` : ''}`);
  error.code = code;
  return error;
}

// /stats/* endpoints: 202 while GitHub computes them, 204 for empty repos, 422
// when the repo is too large. Codes match utils/activityStats.js.
async function fetchStats(owner, repo, path) {
  const url = `${GITHUB_BASE_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/stats/${path}`;
  const response = await fetch(url, { headers: getHeaders() });
  if (response.status === 202) throw statsError('COMPUTING', path);
  if (response.status === 204) return [];
  if (response.status === 422) throw statsError('TOO_LARGE', path);
  if (!response.ok) throw statsError('FAILED', path, response.status);
  return response.json();
}

async function fetchSearchCount(owner, repo, qualifiers) {
  const query = `repo:${encodeURIComponent(owner)}/${encodeURIComponent(repo)}+${qualifiers}`;
  const response = await fetch(`${GITHUB_BASE_URL}/search/issues?q=${query}`, { headers: getHeaders() });
  if (!response.ok) {
    throw new Error(`Search "${qualifiers}" failed: HTTP ${response.status}`);
  }
  const data = await response.json();
  return data.total_count;
}

export const githubService = {
  async fetchRepository(owner, repo) {
    if (!owner || !repo) {
      throw new Error("Owner and repo are required");
    }

    const url = `${GITHUB_BASE_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const response = await fetch(url, { headers: getHeaders() });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  },

  async fetchCommits(owner, repo, params = {}) {
    if (!owner || !repo) {
      throw new Error("Owner and repo are required");
    }

    const perPage = params.perPage || GITHUB_PER_PAGE_COMMITS;
    const url = `${GITHUB_BASE_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?per_page=${perPage}`;

    const response = await fetch(url, { headers: getHeaders() });
    if (response.status === 409) return []; // empty repository

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  },

  // Exact branch count with one request: per_page=1, so the Link header's
  // rel="last" page number IS the count. Used without a token (the old
  // per_page=20 list made "Total de Branches" 20 for repos with 1,000+).
  async fetchBranchCount(owner, repo) {
    const url = `${GITHUB_BASE_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=1`;
    const response = await fetch(url, { headers: getHeaders() });
    if (!response.ok) {
      throw new Error(`Branches failed: HTTP ${response.status}`);
    }
    const lastPage = lastPageFromLink(response.headers.get("link"));
    if (lastPage !== null) return lastPage;
    return (await response.json()).length;
  },

  // With a token: every branch's last commit date via GraphQL (100 per page,
  // up to BRANCH_SCAN_MAX), instead of one REST request per branch for the
  // first 20 only. Throws on failure; requires a token (callers check).
  async fetchBranchActivity(owner, repo) {
    // refUpdateRule reflects the effective protection (rulesets included);
    // branchProtectionRule only classic rules.
    const query = `query($owner: String!, $name: String!, $after: String) {
      repository(owner: $owner, name: $name) {
        refs(refPrefix: "refs/heads/", first: 100, after: $after) {
          totalCount
          pageInfo { hasNextPage endCursor }
          nodes {
            name
            branchProtectionRule { id }
            refUpdateRule { requiredApprovingReviewCount }
            target { ... on Commit { committedDate } }
          }
        }
      }
    }`;
    const branches = [];
    let after = null;
    let totalCount = 0;
    let hasNextPage = true;
    while (hasNextPage && branches.length < BRANCH_SCAN_MAX) {
      const data = await graphql(query, { owner, name: repo, after }, "branches");
      const refs = data.repository?.refs;
      if (!refs) throw new Error("GraphQL branches failed: no refs");
      totalCount = refs.totalCount;
      for (const node of refs.nodes ?? []) {
        if (!node) continue; // partial-error responses can contain null nodes
        branches.push({
          name: node.name,
          protected: Boolean(node.branchProtectionRule || node.refUpdateRule),
          committedDate: node.target?.committedDate ?? null,
        });
      }
      ({ hasNextPage, endCursor: after } = refs.pageInfo);
    }
    return { totalCount, branches, capped: hasNextPage };
  },

  // Fallback for contributor analysis when /stats/contributors isn't ready:
  // the top 100 contributors, all-time only. Throws on failure (used to return
  // [] → "no contributors" and a persisted empty bus factor).
  async fetchContributors(owner, repo) {
    const url = `${GITHUB_BASE_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contributors?per_page=${GITHUB_PER_PAGE_CONTRIBUTORS}`;
    const response = await fetch(url, { headers: getHeaders() });
    if (!response.ok) {
      throw new Error(`Contributors failed: HTTP ${response.status}`);
    }
    return response.json();
  },

  // Top contributors with weekly commit counts (all-time AND recent windows,
  // bots flagged as type "Bot"). One request, no retry: GitHub answers 202
  // while it computes the stats, and waiting for it held the whole dashboard
  // (this runs inside useRepository's allSettled) — the caller falls back to
  // /contributors instead; the next search usually finds the stats ready.
  async fetchContributorStats(owner, repo) {
    const url = `${GITHUB_BASE_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/stats/contributors`;
    const response = await fetch(url, { headers: getHeaders() });
    if (response.status === 202) {
      throw new Error("Contributor stats still being computed by GitHub (HTTP 202)");
    }
    if (response.status === 204) return []; // empty repository
    if (!response.ok) {
      throw new Error(`Contributor stats failed: HTTP ${response.status}`);
    }
    return response.json();
  },

  // Counts below come from the Search API. A failure (HTTP error, network,
  // rate limit — search allows ~10 req/min without a token) THROWS instead of
  // returning 0/null: useRepository then reports the metric as unavailable
  // (partial-data warning) rather than showing and persisting a fake zero.
  async fetchPullRequests(owner, repo) {
    return fetchSearchCount(owner, repo, 'type:pr');
  },

  async fetchLanguages(owner, repo) {
    if (!owner || !repo) {
      return {};
    }

    try {
      const url = `${GITHUB_BASE_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/languages`;
      const response = await fetch(url, { headers: getHeaders() });

      if (!response.ok) {
        console.warn(`Failed to fetch languages: ${response.status}`);
        return {};
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.warn("Error fetching languages:", error);
      return {};
    }
  },

  async fetchOpenIssuesCount(owner, repo) {
    return fetchSearchCount(owner, repo, 'is:issue+is:open');
  },

  async fetchClosedIssuesCount(owner, repo) {
    return fetchSearchCount(owner, repo, 'is:issue+is:closed');
  },

  // null = GitHub has no community profile for this repo (it returns 404 for
  // forks): "unavailable", not an error. Any other failure throws.
  async fetchCommunityProfile(owner, repo) {
    const url = `${GITHUB_BASE_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/community/profile`;
    const response = await fetch(url, { headers: getHeaders() });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Community profile failed: HTTP ${response.status}`);
    }
    return response.json();
  },

  async fetchRecentPullRequests(owner, repo) {
    if (!owner || !repo) {
      return [];
    }

    try {
      const url = `${GITHUB_BASE_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=all&sort=created&direction=desc&per_page=${GITHUB_PER_PAGE_RECENT_PRS}`;
      const response = await fetch(url, { headers: getHeaders() });

      if (!response.ok) {
        console.warn(
          `Failed to fetch recent pull requests: ${response.status}`,
        );
        return [];
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.warn("Error fetching recent pull requests:", error);
      return [];
    }
  },

  // Completed GitHub Actions runs triggered by pushes to the default branch
  // (CI health). Throws on failure; 404 (Actions disabled) = no runs.
  // exclude_pull_requests only empties each run's pull_requests array (smaller payload).
  async fetchActionRuns(owner, repo, branch) {
    const url = `${GITHUB_BASE_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs?branch=${encodeURIComponent(branch)}&event=push&status=completed&exclude_pull_requests=true&per_page=50`;
    const response = await fetch(url, { headers: getHeaders() });
    if (response.status === 404) return { total_count: 0, workflow_runs: [] };
    if (!response.ok) throw new Error(`Actions runs failed: HTTP ${response.status}`);
    return response.json();
  },

  // Latest 100 releases (release cadence). Throws on failure.
  async fetchReleases(owner, repo) {
    const url = `${GITHUB_BASE_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?per_page=100`;
    const response = await fetch(url, { headers: getHeaders() });
    if (!response.ok) throw new Error(`Releases failed: HTTP ${response.status}`);
    return response.json();
  },

  async fetchReleasesCount(owner, repo) {
    // Throws on failure (the caller shows n/d) instead of returning 0.
    const url = `${GITHUB_BASE_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?per_page=${GITHUB_PER_PAGE_RELEASES}`;
    const response = await fetch(url, { headers: getHeaders() });

    if (!response.ok) {
      throw new Error(`Releases failed: HTTP ${response.status}`);
    }

    // per_page=1, so the Link header's rel="last" page number is the total
    const lastPage = lastPageFromLink(response.headers.get("link"));
    if (lastPage !== null) return lastPage;

    // No Link header = single page: the first response already has the full list.
    const data = await response.json();
    return data.length;
  },

  // Weekly commits of the last 52 weeks. Throws (code COMPUTING on 202) instead
  // of 52 zeros, which read and were persisted as "no activity".
  async fetchCommitActivity(owner, repo) {
    const data = await fetchStats(owner, repo, 'participation');
    if (Array.isArray(data) && data.length === 0) return { all: [] }; // 204: empty repository
    if (!Array.isArray(data?.all)) throw statsError('FAILED', 'participation');
    return data;
  },

  // Commits per weekday/hour, whole history (see utils/activityStats.js).
  async fetchPunchCard(owner, repo) {
    return fetchStats(owner, repo, 'punch_card');
  },

  // Recursive file tree of the default branch. Returns { tree, truncated }:
  // GitHub truncates huge trees (linux), and a 422 (too large) falls back to
  // the root level only — both reported as truncated so detectors say "not
  // verified" instead of "absent". Throws on failure (was { tree: [] }).
  // Targeted check for when the recursive tree came back truncated: does any of
  // the directories GitHub reads issue templates from exist? 404 = absent;
  // anything else throws (unknown, not "absent"). Contents paths are
  // case-sensitive: a lowercase issue_template/ stays uncertain (not saved).
  async hasIssueTemplateDirectory(owner, repo) {
    const base = `${GITHUB_BASE_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents`;
    const responses = await Promise.all(
      ['.github/ISSUE_TEMPLATE', 'docs/ISSUE_TEMPLATE', 'ISSUE_TEMPLATE'].map((dir) => fetch(`${base}/${dir}`, { headers: getHeaders() }))
    );
    const failed = responses.find((r) => !r.ok && r.status !== 404);
    if (failed) throw new Error(`Issue template check failed: HTTP ${failed.status}`);
    for (const r of responses.filter((res) => res.ok)) {
      const entries = await r.json();
      if (Array.isArray(entries) && entries.some((e) => !/^config\.ya?ml$/i.test(e.name))) return true;
    }
    return false;
  },

  async fetchRepositoryTree(owner, repo, defaultBranch) {
    if (!defaultBranch) return { tree: [], truncated: false }; // empty repository: nothing to find
    const base = `${GITHUB_BASE_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(defaultBranch)}`;
    const response = await fetch(`${base}?recursive=1`, { headers: getHeaders() });
    if (response.status === 422) {
      const rootOnly = await fetch(base, { headers: getHeaders() });
      if (!rootOnly.ok) {
        throw new Error(`Repository tree failed: HTTP ${rootOnly.status}`);
      }
      return { tree: (await rootOnly.json()).tree ?? [], truncated: true };
    }
    if (response.status === 409) return { tree: [], truncated: false }; // "Git Repository is empty": complete and empty, not a failure
    if (!response.ok) {
      throw new Error(`Repository tree failed: HTTP ${response.status}`);
    }
    const data = await response.json();
    return { tree: data.tree ?? [], truncated: Boolean(data.truncated) };
  },

  // Lead time sample: recently updated CLOSED PRs (merging updates a PR), from
  // which analyzeLeadTime keeps the latest merged ones. Was the 20 most recently
  // *created* PRs, mostly still open in active repos. Throws on failure.
  async fetchPullRequestStats(owner, repo) {
    const url = `${GITHUB_BASE_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=closed&sort=updated&direction=desc&per_page=${CLOSED_PR_SCAN}`;
    const response = await fetch(url, { headers: getHeaders() });
    if (response.status === 404) return []; // pull requests disabled (torvalds/linux): no PRs, not a failure
    if (!response.ok) {
      throw new Error(`PR stats failed: HTTP ${response.status}`);
    }
    return response.json();
  },

  // Review data for recently merged PRs (who merged, approvals, comment
  // authors) in one GraphQL call — the REST list has none of it. Ordered by
  // last update (no merge-date order exists): old PRs with a recent comment
  // come along, so MERGED_PR_SCAN > MERGED_PR_SAMPLE and prReviewStats keeps
  // the latest merged. reviews(last:) so the final approval is included.
  // Requires a token (callers check hasGithubToken()). Unlike the other
  // fetchers it throws on failure, so useRepository can tell "failed" from
  // "no token" and list it in the partial-data warning.
  async fetchPullRequestReviewStats(owner, repo) {
    if (!owner || !repo || !hasGithubToken()) {
      throw new Error("fetchPullRequestReviewStats needs owner, repo and a GitHub token");
    }

    // Three queries over the same PR list, in parallel: one query with every
    // field took 5–10 s on react/express (GitHub cuts GraphQL at ~10 s → 502).
    // Split, each takes ~1.5–5 s (timing/timelineItems is usually the slowest)
    // and the total is about the slowest one; cost ~5 points per search. The
    // core one feeds coverage/divergence/lead time and must succeed; timing
    // (first reviews, ready-for-review) and size fail on their own: their PRs
    // are then marked unknown and only those indicators become unavailable.
    const prList = (fields) => `query($owner: String!, $name: String!, $n: Int!) {
      repository(owner: $owner, name: $name) {
        pullRequests(states: MERGED, first: $n, orderBy: { field: UPDATED_AT, direction: DESC }) {
          nodes { number ${fields} }
        }
      }
    }`;
    const core = prList(`
            createdAt
            mergedAt
            author { login __typename }
            mergedBy { login }
            comments(first: 100) { totalCount nodes { author { login __typename } } }
            reviews(last: 50) { nodes { state submittedAt author { login __typename } comments { totalCount } } }`);
    const timing = prList(`
            firstReviews: reviews(first: 10) { nodes { submittedAt author { login __typename } } }
            readyForReview: timelineItems(itemTypes: [READY_FOR_REVIEW_EVENT], first: 1) { nodes { ... on ReadyForReviewEvent { createdAt } } }`);
    const size = prList('additions deletions');

    // Sent as GraphQL variables, never interpolated into the query string.
    const variables = { owner, name: repo, n: MERGED_PR_SCAN };
    const [coreRes, timingRes, sizeRes] = await Promise.allSettled([
      graphql(core, variables, "PR review stats"),
      graphql(timing, variables, "PR review timing"),
      graphql(size, variables, "PR sizes"),
    ]);
    if (coreRes.status === 'rejected') throw coreRes.reason;
    const nodes = coreRes.value.repository?.pullRequests?.nodes;
    if (!Array.isArray(nodes)) {
      throw new Error("GraphQL PR review stats failed: no pull requests");
    }
    const byNumber = (res) => (res.status === 'fulfilled'
      ? new Map((res.value.repository?.pullRequests?.nodes ?? []).filter(Boolean).map((n) => [n.number, n]))
      : null);
    const timingBy = byNumber(timingRes);
    const sizeBy = byNumber(sizeRes);
    if (!timingBy) console.warn('[githubService] PR review timing failed:', timingRes.reason?.message);
    if (!sizeBy) console.warn('[githubService] PR sizes failed:', sizeRes.reason?.message);

    // Query failed → *Failed on every PR (indicator unavailable). A PR missing
    // from a list that did load (updated between the queries) → *Unknown on
    // that PR only (left out of that indicator's n).
    return toPullRequestStats(nodes.filter(Boolean).map((n) => ({
      ...n,
      ...(timingBy ? timingBy.get(n.number) ?? { timingUnknown: true } : { timingFailed: true }),
      ...(sizeBy ? sizeBy.get(n.number) ?? { sizeUnknown: true } : { sizeFailed: true }),
    })));
  },

  // --- Classroom mode (period-bounded; token required) ---------------------
  // Owner/repo arrive validated (utils/repoName.parseSafeRepoName) and go only
  // as GraphQL variables or encoded URL parts.

  // Repositories of an organization (or, if it isn't one, a user), for the
  // classroom import. With the user's token, private repos they can see are
  // included (GitHub Classroom creates them private).
  async fetchOwnerRepositories(owner, maxPages = 10) {
    const list = async (kind) => {
      const repos = [];
      for (let page = 1; page <= maxPages; page++) {
        const url = `${GITHUB_BASE_URL}/${kind}/${encodeURIComponent(owner)}/repos?type=all&sort=full_name&per_page=100&page=${page}`;
        const response = await fetch(url, { headers: getHeaders() });
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`Repositories of ${owner} failed: HTTP ${response.status}`);
        const data = await response.json();
        repos.push(...data.map((r) => ({ fullName: r.full_name, private: r.private, archived: r.archived })));
        if (data.length < 100) return { repos, capped: false };
      }
      return { repos, capped: true };
    };
    const result = (await list('orgs')) ?? (await list('users'));
    if (!result) throw new Error(`Repositories of ${owner} failed: HTTP 404`);
    return result;
  },

  // Default-branch commits between since/until (ISO), up to maxPages × 100.
  async fetchCommitHistoryInPeriod(owner, repo, since, until, maxPages = 3) {
    const query = `query($owner: String!, $name: String!, $since: GitTimestamp!, $until: GitTimestamp!, $after: String) {
      repository(owner: $owner, name: $name) {
        defaultBranchRef { target { ... on Commit {
          history(since: $since, until: $until, first: 100, after: $after) {
            totalCount
            pageInfo { hasNextPage endCursor }
            nodes { message parents { totalCount } author { name user { login } } }
          }
        } } }
      }
    }`;
    const nodes = [];
    let after = null;
    let totalCount = 0;
    for (let page = 0; page < maxPages; page++) {
      const data = await withExponentialBackoff(() => graphql(query, { owner, name: repo, since, until, after }, "commit history"), 2, 1000);
      if (!data.repository) throw new Error("GraphQL commit history failed: repository not found");
      const history = data.repository.defaultBranchRef?.target?.history;
      if (!history) return { totalCount: 0, nodes: [], capped: false }; // empty repository (no default branch)
      totalCount = history.totalCount;
      nodes.push(...history.nodes.filter(Boolean));
      if (!history.pageInfo.hasNextPage) return { totalCount, nodes, capped: false };
      after = history.pageInfo.endCursor;
    }
    return { totalCount, nodes, capped: true };
  },

  // PRs merged in the period: the repository's merged PRs by last update,
  // filtered by mergedAt. Not the search API: it returned 0 with no error
  // for orgs/tokens where search is restricted (a class would read "0 PRs"),
  // and its single big query timed out (502) on vscode/next.js. Pages of 25
  // with every review field stay well under GitHub's ~10 s limit. A PR's
  // updatedAt is ≥ its mergedAt, so the scan stops at the first page older
  // than the period; maxScanned bounds very active repos (capped).
  // Lighter than the Dashboard query: no comments (divergence isn't shown
  // here) and the last 20 reviews — heavy pages on next.js-sized repos tripped
  // GitHub's secondary rate limit and blocked the rest of the class.
  async fetchMergedPullRequestsInPeriod(owner, repo, since, until, { pageSize = 25, maxScanned = 200 } = {}) {
    const query = `query($owner: String!, $name: String!, $n: Int!, $after: String) {
      repository(owner: $owner, name: $name) {
        pullRequests(states: MERGED, first: $n, after: $after, orderBy: { field: UPDATED_AT, direction: DESC }) {
          pageInfo { hasNextPage endCursor }
          nodes {
            number createdAt mergedAt updatedAt additions deletions
            author { login __typename }
            mergedBy { login }
            reviews(last: 20) { nodes { state submittedAt author { login __typename } } }
            firstReviews: reviews(first: 10) { nodes { submittedAt author { login __typename } } }
            readyForReview: timelineItems(itemTypes: [READY_FOR_REVIEW_EVENT], first: 1) { nodes { ... on ReadyForReviewEvent { createdAt } } }
          }
        }
      }
    }`;
    const from = Date.parse(since);
    const to = Date.parse(until);
    const inPeriod = [];
    let after = null;
    let scanned = 0;
    let n = pageSize;
    for (;;) {
      // Some pages take 20 s+ (a few huge PRs: react, next.js) and fail with a
      // 502/504 — in the browser just "Failed to fetch", and again on retry.
      // Shrink that page (25 → 12 → 6) from the same cursor instead of losing
      // every PR of the repository; give up below MIN_PR_PAGE.
      let data;
      try {
        data = await withExponentialBackoff(() => graphql(query, { owner, name: repo, n, after }, "merged PRs in period"), 1, 1000);
      } catch (error) {
        if (n <= MIN_PR_PAGE) throw error;
        n = Math.max(MIN_PR_PAGE, Math.floor(n / 2));
        continue;
      }
      if (!data.repository) throw new Error("GraphQL merged PRs in period failed: repository not found");
      const { nodes, pageInfo } = data.repository.pullRequests;
      const page = nodes.filter(Boolean);
      scanned += page.length;
      inPeriod.push(...page.filter((n) => { const m = Date.parse(n.mergedAt); return m >= from && m <= to; }));
      const olderThanPeriod = page.length === 0 || Date.parse(page[page.length - 1].updatedAt) < from;
      if (olderThanPeriod || !pageInfo.hasNextPage) return { stats: toPullRequestStats(inPeriod), capped: false };
      if (scanned >= maxScanned) return { stats: toPullRequestStats(inPeriod), capped: true };
      after = pageInfo.endCursor;
    }
  },

  // Push runs on the default branch created in the period (CI health).
  async fetchActionRunsInPeriod(owner, repo, branch, fromDate, toDate) {
    const url = `${GITHUB_BASE_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs?branch=${encodeURIComponent(branch)}&event=push&status=completed&created=${encodeURIComponent(`${fromDate}..${toDate}`)}&exclude_pull_requests=true&per_page=100`;
    const response = await fetch(url, { headers: getHeaders() });
    if (response.status === 404) return { total_count: 0, workflow_runs: [] };
    if (!response.ok) throw new Error(`Actions runs failed: HTTP ${response.status}`);
    return response.json();
  },

  // Weekly additions/deletions. 422 = repo with ≥ 10k commits (GitHub doesn't
  // compute it): code TOO_LARGE, shown differently from 202 / failures.
  async fetchCodeFrequency(owner, repo) {
    return fetchStats(owner, repo, 'code_frequency');
  },

  async fetchMergedPRsCount(owner, repo) {
    return fetchSearchCount(owner, repo, 'is:pr+is:merged');
  },
};
