import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { Line } from "react-chartjs-2";
import { Header } from "../components/Header";
import { SettingsModal } from "../components/SettingsModal";
import analytics from "../services/analytics.js";
import useChartTheme from "../hooks/useChartTheme";
import { createBaseChartOptions } from "../lib/chartDefaults";
import { useState, useMemo } from "react";

export function Timeline({ isSettingsOpen, setIsSettingsOpen }) {
  const { t, i18n } = useTranslation();
  const { owner, repo } = useParams();
  const navigate = useNavigate();
  const chartTheme = useChartTheme();
  const repoFullName = `${owner}/${repo}`;
  const [timeRange, setTimeRange] = useState("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["timeline", repoFullName],
    queryFn: async () => {
      const history = await analytics.getRepoHistory(repoFullName);

      if (!history || history.length === 0) {
        throw new Error(t("timeline.error.noData"));
      }

      // Processar dados do histórico
      const processedData = history.map((snapshot) => {
        let reportData = null;

        // Parse do full_report se for string
        if (snapshot.full_report) {
          try {
            reportData =
              typeof snapshot.full_report === "string"
                ? JSON.parse(snapshot.full_report)
                : snapshot.full_report;
          } catch (e) {
            console.warn("[Timeline] Failed to parse full_report:", e);
          }
        }

        return {
          date: new Date(snapshot.created_at),
          stars: reportData?.metrics?.stars || 0,
          forks: reportData?.metrics?.forks || 0,
          subscribers: reportData?.subscribers || 0,
          healthScore: reportData?.health?.score || 0,
          openIssues: reportData?.metrics?.openIssues || 0,
        };
      });

      return processedData;
    },
    retry: 1,
  });

  // Filtra dados baseado no timeRange selecionado
  const filteredData = useMemo(() => {
    if (!data || timeRange === "all") return data;

    const now = new Date();
    const cutoffDate = new Date();

    switch (timeRange) {
      case "7d":
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case "30d":
        cutoffDate.setDate(now.getDate() - 30);
        break;
      case "60d":
        cutoffDate.setDate(now.getDate() - 60);
        break;
      case "90d":
        cutoffDate.setDate(now.getDate() - 90);
        break;
      default:
        return data;
    }

    return data.filter((point) => point.date >= cutoffDate);
  }, [data, timeRange]);

  const chartData = useMemo(() => {
    if (!filteredData) return null;
    return {
      labels: filteredData.map((point) =>
        new Intl.DateTimeFormat(i18n.language === "pt" ? "pt-BR" : "en-US", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }).format(point.date),
      ),
      datasets: [
        {
          label: t("timeline.metrics.stars"),
          data: filteredData.map((point) => point.stars),
          borderColor: "#FFD700",
          backgroundColor: "rgba(255, 215, 0, 0.1)",
          tension: 0.4,
          fill: true,
        },
        {
          label: t("timeline.metrics.forks"),
          data: filteredData.map((point) => point.forks),
          borderColor: "#3B82F6",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          tension: 0.4,
          fill: true,
        },
        {
          label: t("timeline.metrics.subscribers"),
          data: filteredData.map((point) => point.subscribers),
          borderColor: "#10B981",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          tension: 0.4,
          fill: true,
        },
      ],
    };
  }, [filteredData, i18n.language, t]);

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
          },
        },
        scales: {
          x: {
            grid: { drawBorder: false },
            ticks: { font: { size: 11 }, maxRotation: 45, minRotation: 45 },
          },
          y: {
            grid: { drawBorder: false },
            ticks: { font: { size: 11 } },
          },
        },
        interaction: { mode: "nearest", axis: "x", intersect: false },
      }),
    [chartTheme],
  );

  const handleBack = () => {
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-shark mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-slate-400">
            {t("timeline.loading")}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col">
        <Header onSettingsClick={() => setIsSettingsOpen(true)} />
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center max-w-md">
            <svg
              className="mx-auto h-16 w-16 text-red-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">
              {t("timeline.error.title")}
            </h2>
            <p className="text-gray-600 dark:text-slate-400 mb-6">
              {error.message}
            </p>
            <button
              onClick={handleBack}
              className="px-6 py-2 bg-shark hover:bg-shark/90 text-white font-medium rounded-lg transition-colors"
            >
              {t("timeline.backButton")}
            </button>
          </div>
        </div>
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      </div>
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
                  {t("timeline.dataPoints", { count: data.length })}
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
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-slate-400 font-medium">
                    {t("timeline.filters.label")}
                  </span>
                  <div className="inline-flex rounded-lg border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 p-1">
                    {["7d", "30d", "60d", "90d", "all"].map((range) => (
                      <button
                        key={range}
                        onClick={() => setTimeRange(range)}
                        className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                          timeRange === range
                            ? "bg-white dark:bg-slate-800 text-shark dark:text-white shadow-sm"
                            : "text-gray-600 dark:text-slate-400 hover:text-shark dark:hover:text-white"
                        }`}
                      >
                        {t(`timeline.filters.${range}`)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ height: "400px" }}>
                <Line data={chartData} options={chartOptions} />
              </div>
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
                      {new Intl.DateTimeFormat(
                        i18n.language === "pt" ? "pt-BR" : "en-US",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        },
                      ).format(filteredData[0].date)}
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
                      {new Intl.DateTimeFormat(
                        i18n.language === "pt" ? "pt-BR" : "en-US",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        },
                      ).format(filteredData[filteredData.length - 1].date)}
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
                    <p className="text-lg font-semibold text-green-600 dark:text-green-400 mt-1">
                      +
                      {filteredData[filteredData.length - 1].stars -
                        filteredData[0].stars}{" "}
                      ⭐
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
