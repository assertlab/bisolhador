import { useTranslation } from 'react-i18next';
import { exportToCsv } from '../../utils/csvExporter.js';

export function BenchmarkDetailTable({ repos }) {
  const { t } = useTranslation();

  const handleExportCsv = () => {
    const rows = repos.map((repo) => {
      let riskLabel = t('benchmark.riskLow', 'Low');
      if (repo.busFactorPercentage > 80) {
        riskLabel = t('benchmark.riskCritical', 'Critical');
      } else if (repo.busFactorPercentage > 60) {
        riskLabel = t('benchmark.riskModerate', 'Moderate');
      }

      return {
        [t('benchmark.tableRepo')]: repo.fullName,
        [t('benchmark.healthComparison')]: `${repo.healthScore}%`,
        [t('stats.leadTime')]: repo.leadTime > 0
          ? `${repo.leadTime} ${t('units.' + repo.leadTimeUnit, repo.leadTimeUnit)}`
          : 'N/A',
        [t('stats.divergence')]: repo.divergence > 0 ? repo.divergence.toFixed(1) : 'N/A',
        [t('stats.codeChurn')]: repo.codeChurnRatio > 0 ? repo.codeChurnRatio.toFixed(2) : 'N/A',
        [t('benchmark.busFactorRisk')]: repo.busFactorPercentage > 0
          ? `${repo.busFactorPercentage}% — ${riskLabel}`
          : 'N/A',
      };
    });

    exportToCsv('bisolhador-benchmark.csv', rows);
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-md font-semibold text-shark dark:text-white">
          {t('benchmark.detailTable', 'Tabela Comparativa')}
        </h4>
        <button
          onClick={handleExportCsv}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg border border-emerald-600 hover:border-emerald-700 focus:ring-4 focus:ring-emerald-300 transition-colors"
          title={t('button.csvBenchmarkTitle')}
        >
          <svg aria-hidden="true" className="w-3.5 h-3.5 inline mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
          </svg>
          {t('button.csvExport')}
        </button>
      </div>
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
