import { useState, useCallback } from 'react';
import { githubService } from '../services/githubService.js';
import { analyzers } from '../utils/analyzers.js';

// Custom Hook for repository data fetching and analysis
export function useRepository() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const search = useCallback(async (repoName) => {
        if (!repoName || !repoName.includes('/')) {
            setError('Formato inválido. Use owner/repo');
            return;
        }

        const [owner, repo] = repoName.split('/');
        setLoading(true);
        setError(null);
        setData(null);

        try {
            // First fetch repository data to get default branch
            const repoData = await githubService.fetchRepository(owner, repo);
            if (!repoData) {
                throw new Error('Não foi possível buscar informações do repositório');
            }

            // Fetch all other data in parallel
            const results = await Promise.allSettled([
                githubService.fetchCommits(owner, repo),
                githubService.fetchBranches(owner, repo),
                githubService.fetchContributors(owner, repo),
                githubService.fetchPullRequests(owner, repo),
                githubService.fetchOpenIssuesCount(owner, repo),
                githubService.fetchClosedIssuesCount(owner, repo),
                githubService.fetchRecentPullRequests(owner, repo),
                githubService.fetchLanguages(owner, repo),
                githubService.fetchCommunityProfile(owner, repo),
                githubService.fetchRepositoryTree(owner, repo, repoData.default_branch),
                githubService.fetchReleasesCount(owner, repo),
                githubService.fetchCommitActivity(owner, repo),
                githubService.fetchPullRequestStats(owner, repo),
                githubService.fetchCodeFrequency(owner, repo),
                githubService.fetchMergedPRsCount(owner, repo)
            ]);

            // Extract results with fail-safe handling
            const commits = results[0]?.status === 'fulfilled' ? results[0].value : [];
            const branches = results[1]?.status === 'fulfilled' ? results[1].value : { count: 0, zombies: 0 };
            const contributors = results[2]?.status === 'fulfilled' ? results[2].value : [];
            const pulls = results[3]?.status === 'fulfilled' ? results[3].value : null;
            const issuesOpenCount = results[4]?.status === 'fulfilled' ? results[4].value : null;
            const issuesClosedCount = results[5]?.status === 'fulfilled' ? results[5].value : null;
            const pullRequests = results[6]?.status === 'fulfilled' ? results[6].value : [];
            const languages = results[7]?.status === 'fulfilled' ? results[7].value : {};
            const communityProfile = results[8]?.status === 'fulfilled' ? results[8].value : null;
            const repositoryTree = results[9]?.status === 'fulfilled' ? results[9].value : { tree: [] };
            const releasesCount = results[10]?.status === 'fulfilled' ? results[10].value : 0;
            const commitActivity = results[11]?.status === 'fulfilled' ? results[11].value : { all: [] };
            const pullRequestsStats = results[12]?.status === 'fulfilled' ? results[12].value : [];
            const codeFrequency = results[13]?.status === 'fulfilled' ? results[13].value : null;
            const mergedPRsCount = results[14]?.status === 'fulfilled' ? results[14].value : 0;

            // Get first 10 commits and PRs for activity logs
            const recentCommits = commits.slice(0, 10);
            const recentPRs = pullRequests.slice(0, 10);

            // Calculate repository age
            const createdAt = new Date(repoData.created_at);
            const now = new Date();
            const age = calculateAge(createdAt, now);
            const formattedDate = `${String(createdAt.getDate()).padStart(2, '0')}/${String(createdAt.getMonth() + 1).padStart(2, '0')}/${createdAt.getFullYear()}`;

            // Calculate PRs per branch
            const totalBranches = branches.count;
            const prsPerBranch = branches.count === 0 || pulls === null ? 'N/A' : (pulls / totalBranches).toFixed(1);

            // Analyze health score
            const health = analyzers.calculateHealthScore(communityProfile, repoData.description);

            // Analyze maturity
            const maturity = analyzers.analyzeEngineeringMaturity(repositoryTree.tree, pullRequests, branches.zombies);

            // Analyze code review
            const codeReview = analyzers.analyzeCodeReview(pullRequestsStats);

            // Analyze process metrics
            const leadTime = analyzers.calculateLeadTime(pullRequestsStats);
            const divergence = analyzers.calculateDivergence(pullRequestsStats);

            // Analyze bus factor
            const busFactor = analyzers.calculateBusFactor(contributors);

            // Analyze code churn
            const codeChurn = analyzers.calculateCodeChurn(codeFrequency);

            // Calculate resolution rate
            let resolutionRate = 'N/A';
            if (issuesOpenCount !== null && issuesClosedCount !== null) {
                const total = issuesOpenCount + issuesClosedCount;
                if (total > 0) {
                    resolutionRate = `${Math.round((issuesClosedCount / total) * 100)}% resolvidas`;
                }
            }

            // Format contributors for display
            const formattedContributors = contributors.map(contributor => {
                const totalContributions = contributors.reduce((sum, c) => sum + c.contributions, 0);
                return {
                    ...contributor,
                    percentage: totalContributions > 0 ? ((contributor.contributions / totalContributions) * 100).toFixed(1) : 0
                };
            });

            // Build final data structure matching component expectations
            const formattedData = {
                fullName: repoName,
                url: `https://github.com/${repoName}`,
                description: repoData.description,
                ageText: age,
                createdAt: repoData.created_at, // ISO string for calculations
                createdAtFormatted: formattedDate, // Formatted string for display
                stats: {
                    branches: branches.count,
                    prs: pulls || 0,
                    merges: mergedPRsCount,
                    prsPerBranch,
                    releases: releasesCount
                },
                metrics: {
                    stars: repoData.stargazers_count || 0,
                    forks: repoData.forks_count || 0,
                    openIssues: issuesOpenCount || 0,
                    closedIssues: issuesClosedCount || 0,
                    resolutionRate,
                    leadTime,
                    divergence
                },
                health,
                maturity,
                codeReview,
                contributors: formattedContributors,
                busFactor,
                recentCommits,
                recentPRs,
                charts: {
                    techStack: formatLanguages(languages),
                    activity: formatCommitActivity(commitActivity)
                },
                codeChurn
            };

            setData(formattedData);
        } catch (err) {
            console.error('Error searching repository:', err);
            setError(err.message || 'Erro ao buscar dados do repositório');
        } finally {
            setLoading(false);
        }
    }, []);

    return { data, loading, error, search };
}

