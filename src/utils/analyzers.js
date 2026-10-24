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
    }

};
