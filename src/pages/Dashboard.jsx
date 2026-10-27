import { useMemo, useState, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Header } from '../components/Header';
import { SearchBar } from '../components/SearchBar';
import { RepoInfoCard } from '../components/RepoInfoCard';
import { StatCard } from '../components/StatCard';
import { HealthScoreCard } from '../components/HealthScoreCard';
import { MaturityCard } from '../components/MaturityCard';
import { BusFactorCard } from '../components/BusFactorCard';
import { AiProcessSection } from '../components/ai/AiProcessSection.jsx';
import { ContributorsTable } from '../components/ContributorsTable';
import { ActivityLogs } from '../components/ActivityLogs';
import { SettingsModal } from '../components/SettingsModal';
import { SkeletonDashboard } from '../components/skeletons/SkeletonDashboard.jsx';
import { SkeletonChart } from '../components/skeletons/SkeletonChart.jsx';
import { PartialDataAlert } from '../components/PartialDataAlert.jsx';
import { useRepository } from '../hooks/useRepository.js';
import { useSnapshot, getSnapshotParams } from '../hooks/useSnapshot.js';
import { ensureChartSetup } from '../lib/chartSetup.js';
import { SNAPSHOT_TIMEZONE } from '../constants.js';
import { formatters } from '../utils/formatters.js';
import { buildStatCards } from '../utils/dashboardCards.js';
import { intlLocale } from '../i18n.js';

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

// Card icons by id (the text is in utils/dashboardCards.js)
const CARD_ICON_PATHS = {
  leadTime: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  divergence: 'M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z',
  reviewCoverage: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  firstReview: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
  prSize: 'M4 6h16M4 12h10M4 18h6',
  ci: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  conventional: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z',
  releases: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
};
const CardIcon = ({ id }) => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={CARD_ICON_PATHS[id]}></path></svg>
);
const statCardProps = (card) => ({
  title: card.title,
  guideId: card.guideId,
  value: card.value,
  subValue: card.subValue,
  tooltipText: card.tooltip,
  icon: CARD_ICON_PATHS[card.id] ? <CardIcon id={card.id} /> : undefined,
});

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
  const locale = intlLocale(i18n.language);
  // The stat cards' text comes from utils/dashboardCards.js (shared with the PDF report)
  const cards = useMemo(() => (displayData ? buildStatCards(displayData, t, locale) : null), [displayData, t, locale]);

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
                              recordedAt: formatters.formatDateTime(displayData.analysisDate, intlLocale(i18n.language), SNAPSHOT_TIMEZONE),
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
            <RepoInfoCard data={displayData} onShareSuccess={handleShareSuccess} isSnapshot={isSnapshotUrl} />

            {/* 2. Grid de Métricas de Volume */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {cards.volume.map((card) => <StatCard key={card.id} {...statCardProps(card)} />)}
            </div>

            {/* 3. Grid de Dinâmica de Revisão */}
            <h3 className="text-lg font-semibold text-shark dark:text-white pt-4">{t('app.reviewDynamics')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cards.review.map((card) => <StatCard key={card.id} {...statCardProps(card)} />)}
            </div>

            {/* 3.5. Práticas do Projeto (REST público, sem token) */}
            <h3 className="text-lg font-semibold text-shark dark:text-white pt-4">{t('app.projectPractices')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {cards.practices.map((card) => <StatCard key={card.id} {...statCardProps(card)} />)}
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

            {/* 4.6. IA no Processo › Repositório */}
            <h3 className="text-lg font-semibold text-shark dark:text-white pt-4">{t('aiProcess.title')}</h3>
            <AiProcessSection aiProcess={displayData.aiProcess} />

            {/* 5. Área de Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Suspense fallback={<SkeletonChart />}>
                <CommitActivityChart
                  data={displayData.charts.activity}
                  status={displayData.charts.activityStatus}
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
              <WeekDaysChart weekdays={displayData.charts.weekdays} status={displayData.charts.weekdaysStatus} />
            </Suspense>

            {/* 7. Contribuições */}
            <ContributorsTable contributors={displayData.contributors} busFactor={displayData.busFactor} analysis={displayData.busFactorAnalysis} />

            {/* 8. Atividades Recentes */}
            <ActivityLogs commits={displayData.recentCommits} pullRequests={displayData.recentPRs} isSnapshot={isSnapshotUrl} />

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
