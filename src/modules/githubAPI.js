export class GitHubAPI {
    static BASE_URL = 'https://api.github.com';

    static getHeaders() {
        const token = localStorage.getItem('github_token');
        const headers = {
            'Accept': 'application/vnd.github.v3+json'
        };
        if (token) {
            headers['Authorization'] = `token ${token}`;
        }
        return headers;
    }

    static async fetchRepository(owner, repo) {
        if (!owner || !repo) {
            throw new Error('Owner and repo are required');
        }

        const url = `${this.BASE_URL}/repos/${owner}/${repo}`;
        const response = await fetch(url, { headers: this.getHeaders() });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    }

    static async fetchCommits(owner, repo, params = {}) {
        if (!owner || !repo) {
            throw new Error('Owner and repo are required');
        }

        const perPage = params.perPage || 15;
        const url = `${this.BASE_URL}/repos/${owner}/${repo}/commits?per_page=${perPage}`;

        const response = await fetch(url, { headers: this.getHeaders() });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    }

    static async fetchBranches(owner, repo) {
        if (!owner || !repo) {
            throw new Error('Owner and repo are required');
        }

        const url = `${this.BASE_URL}/repos/${owner}/${repo}/branches?per_page=100`;
        const response = await fetch(url, { headers: this.getHeaders() });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const count = data.length;
        return { count: count, isMore: count === 100 };
    }

    static async fetchContributors(owner, repo) {
        if (!owner || !repo) {
            return [];
        }

        try {
            const url = `${this.BASE_URL}/repos/${owner}/${repo}/contributors`;
            const response = await fetch(url, { headers: this.getHeaders() });

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
    }

    static async fetchPullRequests(owner, repo) {
        if (!owner || !repo) {
            return null;
        }

        try {
            const query = `repo:${owner}/${repo}+type:pr`;
            const url = `${this.BASE_URL}/search/issues?q=${query}`;
            const response = await fetch(url, { headers: this.getHeaders() });

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
    }

    static async fetchLanguages(owner, repo) {
        if (!owner || !repo) {
            throw new Error('Owner and repo are required');
        }

        const url = `${this.BASE_URL}/repos/${owner}/${repo}/languages`;
        const response = await fetch(url, { headers: this.getHeaders() });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    }

    static async fetchOpenIssuesCount(owner, repo) {
        if (!owner || !repo) {
            return null;
        }

        try {
            const query = `repo:${owner}/${repo}+is:issue+is:open`;
            const url = `${this.BASE_URL}/search/issues?q=${query}`;
            const response = await fetch(url, { headers: this.getHeaders() });

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
    }

    static async fetchClosedIssuesCount(owner, repo) {
        if (!owner || !repo) {
            return null;
        }

        try {
            const query = `repo:${owner}/${repo}+is:issue+is:closed`;
            const url = `${this.BASE_URL}/search/issues?q=${query}`;
            const response = await fetch(url, { headers: this.getHeaders() });

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
    }

    static async fetchCommunityProfile(owner, repo) {
        if (!owner || !repo) {
            return null;
        }

        try {
            const url = `${this.BASE_URL}/repos/${owner}/${repo}/community/profile`;
            const response = await fetch(url, { headers: this.getHeaders() });

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
    }

    static async fetchRecentPullRequests(owner, repo) {
        if (!owner || !repo) {
            return [];
        }

        try {
            const url = `${this.BASE_URL}/repos/${owner}/${repo}/pulls?state=all&sort=created&direction=desc&per_page=10`;
            const response = await fetch(url, { headers: this.getHeaders() });

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
    }
}
