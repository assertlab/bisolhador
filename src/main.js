import { SearchComponent } from './modules/searchComponent.js';
import { MetricsCards } from './modules/metricsCards.js';
import { ChartComponent } from './modules/chartComponent.js';
import { RepoInfoComponent } from './modules/repoInfoComponent.js';
import { ContributorsTable } from './modules/contributorsTable.js';
import { ConfigComponent } from './modules/configComponent.js';
import { HealthComponent } from './modules/healthComponent.js';
import { ActivityLogs } from './modules/activityLogs.js';

document.addEventListener('DOMContentLoaded', () => {
    const configComponent = new ConfigComponent('#config-btn');
    const metricsCards = new MetricsCards();
    const chartComponent = new ChartComponent('commits-chart');
    const languagesChartComponent = new ChartComponent('languages-chart');
    const repoInfoComponent = new RepoInfoComponent('repo-info');
    const contributorsTable = new ContributorsTable('contributors-table');
    const healthComponent = new HealthComponent('health-score');
    const activityLogs = new ActivityLogs('#activity-logs');

    const handleData = (repoData, commits, branches, contributors, pulls, issuesOpenCount, issuesClosedCount, pullRequests, languages, owner, repo, communityProfile) => {
        metricsCards.update(repoData, issuesOpenCount, issuesClosedCount);
        healthComponent.update(communityProfile, repoData.description);
        chartComponent.update(commits);
        languagesChartComponent.updateLanguages(languages);
        repoInfoComponent.update(repoData, branches, pulls, owner, repo);
        contributorsTable.update(contributors);
        activityLogs.update(commits, pullRequests);
    };

    new SearchComponent('#search-form', '#search-btn', handleData);
});
