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
            const [repoData, commits, branches, contributors, pulls, issuesOpenCount, languages] = await Promise.all([
                GitHubAPI.fetchRepository(owner, repo),
                GitHubAPI.fetchCommits(owner, repo),
                GitHubAPI.fetchBranches(owner, repo),
                GitHubAPI.fetchContributors(owner, repo),
                GitHubAPI.fetchPullRequests(owner, repo),
                GitHubAPI.fetchOpenIssuesCount(owner, repo),
                GitHubAPI.fetchLanguages(owner, repo)
            ]);
            this.onData(repoData, commits, branches, contributors, pulls, issuesOpenCount, languages, owner, repo);
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
