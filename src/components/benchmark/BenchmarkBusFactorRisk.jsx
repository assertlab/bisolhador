import { useTranslation } from 'react-i18next';

export function BenchmarkBusFactorRisk({ repos }) {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6">
      <h4 className="text-md font-semibold text-shark dark:text-white mb-2">
        {t('benchmark.busFactorRisk', 'Risco Bus Factor')}
      </h4>
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
        {t('benchmark.busFactorDescription', 'Concentração de trabalho no principal contribuidor. Quanto maior, mais arriscado.')}
      </p>
      <div className="space-y-3">
        {repos.map((repo) => {
          const pct = repo.busFactorPercentage;
          let barColor = 'bg-green-500';
          let textBadge = 'text-green-700 dark:text-green-400';
          if (pct > 80) {
            barColor = 'bg-red-500';
            textBadge = 'text-red-700 dark:text-red-400';
          } else if (pct > 60) {
            barColor = 'bg-yellow-500';
            textBadge = 'text-yellow-700 dark:text-yellow-400';
          }

          return (
            <div key={repo.fullName} className="flex items-center gap-3">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: repo.color }}
              ></span>
              <div className="flex-grow">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700 dark:text-slate-300 truncate max-w-[200px]">
                    {repo.fullName}
                  </span>
                  <span className={`font-semibold ${textBadge}`}>
                    {pct > 0 ? `${pct}%` : 'N/A'}
                    {repo.busFactorTopContributor && pct > 0 && (
                      <span className="text-xs text-gray-400 dark:text-slate-500 ml-1">
                        ({repo.busFactorTopContributor})
                      </span>
                    )}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${barColor}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
