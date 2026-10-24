import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { Line } from "react-chartjs-2";
import { Header } from "../components/Header";
import { SettingsModal } from "../components/SettingsModal";
import { PageLoadingState } from "../components/skeletons/PageLoadingState.jsx";
import { TimelineErrorState } from "../components/TimelineErrorState.jsx";
import { SkeletonChart } from "../components/skeletons/SkeletonChart.jsx";
import analytics from "../services/analytics.js";
import useChartTheme from "../hooks/useChartTheme";
import { createBaseChartOptions } from "../lib/chartDefaults";
import { useTimeFilter } from "../hooks/useTimeFilter";
import { TimeRangeFilter } from "../components/TimeRangeFilter";
import { useState, useMemo, useEffect } from "react";
import { ensureChartSetup } from "../lib/chartSetup.js";
import { formatters } from "../utils/formatters.js";
import { toTimelinePoints, growth } from "../utils/timelineData.js";
import { githubService } from "../services/githubService.js";
import { SNAPSHOT_TIMEZONE } from "../constants.js";
import { intlLocale } from '../i18n.js';

export function Timeline({ isSettingsOpen, setIsSettingsOpen }) {
  const { t, i18n } = useTranslation();
  const locale = intlLocale(i18n.language);
  const { owner, repo } = useParams();
  const navigate = useNavigate();
  const chartTheme = useChartTheme();
  const repoFullName = `${owner}/${repo}`;
  const [timeRange, setTimeRange] = useState("all");

  // Unlike Dashboard/Benchmark, this page's <Line> isn't behind its own
  // React.lazy() wrapper, so nothing else guarantees chart.js has been
  // registered by the time it mounts — Timeline can be the very first
  // chart-rendering page a visitor hits (e.g. a shared permalink). Without
  // this gate, react-chartjs-2 throws ("category" is not a registered
  // scale) because ensureChartSetup() was never called. This also doubles
  // as the same prefetch pattern used elsewhere: it fires on mount, in
  // parallel with the history fetch below, instead of waiting for chart
  // mount to trigger it.
  const [chartReady, setChartReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    ensureChartSetup()
      .then(() => { if (!cancelled) setChartReady(true); })
      .catch((err) => console.warn('[Timeline] Chart.js setup failed:', err));
    return () => { cancelled = true; };
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["timeline", repoFullName],
    queryFn: async () => {
      // Renamed repos: rows before the rename are under the old name
      // (facebook/react), newer ones under the canonical one (react/react).
      // GitHub resolves either to the canonical name; if that lookup fails,
      // the route name alone still works.
      const canonical = await githubService.fetchRepository(owner, repo).then((r) => r?.full_name).catch(() => null);
      const names = [...new Set([repoFullName, canonical].filter(Boolean).map((n) => n.toLowerCase()))];
      const histories = await Promise.all(names.map((name) => analytics.getRepoHistory(name)));
      const points = toTimelinePoints(histories.flat().filter(Boolean));

      if (points.length === 0) {
        throw new Error(t("timeline.error.noData"));
      }
      return points;
    },
    retry: 1,
  });

  const filteredData = useTimeFilter(data, timeRange);

  const starsGrowth = useMemo(() => growth(filteredData, "stars"), [filteredData]);

  const chartData = useMemo(() => {
    if (!filteredData) return null;
    // {x: date, y} on a time axis: spacing follows real time; null = gap.
    const series = (key) => filteredData.map((point) => ({ x: point.date, y: point[key] }));
    return {
      datasets: [
        {
          label: t("timeline.metrics.stars"),
          data: series("stars"),
          spanGaps: true,
          borderColor: "#FFD700",
          backgroundColor: "rgba(255, 215, 0, 0.1)",
          tension: 0.4,
          fill: true,
        },
        {
          label: t("timeline.metrics.forks"),
          data: series("forks"),
          spanGaps: true,
          borderColor: "#3B82F6",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          tension: 0.4,
          fill: true,
        },
        {
          label: t("timeline.metrics.subscribers"),
          data: series("subscribers"),
          spanGaps: true,
          borderColor: "#10B981",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          tension: 0.4,
          fill: true,
        },
      ],
    };
  }, [filteredData, t]);

  const chartOptions = useMemo(
    () =>
      createBaseChartOptions(chartTheme, {
        plugins: {
          legend: {
            labels: { font: { size: 12, family: "Inter, sans-serif" } },
          },
          tooltip: {
            mode: "index",
            intersect: false,
            titleFont: { size: 13, weight: "bold" },
            bodyFont: { size: 12 },
            callbacks: {
              title: (items) => (items[0] ? formatters.formatDateShort(items[0].parsed.x, locale, SNAPSHOT_TIMEZONE) : ""),
            },
          },
        },
        scales: {
          x: {
            type: "time",
            time: { unit: "day" },
            grid: { drawBorder: false },
            // date-fns would print English month names ("MMM dd")
            ticks: { font: { size: 11 }, maxRotation: 45, minRotation: 0, callback: (value) => formatters.formatDateShort(value, locale, SNAPSHOT_TIMEZONE) },
          },
          y: {
            grid: { drawBorder: false },
            ticks: { font: { size: 11 } },
          },
        },
        interaction: { mode: "nearest", axis: "x", intersect: false },
      }),
    [chartTheme, locale],
  );

  const handleBack = () => {
    navigate("/");
  };

  if (isLoading) {
    return <PageLoadingState message={t("timeline.loading")} />;
  }

  if (error) {
    return (
      <TimelineErrorState
        title={t("timeline.error.title")}
        message={error.message}
        backButtonLabel={t("timeline.backButton")}
        onBack={handleBack}
        isSettingsOpen={isSettingsOpen}
        setIsSettingsOpen={setIsSettingsOpen}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col">
      <Header onSettingsClick={() => setIsSettingsOpen(true)} />

      <div className="flex-grow py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header Section */}
          <div className="mb-8">
            <button
              onClick={handleBack}
              className="inline-flex items-center text-shark dark:text-white hover:text-ocean dark:hover:text-blue-400 transition-colors mb-4"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              {t("timeline.backButton")}
            </button>

            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold text-shark dark:text-white">
                <span aria-hidden="true">📈</span> {t("timeline.title")}
              </h1>
            </div>

            <p className="text-gray-600 dark:text-slate-400">
              {t("timeline.subtitle", { repo: repoFullName })}
            </p>

            {data && data.length > 0 && (
              <div className="mt-4 inline-flex items-center px-3 py-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-full">
                <svg
                  className="w-4 h-4 text-blue-600 dark:text-blue-400 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  {t("timeline.dataPointsDays", { count: data.length })}
                </span>
              </div>
            )}
          </div>

          {/* Chart Section */}
          {chartData && (
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
                <h2 className="text-lg font-semibold text-shark dark:text-white">
                  {t("timeline.chartTitle")}
                </h2>

                {/* Time Range Filter */}
                <TimeRangeFilter
                  currentRange={timeRange}
                  onRangeChange={setTimeRange}
                  i18nPrefix="timeline"
                />
              </div>

              {chartReady ? (
                <div style={{ height: "400px" }}>
                  <Line data={chartData} options={chartOptions} />
                </div>
              ) : (
                <div style={{ height: "400px" }}>
                  <SkeletonChart bare />
                </div>
              )}
            </div>
          )}

          {/* Stats Summary */}
          {filteredData && filteredData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-slate-400">
                      {t("timeline.summary.firstAnalysis")}
                    </p>
                    <p className="text-lg font-semibold text-shark dark:text-white mt-1">
                      {formatters.formatDateShort(filteredData[0].date, locale, SNAPSHOT_TIMEZONE)}
                    </p>
                  </div>
                  <svg
                    className="w-8 h-8 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-slate-400">
                      {t("timeline.summary.latestAnalysis")}
                    </p>
                    <p className="text-lg font-semibold text-shark dark:text-white mt-1">
                      {formatters.formatDateShort(filteredData[filteredData.length - 1].date, locale, SNAPSHOT_TIMEZONE)}
                    </p>
                  </div>
                  <svg
                    className="w-8 h-8 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-slate-400">
                      {t("timeline.summary.totalGrowth")}
                    </p>
                    <p className={`text-lg font-semibold mt-1 ${starsGrowth?.delta < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                      {starsGrowth == null
                        ? "N/A"
                        : `${starsGrowth.delta > 0 ? "+" : ""}${formatters.formatNumber(starsGrowth.delta, locale)} ⭐`}
                    </p>
                  </div>
                  <svg
                    className="w-8 h-8 text-green-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                    />
                  </svg>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
