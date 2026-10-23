import { useTranslation } from 'react-i18next';

// Which commits the contributor numbers count (shared by BusFactorCard and
// ContributorsTable, which use the same analysis).
export function ContributorsScope({ analysis }) {
  const { t } = useTranslation();
  if (!analysis?.window) return null; // snapshots saved before 2026-10 don't record it
  return (
    <p className="text-xs text-gray-500 dark:text-slate-400">
      {t(`contributors.scope.${analysis.partial ? 'allTimeOnly' : analysis.window}`)}
      {analysis.botsExcluded > 0 && ` · ${t('contributors.scope.botsExcluded', { count: analysis.botsExcluded })}`}
      {analysis.capped && ` · ${t('contributors.scope.capped')}`}
    </p>
  );
}
