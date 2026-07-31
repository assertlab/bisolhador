import { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from '../components/Header';
import { SettingsModal } from '../components/SettingsModal';
import { githubService } from '../services/githubService';
import { withExponentialBackoff } from '../utils/retry.js';
import { useBenchmarkRepos } from '../hooks/useBenchmarkRepos';
import { useTimeFilter } from '../hooks/useTimeFilter';
import { TimeRangeFilter } from '../components/TimeRangeFilter';
import { BenchmarkSearchForm } from '../components/benchmark/BenchmarkSearchForm';
import { BenchmarkRepoChips } from '../components/benchmark/BenchmarkRepoChips';
import { BenchmarkHealthBars } from '../components/benchmark/BenchmarkHealthBars';
import { BenchmarkBusFactorRisk } from '../components/benchmark/BenchmarkBusFactorRisk';
import { BenchmarkDetailTable } from '../components/benchmark/BenchmarkDetailTable';
import { MAX_BENCHMARK_REPOS, GOLDEN_ANGLE } from '../constants';
import { ensureChartSetup } from '../lib/chartSetup.js';
import { showToast } from '../hooks/useToast.js';

// Lazy load chart components. Each also waits on ensureChartSetup() so
// chart.js registration (dynamically imported itself) is done before mount.
const BenchmarkEvolutionChart = lazy(() =>
  Promise.all([import('../components/charts/BenchmarkEvolutionChart'), ensureChartSetup()]).then(([mod]) => mod)
);
const BenchmarkComparisonChart = lazy(() =>
  Promise.all([import('../components/charts/BenchmarkComparisonChart'), ensureChartSetup()]).then(([mod]) => mod)
);

// Utility function to generate consistent random colors
const generateColor = (seed) => {
  const hue = (seed * GOLDEN_ANGLE) % 360;
  return `hsl(${hue}, 70%, 50%)`;
};

export function Benchmark({ isSettingsOpen, setIsSettingsOpen }) {
  const { t } = useTranslation();
  const [selectedRepos, setSelectedRepos] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [metricCategory, setMetricCategory] = useState('popularity');
  const [timeRange, setTimeRange] = useState('30d');
  const [isCheckingRepo, setIsCheckingRepo] = useState(false);

  // Fetch data for all selected repos
  const { isLoading, hasErrors, successfulRepos, errorCount } = useBenchmarkRepos(selectedRepos);

  // Flatten all history points to filter with useTimeFilter, then regroup per repo
  const allHistory = useMemo(() => {
    if (!successfulRepos || successfulRepos.length === 0) return [];
    return successfulRepos.flatMap((repo) =>
      repo.history.map((point) => ({ ...point, _repoFullName: repo.fullName }))
    );
  }, [successfulRepos]);

  const dateAccessor = useCallback((d) => d.date, []);
  const filteredHistory = useTimeFilter(allHistory, timeRange, dateAccessor);

  const filteredRepos = useMemo(() => {
    if (!successfulRepos || successfulRepos.length === 0) return successfulRepos;
    if (timeRange === 'all') return successfulRepos;

    const historyByRepo = new Map();
    for (const point of filteredHistory) {
      const key = point._repoFullName;
      if (!historyByRepo.has(key)) historyByRepo.set(key, []);
      historyByRepo.get(key).push(point);
    }

    return successfulRepos.map((repo) => ({
      ...repo,
      history: historyByRepo.get(repo.fullName) || [],
    }));
  }, [successfulRepos, filteredHistory, timeRange]);

  const handleAddRepo = async (e) => {
    e.preventDefault();
    const repoName = searchInput.trim();

    if (!repoName) return;

    if (!repoName.includes('/')) {
      showToast(t('benchmark.alerts.invalidFormat', 'Por favor, use o formato: owner/repo'), 'warning');
      return;
    }

    if (selectedRepos.some(r => r.fullName === repoName)) {
      showToast(t('benchmark.alerts.alreadyAdded', 'Este repositório já foi adicionado'), 'warning');
      return;
    }

    if (selectedRepos.length >= MAX_BENCHMARK_REPOS) {
      showToast(t('benchmark.alerts.maxRepos', { count: MAX_BENCHMARK_REPOS }), 'warning');
      return;
    }

    // Fire-and-forget: start downloading + registering chart.js in parallel
    // with the privacy check / history fetch below, instead of waiting until
    // a chart actually mounts to trigger it. Never let a failure here block
    // adding the repo.
    ensureChartSetup().catch((err) => {
      console.warn('[Benchmark] Chart.js prefetch failed (non-fatal, will retry on chart mount):', err);
    });

    const [owner, repo] = repoName.split('/');

    // Privacy gate: the Benchmark page has its own entry path (it reads history
    // straight from Supabase and never calls useRepository.js), so it needs its
    // own live check against GitHub before a private repo can ever be selected.
    // Transient failures (rate limit, network blips) are retried with backoff;
    // baseDelay is shortened from the util's 1000ms default to keep the worst
    // case around ~3s instead of ~10s (isCheckingRepo below keeps the button
    // disabled with a spinner for the duration either way).
    // Known limitation: fetchRepository doesn't attach the HTTP status to the
    // error it throws, so a 404 (repo genuinely doesn't exist) gets retried
    // 3x same as a transient failure would — wasteful but not incorrect.
    // Fixing that cleanly requires attaching a status code in githubService.js.
    setIsCheckingRepo(true);
    try {
      const repoInfo = await withExponentialBackoff(
        () => githubService.fetchRepository(owner, repo),
        3,
        300
      );
      if (repoInfo?.private === true) {
        showToast(t('errors.privateRepo'), 'error');
        return;
      }
    } catch {
      // All retries exhausted — fail closed. We can't confirm this repo is
      // public, so we refuse to add it rather than risk processing a private one.
      showToast(t('errors.privacyCheckFailed'), 'error');
      return;
    } finally {
      setIsCheckingRepo(false);
    }

    const newRepo = {
      fullName: repoName,
      owner,
      repo,
      color: generateColor(selectedRepos.length)
    };

    setSelectedRepos([...selectedRepos, newRepo]);
    setSearchInput('');
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

          <BenchmarkSearchForm
            searchInput={searchInput}
            setSearchInput={setSearchInput}
            onSubmit={handleAddRepo}
            isChecking={isCheckingRepo}
          />

          {/* Counter Badge */}
          {selectedRepos.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
              <span className="font-medium">
                {selectedRepos.length} / {MAX_BENCHMARK_REPOS} {t('benchmark.reposCount', 'repositórios')}
              </span>
            </div>
          )}
        </div>

        {/* Chips Area - Selected Repos */}
        <BenchmarkRepoChips selectedRepos={selectedRepos} onRemoveRepo={handleRemoveRepo} />

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

                  <TimeRangeFilter
                    currentRange={timeRange}
                    onRangeChange={setTimeRange}
                    i18nPrefix="benchmark"
                  />
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

                    {/* Health & Language side-by-side */}
                    {successfulRepos.length >= 2 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <BenchmarkHealthBars repos={successfulRepos} />

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
                      <BenchmarkBusFactorRisk repos={successfulRepos} />
                    )}

                    {/* Detail Metrics Table */}
                    {successfulRepos.length >= 2 && (
                      <BenchmarkDetailTable repos={successfulRepos} />
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
