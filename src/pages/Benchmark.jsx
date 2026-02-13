import { useState, useMemo, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from '../components/Header';
import { SettingsModal } from '../components/SettingsModal';
import { useBenchmarkRepos } from '../hooks/useBenchmarkRepos';

// Lazy load chart components
const BenchmarkEvolutionChart = lazy(() => import('../components/charts/BenchmarkEvolutionChart'));
const BenchmarkComparisonChart = lazy(() => import('../components/charts/BenchmarkComparisonChart'));

// Utility function to generate consistent random colors
const generateColor = (seed) => {
  // Use seed to generate consistent color
  const hue = (seed * 137.508) % 360; // Golden angle approximation
  return `hsl(${hue}, 70%, 50%)`;
};

export function Benchmark({ isSettingsOpen, setIsSettingsOpen }) {
  const { t } = useTranslation();
  const [selectedRepos, setSelectedRepos] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [metricCategory, setMetricCategory] = useState('popularity');
  const [timeRange, setTimeRange] = useState('30d');

  const MAX_REPOS = 10;

  // Fetch data for all selected repos
  const { queries, isLoading, hasErrors, successfulRepos, errorCount } = useBenchmarkRepos(selectedRepos);

  // Filtra o histórico de cada repo com base no timeRange selecionado
  const filteredRepos = useMemo(() => {
    if (!successfulRepos || successfulRepos.length === 0) return successfulRepos;
    if (timeRange === 'all') return successfulRepos;

    const now = new Date();
    const cutoffDate = new Date();

    switch (timeRange) {
      case '7d':
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        cutoffDate.setDate(now.getDate() - 30);
        break;
      case '60d':
        cutoffDate.setDate(now.getDate() - 60);
        break;
      case '90d':
        cutoffDate.setDate(now.getDate() - 90);
        break;
      default:
        return successfulRepos;
    }

    return successfulRepos.map((repo) => ({
      ...repo,
      history: repo.history.filter((point) => point.date >= cutoffDate),
    }));
  }, [successfulRepos, timeRange]);

  const handleAddRepo = (e) => {
    e.preventDefault();
    const repoName = searchInput.trim();

    if (!repoName) return;

    // Validate format (owner/repo)
    if (!repoName.includes('/')) {
      alert('Por favor, use o formato: owner/repo');
      return;
    }

    // Check if already added
    if (selectedRepos.some(r => r.fullName === repoName)) {
      alert('Este repositório já foi adicionado');
      return;
    }

    // Check max limit
    if (selectedRepos.length >= MAX_REPOS) {
      alert(`Máximo de ${MAX_REPOS} repositórios permitidos`);
      return;
    }

    // Add repo to list
    const [owner, repo] = repoName.split('/');
    const newRepo = {
      fullName: repoName,
      owner,
      repo,
      color: generateColor(selectedRepos.length)
    };

    setSelectedRepos([...selectedRepos, newRepo]);
    setSearchInput(''); // Clear input
  };

  const handleRemoveRepo = (fullName) => {
    setSelectedRepos(selectedRepos.filter(r => r.fullName !== fullName));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col">
      <Header onSettingsClick={() => setIsSettingsOpen(true)} />

      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 space-y-8">

        {/* Page Title */}
        <div className="flex flex-col items-center justify-center space-y-4">
          <h2 className="text-3xl font-bold text-shark dark:text-white tracking-tight text-center">
            📊 {t('benchmark.title', 'Benchmark de Repositórios')}
          </h2>
          <p className="text-gray-600 dark:text-slate-400 text-center max-w-2xl">
            {t('benchmark.subtitle', 'Compare até 10 repositórios simultaneamente e visualize a evolução de métricas')}
          </p>

          {/* Search Bar */}
          <div className="w-full pt-4">
            <form onSubmit={handleAddRepo} className="w-full max-w-3xl mx-auto">
              <label htmlFor="benchmark-search" className="mb-2 text-sm font-medium text-gray-900 dark:text-white sr-only">
                {t('benchmark.searchLabel', 'Adicionar repositório')}
              </label>
              <div className="relative">
                {/* Search Icon */}
                <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                  </svg>
                </div>

                {/* Input */}
                <input
                  type="search"
                  id="benchmark-search"
                  className="block w-full p-4 ps-12 text-sm text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 focus:ring-ocean focus:border-ocean outline-none shadow-sm transition-shadow placeholder-gray-400 dark:placeholder-slate-400"
                  placeholder={t('benchmark.searchPlaceholder', 'Ex: facebook/react, microsoft/vscode...')}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  required
                />

                {/* Submit Button */}
                <button
                  type="submit"
                  className="text-white absolute end-2.5 bottom-2.5 bg-ocean dark:bg-sky-600 hover:bg-sky-600 dark:hover:bg-sky-700 focus:ring-4 focus:outline-none focus:ring-sky-300 font-medium rounded-lg text-sm px-5 py-2 transition-all flex items-center gap-2"
                >
                  {t('benchmark.addButton', 'Adicionar')}
                </button>
              </div>
            </form>
          </div>

          {/* Counter Badge */}
          {selectedRepos.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
              <span className="font-medium">
                {selectedRepos.length} / {MAX_REPOS} {t('benchmark.reposCount', 'repositórios')}
              </span>
            </div>
          )}
        </div>

        {/* Chips Area - Selected Repos */}
        {selectedRepos.length > 0 && (
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">
              {t('benchmark.selectedRepos', 'Repositórios Selecionados')}
            </h3>
            <div className="flex flex-wrap gap-2">
              {selectedRepos.map((repo) => (
                <div
                  key={repo.fullName}
                  className="inline-flex items-center gap-2 bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-full px-3 py-1.5 text-sm"
                >
                  {/* Color Dot */}
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: repo.color }}
                    aria-hidden="true"
                  ></span>

                  {/* Repo Name */}
                  <span className="font-medium text-gray-700 dark:text-slate-200">
                    {repo.fullName}
                  </span>

                  {/* Remove Button */}
                  <button
                    onClick={() => handleRemoveRepo(repo.fullName)}
                    className="ml-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    aria-label={`Remover ${repo.fullName}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status Messages */}
        {hasErrors && errorCount > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400 px-4 py-3 rounded-md">
            <p className="text-sm">
              ⚠️ {t('benchmark.partialError', `${errorCount} repositório(s) sem histórico. Faça uma análise primeiro na página de busca.`)}
            </p>
          </div>
        )}

        {/* Visualization Grid */}
        {selectedRepos.length === 0 ? (
          /* Empty State */
          <div className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl p-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-700 dark:text-slate-300">
                {t('benchmark.emptyTitle', 'Nenhum repositório selecionado')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 max-w-md">
                {t('benchmark.emptyDescription', 'Adicione repositórios usando a barra de busca acima para começar a comparar métricas')}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Loading State */}
            {isLoading && (
              <div className="text-center py-8">
                <svg className="animate-spin h-8 w-8 text-ocean mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  {t('benchmark.loading', 'Carregando dados dos repositórios...')}
                </p>
              </div>
            )}

            {/* Repository Preview Cards */}
            {successfulRepos.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-shark dark:text-white mb-4">
                  {t('benchmark.loadedRepos', 'Repositórios Carregados')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {successfulRepos.map((repo) => (
                    <div
                      key={repo.fullName}
                      className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: repo.color }}
                          ></span>
                          <h4 className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                            {repo.fullName}
                          </h4>
                        </div>
                      </div>

                      <div className="space-y-2 text-xs text-gray-600 dark:text-slate-400">
                        <div className="flex justify-between">
                          <span>⭐ Stars:</span>
                          <span className="font-medium">{repo.stars.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>🔱 Forks:</span>
                          <span className="font-medium">{repo.forks.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>🏥 Health:</span>
                          <span className="font-medium">{repo.healthScore}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>📊 Language:</span>
                          <span className="font-medium">{repo.language}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>⏱️ Lead Time:</span>
                          <span className="font-medium">
                            {repo.leadTime > 0 ? `${repo.leadTime} ${repo.leadTimeUnit}` : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>🚌 Bus Factor:</span>
                          <span className="font-medium">
                            {repo.busFactorPercentage > 0 ? `${repo.busFactorPercentage}%` : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Charts Section */}
            {successfulRepos.length > 0 && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <h3 className="text-xl font-semibold text-shark dark:text-white">
                    {t('benchmark.visualizationTitle', 'Comparação de Métricas')}
                  </h3>

                  {/* Time Range Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-slate-400 font-medium">
                      {t('benchmark.filters.label')}
                    </span>
                    <div className="inline-flex rounded-lg border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 p-1">
                      {['7d', '30d', '60d', '90d', 'all'].map((range) => (
                        <button
                          key={range}
                          onClick={() => setTimeRange(range)}
                          className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                            timeRange === range
                              ? 'bg-white dark:bg-slate-800 text-shark dark:text-white shadow-sm'
                              : 'text-gray-600 dark:text-slate-400 hover:text-shark dark:hover:text-white'
                          }`}
                        >
                          {t(`benchmark.filters.${range}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <Suspense
                  fallback={
                    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6 h-80 flex items-center justify-center">
                      <div className="animate-pulse text-gray-400 dark:text-slate-500">
                        {t('benchmark.loadingCharts', 'Carregando gráficos...')}
                      </div>
                    </div>
                  }
                >
                  <div className="space-y-6">
                    {/* Evolution Chart - Stars over time */}
                    <BenchmarkEvolutionChart repos={filteredRepos} metric="stars" />

                    {/* Metric Category Tabs */}
                    <div className="flex flex-wrap gap-2">
                      {[
                        { key: 'popularity', label: t('benchmark.categoryPopularity', 'Popularidade'), icon: '⭐' },
                        { key: 'velocity', label: t('benchmark.categoryVelocity', 'Velocidade'), icon: '🚀' },
                        { key: 'quality', label: t('benchmark.categoryQuality', 'Qualidade'), icon: '🔬' },
                      ].map((tab) => (
                        <button
                          key={tab.key}
                          onClick={() => setMetricCategory(tab.key)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            metricCategory === tab.key
                              ? 'bg-ocean text-white shadow-sm'
                              : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                          }`}
                        >
                          {tab.icon} {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Comparison Bar Chart */}
                    <BenchmarkComparisonChart repos={filteredRepos} metricCategory={metricCategory} />

                    {/* Additional metrics if needed */}
                    {successfulRepos.length >= 2 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Health Score Comparison */}
                        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6">
                          <h4 className="text-md font-semibold text-shark dark:text-white mb-4">
                            {t('benchmark.healthComparison', 'Health Score')}
                          </h4>
                          <div className="space-y-3">
                            {successfulRepos.map((repo) => (
                              <div key={repo.fullName} className="flex items-center gap-3">
                                <span
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: repo.color }}
                                ></span>
                                <div className="flex-grow">
                                  <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-700 dark:text-slate-300 truncate max-w-[200px]">
                                      {repo.fullName}
                                    </span>
                                    <span className="font-semibold text-shark dark:text-white">
                                      {repo.healthScore}%
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                                    <div
                                      className="h-2 rounded-full transition-all"
                                      style={{
                                        width: `${repo.healthScore}%`,
                                        backgroundColor: repo.color,
                                      }}
                                    ></div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Language Distribution */}
                        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6">
                          <h4 className="text-md font-semibold text-shark dark:text-white mb-4">
                            {t('benchmark.languageDistribution', 'Linguagens')}
                          </h4>
                          <div className="space-y-2">
                            {successfulRepos.map((repo) => (
                              <div key={repo.fullName} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: repo.color }}
                                  ></span>
                                  <span className="text-gray-700 dark:text-slate-300 truncate max-w-[150px]">
                                    {repo.fullName.split('/')[1]}
                                  </span>
                                </div>
                                <span className="font-medium text-gray-900 dark:text-white">
                                  {repo.language}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Bus Factor Risk Section */}
                    {successfulRepos.length >= 2 && (
                      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6">
                        <h4 className="text-md font-semibold text-shark dark:text-white mb-2">
                          {t('benchmark.busFactorRisk', 'Risco Bus Factor')}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
                          {t('benchmark.busFactorDescription', 'Concentração de trabalho no principal contribuidor. Quanto maior, mais arriscado.')}
                        </p>
                        <div className="space-y-3">
                          {successfulRepos.map((repo) => {
                            const pct = repo.busFactorPercentage;
                            let barColor = 'bg-green-500';
                            let textBadge = 'text-green-700 dark:text-green-400';
                            if (pct > 80) {
                              barColor = 'bg-red-500';
                              textBadge = 'text-red-700 dark:text-red-400';
                            } else if (pct > 60) {
                              barColor = 'bg-yellow-500';
                              textBadge = 'text-yellow-700 dark:text-yellow-400';
                            }

                            return (
                              <div key={repo.fullName} className="flex items-center gap-3">
                                <span
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: repo.color }}
                                ></span>
                                <div className="flex-grow">
                                  <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-700 dark:text-slate-300 truncate max-w-[200px]">
                                      {repo.fullName}
                                    </span>
                                    <span className={`font-semibold ${textBadge}`}>
                                      {pct > 0 ? `${pct}%` : 'N/A'}
                                      {repo.busFactorTopContributor && pct > 0 && (
                                        <span className="text-xs text-gray-400 dark:text-slate-500 ml-1">
                                          ({repo.busFactorTopContributor})
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full transition-all ${barColor}`}
                                      style={{ width: `${Math.min(pct, 100)}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Detail Metrics Table */}
                    {successfulRepos.length >= 2 && (
                      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6">
                        <h4 className="text-md font-semibold text-shark dark:text-white mb-4">
                          {t('benchmark.detailTable', 'Tabela Comparativa')}
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                            <thead className="bg-gray-50 dark:bg-slate-700">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                                  {t('benchmark.tableRepo', 'Repositório')}
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                                  {t('benchmark.healthComparison', 'Health Score')}
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                                  {t('stats.leadTime', 'Lead Time')}
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                                  {t('stats.divergence', 'Divergência')}
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                                  {t('stats.codeChurn', 'Code Churn')}
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                                  {t('benchmark.busFactorRisk', 'Risco Bus Factor')}
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                              {successfulRepos.map((repo) => {
                                let riskBadge = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
                                let riskLabel = t('benchmark.riskLow', 'Baixo');
                                if (repo.busFactorPercentage > 80) {
                                  riskBadge = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
                                  riskLabel = t('benchmark.riskCritical', 'Crítico');
                                } else if (repo.busFactorPercentage > 60) {
                                  riskBadge = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
                                  riskLabel = t('benchmark.riskModerate', 'Moderado');
                                }

                                return (
                                  <tr key={repo.fullName} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <div className="flex items-center gap-2">
                                        <span
                                          className="w-2 h-2 rounded-full flex-shrink-0"
                                          style={{ backgroundColor: repo.color }}
                                        ></span>
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                                          {repo.fullName}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm text-gray-700 dark:text-slate-300">
                                      {repo.healthScore}%
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm text-gray-700 dark:text-slate-300">
                                      {repo.leadTime > 0
                                        ? `${repo.leadTime} ${t('units.' + repo.leadTimeUnit, repo.leadTimeUnit)}`
                                        : 'N/A'}
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm text-gray-700 dark:text-slate-300">
                                      {repo.divergence > 0 ? repo.divergence.toFixed(1) : 'N/A'}
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm text-gray-700 dark:text-slate-300">
                                      {repo.codeChurnRatio > 0 ? repo.codeChurnRatio.toFixed(2) : 'N/A'}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${riskBadge}`}>
                                        {repo.busFactorPercentage > 0 ? `${repo.busFactorPercentage}% — ${riskLabel}` : 'N/A'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </Suspense>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 py-6 mt-auto">
        <div className="text-center text-sm text-gray-500 dark:text-slate-400">
          <p>{t('app.footerCopyright')}</p>
          <p className="mt-1 font-medium text-shark dark:text-white">
            {t('app.footerPowered')}
          </p>
        </div>
      </footer>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
