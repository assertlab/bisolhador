import { useState, lazy, Suspense, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Header } from '../components/Header';
import { SearchBar } from '../components/SearchBar';
import { RepoInfoCard } from '../components/RepoInfoCard';
import { StatCard } from '../components/StatCard';
import { HealthScoreCard } from '../components/HealthScoreCard';
import { MaturityCard } from '../components/MaturityCard';
import { BusFactorCard } from '../components/BusFactorCard';
import { ContributorsTable } from '../components/ContributorsTable';
import { ActivityLogs } from '../components/ActivityLogs';
import { SettingsModal } from '../components/SettingsModal';
import { SkeletonDashboard } from '../components/skeletons/SkeletonDashboard.jsx';
import { SkeletonChart } from '../components/skeletons/SkeletonChart.jsx';
import { PartialDataAlert } from '../components/PartialDataAlert.jsx';
import { useRepository } from '../hooks/useRepository.js';
import { useSnapshot, getSnapshotParams } from '../hooks/useSnapshot.js';
import analytics from '../services/analytics.js';
import { ensureChartSetup } from '../lib/chartSetup.js';
import { MERGED_PR_SAMPLE, SNAPSHOT_TIMEZONE } from '../constants.js';
import { formatDuration } from '../utils/prReviewStats.js';
import { formatters } from '../utils/formatters.js';

// Lazy-loaded chart components (Code Splitting). Each also waits on
// ensureChartSetup() so chart.js registration — now dynamically imported
// itself — is guaranteed done before the component mounts, without keeping
// it on the app's critical path.
const TechStackChart = lazy(() =>
  Promise.all([import('../components/charts/TechStackChart'), ensureChartSetup()]).then(([mod]) => mod)
);
const CommitActivityChart = lazy(() =>
  Promise.all([import('../components/charts/CommitActivityChart'), ensureChartSetup()]).then(([mod]) => mod)
);
const WeekDaysChart = lazy(() =>
  Promise.all([import('../components/charts/WeekDaysChart'), ensureChartSetup()]).then(([mod]) => mod)
);

