import { useTranslation } from 'react-i18next';
import { Tooltip } from './Tooltip.jsx';

export function HealthScoreCard({ score, files, reason }) {
  const { t } = useTranslation();
  // null = not measured (no community profile / request failed): n/d, not 0%.
  const unavailable = score === null || score === undefined || !files;
  // Determinar cor baseada no score
  let scoreColor;
  let bgColor;
  if (unavailable) {
    scoreColor = 'text-gray-500 dark:text-slate-400';
    bgColor = 'bg-gray-50 dark:bg-slate-700/40';
  } else if (score >= 75) {
    scoreColor = 'text-green-600';
    bgColor = 'bg-green-50 dark:bg-green-900/20';
  } else if (score >= 50) {
    scoreColor = 'text-yellow-600';
    bgColor = 'bg-yellow-50 dark:bg-yellow-900/20';
  } else {
    scoreColor = 'text-red-600';
    bgColor = 'bg-red-50 dark:bg-red-900/20';
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          {t('health.title')}
          <Tooltip text={t('health.tooltip')}>
            <svg className="w-4 h-4 text-gray-300 dark:text-slate-500 hover:text-gray-500 dark:hover:text-slate-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </Tooltip>
        </h3>
      </div>

      {/* Score Central */}
      <div className={`text-center py-6 ${bgColor} rounded-lg mb-6`}>
        <div className={`text-5xl font-bold ${scoreColor}`}>
          {unavailable ? t('health.notAvailable') : `${score}%`}
        </div>
        <div className="text-sm text-gray-600 dark:text-slate-400 mt-1">{t('health.communityHealth')}</div>
      </div>

      {unavailable && (
        <p className="text-sm text-gray-600 dark:text-slate-400">
          {t(`health.unavailable.${reason}`, { defaultValue: t('health.unavailable.error') })}
        </p>
      )}

      {/* Checklist Grid */}
      {!unavailable && (
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2 text-sm">
          {files.hasReadme ? '✅' : '❌'}
          <span className={files.hasReadme ? 'text-green-600' : 'text-red-600'}>
            {t('health.files.readme')}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {files.hasLicense ? '✅' : '❌'}
          <span className={files.hasLicense ? 'text-green-600' : 'text-red-600'}>
            {t('health.files.license')}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {files.hasContributing ? '✅' : '❌'}
          <span className={files.hasContributing ? 'text-green-600' : 'text-red-600'}>
            {t('health.files.contributing')}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {files.hasDescription ? '✅' : '❌'}
          <span className={files.hasDescription ? 'text-green-600' : 'text-red-600'}>
            {t('health.files.description')}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {files.hasCodeOfConduct ? '✅' : '❌'}
          <span className={files.hasCodeOfConduct ? 'text-green-600' : 'text-red-600'}>
            {t('health.files.codeOfConduct')}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {files.hasIssueTemplate ? '✅' : '❌'}
          <span className={files.hasIssueTemplate ? 'text-green-600' : 'text-red-600'}>
            {t('health.files.issueTemplate')}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm col-span-2">
          {files.hasPullRequestTemplate ? '✅' : '❌'}
          <span className={files.hasPullRequestTemplate ? 'text-green-600' : 'text-red-600'}>
            {t('health.files.prTemplate')}
          </span>
        </div>
      </div>
      )}
    </div>
  );
}
