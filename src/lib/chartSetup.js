// Chart.js registration is deliberately NOT imported eagerly here — it used
// to run at module scope, imported statically from main.jsx, which forced
// chart.js + chartjs-adapter-date-fns (and the date-fns it pulls in) into
// the critical path of every single page load, even when the page never
// renders a chart. ensureChartSetup() defers both the import and the
// registration until the first chart component actually needs them, and
// memoizes the promise so every lazy chart chunk shares one registration
// instead of re-importing/re-registering per component.
let registrationPromise = null;

export function ensureChartSetup() {
  if (!registrationPromise) {
    registrationPromise = Promise.all([
      import('chart.js'),
      import('chartjs-adapter-date-fns'),
    ]).then(([chartJs]) => {
      const {
        Chart: ChartJS,
        CategoryScale,
        LinearScale,
        PointElement,
        LineElement,
        BarElement,
        ArcElement,
        Title,
        TimeScale,
        Tooltip,
        Legend,
        Filler,
      } = chartJs;

      ChartJS.register(
        CategoryScale,
        LinearScale,
        PointElement,
        LineElement,
        BarElement,
        ArcElement,
        Title,
        Tooltip,
        Legend,
        Filler,
        TimeScale,
      );
    });
  }
  return registrationPromise;
}
