export class MetricsCards {
    constructor() {
        this.starsElement = document.getElementById('stars-value');
        this.forksElement = document.getElementById('forks-value');
        this.issuesElement = document.getElementById('issues-value');
        this.closedIssuesElement = document.getElementById('closed-issues-value');
        this.resolutionRateElement = document.getElementById('resolution-rate');
    }

    update(data, openIssuesCount, closedIssuesCount) {
        this.starsElement.textContent = data.stargazers_count ? data.stargazers_count.toLocaleString() : '-';
        this.forksElement.textContent = data.forks_count ? data.forks_count.toLocaleString() : '-';
        this.issuesElement.textContent = openIssuesCount !== null ? (openIssuesCount ? openIssuesCount.toLocaleString() : 0) : 'N/A';
        this.closedIssuesElement.textContent = closedIssuesCount !== null ? (closedIssuesCount ? closedIssuesCount.toLocaleString() : 0) : 'N/A';

        this.updateResolutionRate(openIssuesCount, closedIssuesCount);
    }

    updateResolutionRate(open, closed) {
        let rateText = '';
        if (open !== null && closed !== null) {
            const total = open + closed;
            if (total > 0) {
                const rate = (closed / total) * 100;
                rateText = `${Math.round(rate)}% resolvidas`;
            } else {
                rateText = '0% resolvidas';
            }
        } else {
            rateText = 'N/A';
        }
        this.resolutionRateElement.textContent = rateText;
    }
}
