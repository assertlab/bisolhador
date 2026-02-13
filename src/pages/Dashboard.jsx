import { useState, lazy, Suspense, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { Header } from '../components/Header';
import { SearchBar } from '../components/SearchBar';
import { RepoInfoCard } from '../components/RepoInfoCard';
import { StatCard } from '../components/StatCard';
import { HealthScoreCard } from '../components/HealthScoreCard';
import { MaturityCard } from '../components/MaturityCard';
import { ContributorsTable } from '../components/ContributorsTable';
import { ActivityLogs } from '../components/ActivityLogs';
import { SettingsModal } from '../components/SettingsModal';
import { SkeletonDashboard } from '../components/skeletons/SkeletonDashboard.jsx';
import { useRepository } from '../hooks/useRepository.js';
import { createMockRepoData } from '../utils/snapshotAdapter.js';
import analytics from '../services/analytics.js';

// Lazy-loaded chart components (Code Splitting)
const TechStackChart = lazy(() => import('../components/charts/TechStackChart'));
const CommitActivityChart = lazy(() => import('../components/charts/CommitActivityChart'));
const WeekDaysChart = lazy(() => import('../components/charts/WeekDaysChart'));

// Skeleton component for chart loading
function SkeletonChart() {
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6 flex flex-col h-80 hover:shadow-md transition-shadow relative overflow-visible hover:z-50">
      <div className="h-5 bg-gray-200 dark:bg-slate-600 rounded animate-pulse mb-4 w-40"></div>
      <div className="flex-grow bg-gray-100 dark:bg-slate-700 rounded animate-pulse"></div>
    </div>
  );
}

