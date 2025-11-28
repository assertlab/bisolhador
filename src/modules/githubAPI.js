export class GitHubAPI {
    static BASE_URL = 'https://api.github.com';

    static async fetchRepository(owner, repo) {
        if (!owner || !repo) {
            throw new Error('Owner and repo are required');
        }

        const url = `${this.BASE_URL}/repos/${owner}/${repo}`;
        const response = await fetch(url);

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

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    }
}
