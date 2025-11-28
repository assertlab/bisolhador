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
            const commits = await GitHubAPI.fetchCommits(owner, repo);
            this.onData(repoData, commits);
        } catch (error) {
            console.error('Erro na busca:', error);
            alert('Erro ao buscar dados do repositório.');
        } finally {
            this.setLoading(false);
        }
    }

    setLoading(isLoading) {
        this.button.textContent = isLoading ? 'Bisolhando...' : 'Buscar';
        this.button.disabled = isLoading;
    }
}
