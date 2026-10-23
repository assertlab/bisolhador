// GitHub Service - Modern ES6 Module for API calls
// Migrated from v1-legacy/src/modules/githubAPI.js

import { getItem } from "../utils/storage.js";
import { toPullRequestStats } from "../utils/prReviewStats.js";
import {
  GITHUB_PER_PAGE_COMMITS,
  GITHUB_PER_PAGE_BRANCHES,
  GITHUB_PER_PAGE_RECENT_PRS,
  GITHUB_PER_PAGE_PR_STATS,
  GITHUB_PER_PAGE_RELEASES,
  ZOMBIE_BRANCH_DAYS,
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

  async fetchBranches(owner, repo) {
    // Throws on failure (the caller shows n/d) instead of { count: 0, zombies: 0 },
    // which rendered as a green "no zombie branches" badge.
    const url = `${GITHUB_BASE_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=${GITHUB_PER_PAGE_BRANCHES}`;
    const response = await fetch(url, { headers: getHeaders() });

    if (!response.ok) {
      throw new Error(`Branches failed: HTTP ${response.status}`);
    }

    const data = await response.json();
    const count = data.length;
    let zombies = 0;
    // A branch whose last commit couldn't be checked makes the zombie count
    // unknown (null → n/d), not "one fewer zombie".
    let unchecked = 0;
    const now = new Date();
    const ninetyDaysAgo = new Date(
      now.getTime() - ZOMBIE_BRANCH_DAYS * 24 * 60 * 60 * 1000,
    );

    for (const branch of data) {
      if (!branch.commit || !branch.commit.url) {
        unchecked++;
        continue;
      }

      try {
        const commitResponse = await fetch(branch.commit.url, {
          headers: getHeaders(),
        });
        if (commitResponse.ok) {
          const commitData = await commitResponse.json();
          const commitDate = new Date(commitData.commit.author.date);
          if (commitDate < ninetyDaysAgo) {
            zombies++;
          }
        } else {
          unchecked++;
        }
      } catch (error) {
        console.warn("Error fetching commit details for branch:", branch.name, error);
        unchecked++;
      }
    }

    return { count, zombies: unchecked > 0 ? null : zombies };
  },

  async fetchContributors(owner, repo) {
    if (!owner || !repo) {
      return [];
    }

    try {
      const url = `${GITHUB_BASE_URL}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contributors`;
      const response = await fetch(url, { headers: getHeaders() });

      if (!response.ok) {
        console.warn(`Failed to fetch contributors: ${response.status}`);
        return [];
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.warn("Error fetching contributors:", error);
      return [];
    }
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

    // Parse Link header for last page to get total count
    const linkHeader = response.headers.get("link");
    if (linkHeader) {
      const lastMatch = linkHeader.match(/<([^>]+)>;\s*rel="last"/);
      if (lastMatch) {
        const lastUrl = new URL(lastMatch[1]);
        const page = lastUrl.searchParams.get("page");
        if (page) {
          return parseInt(page);
        }
      }
    }

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
