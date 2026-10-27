import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { Tooltip } from '../Tooltip.jsx';
import useChartTheme from '../../hooks/useChartTheme.js';
import { GuideLink } from '../GuideLink.jsx';
import { trimCommitSeries } from '../../utils/activityStats.js';

// status: 'computing' (HTTP 202) / 'error' when GitHub didn't return the
// series (data null); undefined for snapshots from before 2026-10.
export default function CommitActivityChart({ data, createdAt, status }) {
  const { t } = useTranslation();
  const { textColor, gridColor } = useChartTheme();

  // Smart trimming by project age (shared with the PDF report: utils/activityStats.js)
  const processedData = useMemo(() => {
    const raw = data?.datasets?.[0]?.data;
    if (!raw) return data;
    const { values, labels } = trimCommitSeries(raw, createdAt);
    return { labels, datasets: [{ ...data.datasets[0], data: values }] };
  }, [data, createdAt]);

  // Check if we have any data at all (accepts arrays with zeros)
  const hasData = (processedData?.datasets?.[0]?.data?.length ?? 0) > 0;
  // Weeks actually plotted (was the repo's age: "904 semanas" for express, with 52 plotted)
  const weeksShown = processedData?.labels?.length || 0;

  const chartData = useMemo(() => processedData, [processedData]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }, // Esconde legenda "Commits" pois é óbvio
      tooltip: { mode: 'index', intersect: false }
    },
    scales: {
      y: { beginAtZero: true, grid: { borderDash: [2, 4], color: gridColor }, ticks: { color: textColor } },
      x: { grid: { display: false }, ticks: { color: textColor } }
    }
  }), [gridColor, textColor]);

  if (!hasData) {
    return (
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6 flex flex-col h-80 hover:shadow-md transition-shadow relative overflow-visible hover:z-50">
        <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          {t('charts.commitActivity.titleNoData')}
          <Tooltip text={t('charts.commitActivity.tooltip')}>
            <svg className="w-4 h-4 text-gray-300 dark:text-slate-500 hover:text-gray-500 dark:hover:text-slate-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </Tooltip>
        </h3>
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center text-gray-500 dark:text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
            </svg>
            <p className="text-sm">{t(`charts.statsUnavailable.${status ?? 'error'}`, { defaultValue: t('charts.statsUnavailable.error') })}</p>
          </div>
        </div>
        <GuideLink id="commit-activity" className="mt-3 inline-block" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6 flex flex-col h-80 hover:shadow-md transition-shadow relative overflow-visible hover:z-50">
      <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        {t('charts.commitActivity.title', { count: weeksShown })}
        <Tooltip text={t('charts.commitActivity.tooltip')}>
          <svg className="w-4 h-4 text-gray-300 dark:text-slate-500 hover:text-gray-500 dark:hover:text-slate-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </Tooltip>
      </h3>
      <div className="flex-grow relative" style={{ height: '100%', minHeight: '200px' }}>
        <Line data={chartData} options={options} />
      </div>
      <GuideLink id="commit-activity" className="mt-3 inline-block" />
    </div>
  );
}