export function Dashboard({ isSettingsOpen, setIsSettingsOpen }) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dismissedError, setDismissedError] = useState(false);
  const [snapshotAlertDismissed, setSnapshotAlertDismissed] = useState(false);
  const [searchBarKey, setSearchBarKey] = useState(0);

  // A URL decide o que é exibido (prioridade: ID > Semântico > Live), uma vez só:
  // nunca dados de uma busca ao vivo anterior por baixo do banner de snapshot.
  const snapshotParams = getSnapshotParams(searchParams);
  const isSnapshotUrl = Boolean(snapshotParams);
  const snapshot = useSnapshot(snapshotParams);
  const { data: repoData, loading, error } = useRepository(isSnapshotUrl ? null : searchParams.get('q'));
  const displayData = isSnapshotUrl ? snapshot.data : repoData;
  const displayLoading = isSnapshotUrl ? snapshot.loading : loading;
  const displayError = isSnapshotUrl
    ? (snapshot.failed ? t('errors.snapshotUnavailable') : null)
    : error;
  const isSnapshotMode = isSnapshotUrl && !snapshotAlertDismissed;
  const leadTime = displayData?.metrics?.leadTime ?? {};
  const leadTimeP90 = leadTime.p90Hours != null ? formatDuration(leadTime.p90Hours) : null;
  const duration = ({ value, unit }) => `${value} ${t('units.' + unit, { count: value })}`;

  // Sincroniza URL → estado durante o render, quando a query string muda (padrão
  // "ajustar estado quando um valor muda" da doc do React), em vez de setState
  // num effect. null inicial: a primeira renderização também processa a URL.
  const [syncedSearch, setSyncedSearch] = useState(null);
  if (syncedSearch !== location.search) {
    setSyncedSearch(location.search);
    // Toda mudança de URL (inclusive Back/Forward) volta a exibir os alertas.
    setDismissedError(false);
    setSnapshotAlertDismissed(false);

    // Navegação para "/" sem parâmetros (ex.: ícones de Home/Busca): os dados
    // somem sozinhos (nenhum hook habilitado); falta limpar o input do SearchBar.
    if (!isSnapshotUrl && !searchParams.get('q')) {
      setSearchBarKey((key) => key + 1); // Força remount do SearchBar
    }
  }

  // Efeito externo de verdade (GA4): só o pageview fica em effect.
  const lastTrackedSearch = useRef(null);
  useEffect(() => {
    if (lastTrackedSearch.current === location.search) return;
    lastTrackedSearch.current = location.search;
    analytics.trackPageView(location.pathname);
  }, [location.search, location.pathname]);

  const handleSearch = (repositoryName) => {
    setDismissedError(false); // reenviar a mesma busca não muda a URL
    setSearchParams({ q: repositoryName });
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
            <SearchBar key={searchBarKey} onSearch={handleSearch} loading={loading} />
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
                      {snapshotParams.date
                        ? displayData?.analysisDate
                          // Recife time, like the day boundary in buscar_snapshot_por_data
                          ? t('snapshot.byDateRecorded', {
                              date: snapshotParams.date,
                              recordedAt: formatters.formatDateTime(displayData.analysisDate, i18n.language === 'pt' ? 'pt-BR' : 'en-US', SNAPSHOT_TIMEZONE),
                            })
                          : t('snapshot.byDate', { date: snapshotParams.date })
                        : t('snapshot.byId', { id: snapshotParams.id })
                      }
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSnapshotAlertDismissed(true)}
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
          {displayError && !dismissedError && (
            <div className="w-full max-w-2xl mx-auto">
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex items-center justify-between">
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h3 className="text-sm font-medium">{t('app.errorTitle')}</h3>
                    <p className="text-sm mt-1">{displayError}</p>
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

          {/* Alerta de Dados Parciais */}
          <PartialDataAlert warnings={displayData?._warnings} />
        </div>

        {/* Lógica de Renderização */}
        {displayLoading ? (
          <SkeletonDashboard />
        ) : displayData ? (
          <div className="space-y-6 animate-fade-in-up">

            {/* 1. Card Principal */}
            <RepoInfoCard data={displayData} onShareSuccess={handleShareSuccess} />

            {/* 2. Grid de Métricas de Volume */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard
                title={t('stats.stars')}
                value={displayData.metrics.stars}
                tooltipText={t('stats.starsTooltip')}
              />
              <StatCard
                title={t('stats.forks')}
                value={displayData.metrics.forks}
                tooltipText={t('stats.forksTooltip')}
              />
              <StatCard
                title={t('stats.openIssues')}
                value={displayData.metrics.openIssues}
                tooltipText={t('stats.openIssuesTooltip')}
              />
              <StatCard
                title={t('stats.closedIssues')}
                value={displayData.metrics.closedIssues}
                subValue={displayData.metrics.resolutionRate}
                tooltipText={t('stats.closedIssuesTooltip')}
              />
              <StatCard
                title={t('stats.codeChurn')}
                value={displayData.codeChurn?.ratio || 'N/A'}
                tooltipText={t('stats.codeChurnTooltip')}
              />
            </div>

            {/* 3. Grid de Dinâmica de Revisão */}
            <h3 className="text-lg font-semibold text-shark dark:text-white pt-4">{t('app.reviewDynamics')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StatCard
                title={t('stats.leadTime')}
                value={leadTime.n > 0 ? duration(leadTime) : 'N/A'}
                subValue={leadTime.n > 0 && leadTimeP90
                  ? t('stats.leadTimeSample', { n: leadTime.n, p90: duration(leadTimeP90) })
                  : t(`stats.leadTimeUnavailable.${leadTime.reason}`, { defaultValue: t('stats.leadTimeUnavailable.error') })}
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
                tooltipText={t('stats.leadTimeTooltip', { n: MERGED_PR_SAMPLE })}
              />
              <StatCard
                title={t('stats.divergence')}
                value={displayData.metrics.divergence.avg ?? 'N/A'}
                subValue={displayData.metrics.divergence.n > 0
                  ? `${t(displayData.metrics.divergence.categoryKey)} · ${t('stats.prSample', { n: displayData.metrics.divergence.n })}`
                  : t(displayData.metrics.divergence.categoryKey)}
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"></path></svg>}
                tooltipText={t('stats.divergenceTooltip', { n: MERGED_PR_SAMPLE })}
              />
            </div>

            {/* 4. Governança e Maturidade */}
            <h3 className="text-lg font-semibold text-shark dark:text-white pt-4">{t('app.governanceMaturity')}</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <HealthScoreCard health={displayData.health} />
              <MaturityCard maturity={displayData.maturity} codeReview={displayData.codeReview} branchAnalysis={displayData.stats.branchAnalysis} />
            </div>

            {/* 4.5. Análise de Risco (Bus Factor) */}
            {displayData.busFactorAnalysis?.busFactor > 0 && (
              <>
                <h3 className="text-lg font-semibold text-shark dark:text-white pt-4">{t('busFactor.sectionTitle')}</h3>
                <BusFactorCard busFactorAnalysis={displayData.busFactorAnalysis} />
              </>
            )}

            {/* 5. Área de Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Suspense fallback={<SkeletonChart />}>
                <CommitActivityChart
                  data={displayData.charts.activity}
                  createdAt={displayData.createdAt}
                  key={`chart-${displayData.fullName}`}
                />
              </Suspense>
              <Suspense fallback={<SkeletonChart />}>
                <TechStackChart data={displayData.charts.techStack} />
              </Suspense>
            </div>

            {/* 6. Padrões de Trabalho */}
            <Suspense fallback={<SkeletonChart />}>
              <WeekDaysChart commits={displayData.recentCommits} />
            </Suspense>

            {/* 7. Contribuições */}
            <ContributorsTable contributors={displayData.contributors} busFactor={displayData.busFactor} analysis={displayData.busFactorAnalysis} />

            {/* 8. Atividades Recentes */}
            <ActivityLogs commits={displayData.recentCommits} pullRequests={displayData.recentPRs} />

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
