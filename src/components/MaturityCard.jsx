import { useTranslation } from 'react-i18next';
import { Tooltip } from './Tooltip.jsx';
import { ZOMBIE_BRANCH_DAYS, BRANCH_SCAN_MAX } from '../constants.js';

const BADGE_COLORS = { green: 'bg-green-500', yellow: 'bg-yellow-500', red: 'bg-red-500', gray: 'bg-gray-500' };

export function MaturityCard({ maturity, codeReview, branchAnalysis }) {
  const { t } = useTranslation();
  // Criteria only for data computed with them (snapshots before 2026-10 used the
  // first 20 branches, no exclusions).
  const zombieCriteria = branchAnalysis?.checked != null
    ? t('maturity.zombieCriteria', { checked: branchAnalysis.checked, days: ZOMBIE_BRANCH_DAYS })
      + (branchAnalysis.capped ? ` ${t('maturity.zombieCapped', { max: BRANCH_SCAN_MAX })}` : '')
    : null;
  const zombieCount = branchAnalysis?.capped ? `≥ ${maturity.zombies}` : maturity.zombies;
  // Só mostra a taxa quando ela foi de fato medida (ver prReviewStats.js);
  // snapshots antigos chegam aqui já normalizados como indisponíveis.
  const reviewAvailable = codeReview?.available === true;
  // Função auxiliar para renderizar badge: cor explícita, senão verde/cinza por `detected`
  const renderBadge = (text, detected, customColor, tooltip) => {
    const bgColor = BADGE_COLORS[customColor] ?? (detected ? 'bg-green-500' : 'bg-gray-500');
    const badge = (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold text-white ${bgColor}`}>
        {text}
      </span>
    );
    return tooltip ? <Tooltip text={tooltip}>{badge}</Tooltip> : badge;
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          {t('maturity.title')}
          <Tooltip text={t('maturity.tooltip')}>
            <svg className="w-4 h-4 text-gray-300 dark:text-slate-500 hover:text-gray-500 dark:hover:text-slate-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </Tooltip>
        </h3>
      </div>

      {/* Badges de Tecnologias */}
      <div className="flex flex-wrap gap-2 mb-4">
        {renderBadge(t('maturity.badges.tests'), maturity.testsDetected)}
        {renderBadge(t('maturity.badges.ciCd'), maturity.ciCdDetected)}
        {renderBadge(t('maturity.badges.docker'), maturity.dockerDetected)}
        {reviewAvailable
          ? renderBadge(t('maturity.badges.codeReview', { percentage: codeReview.selfMergePercentage }), true, codeReview.color)
          : renderBadge(t('maturity.badges.codeReviewUnavailable'), false, 'gray')
        }
        {maturity.zombies == null
          ? renderBadge(t('maturity.badges.zombiesUnavailable'), false, 'gray')
          : maturity.zombies === 0
          ? renderBadge(t('maturity.badges.noZombies'), true, 'green', zombieCriteria)
          : renderBadge(t('maturity.badges.zombies', { count: zombieCount }), true, 'red', zombieCriteria)
        }
      </div>

      {!reviewAvailable && (
        <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
          {t(`maturity.unavailable.${codeReview.reason}`, { defaultValue: t('maturity.unavailable.error') })}
        </p>
      )}

      {/* Alerta de Code Review */}
      {reviewAvailable && codeReview.selfMergePercentage > 0 && (
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                {t('maturity.alert.title')}
              </h3>
              <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                <p>
                  {t('maturity.alert.message', { percentage: codeReview.selfMergePercentage })}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
