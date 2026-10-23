// GitHub Service - Modern ES6 Module for API calls
// Migrated from v1-legacy/src/modules/githubAPI.js

import { getItem } from "../utils/storage.js";
import { toPullRequestStats } from "../utils/prReviewStats.js";
import {
  GITHUB_PER_PAGE_COMMITS,
  BRANCH_SCAN_MAX,
  GITHUB_PER_PAGE_RECENT_PRS,
  CLOSED_PR_SCAN,
  MERGED_PR_SAMPLE,
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

  // Review data for the latest merged PRs (who merged, approvals, comment
  // authors) in one GraphQL call — the REST list has none of it. Why and how
  // it's measured: src/utils/prReviewStats.js. reviews(last:) so the final
  // approval of a long review is included.
  // Requires a token (callers check hasGithubToken()). Unlike the other
  // fetchers it throws on failure, so useRepository can tell "failed" from
  // "no token" and list it in the partial-data warning.
  async fetchPullRequestReviewStats(owner, repo) {
    if (!owner || !repo || !hasGithubToken()) {
      throw new Error("fetchPullRequestReviewStats needs owner, repo and a GitHub token");
    }

    const query = `query($owner: String!, $name: String!, $n: Int!) {
      repository(owner: $owner, name: $name) {
        pullRequests(states: MERGED, first: $n, orderBy: { field: UPDATED_AT, direction: DESC }) {
          nodes {
            createdAt
            mergedAt
            author { login __typename }
            mergedBy { login }
            comments(first: 100) { totalCount nodes { author { login __typename } } }
            reviews(last: 50) { nodes { state author { login __typename } comments { totalCount } } }
          }
        }
      }
    }`;

    // Sent as GraphQL variables, never interpolated into the query string.
    const data = await graphql(query, { owner, name: repo, n: MERGED_PR_SAMPLE }, "PR review stats");
    const nodes = data.repository?.pullRequests?.nodes;
    if (!Array.isArray(nodes)) {
      throw new Error("GraphQL PR review stats failed: no pull requests");
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
