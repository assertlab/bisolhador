import { Component } from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from './Header';
import { claimAutoReload, isChunkLoadError } from '../lib/chunkErrors.js';

function ErrorPage({ error, onSettingsClick }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col">
      <Header onSettingsClick={onSettingsClick} />
      <main className="flex-grow max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 space-y-4">
        <div role="alert" className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-md text-sm">
          {t(isChunkLoadError(error) ? 'errors.chunkLoad' : 'errors.pageCrash')}
        </div>
        <button type="button" onClick={() => window.location.reload()} className="px-4 py-2 bg-ocean text-white text-sm font-medium rounded-lg">
          {t('app.reload')}
        </button>
      </main>
    </div>
  );
}

/**
 * Around the routes: a page chunk that fails to load (hash gone after a deploy, network) or a render
 * crash used to leave a blank screen. Error boundaries can only be class components. A chunk error
 * reloads once on its own (the tab predates a deploy; claimAutoReload guards the loop); anything else,
 * or a second failure, shows the error with the header still there to navigate away. Remount it with a
 * new `key` per route so leaving the broken page clears the error.
 */
export class RouteErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[route] render failed:', error, info?.componentStack);
    if (isChunkLoadError(error) && claimAutoReload()) window.location.reload();
  }

  render() {
    if (this.state.error) return <ErrorPage error={this.state.error} onSettingsClick={this.props.onSettingsClick} />;
    return this.props.children;
  }
}
