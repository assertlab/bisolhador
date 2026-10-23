// GitHub Service - Modern ES6 Module for API calls
// Migrated from v1-legacy/src/modules/githubAPI.js

import { getItem } from "../utils/storage.js";
import { toPullRequestStats } from "../utils/prReviewStats.js";
import {
  GITHUB_PER_PAGE_COMMITS,
  BRANCH_SCAN_MAX,
  GITHUB_PER_PAGE_RECENT_PRS,
  GITHUB_PER_PAGE_PR_STATS,
  GITHUB_PER_PAGE_CONTRIBUTORS,
  GITHUB_PER_PAGE_RELEASES,
  WEEKS_IN_YEAR,
} from "../constants.js";

const GITHUB_BASE_URL = "https://api.github.com";

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
  const page = new URL(match[1]).searchParams.get("page");
  return page ? parseInt(page, 10) : null;
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
    const query = `query($owner: String!, $name: String!, $after: String) {
      repository(owner: $owner, name: $name) {
        refs(refPrefix: "refs/heads/", first: 100, after: $after) {
          totalCount
          pageInfo { hasNextPage endCursor }
          nodes {
            name
            branchProtectionRule { id }
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
      const response = await fetch(`${GITHUB_BASE_URL}/graphql`, {
        method: "POST",
        headers: { ...getHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables: { owner, name: repo, after } }),
      });
      if (!response.ok) {
        throw new Error(`GraphQL branches failed: HTTP ${response.status}`);
      }
      const body = await response.json();
      const refs = body.data?.repository?.refs;
      if (!refs) {
        throw new Error(`GraphQL branches failed: ${body.errors?.[0]?.message ?? "no data"}`);
      }
      totalCount = refs.totalCount;
      for (const node of refs.nodes) {
        branches.push({
          name: node.name,
          protected: Boolean(node.branchProtectionRule),
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

  async fetchCommitActivity(owner, repo) {
    if (!owner || !repo) {
      return { all: Array(WEEKS_IN_YEAR).fill(0) }; // Return 52 weeks of zeros
    }

    try {
      const url = `${GITHUB_BASE_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/stats/participation`;
      const response = await fetch(url, { headers: getHeaders() });

      if (!response.ok) {
        console.warn(`Failed to fetch commit activity: ${response.status}`);
        return { all: Array(WEEKS_IN_YEAR).fill(0) };
      }

      const data = await response.json();
      // Ensure we have valid data
      if (!data || !data.all || !Array.isArray(data.all)) {
        return { all: Array(WEEKS_IN_YEAR).fill(0) };
      }
      return data;
    } catch (error) {
      console.warn("Error fetching commit activity:", error);
      return { all: Array(WEEKS_IN_YEAR).fill(0) };
    }
  },

  async fetchRepositoryTree(owner, repo, defaultBranch) {
    if (!owner || !repo || !defaultBranch) {
      return { tree: [] };
    }

    try {
      const url = `${GITHUB_BASE_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`;
      const response = await fetch(url, { headers: getHeaders() });

      if (!response.ok) {
        if (response.status === 422) {
          // Repository too large, try without recursive
          const urlNoRecursive = `${GITHUB_BASE_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(defaultBranch)}`;
          const responseNoRecursive = await fetch(urlNoRecursive, {
            headers: getHeaders(),
          });
          if (!responseNoRecursive.ok) {
            return { tree: [] };
          }
          const dataNoRecursive = await responseNoRecursive.json();
          return dataNoRecursive;
        }
        console.warn(`Failed to fetch repository tree: ${response.status}`);
        return { tree: [] };
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.warn("Error fetching repository tree:", error);
      return { tree: [] };
    }
  },

  async fetchPullRequestStats(owner, repo) {
    if (!owner || !repo) {
      return [];
    }

    try {
      const url = `${GITHUB_BASE_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=all&per_page=${GITHUB_PER_PAGE_PR_STATS}&sort=created&direction=desc`;
      const response = await fetch(url, { headers: getHeaders() });

      if (!response.ok) {
        console.warn(`Failed to fetch PR stats: ${response.status}`);
        return [];
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.warn("Error fetching PR stats:", error);
      return [];
    }
  },

  // Review data (merged_by, comment counts) for the same recent PRs as
  // fetchPullRequestStats, in one GraphQL call instead of up to
  // GITHUB_PER_PAGE_PR_STATS per-PR REST calls. Why: see src/utils/prReviewStats.js.
  // Requires a token (callers check hasGithubToken()). Unlike the other
  // fetchers it throws on failure, so useRepository can tell "failed" from
  // "no token" and list it in the partial-data warning.
  async fetchPullRequestReviewStats(owner, repo) {
    if (!owner || !repo || !hasGithubToken()) {
      throw new Error("fetchPullRequestReviewStats needs owner, repo and a GitHub token");
    }

    const query = `query($owner: String!, $name: String!, $n: Int!) {
      repository(owner: $owner, name: $name) {
        pullRequests(first: $n, orderBy: { field: CREATED_AT, direction: DESC }) {
          nodes {
            createdAt
            mergedAt
            author { login }
            mergedBy { login }
            comments { totalCount }
            reviews(first: 100) { nodes { comments { totalCount } } }
          }
        }
      }
    }`;

    const response = await fetch(`${GITHUB_BASE_URL}/graphql`, {
      method: "POST",
      headers: { ...getHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        // Sent as GraphQL variables, never interpolated into the query string.
        variables: { owner, name: repo, n: GITHUB_PER_PAGE_PR_STATS },
      }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL PR review stats failed: ${response.status}`);
    }

    // GraphQL can return partial data alongside `errors` (e.g. one node
    // FORBIDDEN); use the data when it's there, fail only when it isn't.
    const body = await response.json();
    const nodes = body.data?.repository?.pullRequests?.nodes;
    if (!Array.isArray(nodes)) {
      throw new Error(`GraphQL PR review stats failed: ${body.errors?.[0]?.message ?? "no data"}`);
    }
    if (body.errors?.length) {
      console.warn("[githubService] GraphQL PR review stats returned partial data:", body.errors[0].message);
    }

    return toPullRequestStats(nodes);
  },

  async fetchCodeFrequency(owner, repo) {
    if (!owner || !repo) {
      return [];
    }

    try {
      const url = `${GITHUB_BASE_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/stats/code_frequency`;
      const response = await fetch(url, { headers: getHeaders() });

      // Silently handle 202 (calculating) and 422 (repo too large)
      if (response.status === 202 || response.status === 422 || !response.ok) {
        return [];
      }

      const data = await response.json();
      return data || [];
    } catch {
      // Silently handle all errors for this endpoint (including 422 on large repos)
      return [];
    }
  },

  async fetchMergedPRsCount(owner, repo) {
    return fetchSearchCount(owner, repo, 'is:pr+is:merged');
  },
};