export function Dashboard({ isSettingsOpen, setIsSettingsOpen }) {
  const { t } = useTranslation();
  const location = useLocation();
  const { data: repoData, loading, error, search } = useRepository();
  const [dismissedError, setDismissedError] = useState(false);
  const [isSnapshotMode, setIsSnapshotMode] = useState(false);
  const [snapshotId, setSnapshotId] = useState(null);
  const [snapshotData, setSnapshotData] = useState(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [semanticDate, setSemanticDate] = useState(null);

  const lastFetchedParams = useRef('');

  const loadSnapshot = useCallback(async (id) => {
    setSnapshotLoading(true);
    try {
      const snapshotResult = await analytics.getSnapshot(id);
      if (snapshotResult) {
        let finalData = null;

        if (snapshotResult.full_report) {
          try {
            finalData = typeof snapshotResult.full_report === 'string'
              ? JSON.parse(snapshotResult.full_report)
              : snapshotResult.full_report;
          } catch (e) {
            console.error('[Dashboard] Erro fatal ao decodificar JSON:', e);
            finalData = null;
          }
        }

        if (!finalData) {
          finalData = createMockRepoData(snapshotResult);
        }

        if (finalData && typeof finalData === 'object') {
           finalData.analysisDate = snapshotResult.created_at || new Date().toISOString();
        }

        setSnapshotData(finalData);
      } else {
        throw new Error('Snapshot não encontrado');
      }
    } catch (error) {
      console.error('Erro ao carregar snapshot:', error);
      setDismissedError(false);
    } finally {
      setSnapshotLoading(false);
    }
  }, []);

  const loadSnapshotByDate = useCallback(async (repoName, dateString) => {
    setSnapshotLoading(true);
    try {
      const snapshotResult = await analytics.getSnapshotByDate(repoName, dateString);
      if (snapshotResult) {
        let finalData = null;

        if (snapshotResult.full_report) {
          try {
            finalData = typeof snapshotResult.full_report === 'string'
              ? JSON.parse(snapshotResult.full_report)
              : snapshotResult.full_report;
          } catch (e) {
            console.error('[Dashboard] Erro fatal ao decodificar JSON:', e);
            finalData = null;
          }
        }

        if (!finalData) {
          finalData = createMockRepoData(snapshotResult);
        }

        if (finalData && typeof finalData === 'object') {
           finalData.analysisDate = snapshotResult.created_at || new Date().toISOString();
        }

        setSnapshotData(finalData);
      } else {
        throw new Error(`Nenhum registro encontrado para ${repoName} em ${dateString}`);
      }
    } catch (error) {
      console.error('Erro ao carregar snapshot por data:', error);
      setDismissedError(false);
    } finally {
      setSnapshotLoading(false);
    }
  }, []);

  useEffect(() => {
    const currentParams = location.search;
    if (lastFetchedParams.current === currentParams) return;

    lastFetchedParams.current = currentParams;

    analytics.trackPageView(location.pathname);

    const urlParams = new URLSearchParams(location.search);
    const idParam = urlParams.get('id');
    const repoParam = urlParams.get('repo');
    const dateParam = urlParams.get('date');
    const queryParam = urlParams.get('q');

    if (idParam) {
      setIsSnapshotMode(true);
      setSnapshotId(idParam);
      setSemanticDate(null);
      loadSnapshot(parseInt(idParam));
    } else if (repoParam && dateParam) {
      setIsSnapshotMode(true);
      setSnapshotId(null);
      setSemanticDate(dateParam);
      loadSnapshotByDate(repoParam, dateParam);
    } else if (queryParam) {
      search(queryParam);
    }
  }, [location.search, loadSnapshot, loadSnapshotByDate, search]);

  const handleSearch = (repositoryName) => {
    setDismissedError(false);
    setIsSnapshotMode(false);
    search(repositoryName);

    const currentPath = window.location.pathname;
    const cleanPath = currentPath.endsWith('/') ? currentPath.slice(0, -1) : currentPath;
    const newUrl = `${cleanPath}/?q=${encodeURIComponent(repositoryName)}`;

    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  const handleShareSuccess = () => {
    // Callback chamado quando o compartilhamento é bem-sucedido
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col">
      <Header onSettingsClick={() => setIsSettingsOpen(true)} />

      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 space-y-8">

        <div className="flex flex-col items-center justify-center space-y-4">
          <h2 className="text-3xl font-bold text-shark dark:text-white tracking-tight text-center">
            {t('app.subtitle')}
          </h2>

          <div className="w-full pt-4">
            <SearchBar onSearch={handleSearch} loading={loading} />
          </div>

          {/* Alerta de Modo Snapshot */}
          {isSnapshotMode && (
            <div className="w-full max-w-2xl mx-auto">
              <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-md flex items-center justify-between">
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h3 className="text-sm font-medium">{t('snapshot.title')}</h3>
                    <p className="text-sm mt-1">
                      {semanticDate
                        ? t('snapshot.byDate', { date: semanticDate })
                        : t('snapshot.byId', { id: snapshotId })
                      }
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSnapshotMode(false)}
                  className="ml-4 text-blue-400 hover:text-blue-600 transition-colors"
                  aria-label={t('snapshot.closeAlert')}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Alerta de Erro Condicional */}
          {error && !dismissedError && (
            <div className="w-full max-w-2xl mx-auto">
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex items-center justify-between">
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h3 className="text-sm font-medium">{t('app.errorTitle')}</h3>
                    <p className="text-sm mt-1">{error}</p>
                  </div>
                </div>
                <button
                  onClick={() => setDismissedError(true)}
                  className="ml-4 text-red-400 hover:text-red-600 transition-colors"
                  aria-label="Fechar alerta"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Lógica de Renderização */}
        {loading || snapshotLoading ? (
          <SkeletonDashboard />
        ) : (repoData || snapshotData) ? (
          <div className="space-y-6 animate-fade-in-up">

            {/* 1. Card Principal */}
            <RepoInfoCard data={repoData || snapshotData} onShareSuccess={handleShareSuccess} />

            {/* 2. Grid de Métricas de Volume */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard
                title={t('stats.stars')}
                value={(repoData || snapshotData).metrics.stars}
                tooltipText={t('stats.starsTooltip')}
              />
              <StatCard
                title={t('stats.forks')}
                value={(repoData || snapshotData).metrics.forks}
                tooltipText={t('stats.forksTooltip')}
              />
              <StatCard
                title={t('stats.openIssues')}
                value={(repoData || snapshotData).metrics.openIssues}
                tooltipText={t('stats.openIssuesTooltip')}
              />
              <StatCard
                title={t('stats.closedIssues')}
                value={(repoData || snapshotData).metrics.closedIssues}
                subValue={(repoData || snapshotData).metrics.resolutionRate}
                tooltipText={t('stats.closedIssuesTooltip')}
              />
              <StatCard
                title={t('stats.codeChurn')}
                value={(repoData || snapshotData).codeChurn?.ratio || 'N/A'}
                tooltipText={t('stats.codeChurnTooltip')}
              />
            </div>

            {/* 3. Grid de Dinâmica de Revisão */}
            <h3 className="text-lg font-semibold text-shark dark:text-white pt-4">{t('app.reviewDynamics')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StatCard
                title={t('stats.leadTime')}
                value={(repoData || snapshotData).metrics.leadTime.value === 'N/A' ? 'N/A' : (repoData || snapshotData).metrics.leadTime.value + ' ' + t('units.' + (repoData || snapshotData).metrics.leadTime.unit, {count: (repoData || snapshotData).metrics.leadTime.count})}
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
                tooltipText={t('stats.leadTimeTooltip')}
              />
              <StatCard
                title={t('stats.divergence')}
                value={(repoData || snapshotData).metrics.divergence.avg}
                subValue={t((repoData || snapshotData).metrics.divergence.categoryKey)}
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"></path></svg>}
                tooltipText={t('stats.divergenceTooltip')}
              />
            </div>

            {/* 4. Governança e Maturidade */}
            <h3 className="text-lg font-semibold text-shark dark:text-white pt-4">{t('app.governanceMaturity')}</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <HealthScoreCard score={(repoData || snapshotData).health.score} files={(repoData || snapshotData).health.files} />
              <MaturityCard maturity={(repoData || snapshotData).maturity} codeReview={(repoData || snapshotData).codeReview} />
            </div>

            {/* 5. Área de Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Suspense fallback={<SkeletonChart />}>
                <CommitActivityChart
                  data={(repoData || snapshotData).charts.activity}
                  createdAt={(repoData || snapshotData).createdAt}
                  key={`chart-${(repoData || snapshotData).fullName}`}
                />
              </Suspense>
              <Suspense fallback={<SkeletonChart />}>
                <TechStackChart data={(repoData || snapshotData).charts.techStack} />
              </Suspense>
            </div>

            {/* 6. Padrões de Trabalho */}
            <Suspense fallback={<SkeletonChart />}>
              <WeekDaysChart commits={(repoData || snapshotData).recentCommits} />
            </Suspense>

            {/* 7. Contribuições */}
            <ContributorsTable contributors={(repoData || snapshotData).contributors} busFactor={(repoData || snapshotData).busFactor} />

            {/* 8. Atividades Recentes */}
            <ActivityLogs commits={(repoData || snapshotData).recentCommits} pullRequests={(repoData || snapshotData).recentPRs} />

          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-xl h-64 flex items-center justify-center text-gray-400 dark:text-slate-500">
            {t('app.placeholderText')}
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
