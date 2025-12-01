import { GitHubAPI } from './githubAPI.js';

export class SearchComponent {
    constructor(formSelector, buttonSelector, onData) {
        this.form = document.querySelector(formSelector);
        this.button = document.querySelector(buttonSelector);
        this.onData = onData;
        this.bindEvents();
    }

    bindEvents() {
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSearch();
        });
    }

    async handleSearch() {
        const repoName = document.querySelector('#repo-input').value.trim();
        if (!repoName) return;

        const [owner, repo] = repoName.split('/');
        if (!owner || !repo) {
            alert('Formato inválido. Use owner/repo');
            return;
        }

        this.setLoading(true);

        try {
            const repoData = await GitHubAPI.fetchRepository(owner, repo);
            const results = await Promise.allSettled([
                GitHubAPI.fetchCommits(owner, repo),
                GitHubAPI.fetchBranches(owner, repo),
                GitHubAPI.fetchContributors(owner, repo),
                GitHubAPI.fetchPullRequests(owner, repo),
                GitHubAPI.fetchOpenIssuesCount(owner, repo),
                GitHubAPI.fetchClosedIssuesCount(owner, repo),
                GitHubAPI.fetchRecentPullRequests(owner, repo),
                GitHubAPI.fetchLanguages(owner, repo),
                GitHubAPI.fetchCommunityProfile(owner, repo),
                GitHubAPI.fetchRepositoryTree(owner, repo, repoData.default_branch),
                GitHubAPI.fetchReleasesCount(owner, repo),
                GitHubAPI.fetchCommitActivity(owner, repo),
                GitHubAPI.fetchPullRequestStats(owner, repo),
                GitHubAPI.fetchCodeFrequency(owner, repo),
                GitHubAPI.fetchMergedPRsCount(owner, repo)
            ]);

            // Extract values, handling failures gracefully
            const commits = results[0].status === 'fulfilled' ? results[0].value : [];
            const branches = results[1].status === 'fulfilled' ? results[1].value : { count: 0, zombies: 0 };
            const contributors = results[2].status === 'fulfilled' ? results[2].value : [];
            const pulls = results[3].status === 'fulfilled' ? results[3].value : null;
            const issuesOpenCount = results[4].status === 'fulfilled' ? results[4].value : null;
            const issuesClosedCount = results[5].status === 'fulfilled' ? results[5].value : null;
            const pullRequests = results[6].status === 'fulfilled' ? results[6].value : [];
            const languages = results[7].status === 'fulfilled' ? results[7].value : {};
            const communityProfile = results[8].status === 'fulfilled' ? results[8].value : null;
            const repositoryTree = results[9].status === 'fulfilled' ? results[9].value : { tree: [] };
            const releasesCount = results[10].status === 'fulfilled' ? results[10].value : 0;
            const commitActivity = results[11].status === 'fulfilled' ? results[11].value : { all: [] };
            const pullRequestsStats = results[12].status === 'fulfilled' ? results[12].value : [];
            const codeFrequency = results[13].status === 'fulfilled' ? results[13].value : [];
            const mergedPRsCount = results[14].status === 'fulfilled' ? results[14].value : 0;

            this.onData(repoData, commits, branches, contributors, pulls, issuesOpenCount, issuesClosedCount, pullRequests, languages, owner, repo, communityProfile, repositoryTree, releasesCount, commitActivity, pullRequestsStats, codeFrequency, branches.zombies, mergedPRsCount);
        } catch (error) {
            console.error('Erro na busca:', error);
            if (error.message.includes('401')) {
                alert('Erro 401 - Token inválido ou insuficiente. Verifique o token no botão de configurações.');
            } else if (error.message.includes('422')) {
                alert('Erro 422 - Limite de requisições excedido. Consider inserir um token GitHub para aumentar o limite.');
            } else {
                alert('Erro ao buscar dados do repositório.');
            }
        } finally {
            this.setLoading(false);
        }
    }

    setLoading(isLoading) {
        this.button.textContent = isLoading ? 'Bisolhando...' : 'Buscar';
        this.button.disabled = isLoading;
    }
}
