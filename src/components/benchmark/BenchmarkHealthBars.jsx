import { useTranslation } from 'react-i18next';

export function BenchmarkHealthBars({ repos }) {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6">
      <h4 className="text-md font-semibold text-shark dark:text-white mb-4">
        {t('benchmark.healthComparison', 'Health Score')}
      </h4>
      <div className="space-y-3">
        {repos.map((repo) => (
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
                <span className="font-semibold text-shark dark:text-white">
                  {repo.healthScore}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: `${repo.healthScore}%`,
                    backgroundColor: repo.color,
                  }}
                ></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
