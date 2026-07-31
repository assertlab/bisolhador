// Pulsing placeholder for a single chart. Two contexts need this differently:
// - Dashboard.jsx uses it as a Suspense fallback standing in for a whole
//   lazy-loaded chart component, which normally renders its own card + title
//   (default: full card with a title bar placeholder).
// - Timeline.jsx already renders its own card/title/filter row around the
//   chart area and only needs the inner pulsing rectangle while chartReady
//   is false (bare: true — no card, no title bar).
export function SkeletonChart({ bare = false }) {
  const pulse = (
    <div
      className={
        bare
          ? 'bg-gray-100 dark:bg-slate-700 rounded animate-pulse h-full w-full'
          : 'flex-grow bg-gray-100 dark:bg-slate-700 rounded animate-pulse'
      }
    ></div>
  );

  if (bare) return pulse;

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6 flex flex-col h-80 hover:shadow-md transition-shadow relative overflow-visible hover:z-50">
      <div className="h-5 bg-gray-200 dark:bg-slate-600 rounded animate-pulse mb-4 w-40"></div>
      {pulse}
    </div>
  );
}
