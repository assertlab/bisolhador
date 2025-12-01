export class MetricsCards {
    constructor() {
        this.starsElement = document.getElementById('stars-value');
        this.forksElement = document.getElementById('forks-value');
        this.issuesElement = document.getElementById('issues-value');
        this.closedIssuesElement = document.getElementById('closed-issues-value');
        this.resolutionRateElement = document.getElementById('resolution-rate');
        this.codeChurnElement = document.getElementById('code-churn-value');
        this.codeChurnCategoryElement = document.getElementById('code-churn-category');
    }

    update(data, openIssuesCount, closedIssuesCount, codeFrequencyData) {
        this.starsElement.textContent = data.stargazers_count ? data.stargazers_count.toLocaleString() : '-';
        this.forksElement.textContent = data.forks_count ? data.forks_count.toLocaleString() : '-';
        this.issuesElement.textContent = openIssuesCount !== null ? (openIssuesCount ? openIssuesCount.toLocaleString() : 0) : 'N/A';
        this.closedIssuesElement.textContent = closedIssuesCount !== null ? (closedIssuesCount ? closedIssuesCount.toLocaleString() : 0) : 'N/A';

        this.updateResolutionRate(openIssuesCount, closedIssuesCount);
        this.updateCodeChurn(codeFrequencyData);
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

    updateCodeChurn(data) {
        if (data === null) {
            this.codeChurnElement.textContent = '⏳';
            this.codeChurnCategoryElement.textContent = 'Calculando pelo GitHub... Tente novamente em breve';
            return;
        }

        if (!data || !Array.isArray(data) || data.length === 0) {
            this.codeChurnElement.textContent = '-';
            this.codeChurnCategoryElement.textContent = '';
            return;
        }

        // Últimas 10 semanas, ou o que houver
        const last10 = data.slice(-10);
        let totalAdditions = 0;
        let totalDeletions = 0;
        for (const week of last10) {
            totalAdditions += week[1];
            totalDeletions += week[2];
        }
        const ratio = totalDeletions > 0 ? totalAdditions / totalDeletions : totalAdditions > 0 ? Infinity : 0;
        let category = '';
        if (ratio > 10) {
            category = 'Acúmulo Intenso (Pouca Refatoração)';
        } else if (ratio >= 2) {
            category = 'Saudável (Evolução com Limpeza)';
        } else {
            category = 'Refatoração Agressiva';
        }
        this.codeChurnElement.textContent = ratio.toFixed(2);
        this.codeChurnCategoryElement.textContent = category;
    }
}
