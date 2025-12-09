// GitHub Service - Modern ES6 Module for API calls
// Migrated from v1-legacy/src/modules/githubAPI.js

const GITHUB_BASE_URL = 'https://api.github.com';

function getHeaders() {
    const token = localStorage.getItem('github_token');
    const headers = {
        'Accept': 'application/vnd.github.v3+json'
    };
    if (token) {
        headers['Authorization'] = `token ${token}`;
    }
    return headers;
}

export const githubService = {
    async fetchRepository(owner, repo) {
        if (!owner || !repo) {
            throw new Error('Owner and repo are required');
        }

        const url = `${GITHUB_BASE_URL}/repos/${owner}/${repo}`;
        const response = await fetch(url, { headers: getHeaders() });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    },

    async fetchCommits(owner, repo, params = {}) {
        if (!owner || !repo) {
            throw new Error('Owner and repo are required');
        }

        const perPage = params.perPage || 15;
        const url = `${GITHUB_BASE_URL}/repos/${owner}/${repo}/commits?per_page=${perPage}`;

        const response = await fetch(url, { headers: getHeaders() });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    },

    async fetchBranches(owner, repo) {
        if (!owner || !repo) {
            return { count: 0, zombies: 0 };
        }

        try {
            const url = `${GITHUB_BASE_URL}/repos/${owner}/${repo}/branches?per_page=20`;
            const response = await fetch(url, { headers: getHeaders() });

            if (!response.ok) {
                console.warn(`Failed to fetch branches: ${response.status}`);
                return { count: 0, zombies: 0 };
            }

            const data = await response.json();
            const count = data.length;
            let zombies = 0;
            const now = new Date();
            const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

            for (const branch of data) {
                if (!branch.commit || !branch.commit.url) continue;

                try {
                    const commitResponse = await fetch(branch.commit.url, { headers: getHeaders() });
                    if (commitResponse.ok) {
                        const commitData = await commitResponse.json();
                        const commitDate = new Date(commitData.commit.author.date);
                        if (commitDate < ninetyDaysAgo) {
                            zombies++;
                        }
                    }
                } catch (error) {
                    console.warn('Error fetching commit details for branch:', branch.name, error);
                    // Ignore, as per fail-safe
                }
            }

            return { count, zombies };
        } catch (error) {
            console.warn('Error fetching branches:', error);
            return { count: 0, zombies: 0 };
        }
    },

    async fetchContributors(owner, repo) {
        if (!owner || !repo) {
            return [];
        }

        try {
            const url = `${GITHUB_BASE_URL}/repos/${owner}/${repo}/contributors`;
            const response = await fetch(url, { headers: getHeaders() });

            if (!response.ok) {
                console.warn(`Failed to fetch contributors: ${response.status}`);
                return [];
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.warn('Error fetching contributors:', error);
            return [];
        }
    },

    async fetchPullRequests(owner, repo) {
        if (!owner || !repo) {
            return null;
        }

        try {
            const query = `repo:${owner}/${repo}+type:pr`;
            const url = `${GITHUB_BASE_URL}/search/issues?q=${query}`;
            const response = await fetch(url, { headers: getHeaders() });

            if (!response.ok) {
                console.warn(`Failed to fetch pull requests: ${response.status}`);
                return null;
            }

            const data = await response.json();
            return data.total_count;
        } catch (error) {
            console.warn('Error fetching pull requests:', error);
            return null;
        }
    },

    async fetchLanguages(owner, repo) {
        if (!owner || !repo) {
            return {};
        }

        try {
            const url = `${GITHUB_BASE_URL}/repos/${owner}/${repo}/languages`;
            const response = await fetch(url, { headers: getHeaders() });

            if (!response.ok) {
                console.warn(`Failed to fetch languages: ${response.status}`);
                return {};
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.warn('Error fetching languages:', error);
            return {};
        }
    },

    async fetchOpenIssuesCount(owner, repo) {
        if (!owner || !repo) {
            return null;
        }

        try {
            const query = `repo:${owner}/${repo}+is:issue+is:open`;
            const url = `${GITHUB_BASE_URL}/search/issues?q=${query}`;
            const response = await fetch(url, { headers: getHeaders() });

            if (!response.ok) {
                console.warn(`Failed to fetch open issues: ${response.status}`);
                return null;
            }

            const data = await response.json();
            return data.total_count;
        } catch (error) {
            console.warn('Error fetching open issues:', error);
            return null;
        }
    },

    async fetchClosedIssuesCount(owner, repo) {
        if (!owner || !repo) {
            return null;
        }

        try {
            const query = `repo:${owner}/${repo}+is:issue+is:closed`;
            const url = `${GITHUB_BASE_URL}/search/issues?q=${query}`;
            const response = await fetch(url, { headers: getHeaders() });

            if (!response.ok) {
                console.warn(`Failed to fetch closed issues: ${response.status}`);
                return null;
            }

            const data = await response.json();
            return data.total_count;
        } catch (error) {
            console.warn('Error fetching closed issues:', error);
            return null;
        }
    },

    async fetchCommunityProfile(owner, repo) {
        if (!owner || !repo) {
            return null;
        }

        try {
            const url = `${GITHUB_BASE_URL}/repos/${owner}/${repo}/community/profile`;
            const response = await fetch(url, { headers: getHeaders() });

            if (!response.ok) {
                if (response.status === 404) {
                    // No community profile, return null or score 0
                    return null;
                }
                console.warn(`Failed to fetch community profile: ${response.status}`);
                return null;
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.warn('Error fetching community profile:', error);
            return null;
        }
    },

    async fetchRecentPullRequests(owner, repo) {
        if (!owner || !repo) {
            return [];
        }

        try {
            const url = `${GITHUB_BASE_URL}/repos/${owner}/${repo}/pulls?state=all&sort=created&direction=desc&per_page=10`;
            const response = await fetch(url, { headers: getHeaders() });

            if (!response.ok) {
                console.warn(`Failed to fetch recent pull requests: ${response.status}`);
                return [];
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.warn('Error fetching recent pull requests:', error);
            return [];
        }
    },

    async fetchReleasesCount(owner, repo) {
        if (!owner || !repo) {
            return 0;
        }

        try {
            const url = `${GITHUB_BASE_URL}/repos/${owner}/${repo}/releases?per_page=1`;
            const response = await fetch(url, { headers: getHeaders() });

            if (!response.ok) {
                if (response.status === 404) {
                    return 0;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Parse Link header for last page to get total count
            const linkHeader = response.headers.get('link');
            if (linkHeader) {
                const lastMatch = linkHeader.match(/<([^>]+)>;\s*rel="last"/);
                if (lastMatch) {
                    const lastUrl = new URL(lastMatch[1]);
                    const page = lastUrl.searchParams.get('page');
                    if (page) {
                        return parseInt(page);
                    }
                }
            }

            // Fallback for MVP: fetch all releases and count
            const allUrl = `${GITHUB_BASE_URL}/repos/${owner}/${repo}/releases`;
            const allResponse = await fetch(allUrl, { headers: getHeaders() });

            if (!allResponse.ok) {
                if (allResponse.status === 404) {
                    return 0;
                }
                throw new Error(`HTTP error! status: ${allResponse.status}`);
            }

            const data = await allResponse.json();
            const allLinkHeader = allResponse.headers.get('link');

            if (allLinkHeader) {
                const allLastMatch = allLinkHeader.match(/<([^>]+)>;\s*rel="last"/);
                if (allLastMatch) {
                    const allLastUrl = new URL(allLastMatch[1]);
                    const allPage = allLastUrl.searchParams.get('page');
                    if (allPage) {
                        return parseInt(allPage);
                    }
                } else {
                    // If paginated but can't parse last page, assume 30+
                    return '30+';
                }
            } else {
                // No pagination, exact count
                return data.length;
            }
        } catch (error) {
            console.warn('Error fetching releases count:', error);
            return 0;
        }
    },

    async fetchCommitActivity(owner, repo) {
        if (!owner || !repo) {
            return { all: Array(52).fill(0) }; // Return 52 weeks of zeros
        }

        try {
            const url = `${GITHUB_BASE_URL}/repos/${owner}/${repo}/stats/participation`;
            const response = await fetch(url, { headers: getHeaders() });

            if (!response.ok) {
                console.warn(`Failed to fetch commit activity: ${response.status}`);
                return { all: Array(52).fill(0) };
            }

            const data = await response.json();
            // Ensure we have valid data
            if (!data || !data.all || !Array.isArray(data.all)) {
                return { all: Array(52).fill(0) };
            }
            return data;
        } catch (error) {
            console.warn('Error fetching commit activity:', error);
            return { all: Array(52).fill(0) };
        }
    },

    async fetchRepositoryTree(owner, repo, defaultBranch) {
        if (!owner || !repo || !defaultBranch) {
            return { tree: [] };
        }

        try {
            const url = `${GITHUB_BASE_URL}/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`;
            const response = await fetch(url, { headers: getHeaders() });

            if (!response.ok) {
                if (response.status === 422) {
                    // Repository too large, try without recursive
                    const urlNoRecursive = `${GITHUB_BASE_URL}/repos/${owner}/${repo}/git/trees/${defaultBranch}`;
                    const responseNoRecursive = await fetch(urlNoRecursive, { headers: getHeaders() });
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
            console.warn('Error fetching repository tree:', error);
            return { tree: [] };
        }
    },

    async fetchPullRequestStats(owner, repo) {
        if (!owner || !repo) {
            return [];
        }

        try {
            const url = `${GITHUB_BASE_URL}/repos/${owner}/${repo}/pulls?state=all&per_page=20&sort=created&direction=desc`;
            const response = await fetch(url, { headers: getHeaders() });

            if (!response.ok) {
                console.warn(`Failed to fetch PR stats: ${response.status}`);
                return [];
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.warn('Error fetching PR stats:', error);
            return [];
        }
    },

    async fetchCodeFrequency(owner, repo) {
        if (!owner || !repo) {
            return [];
        }

        try {
            const url = `${GITHUB_BASE_URL}/repos/${owner}/${repo}/stats/code_frequency`;
            const response = await fetch(url, { headers: getHeaders() });

            // Silently handle 202 (calculating) and 422 (repo too large)
            if (response.status === 202 || response.status === 422 || !response.ok) {
                return [];
            }

            const data = await response.json();
            return data || [];
        } catch (error) {
            // Silencia erro 422 (repositórios gigantes)
            if (error.response && error.response.status === 422) {
                return [];
            }
            // Loga outros erros reais
            console.error('Error fetching code frequency:', error);
            return [];
        }
    },

    async fetchMergedPRsCount(owner, repo) {
        if (!owner || !repo) {
            return 0;
        }

        try {
            const query = `repo:${owner}/${repo}+is:pr+is:merged`;
            const url = `${GITHUB_BASE_URL}/search/issues?q=${query}`;
            const response = await fetch(url, { headers: getHeaders() });

            if (!response.ok) {
                console.warn(`Failed to fetch merged PRs count: ${response.status}`);
                return 0;
            }

            const data = await response.json();
            return data.total_count;
        } catch (error) {
            console.warn('Error fetching merged PRs count:', error);
            return 0;
        }
    }
};
