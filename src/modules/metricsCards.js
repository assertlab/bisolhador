export class MetricsCards {
    constructor() {
        this.starsElement = document.getElementById('stars-value');
        this.forksElement = document.getElementById('forks-value');
        this.issuesElement = document.getElementById('issues-value');
    }

    update(data) {
        this.starsElement.textContent = data.stargazers_count ? data.stargazers_count.toLocaleString() : '-';
        this.forksElement.textContent = data.forks_count ? data.forks_count.toLocaleString() : '-';
        this.issuesElement.textContent = data.open_issues_count !== undefined ? data.open_issues_count.toLocaleString() : '-';
    }
}
