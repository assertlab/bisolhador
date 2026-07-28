import { useTranslation } from 'react-i18next';

export function BenchmarkSearchForm({ searchInput, setSearchInput, onSubmit, isChecking }) {
  const { t } = useTranslation();

  return (
    <div className="w-full pt-4">
      <form onSubmit={onSubmit} className="w-full max-w-3xl mx-auto">
        <label htmlFor="benchmark-search" className="mb-2 text-sm font-medium text-gray-900 dark:text-white sr-only">
          {t('benchmark.searchLabel', 'Adicionar repositório')}
        </label>
        <div className="relative">
          {/* Search Icon */}
          <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none">
            <svg className="w-5 h-5 text-gray-400" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
            </svg>
          </div>

          {/* Input */}
          <input
            type="search"
            id="benchmark-search"
            className="block w-full p-4 ps-12 text-sm text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 focus:ring-ocean focus:border-ocean outline-none shadow-sm transition-shadow placeholder-gray-400 dark:placeholder-slate-400"
            placeholder={t('benchmark.searchPlaceholder', 'Ex: facebook/react, microsoft/vscode...')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            required
            disabled={isChecking}
          />

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isChecking}
            className="text-white absolute end-2.5 bottom-2.5 bg-ocean dark:bg-sky-600 hover:bg-sky-600 dark:hover:bg-sky-700 focus:ring-4 focus:outline-none focus:ring-sky-300 font-medium rounded-lg text-sm px-5 py-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isChecking ? (
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              t('benchmark.addButton', 'Adicionar')
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
