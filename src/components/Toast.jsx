import { useTranslation } from 'react-i18next';
import { useToast } from '../hooks/useToast';

const TOAST_STYLES = {
  error: {
    container: 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300',
    icon: 'text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-300',
  },
  success: {
    container: 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300',
    icon: 'text-green-400 hover:text-green-600 dark:text-green-500 dark:hover:text-green-300',
  },
  warning: {
    container: 'bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-900/20 dark:border-yellow-700 dark:text-yellow-300',
    icon: 'text-yellow-400 hover:text-yellow-600 dark:text-yellow-500 dark:hover:text-yellow-300',
  },
};

export function ToastContainer() {
  const { t } = useTranslation();
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm px-4 sm:px-0">
      {toasts.map((toast) => {
        const style = TOAST_STYLES[toast.type];
        return (
          <div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : 'status'}
            aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
            className={`border px-4 py-3 rounded-md shadow-lg flex items-center justify-between ${style.container}`}
          >
            <p className="text-sm mr-3">{toast.message}</p>
            <button
              onClick={() => dismissToast(toast.id)}
              className={`flex-shrink-0 transition-colors ${style.icon}`}
              aria-label={t('toast.close')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
