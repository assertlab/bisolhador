import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from './Tooltip.jsx';

const DEVELOPER_COLORS = [
  '#3b82f6', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#8b5cf6', '#ec4899', '#14b8a6',
];

const RISK_STYLES = {
  critical: { text: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
  high:     { text: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  moderate: { text: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
  healthy:  { text: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
};

export function BusFactorCard({ busFactorAnalysis }) {
  const { t } = useTranslation();

  const othersPercentage = useMemo(() => {
    if (!busFactorAnalysis?.keyDevelopers) return 0;
    const devTotal = busFactorAnalysis.keyDevelopers.reduce((sum, d) => sum + d.percentage, 0);
    return Math.round((100 - devTotal) * 10) / 10;
  }, [busFactorAnalysis]);

  if (!busFactorAnalysis || busFactorAnalysis.busFactor === 0) return null;

  const { busFactor, riskLevel, keyDevelopers } = busFactorAnalysis;
  const risk = RISK_STYLES[riskLevel] || RISK_STYLES.critical;

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow relative overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          {t('busFactor.title')}
          <Tooltip text={t('busFactor.tooltip')}>
            <svg className="w-4 h-4 text-gray-300 dark:text-slate-500 hover:text-gray-500 dark:hover:text-slate-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </Tooltip>
        </h3>
      </div>

      {/* Central Score */}
      <div className={`text-center py-4 ${risk.bg} rounded-lg mb-6`}>
        <div className={`text-5xl font-bold ${risk.text}`}>{busFactor}</div>
        <div className={`text-sm font-medium mt-1 ${risk.text}`}>
          {t(`busFactor.risk.${riskLevel}`)}
        </div>
        <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
          {t('busFactor.description', { count: busFactor })}
        </div>
      </div>

      {/* Key Developers */}
      <div className="flex flex-wrap gap-3 mb-4">
        {keyDevelopers.map((dev, i) => (
          <div key={dev.login} className="flex items-center gap-2">
            <img
              src={dev.avatar_url}
              alt={dev.login}
              className="w-8 h-8 rounded-full border-2"
              style={{ borderColor: DEVELOPER_COLORS[i % DEVELOPER_COLORS.length] }}
            />
            <div className="text-xs">
              <div className="font-medium text-gray-900 dark:text-white">{dev.login}</div>
              <div className="text-gray-500 dark:text-slate-400">{dev.percentage}%</div>
            </div>
          </div>
        ))}
      </div>

      {/* Stacked Bar */}
      <div className="flex h-4 rounded-full overflow-hidden bg-gray-200 dark:bg-slate-600">
        {keyDevelopers.map((dev, i) => (
          <div
            key={dev.login}
            className="h-full"
            style={{
              width: `${dev.percentage}%`,
              backgroundColor: DEVELOPER_COLORS[i % DEVELOPER_COLORS.length],
            }}
            title={`${dev.login}: ${dev.percentage}%`}
          />
        ))}
        {othersPercentage > 0 && (
          <div
            className="h-full bg-gray-300 dark:bg-slate-500"
            style={{ width: `${othersPercentage}%` }}
            title={`${t('busFactor.others')}: ${othersPercentage}%`}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3">
        {keyDevelopers.map((dev, i) => (
          <div key={dev.login} className="flex items-center gap-1 text-xs text-gray-600 dark:text-slate-400">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: DEVELOPER_COLORS[i % DEVELOPER_COLORS.length] }}
            />
            {dev.login}
          </div>
        ))}
        {othersPercentage > 0 && (
          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full inline-block bg-gray-300 dark:bg-slate-500" />
            {t('busFactor.others')}
          </div>
        )}
      </div>
    </div>
  );
}
