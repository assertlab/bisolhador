import { useTranslation } from 'react-i18next';

export function BenchmarkRepoChips({ selectedRepos, onRemoveRepo }) {
  const { t } = useTranslation();

  if (selectedRepos.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">
        {t('benchmark.selectedRepos', 'Repositórios Selecionados')}
      </h3>
      <div className="flex flex-wrap gap-2">
        {selectedRepos.map((repo) => (
          <div
            key={repo.fullName}
            className="inline-flex items-center gap-2 bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-full px-3 py-1.5 text-sm"
          >
            {/* Color Dot */}
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: repo.color }}
              aria-hidden="true"
            ></span>

            {/* Repo Name */}
            <span className="font-medium text-gray-700 dark:text-slate-200">
              {repo.fullName}
            </span>

            {/* Remove Button */}
            <button
              onClick={() => onRemoveRepo(repo.fullName)}
              className="ml-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              aria-label={`Remover ${repo.fullName}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
