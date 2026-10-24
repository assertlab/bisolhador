import { useQuery } from '@tanstack/react-query';
import { githubService, hasGithubToken } from '../services/githubService.js';
import { analyzers } from '../utils/analyzers.js';
import { analyzeReviewMetrics, analyzeLeadTime } from '../utils/prReviewStats.js';
import { analyzeContributors, peopleFromStats, peopleFromContributors } from '../utils/contributors.js';
import { analyzeBranches } from '../utils/branches.js';
import { analyzeMaturity, mergeProfileWithTree, hasIssueTemplate, treePathsOf } from '../utils/repoTree.js';
import { statsStatus, weekdaysFromPunchCard, addDeleteRatio, closedShare } from '../utils/activityStats.js';
import { analyzeCiRuns, analyzeConventionalCommits, analyzeReleases } from '../utils/projectPractices.js';
import analytics from '../services/analytics.js';
import i18n from '../i18n.js';
import { ensureChartSetup } from '../lib/chartSetup.js';
import { RECENT_ITEMS_LIMIT, CACHE_STALE_TIME_MS, LANGUAGE_MIN_PERCENTAGE } from '../constants.js';

// A snapshot isn't persisted when any of these failed: it would become
// permanent history (Timeline/Benchmark/Ranking) with fake values — e.g. the
// health-14 snapshots found in the 2026-10 audit. Names match endpointNames.
// "No community profile" (forks, 404) is not a failure: forks are saved, with
// health unavailable.
const PERSIST_BLOCKERS = ['communityProfile', 'openIssues', 'closedIssues', 'pullRequests', 'mergedPRs', 'contributors'];

// Branches: with a token, every branch's last commit via GraphQL → exact count
// and zombies (release/protected/default excluded). Without one, the exact
// count from one REST request; zombies unavailable (it'd take a request per branch).
async function fetchBranchAnalysis(owner, repo, defaultBranch, hasToken) {
    if (!hasToken) {
        return { count: await githubService.fetchBranchCount(owner, repo), zombies: null, zombiesReason: 'noToken' };
    }
    try {
        const { totalCount, branches, capped } = await githubService.fetchBranchActivity(owner, repo);
        return { count: totalCount, capped, ...analyzeBranches(branches, { defaultBranch }) };
    } catch (error) {
        // Keep the exact total from REST; only zombies become unavailable.
        console.warn('[useRepository] GraphQL branches failed, falling back to REST count:', error.message);
        return { count: await githubService.fetchBranchCount(owner, repo), zombies: null, zombiesReason: 'error' };
    }
}

// Contributor analysis: /stats/contributors (weekly data → recent window, bots
// flagged); if GitHub is still computing it (202) or it fails, the top-100
// /contributors list (all-time, marked partial). Throws only if both fail.
async function fetchContributorAnalysis(owner, repo) {
    try {
        const stats = await githubService.fetchContributorStats(owner, repo);
        return analyzeContributors(peopleFromStats(stats), { source: 'stats' });
    } catch (error) {
        console.warn('[useRepository] Contributor stats unavailable, using /contributors fallback:', error.message);
        const list = await githubService.fetchContributors(owner, repo);
        return analyzeContributors(peopleFromContributors(list), { source: 'contributors' });
    }
}

