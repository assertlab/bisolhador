import { Component, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from './Header';
import { SettingsModal } from './SettingsModal';
import analytics from '../services/analytics.js';
import { claimAutoReload, isChunkLoadError } from '../lib/chunkErrors.js';

// Self-contained: the settings modal normally lives inside each page, which is gone here, and a
// rate-limit or token problem is exactly when someone needs it.
function ErrorPage({ error }) {
  const { t } = useTranslation();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col">
      <Header onSettingsClick={() => setIsSettingsOpen(true)} />
      <main className="flex-grow max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 space-y-4">
        <div role="alert" className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-md text-sm">
          {t(isChunkLoadError(error) ? 'errors.chunkLoad' : 'errors.pageCrash')}
        </div>
        <button type="button" onClick={() => window.location.reload()} className="px-4 py-2 bg-ocean text-white text-sm font-medium rounded-lg">
          {t('app.reload')}
        </button>
      </main>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}

/**
 * Around the routes: a page chunk that fails to load (hash gone after a deploy, network) or a render
 * crash used to leave a blank screen. Error boundaries can only be class components. A chunk error
 * reloads once on its own (the tab predates a deploy; claimAutoReload guards the loop and offline);
 * anything else, or a second failure, shows the error with the header still there to navigate away.
 * `resetKey` (the path) clears the error when the route changes. Note that React.lazy keeps a rejected
 * import rejected: coming back to the same broken page fails again until a reload, which the button does.
 */
export class RouteErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[route] render failed:', error, info?.componentStack);
    const chunk = isChunkLoadError(error);
    analytics.trackRouteError(chunk ? 'chunk' : 'render');
    if (chunk && claimAutoReload()) window.location.reload();
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (this.state.error) return <ErrorPage error={this.state.error} />;
    return this.props.children;
  }
}
