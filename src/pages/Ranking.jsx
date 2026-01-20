import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchLeaderboard } from '../services/leaderboardService.js';
import { Header } from '../components/Header';
import { SettingsModal } from '../components/SettingsModal';

export function Ranking({ isSettingsOpen, setIsSettingsOpen }) {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => fetchLeaderboard(50),
  });

  const getHealthBadge = (score) => {
    if (score > 80) return { emoji: '🟢', grade: 'A' };
    if (score >= 50) return { emoji: '🟡', grade: 'B' };
    return { emoji: '🔴', grade: 'C' };
  };

  const getPositionDisplay = (position) => {
    if (position === 1) return '🥇 1º';
    if (position === 2) return '🥈 2º';
    if (position === 3) return '🥉 3º';
    return `${position}º`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-shark mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-slate-400">{t('ranking.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{t('ranking.error')}</p>
          <p className="text-gray-600 dark:text-slate-400">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col">
      <Header onSettingsClick={() => setIsSettingsOpen(true)} />

      <div className="flex-grow py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-shark dark:text-white mb-2">
              <span aria-hidden="true">🏆</span> {t('ranking.title')}
            </h1>
            <p className="text-gray-600 dark:text-slate-400">
              {t('ranking.subtitle')}
            </p>
          </div>

        {data && data.length > 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-slate-700">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                      {t('ranking.columns.position')}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                      {t('ranking.columns.repository')}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                      {t('ranking.columns.language')}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                      {t('ranking.columns.health')}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                      {t('ranking.columns.stars')}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                      {t('ranking.columns.searches')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                  {data.map((item, index) => {
                    const position = index + 1;
                    const health = getHealthBadge(item.health_score);
                    return (
                      <tr key={item.repo_name} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          <span aria-label={`${t('ranking.ariaLabels.position')} ${position}`}>
                            {getPositionDisplay(position)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <a
                            href={`https://github.com/${item.repo_name}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {item.repo_name}
                          </a>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-600 text-gray-800 dark:text-slate-200">
                            {item.language || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium">
                            {health.emoji} {health.grade}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          <span aria-label={`${item.stars} ${t('ranking.ariaLabels.stars')}`}>
                            ⭐ {item.stars?.toLocaleString() || 0}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {item.total_buscas}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-400 dark:text-slate-500 mb-4">
              <svg aria-hidden="true" className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {t('ranking.empty.title')}
            </h3>
            <p className="text-gray-500 dark:text-slate-400">
              {t('ranking.empty.message')}
            </p>
          </div>
        )}
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