// Repository data fetching function for TanStack Query
async function fetchRepositoryData(repoName) {
    if (!repoName || !repoName.includes('/')) {
        throw new Error('Formato inválido. Use owner/repo');
    }

    // Fire-and-forget: start downloading + registering chart.js in parallel
    // with the GitHub fetches below, instead of waiting until a chart
    // actually mounts to trigger it. This is what eliminates the cold-search
    // chart lag — never let a failure here block the actual search.
    ensureChartSetup().catch((err) => {
        console.warn('[useRepository] Chart.js prefetch failed (non-fatal, will retry on chart mount):', err);
    });

    const [requestedOwner, requestedRepo] = repoName.split('/');

    // First fetch repository data to get default branch
    const repoData = await githubService.fetchRepository(requestedOwner, requestedRepo);
    if (!repoData) {
        throw new Error('Não foi possível buscar informações do repositório');
    }

    // Privacy gate: never process or persist data from private repositories,
    // regardless of the PAT having read access to them. Must run before any
    // of the 15+ parallel fetches below and before analytics.saveSearch.
    if (repoData.private === true) {
        const privateRepoError = new Error(i18n.t('errors.privateRepo'));
        privateRepoError.code = 'PRIVATE_REPO_UNSUPPORTED';
        throw privateRepoError;
    }

    // Canonical name from here on: /repos follows renames (facebook/react →
    // react/react), but the Search API does not — querying the typed name gave
    // HTTP 422 → 0 issues/PRs, and the history split across two names.
    const fullName = repoData.full_name;
    const [owner, repo] = fullName.split('/');

    const hasToken = hasGithubToken();

    // Fetch all other data in parallel
    const results = await Promise.allSettled([
        githubService.fetchCommits(owner, repo),
        fetchBranchAnalysis(owner, repo, repoData.default_branch, hasToken),
        fetchContributorAnalysis(owner, repo),
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
        githubService.fetchMergedPRsCount(owner, repo),
        // GraphQL requires a token; without one, skip it (metrics → unavailable).
        hasToken ? githubService.fetchPullRequestReviewStats(owner, repo) : Promise.resolve(null),
        githubService.fetchPunchCard(owner, repo),
        repoData.default_branch ? githubService.fetchActionRuns(owner, repo, repoData.default_branch) : Promise.resolve({ total_count: 0, workflow_runs: [] }),
        githubService.fetchReleases(owner, repo)
    ]);

    // Map of result indices to human-readable endpoint names
    const endpointNames = [
        'commits', 'branches', 'contributors', 'pullRequests',
        'openIssues', 'closedIssues', 'recentPRs', 'languages',
        'communityProfile', 'repositoryTree', 'releases',
        'commitActivity', 'prStats', 'codeFrequency', 'mergedPRs',
        'prReviewStats', 'punchCard', 'actionRuns', 'releasesList'
    ];

    // Collect warnings from rejected promises. The REST PR list only feeds lead
    // time when the GraphQL sample is missing: its failure alone isn't partial
    // data. /stats/* (202 computing, 422 too large) are explained by their own
    // charts/cards; a 10k+ commit repo would otherwise always show the banner.
    const SELF_EXPLAINED = new Set(['commitActivity', 'codeFrequency', 'punchCard', 'actionRuns', 'releasesList']);
    const warnings = results.reduce((acc, result, index) => {
        const unused = endpointNames[index] === 'prStats' && results[15]?.status === 'fulfilled' && results[15].value;
        if (result.status === 'rejected' && !unused && !SELF_EXPLAINED.has(endpointNames[index])) {
            acc.push(endpointNames[index]);
        }
        return acc;
    }, []);

    // Extract results with fail-safe handling
    const commits = results[0]?.status === 'fulfilled' ? results[0].value : [];
    // Counts/branches/profile: null when the request failed (see _warnings), never a fake 0.
    const branches = results[1]?.status === 'fulfilled' ? results[1].value : null;
    const contributorAnalysis = results[2]?.status === 'fulfilled' ? results[2].value : null;
    const pulls = results[3]?.status === 'fulfilled' ? results[3].value : null;
    const issuesOpenCount = results[4]?.status === 'fulfilled' ? results[4].value : null;
    const issuesClosedCount = results[5]?.status === 'fulfilled' ? results[5].value : null;
    const pullRequests = results[6]?.status === 'fulfilled' ? results[6].value : [];
    const languages = results[7]?.status === 'fulfilled' ? results[7].value : {};
    const communityProfile = results[8]?.status === 'fulfilled' ? results[8].value : null;
    const repositoryTree = results[9]?.status === 'fulfilled' ? results[9].value : null;
    const releasesCount = results[10]?.status === 'fulfilled' ? results[10].value : null;
    // /stats/*: 'computing' (202) / 'tooLarge' (422) / 'error' are shown as such,
    // never as an all-zero chart (see utils/activityStats.js)
    const activityStats = statsStatus(results[11]);
    const codeFrequencyStats = statsStatus(results[13]);
    const punchCardStats = statsStatus(results[16]);
    const pullRequestsStats = results[12]?.status === 'fulfilled' ? results[12].value : null;
    const mergedPRsCount = results[14]?.status === 'fulfilled' ? results[14].value : null;
    const prReviewStats = results[15]?.status === 'fulfilled' ? results[15].value : null;

    // Get recent commits and PRs for activity logs
    const recentCommits = commits.slice(0, RECENT_ITEMS_LIMIT);
    const recentPRs = pullRequests.slice(0, RECENT_ITEMS_LIMIT);

    // Calculate repository age
    const createdAt = new Date(repoData.created_at);
    const now = new Date();
    const age = calculateAge(createdAt, now);
    const formattedDate = `${String(createdAt.getDate()).padStart(2, '0')}/${String(createdAt.getMonth() + 1).padStart(2, '0')}/${createdAt.getFullYear()}`;

    // Calculate PRs per branch
    const prsPerBranch = !branches?.count || pulls === null ? 'N/A' : (pulls / branches.count).toFixed(1);

    // Health score: unavailable (not 14%) when the community profile is missing
    // (404 — GitHub has none for forks) or the request failed.
    // Profile files completed with the tree (issue-forms directory; forks with
    // no profile → files from the tree). See mergeProfileWithTree.
    // Truncated tree (huge repos): settle the issue-template point with a
    // targeted check instead of leaving it uncertain on every search.
    let issueTemplateDirectory = null;
    if (communityProfile && !communityProfile.files?.issue_template && repositoryTree?.truncated && !hasIssueTemplate(treePathsOf(repositoryTree))) {
        issueTemplateDirectory = await githubService.hasIssueTemplateDirectory(owner, repo).catch(() => null);
    }
    const profileMissing = results[8]?.status === 'fulfilled' && !communityProfile; // fork (404), not a failed request
    const profileFiles = mergeProfileWithTree(communityProfile, repositoryTree, { profileMissing, issueTemplateDirectory });
    const health = profileFiles
        ? {
            ...analyzers.calculateHealthScore({ files: profileFiles.files }, repoData.description),
            available: true,
            ...(profileFiles.source === 'tree' && { source: 'tree' }),
            ...(profileFiles.uncertain && { uncertain: true }),
        }
        : { score: null, files: null, available: false, reason: results[8]?.status === 'fulfilled' ? 'noProfile' : 'error' };

    // Analyze maturity (zombies null = branch data unavailable)
    const maturity = analyzeMaturity(repositoryTree, branches?.zombies ?? null);

    // Merged-without-approval rate and divergence: GraphQL-backed, unavailable without a token
    const { codeReview, divergence, reviewProcess } = analyzeReviewMetrics(prReviewStats, hasToken ? 'error' : 'noToken');

    // Lead time: median over the latest merged PRs. With a token, the same
    // merged sample as review/divergence (GraphQL); otherwise REST closed PRs,
    // where unmerged ones shrink the sample.
    const leadTime = prReviewStats ? analyzeLeadTime(prReviewStats, 'graphql') : analyzeLeadTime(pullRequestsStats, 'rest');

    // Contributors: one analysis (same people, window and denominator) feeds the
    // Pareto bus factor card, the top-contributor concentration and the table.
    // busFactor keeps the {level, topContributor, percentage} shape Benchmark reads.
    const busFactor = contributorAnalysis?.top
        ? { level: contributorAnalysis.top.level, topContributor: contributorAnalysis.top.login, percentage: contributorAnalysis.top.percentage }
        : { level: contributorAnalysis ? 'none' : 'unavailable' };
    // table/top already go out as `contributors` and `busFactor`; not stored twice.
    const { table: _table, top: _top, ...busFactorAnalysis } = contributorAnalysis ?? {};

    // Analyze code churn
    // Additions/deletions ratio ("Code Churn"): null + reason when not measured
    const codeChurn = codeFrequencyStats.status === 'ok'
        ? addDeleteRatio(codeFrequencyStats.data)
        : { ratio: null, reason: codeFrequencyStats.status };

    // Share of closed issues, 0–100 or null (was the string "NN% resolvidas",
    // Portuguese even in the English UI). It counts every closed issue, also
    // "not planned"/duplicates: a closing rate, not a resolution rate.
    const resolutionRate = closedShare(issuesOpenCount, issuesClosedCount);

    // Project practices (public REST, no token): CI health on the default
    // branch, Conventional Commits in recent commits, release cadence.
    const practices = {
        ci: analyzeCiRuns(results[17]?.status === 'fulfilled' ? results[17].value : null),
        commits: analyzeConventionalCommits(results[0]?.status === 'fulfilled' ? results[0].value : null),
        releases: analyzeReleases(results[18]?.status === 'fulfilled' ? results[18].value : null),
    };


    // One report object: shown on screen and persisted as the snapshot's full_report.
    const report = {
      fullName,
      // Typed name when it differs (renamed repo): Timeline merges its history
      ...(repoName.toLowerCase() !== fullName.toLowerCase() && { searchedName: repoName }),
      url: `https://github.com/${fullName}`,
      description: repoData.description,
      language: repoData.language,
      ownerType: repoData.owner?.type || 'User',
      subscribers: repoData.subscribers_count || 0,
      pushedAt: repoData.pushed_at,
      ageText: age,
      createdAt: repoData.created_at, // ISO string for calculations
      createdAtFormatted: formattedDate, // Formatted string for display
      analysisDate: new Date().toISOString(),
      stats: {
          branches: branches?.count ?? null,
          branchAnalysis: branches, // count, zombies, checked, exclusions, capped / zombiesReason
          prs: pulls,
          merges: mergedPRsCount,
          prsPerBranch,
          releases: releasesCount
      },
      metrics: {
          stars: repoData.stargazers_count || 0,
          forks: repoData.forks_count || 0,
          openIssues: issuesOpenCount,
          closedIssues: issuesClosedCount,
          resolutionRate,
          leadTime,
          divergence
      },
      health,
      maturity,
      codeReview,
      reviewProcess,
      contributors: contributorAnalysis?.table ?? null,
      busFactor,
      busFactorAnalysis,
      recentCommits,
      recentPRs,
      charts: {
          techStack: formatLanguages(languages),
          activity: activityStats.status === 'ok' ? formatCommitActivity(activityStats.data) : null,
          activityStatus: activityStats.status,
          weekdays: punchCardStats.status === 'ok' ? weekdaysFromPunchCard(punchCardStats.data) : null,
          weekdaysStatus: punchCardStats.status
      },
      codeChurn,
      practices
    };

    // Don't persist a snapshot built on failed critical data: it would become
    // permanent history (Timeline/Benchmark/Ranking) with fake zeros — e.g. the
    // health-14 snapshots found in the 2026-10 audit. The live view still
    // renders, with the partial-data warning.
    const blockers = warnings.filter((w) => PERSIST_BLOCKERS.includes(w));
    // Fallback contributor data (all-time, no window) is a different method:
    // persisting it would mix methods in Timeline/Benchmark history.
    if (contributorAnalysis?.partial) blockers.push('contributors (partial)');
    // Health that the tree couldn't confirm (tree failed/truncated) may undercount.
    if (health.uncertain) blockers.push('healthScore (tree unconfirmed)');
    if (leadTime.reason === 'error') blockers.push('leadTime');
    let searchId = null;
    if (blockers.length === 0) {
        searchId = await analytics.saveSearch({
            name: fullName,
            ownerType: repoData.owner.type,
            language: repoData.language,
            stars: repoData.stargazers_count || 0,
            forks: repoData.forks_count || 0,
            issues: issuesOpenCount,
            subscribers: repoData.subscribers_count || 0,
            lastPush: repoData.pushed_at,
            healthScore: health.score
        }, report);
    } else {
        console.warn('[useRepository] Snapshot not saved, unavailable:', blockers.join(', '));
    }

    const formattedData = {
        ...report,
        searchId, // ID da busca salva no banco (null quando não foi gravada)
        _warnings: warnings.length > 0 ? warnings : undefined
    };

    return formattedData;
}

