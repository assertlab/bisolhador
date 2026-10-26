import { useTranslation } from 'react-i18next';
import { Header } from './Header';
import { SettingsModal } from './SettingsModal';
import { PageLoadingState } from './skeletons/PageLoadingState.jsx';

/**
 * What a page shows while its lazy locale bundle (useLazyLocale) isn't ready: the same spinner as
 * the route's chunk fallback while loading (so a cold load looks like one wait), or an error with
 * the header still there to navigate away.
 */
export function LazyTextsState({ status, isSettingsOpen, setIsSettingsOpen }) {
  const { t } = useTranslation();
  if (status !== 'error') return <PageLoadingState message={t('app.loadingPage')} />;
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col">
      <Header onSettingsClick={() => setIsSettingsOpen(true)} />
      <main className="flex-grow max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        <div role="alert" className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-md text-sm">
          {t('errors.lazyTexts')}
        </div>
      </main>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
