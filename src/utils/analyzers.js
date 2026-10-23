// Analyzers - Pure functions for business logic calculations
// Migrated from v1-legacy modules

export const analyzers = {
    // Health Score Analysis
    calculateHealthScore(profileData, repoDescription) {
        const files = {
            hasReadme: false,
            hasLicense: false,
            hasContributing: false,
            hasDescription: false,
            hasCodeOfConduct: false,
            hasIssueTemplate: false,
            hasPullRequestTemplate: false
        };

        if (profileData && profileData.files) {
            files.hasReadme = profileData.files?.readme != null;
            files.hasLicense = profileData.files?.license != null;
            files.hasContributing = profileData.files?.contributing != null;
            files.hasCodeOfConduct = profileData.files?.code_of_conduct != null;
            files.hasIssueTemplate = profileData.files?.issue_template != null;
            files.hasPullRequestTemplate = profileData.files?.pull_request_template != null;
        }

        files.hasDescription = !!(repoDescription && repoDescription.trim().length > 0);

        // Calculate percentage based on items present / 7 * 100
        const itemsCount = Object.values(files).filter(Boolean).length;
        const score = Math.round((itemsCount / 7) * 100);

        return { score, files };
    },

    analyzeCodeReview(pullRequests) {
        if (!pullRequests || !Array.isArray(pullRequests)) {
            return { selfMergePercentage: 0, color: 'gray' };
        }

        const mergedPRs = pullRequests.filter(pr => pr.merged_at);
        const totalMerged = mergedPRs.length;

        if (totalMerged === 0) {
            return { selfMergePercentage: 0, color: 'gray' };
        }

        const selfMerges = mergedPRs.filter(pr => pr.merged_by && pr.user && pr.merged_by.login === pr.user.login).length;
        const percentage = (selfMerges / totalMerged) * 100;

        let color = 'red';
        if (percentage < 20) {
            color = 'green';
        } else if (percentage < 50) {
            color = 'yellow';
        }

        return { selfMergePercentage: Math.round(percentage), color };
    },

    // Process Analysis
    calculateLeadTime(prStats) {
        if (!Array.isArray(prStats)) return { value: 'N/A', unit: '' };
        const mergedPRs = prStats.filter(pr => pr.merged_at);
        if (mergedPRs.length === 0) return { value: 'N/A', unit: '' };

        const totalHours = mergedPRs.reduce((sum, pr) => {
            const created = new Date(pr.created_at);
            const merged = new Date(pr.merged_at);
            const diffMs = merged - created;
            const diffHours = diffMs / (1000 * 60 * 60);
            return sum + diffHours;
        }, 0);

        const avgHours = totalHours / mergedPRs.length;

        if (avgHours < 24) {
            const formattedValue = Math.round(avgHours * 10) / 10;
            return { value: formattedValue, unit: 'hours', count: formattedValue };
        } else {
            const days = avgHours / 24;
            const formattedValue = Math.round(days * 10) / 10;
            return { value: formattedValue, unit: 'days', count: formattedValue };
        }
    },

    calculateDivergence(pullRequests) {
        // Validação dos Dados de Entrada
        if (!pullRequests || pullRequests.length === 0) return { avg: 0, categoryKey: 'repo.divergenceNone' };

        // Cálculo Seguro
        const totalComments = pullRequests.reduce((sum, pr) => sum + (pr.comments || 0) + (pr.review_comments || 0), 0);
        const average = totalComments / pullRequests.length;
        const safeAverage = Number.isNaN(average) ? 0 : average;

        // Correção da Classificação
        let categoryKey;
        if (safeAverage < 1) {
            categoryKey = 'repo.divergenceLow';
        } else if (safeAverage <= 5) {
            categoryKey = 'repo.divergenceMedium';
        } else {
            categoryKey = 'repo.divergenceHigh';
        }

        // Formatação
        const formattedAvg = Math.round(safeAverage * 10) / 10;
        return { avg: formattedAvg, categoryKey };
    },

    // Code Churn Analysis
    calculateCodeChurn(codeFrequencyData) {
        if (!codeFrequencyData || !Array.isArray(codeFrequencyData) || codeFrequencyData.length === 0) {
            return { ratio: null, category: null };
        }

        // Últimas 10 semanas, ou o que houver
        const last10 = codeFrequencyData.slice(-10);
        let totalAdditions = 0;
        let totalDeletions = 0;
        // GitHub /stats/code_frequency: [timestamp, additions, deletions], com
        // deletions NEGATIVO (ex: [1792281600, 989, -1243]). Sem o abs, toda
        // semana com remoções deixava totalDeletions < 0 e o ratio ia a Infinity.
        for (const week of last10) {
            totalAdditions += week[1];
            totalDeletions += Math.abs(week[2]);
        }
        const ratio = totalDeletions > 0 ? totalAdditions / totalDeletions : totalAdditions > 0 ? Infinity : 0;
        let category;
        if (ratio > 10) {
            category = 'Acúmulo Intenso (Pouca Refatoração)';
        } else if (ratio >= 2) {
            category = 'Saudável (Evolução com Limpeza)';
        } else {
            category = 'Refatoração Agressiva';
        }
        return { ratio: ratio.toFixed(2), category };
    }
};
