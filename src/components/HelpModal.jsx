
import { useTranslation, Trans } from 'react-i18next';

export function HelpModal({ isOpen, onClose }) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('help.title')}
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">{t('help.about.title')}</h3>
            <p className="text-sm text-gray-600 dark:text-slate-400">
              {t('help.about.description')}
            </p>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">{t('help.token.title')}</h3>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-3">
              {t('help.token.description')}
            </p>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded p-3">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>{t('help.token.warning.important')}</strong> {t('help.token.warning.message')}
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">{t('help.createToken.title')}</h3>
            <ol className="text-sm text-gray-600 dark:text-slate-400 space-y-1 list-decimal list-inside">
              {t('help.createToken.steps', { returnObjects: true }).map((step, index) => (
                <li key={index}>
                  <Trans
                    i18nKey={`help.createToken.steps.${index}`}
                    components={{
                      link: <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-ocean hover:underline" />
                    }}
                  />
                </li>
              ))}
            </ol>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">{t('help.usage.title')}</h3>
            <ol className="text-sm text-gray-600 dark:text-slate-400 space-y-1 list-decimal list-inside">
              {t('help.usage.steps', { returnObjects: true }).map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-ocean border border-transparent rounded-md hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ocean"
          >
            {t('help.button.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
