import { useState, useEffect, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import analytics from './services/analytics.js';
import { ToastContainer } from './components/Toast.jsx';
import { PageLoadingState } from './components/skeletons/PageLoadingState.jsx';
import i18n from './i18n.js';
import { loadLocale } from './lib/lazyLocales.js';

// Lazy-loaded pages (Code Splitting) — same pattern already used for chart
// components. Pages use named exports, so map the module to the { default }
// shape React.lazy expects instead of changing their export style.
const Dashboard = lazy(() => import('./pages/Dashboard.jsx').then((m) => ({ default: m.Dashboard })));
const Ranking = lazy(() => import('./pages/Ranking.jsx').then((m) => ({ default: m.Ranking })));
const Timeline = lazy(() => import('./pages/Timeline.jsx').then((m) => ({ default: m.Timeline })));
const Benchmark = lazy(() => import('./pages/Benchmark.jsx').then((m) => ({ default: m.Benchmark })));
// The guide pages also need their texts (src/lib/lazyLocales.js): fetched in parallel with the
// page chunk, fire-and-forget; useLazyLocale in the page waits for them and reports a failure.
const withTexts = (name, page) => {
  loadLocale(i18n, name).catch(() => {});
  return page();
};
const Guide = lazy(() => withTexts('guide', () => import('./pages/Guide.jsx')).then((m) => ({ default: m.Guide })));
const AiGuide = lazy(() => withTexts('aiGuide', () => import('./pages/AiGuide.jsx')).then((m) => ({ default: m.AiGuide })));
const Classroom = lazy(() => import('./pages/Classroom.jsx').then((m) => ({ default: m.Classroom })));

// Same full-page spinner already used by Ranking.jsx/Timeline.jsx for their
// own data-loading states — reused here, not a new pattern, for the brief
// wait while a route's chunk downloads.
function PageFallback() {
  const { t } = useTranslation();
  return <PageLoadingState message={t('app.loadingPage')} />;
}

// One pageview per route or query change (each search/class counts, as the
// Dashboard did); only the path is sent (analytics.pathOnlyLocation).
function RouteTracker() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    analytics.trackPageView(pathname);
  }, [pathname, search]);
  return null;
}

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <Router basename={import.meta.env.BASE_URL}>
      <RouteTracker />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Dashboard isSettingsOpen={isSettingsOpen} setIsSettingsOpen={setIsSettingsOpen} />} />
          <Route path="/ranking" element={<Ranking isSettingsOpen={isSettingsOpen} setIsSettingsOpen={setIsSettingsOpen} />} />
          <Route path="/timeline/:owner/:repo" element={<Timeline isSettingsOpen={isSettingsOpen} setIsSettingsOpen={setIsSettingsOpen} />} />
          <Route path="/benchmark" element={<Benchmark isSettingsOpen={isSettingsOpen} setIsSettingsOpen={setIsSettingsOpen} />} />
          <Route path="/guia" element={<Guide isSettingsOpen={isSettingsOpen} setIsSettingsOpen={setIsSettingsOpen} />} />
          <Route path="/guia/ia" element={<AiGuide isSettingsOpen={isSettingsOpen} setIsSettingsOpen={setIsSettingsOpen} />} />
          <Route path="/turma" element={<Classroom isSettingsOpen={isSettingsOpen} setIsSettingsOpen={setIsSettingsOpen} />} />
        </Routes>
      </Suspense>
      <ToastContainer />
    </Router>
  );
}

export default App;
