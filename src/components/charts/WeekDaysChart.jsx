import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { Tooltip } from '../Tooltip.jsx';
import useChartTheme from '../../hooks/useChartTheme.js';

function WeekDaysChart({ commits }) {
  const { t } = useTranslation();
  const { textColor, gridColor } = useChartTheme();

  // Memoização dos dados calculados para evitar re-processamento desnecessário
  const { dayNames, dayCounts } = useMemo(() => {
    const dayNames = t('charts.weekdays.days', { returnObjects: true });
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];

    commits.forEach(commit => {
      try {
        const commitDate = new Date(commit.commit.author.date);
        const dayOfWeek = commitDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
        dayCounts[dayOfWeek]++;
      } catch {
        // Skip invalid dates
      }
    });

    return { dayNames, dayCounts };
  }, [commits, t]);

  // Chart data - Memoizada para evitar re-renders
  const chartData = useMemo(() => ({
    labels: dayNames,
    datasets: [
      {
        label: 'Commits',
        data: dayCounts,
        backgroundColor: '#0ea5e9', // Ocean color
        borderColor: '#0284c7',
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  }), [dayNames, dayCounts]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function(context) {
            return t('charts.weekdays.tooltipLabel', { day: context.label, count: context.raw });
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { precision: 0, color: textColor },
        grid: { color: gridColor }
      },
      x: {
        grid: { display: false },
        ticks: { color: textColor }
      }
    }
  }), [textColor, gridColor, t]);

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6 flex flex-col h-80 hover:shadow-md transition-shadow relative overflow-visible hover:z-50">
      <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        {t('charts.weekdays.title', { count: commits.length })}
        <Tooltip text={t('charts.weekdays.tooltip')}>
          <svg className="w-4 h-4 text-gray-300 dark:text-slate-500 hover:text-gray-500 dark:hover:text-slate-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </Tooltip>
      </h3>
      <div className="flex-grow relative">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
}

export default WeekDaysChart;