// Custom Hook for repository data fetching and analysis with TanStack Query.
// The caller passes the name (the Dashboard reads it from `?q=`); null/invalid
// disables the query, so a hidden search never refetches or re-saves.
export function useRepository(repoName) {
    const name = repoName && repoName.includes('/') ? repoName : null;

    const { data, isLoading, error } = useQuery({
        queryKey: ['repository', name],
        queryFn: () => fetchRepositoryData(name),
        enabled: Boolean(name),
        staleTime: CACHE_STALE_TIME_MS,
        retry: 1
    });

    return {
        data,
        loading: isLoading,
        error: error?.message || null,
        errorCode: error?.code || null,
    };
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

    // Filter languages below threshold
    const mainLanguages = languageEntries.filter(lang => lang.percentage >= LANGUAGE_MIN_PERCENTAGE);
    const others = languageEntries.filter(lang => lang.percentage < LANGUAGE_MIN_PERCENTAGE);
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
    // Return raw data from GitHub API without forcing 52 weeks
    // Let CommitActivityChart handle the smart trimming based on project age
    const data = commitActivity?.all || [];

    return {
        labels: [], // Component will generate labels dynamically
        datasets: [{
            label: 'Commits',
            data: data, // Pass raw array from GitHub (can be less than 52 weeks)
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
