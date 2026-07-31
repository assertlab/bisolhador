import { useState, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Lazy-loaded pages (Code Splitting) — same pattern already used for chart
// components. Pages use named exports, so map the module to the { default }
// shape React.lazy expects instead of changing their export style.
const Dashboard = lazy(() => import('./pages/Dashboard.jsx').then((m) => ({ default: m.Dashboard })));
const Ranking = lazy(() => import('./pages/Ranking.jsx').then((m) => ({ default: m.Ranking })));
const Timeline = lazy(() => import('./pages/Timeline.jsx').then((m) => ({ default: m.Timeline })));
const Benchmark = lazy(() => import('./pages/Benchmark.jsx').then((m) => ({ default: m.Benchmark })));

// Same full-page spinner already used by Ranking.jsx/Timeline.jsx for their
// own data-loading states — reused here, not a new pattern, for the brief
// wait while a route's chunk downloads.
function PageFallback() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-shark mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-slate-400">{t('app.loadingPage')}</p>
      </div>
    </div>
  );
}

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <Router basename={import.meta.env.BASE_URL}>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Dashboard isSettingsOpen={isSettingsOpen} setIsSettingsOpen={setIsSettingsOpen} />} />
          <Route path="/ranking" element={<Ranking isSettingsOpen={isSettingsOpen} setIsSettingsOpen={setIsSettingsOpen} />} />
          <Route path="/timeline/:owner/:repo" element={<Timeline isSettingsOpen={isSettingsOpen} setIsSettingsOpen={setIsSettingsOpen} />} />
          <Route path="/benchmark" element={<Benchmark isSettingsOpen={isSettingsOpen} setIsSettingsOpen={setIsSettingsOpen} />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
