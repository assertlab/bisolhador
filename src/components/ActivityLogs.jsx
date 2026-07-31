import { useTranslation } from 'react-i18next';
import { Tooltip } from './Tooltip.jsx';
import { formatters } from '../utils/formatters.js';

export function ActivityLogs({ commits, pullRequests }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'pt' ? 'pt-BR' : 'en-US';

  const formatDate = (dateString) => formatters.formatDateLong(dateString, locale);

  // Função para determinar cor do badge do PR
  const getPRBadge = (state, merged) => {
    if (merged) return { text: t('activity.prStates.merged'), color: 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200' };
    if (state === 'open') return { text: t('activity.prStates.open'), color: 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200' };
    return { text: t('activity.prStates.closed'), color: 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200' };
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          {t('activity.title')}
          <Tooltip text={t('activity.tooltip')}>
            <svg className="w-4 h-4 text-gray-300 dark:text-slate-500 hover:text-gray-500 dark:hover:text-slate-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </Tooltip>
        </h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Últimos Commits */}
        <div>
          <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">{t('activity.sections.commits')}</h4>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {commits.slice(0, 10).map((commit, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700">
                <img
                  className="w-8 h-8 rounded-full"
                  src={commit.author?.avatar_url || commit.committer?.avatar_url}
                  alt=""
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white truncate">
                    <a
                      href={commit.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ocean hover:underline"
                    >
                      {commit.commit.message.split('\n')[0]}
                    </a>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {t('activity.commitBy', { author: commit.commit.author.name, date: formatDate(commit.commit.author.date) })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Últimos PRs */}
        <div>
          <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">{t('activity.sections.pullRequests')}</h4>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {pullRequests.slice(0, 10).map((pr, index) => {
              const badge = getPRBadge(pr.state, pr.merged_at);
              return (
                <div key={index} className="flex items-start space-x-3 p-3 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-white">
                      <a
                        href={pr.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-ocean hover:underline"
                      >
                        {pr.title}
                      </a>
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
                        {badge.text}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-slate-400">
                        {formatDate(pr.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
