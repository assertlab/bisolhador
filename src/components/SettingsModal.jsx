import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export function SettingsModal({ isOpen, onClose }) {
  const { t } = useTranslation();
  const [token, setToken] = useState(() => localStorage.getItem('github_token') || '');
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSave = () => {
    if (token.trim() === '') {
      localStorage.removeItem('github_token');
    } else {
      localStorage.setItem('github_token', token.trim());
    }
    setShowSuccess(true);

    // Fechar modal após 2 segundos
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  const handleCancel = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('settings.title')}
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
            {t('settings.description')}
          </p>

          <div className="mb-4">
            <label htmlFor="token" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              {t('settings.tokenLabel')}
            </label>
            <input
              type="password"
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={t('settings.tokenPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-ocean focus:border-ocean"
            />
          </div>

          {showSuccess && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-md">
              <p className="text-sm text-green-800 dark:text-green-200">
                {t('settings.successMessage')}
              </p>
            </div>
          )}

          <div className="text-xs text-gray-500 dark:text-slate-400">
            <p>
              {t('settings.createToken.text')}{' '}
              <a
                href={`https://${t('settings.createToken.link')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ocean hover:underline"
              >
                {t('settings.createToken.link')}
              </a>
            </p>
            <p className="mt-1">
              {t('settings.warning')}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-end space-x-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            {t('settings.buttons.cancel')}
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-ocean border border-transparent rounded-md hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ocean"
          >
            {t('settings.buttons.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
