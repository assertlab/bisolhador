import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Tooltip } from '../Tooltip.jsx';
import useChartTheme from '../../hooks/useChartTheme.js';

function TechStackChart({ data }) {
  const { t } = useTranslation();
  const { textColor } = useChartTheme();

  // Configuração dos dados para o Chart.js - Memoizada para evitar re-renders
  const chartData = useMemo(() => ({
    labels: data.map(item => item.language),
    datasets: [
      {
        data: data.map(item => item.percentage),
        backgroundColor: data.map(item => item.color),
        borderWidth: 0,
      },
    ],
  }), [data]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right', // Legenda ao lado fica mais elegante
        labels: { usePointStyle: true, boxWidth: 8, color: textColor }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const value = context.raw;
            const label = context.label || '';
            if (value < 1) {
              return `${label}: < 1%`;
            }
            return `${label}: ${value.toFixed(1)}%`;
          }
        }
      }
    },
    cutout: '60%', // Deixa o buraco no meio (Rosca)
  }), [textColor]);

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6 flex flex-col h-80 hover:shadow-md transition-shadow relative overflow-visible hover:z-50">
      <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        {t('charts.techStack.title')}
        <Tooltip text={t('charts.techStack.tooltip')}>
          <svg className="w-4 h-4 text-gray-300 dark:text-slate-500 hover:text-gray-500 dark:hover:text-slate-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </Tooltip>
      </h3>
      <div className="flex-grow relative">
        <Doughnut data={chartData} options={options} />
      </div>
    </div>
  );
}

export default TechStackChart;
