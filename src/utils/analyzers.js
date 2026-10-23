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
