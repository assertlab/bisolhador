import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export function PartialDataAlert({ warnings }) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);

  if (!warnings || warnings.length === 0 || dismissed) return null;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 dark:bg-yellow-900/20 dark:border-yellow-700 dark:text-yellow-300 px-4 py-3 rounded-md flex items-center justify-between">
        <div className="flex items-center">
          <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="text-sm font-medium">{t('partialData.title')}</h3>
            <p className="text-sm mt-1">
              {t('partialData.message', { items: warnings.join(', ') })}
            </p>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="ml-4 text-yellow-400 hover:text-yellow-600 dark:text-yellow-500 dark:hover:text-yellow-300 transition-colors"
          aria-label={t('partialData.closeAlert')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
