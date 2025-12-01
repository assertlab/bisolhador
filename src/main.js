import { SearchComponent } from './modules/searchComponent.js';
import { MetricsCards } from './modules/metricsCards.js';
import { ChartComponent } from './modules/chartComponent.js';
import { RepoInfoComponent } from './modules/repoInfoComponent.js';
import { ContributorsTable } from './modules/contributorsTable.js';
import { ConfigComponent } from './modules/configComponent.js';
import { HealthComponent } from './modules/healthComponent.js';
import { ActivityLogs } from './modules/activityLogs.js';
import { EngineeringMaturity } from './modules/engineeringMaturity.js';
import { EngineeringMaturityCard } from './modules/engineeringMaturityCard.js';
import { ProcessAnalysis } from './modules/processAnalysis.js';
import { ProcessAnalysisCard } from './modules/processAnalysisCard.js';
import { exportToPDF } from './utils/pdfExporter.js';

document.addEventListener('DOMContentLoaded', () => {
    let currentOwner = null;
    let currentRepo = null;

    const configComponent = new ConfigComponent('#config-btn');
    const metricsCards = new MetricsCards();
    const chartComponent = new ChartComponent('commits-chart');
    const languagesChartComponent = new ChartComponent('languages-chart');
    const repoInfoComponent = new RepoInfoComponent('repo-info');
    const contributorsTable = new ContributorsTable('contributors-table');
    const healthComponent = new HealthComponent('health-score');
    const commitHistoryChart = new ChartComponent('commit-history-chart');
    const activityLogs = new ActivityLogs('#activity-logs');
    const engineeringMaturityCard = new EngineeringMaturityCard('#engineering-maturity-card');
    const processAnalysisCard = new ProcessAnalysisCard();

    const handleData = (repoData, commits, branches, contributors, pulls, issuesOpenCount, issuesClosedCount, pullRequests, languages, owner, repo, communityProfile, repositoryTree, releasesCount, commitActivity, pullRequestsStats, codeFrequency, branchesZombies, mergedPRsCount) => {
        currentOwner = owner;
        currentRepo = repo;
        metricsCards.update(repoData, issuesOpenCount, issuesClosedCount, codeFrequency);
        healthComponent.update(communityProfile, repoData.description);
        chartComponent.update(commits);
        languagesChartComponent.updateLanguages(languages);
        repoInfoComponent.update(repoData, branches, pulls, owner, repo, releasesCount, mergedPRsCount);
        contributorsTable.update(contributors);
        commitHistoryChart.renderCommitHistoryChart(commitActivity, repoData.created_at);
        activityLogs.update(commits, pullRequests);
        const maturity = EngineeringMaturity.analyze(repositoryTree.tree, pullRequests, branchesZombies);
        engineeringMaturityCard.update(maturity);
        const leadTime = ProcessAnalysis.calculateLeadTime(pullRequestsStats);
        const divergence = ProcessAnalysis.calculateDivergence(pullRequestsStats);
        processAnalysisCard.update(leadTime, divergence);
    };

    new SearchComponent('#search-form', '#search-btn', handleData);

    document.getElementById('export-pdf-btn').addEventListener('click', () => {
        if (currentOwner && currentRepo) {
            exportToPDF(currentOwner, currentRepo);
        } else {
            alert('Por favor, busque um repositório primeiro para exportar o relatório.');
        }
    });

    const helpModal = document.getElementById('help-modal');
    document.getElementById('help-btn').addEventListener('click', () => {
        helpModal.showModal();
    });
    document.getElementById('close-help').addEventListener('click', () => {
        helpModal.close();
    });
});