// Helper function to calculate repository age
function calculateAge(createdAt, now) {
    const ageInMs = now - createdAt;
    const ageInDays = Math.floor(ageInMs / (1000 * 60 * 60 * 24));
    const ageInWeeks = Math.floor(ageInDays / 7);
    const ageInMonths = Math.floor(ageInDays / 30);
    const ageInYears = Math.floor(ageInDays / 365);

    // Less than 1 week, show in days
    if (ageInDays < 7) {
        if (ageInDays === 0) return 'Menos de 1 dia';
        if (ageInDays === 1) return '1 dia';
        return `${ageInDays} dias`;
    }

    // Less than 4 weeks, show in weeks
    if (ageInWeeks < 4) {
        if (ageInWeeks === 1) return '1 semana';
        return `${ageInWeeks} semanas`;
    }

    // Less than 1 year, show in months
    if (ageInYears < 1) {
        if (ageInMonths === 1) return '1 mês';
        return `${ageInMonths} meses`;
    }

    // 1+ years
    if (ageInYears === 1) return '1 ano';
    return `${ageInYears} anos`;
}

// Helper function to format languages for charts
function formatLanguages(languages) {
    if (!languages || Object.keys(languages).length === 0) {
        return [];
    }

    const total = Object.values(languages).reduce((sum, bytes) => sum + bytes, 0);
    const languageEntries = Object.entries(languages).map(([label, bytes]) => ({
        label,
        percentage: (bytes / total) * 100
    }));

    // Filter languages with less than 1%
    const mainLanguages = languageEntries.filter(lang => lang.percentage >= 1);
    const others = languageEntries.filter(lang => lang.percentage < 1);
    const othersPercentage = others.reduce((sum, lang) => sum + lang.percentage, 0);

    if (othersPercentage > 0) {
        mainLanguages.push({
            label: 'Outros',
            percentage: othersPercentage
        });
    }

    return mainLanguages.map(lang => ({
        language: lang.label,
        percentage: Math.round(lang.percentage),
        color: getLanguageColor(lang.label)
    }));
}

// Helper function to format commit activity data for charts
function formatCommitActivity(commitActivity) {
    const data = commitActivity?.all || [];
    const now = new Date();

    // Generate labels for the last 52 weeks (most recent first)
    const labels = [];
    for (let i = 51; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - (i * 7));
        const label = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
        labels.push(label);
    }

    // Ensure we have exactly 52 data points
    const values = Array.isArray(data) ? data.slice(-52) : [];
    while (values.length < 52) {
        values.unshift(0); // Add zeros for missing weeks
    }

    return {
        labels: labels,
        datasets: [{
            label: 'Commits',
            data: values,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.4
        }]
    };
}

// Language color mapping
function getLanguageColor(language) {
    const colorMap = {
        'JavaScript': '#f1e05a',
        'HTML': '#e34c26',
        'CSS': '#563d7c',
        'Python': '#3572A5',
        'Java': '#b07219',
        'Shell': '#89e051',
        'TypeScript': '#3178c6',
        'C++': '#f34b7d',
        'C': '#555555',
        'Outros': '#cccccc'
    };

    if (colorMap[language]) {
        return colorMap[language];
    }

    // Generate dynamic color based on hash
    let hash = 0;
    for (let i = 0; i < language.length; i++) {
        hash = language.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 65%, 60%)`;
}
