import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { Tooltip } from '../Tooltip.jsx';
import useChartTheme from '../../hooks/useChartTheme.js';

export default function CommitActivityChart({ data, createdAt }) {
  const { t } = useTranslation();
  const { textColor, gridColor } = useChartTheme();

  // Memoização do cálculo da idade do projeto
  const weeksOld = useMemo(() => {
    let weeks = 52; // Default to 52 weeks
    if (createdAt) {
      try {
        const createdDate = new Date(createdAt);
        const now = new Date();
        if (!isNaN(createdDate.getTime())) {
          const ageInMs = now - createdDate;
          weeks = Math.ceil(ageInMs / (1000 * 60 * 60 * 24 * 7));
        }
      } catch {
        weeks = 52;
      }
    }
    return weeks;
  }, [createdAt]);

  // Memoização do processamento de dados (smart trimming)
  const processedData = useMemo(() => {
    let result = data;
    if (data && data.datasets && data.datasets[0] && data.datasets[0].data) {
      const rawData = data.datasets[0].data;

      // For young projects, trim to actual age + small buffer
      // For older projects, show full 52 weeks
      const maxWeeksToShow = Math.min(weeksOld + 4, 52); // Small buffer for context
      let itemsToShow = Math.min(rawData.length, maxWeeksToShow);

      // Find first non-zero value to avoid showing too much empty data
      const firstNonZeroIndex = rawData.findIndex(value => value > 0);
      let startIndex = 0;

      if (firstNonZeroIndex !== -1) {
        // Found activity - show from a few weeks before first activity
        startIndex = Math.max(0, firstNonZeroIndex - 2); // 2 weeks of context before activity
        itemsToShow = Math.min(rawData.length - startIndex, itemsToShow);
      } else if (weeksOld < 52) {
        // No activity found but project is young - show only recent period
        startIndex = Math.max(0, rawData.length - itemsToShow);
      }

      // Slice the data
      const trimmedValues = rawData.slice(startIndex, startIndex + itemsToShow);

      // Generate labels dynamically based on trimmed data length
      const finalLabels = [];
      for (let i = trimmedValues.length - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - (i * 7));
        const label = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
        finalLabels.push(label);
      }

      result = {
        labels: finalLabels,
        datasets: [{
          ...data.datasets[0],
          data: trimmedValues
        }]
      };
    }
    return result;
  }, [data, weeksOld]);

  // Check if we have any data at all (accepts arrays with zeros)
  const hasData = processedData?.datasets?.[0]?.data !== undefined;

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
          {t('charts.commitActivity.title', { weeks: weeksOld })}
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
            <p className="text-sm">{t('charts.commitActivity.noData.title')}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{t('charts.commitActivity.noData.subtitle')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6 flex flex-col h-80 hover:shadow-md transition-shadow relative overflow-visible hover:z-50">
      <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        {t('charts.commitActivity.title', { weeks: weeksOld })}
        <Tooltip text={t('charts.commitActivity.tooltip')}>
          <svg className="w-4 h-4 text-gray-300 dark:text-slate-500 hover:text-gray-500 dark:hover:text-slate-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </Tooltip>
      </h3>
      <div className="flex-grow relative" style={{ height: '100%', minHeight: '200px' }}>
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
