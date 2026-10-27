import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { Tooltip } from '../Tooltip.jsx';
import useChartTheme from '../../hooks/useChartTheme.js';
import { PUNCH_CARD_MAX_COMMITS, WEEKDAYS_MIN_SAMPLE } from '../../utils/activityStats.js';
import { formatters } from '../../utils/formatters.js';
import { intlLocale } from '../../i18n.js';
import { GuideLink } from '../GuideLink.jsx';


// weekdays: { counts[7], total } from /stats/punch_card (whole history, each
// commit's own time zone) — see utils/activityStats.js. null with a status when
// not measured; status undefined = snapshot from before 2026-10 (10 commits).
function WeekDaysChart({ weekdays, status }) {
  const { t, i18n } = useTranslation();
  const { textColor, gridColor } = useChartTheme();

  // Memoização dos dados calculados para evitar re-processamento desnecessário
  const dayNames = useMemo(() => t('charts.weekdays.days', { returnObjects: true }), [t]);
  const dayCounts = weekdays?.counts;
  const total = weekdays?.total ?? 0;

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
        {t('charts.weekdays.title')}
        <Tooltip text={t('charts.weekdays.tooltip')}>
          <svg className="w-4 h-4 text-gray-300 dark:text-slate-500 hover:text-gray-500 dark:hover:text-slate-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </Tooltip>
      </h3>
      {dayCounts ? (
        <>
          <p className="text-xs text-gray-500 dark:text-slate-400 -mt-2 mb-2">
            {t(total >= PUNCH_CARD_MAX_COMMITS ? 'charts.weekdays.scopeCapped' : 'charts.weekdays.scope', { count: total, n: formatters.formatNumber(total, intlLocale(i18n.language)) })}
            {total < WEEKDAYS_MIN_SAMPLE && ` ${t('charts.weekdays.smallSample')}`}
          </p>
          <div className="flex-grow relative">
            <Bar data={chartData} options={options} />
          </div>
        </>
      ) : (
        <div className="flex-grow flex items-center justify-center text-center text-sm text-gray-500 dark:text-slate-400 px-4">
          {t(`charts.statsUnavailable.${status ?? 'notRecordedWeekdays'}`, { defaultValue: t('charts.statsUnavailable.error') })}
        </div>
      )}
      <GuideLink id="weekdays" className="mt-3 inline-block" />
    </div>
  );
}

export default WeekDaysChart;
