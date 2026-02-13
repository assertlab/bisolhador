import { useTranslation } from 'react-i18next';

export function BenchmarkDetailTable({ repos }) {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6">
      <h4 className="text-md font-semibold text-shark dark:text-white mb-4">
        {t('benchmark.detailTable', 'Tabela Comparativa')}
      </h4>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
          <thead className="bg-gray-50 dark:bg-slate-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                {t('benchmark.tableRepo', 'Repositório')}
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                {t('benchmark.healthComparison', 'Health Score')}
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                {t('stats.leadTime', 'Lead Time')}
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                {t('stats.divergence', 'Divergência')}
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                {t('stats.codeChurn', 'Code Churn')}
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                {t('benchmark.busFactorRisk', 'Risco Bus Factor')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
            {repos.map((repo) => {
              let riskBadge = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
              let riskLabel = t('benchmark.riskLow', 'Baixo');
              if (repo.busFactorPercentage > 80) {
                riskBadge = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
                riskLabel = t('benchmark.riskCritical', 'Crítico');
              } else if (repo.busFactorPercentage > 60) {
                riskBadge = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
                riskLabel = t('benchmark.riskModerate', 'Moderado');
              }

              return (
                <tr key={repo.fullName} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: repo.color }}
                      ></span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {repo.fullName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-700 dark:text-slate-300">
                    {repo.healthScore}%
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-700 dark:text-slate-300">
                    {repo.leadTime > 0
                      ? `${repo.leadTime} ${t('units.' + repo.leadTimeUnit, repo.leadTimeUnit)}`
                      : 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-700 dark:text-slate-300">
                    {repo.divergence > 0 ? repo.divergence.toFixed(1) : 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-700 dark:text-slate-300">
                    {repo.codeChurnRatio > 0 ? repo.codeChurnRatio.toFixed(2) : 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${riskBadge}`}>
                      {repo.busFactorPercentage > 0 ? `${repo.busFactorPercentage}% — ${riskLabel}` : 'N/A'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
