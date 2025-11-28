import { SearchComponent } from './modules/searchComponent.js';
import { MetricsCards } from './modules/metricsCards.js';
import { ChartComponent } from './modules/chartComponent.js';

document.addEventListener('DOMContentLoaded', () => {
    const metricsCards = new MetricsCards();
    const chartComponent = new ChartComponent('commits-chart');

    const handleData = (repoData, commits) => {
        metricsCards.update(repoData);
        chartComponent.update(commits);
    };

    new SearchComponent('#search-form', '#search-btn', handleData);
});
