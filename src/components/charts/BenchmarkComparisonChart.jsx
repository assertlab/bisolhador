import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import useChartTheme from '../../hooks/useChartTheme';

/**
 * Gráfico de barras comparativo com suporte a múltiplas categorias de métricas
 * Categorias: popularity (Stars/Forks), velocity (Open/Closed Issues), quality (Lead Time/Code Churn)
 */
export default function BenchmarkComparisonChart({ repos, metricCategory = 'popularity' }) {
  const { t } = useTranslation();
  const chartTheme = useChartTheme();

  if (!repos || repos.length === 0) {
    return null;
  }

  const labels = repos.map((repo) => repo.fullName);

  const datasetConfigs = {
    popularity: [
      {
        labelKey: 'stats.stars',
        fallback: 'Stars',
        accessor: (repo) => repo.stars,
        alphaHex: '80',
      },
      {
        labelKey: 'stats.forks',
        fallback: 'Forks',
        accessor: (repo) => repo.forks,
        alphaHex: '60',
      },
    ],
    velocity: [
      {
        labelKey: 'stats.openIssues',
        fallback: 'Open Issues',
        accessor: (repo) => repo.openIssues,
        alphaHex: '80',
      },
      {
        labelKey: 'stats.closedIssues',
        fallback: 'Closed Issues',
        accessor: (repo) => repo.closedIssues,
        alphaHex: '60',
      },
    ],
    quality: [
      {
        labelKey: 'benchmark.leadTimeDays',
        fallback: 'Lead Time (days)',
        accessor: (repo) => repo.leadTime,
        alphaHex: '80',
      },
      {
        labelKey: 'stats.codeChurn',
        fallback: 'Code Churn',
        accessor: (repo) => repo.codeChurnRatio,
        alphaHex: '60',
      },
    ],
  };

  const categoryTitles = {
    popularity: t('benchmark.categoryPopularity', 'Popularidade'),
    velocity: t('benchmark.categoryVelocity', 'Velocidade'),
    quality: t('benchmark.categoryQuality', 'Qualidade'),
  };

  const activeConfigs = datasetConfigs[metricCategory] || datasetConfigs.popularity;

  const chartData = useMemo(() => ({
    labels,
    datasets: activeConfigs.map((config) => ({
      label: t(config.labelKey, config.fallback),
      data: repos.map(config.accessor),
      backgroundColor: repos.map((repo) => repo.color + config.alphaHex),
      borderColor: repos.map((repo) => repo.color),
      borderWidth: 2,
    })),
  }), [repos, metricCategory, labels, activeConfigs, t]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          color: chartTheme.textColor,
          padding: 15,
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        backgroundColor: chartTheme.tooltipBg,
        titleColor: chartTheme.tooltipText,
        bodyColor: chartTheme.tooltipText,
        borderColor: chartTheme.gridColor,
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (context) => {
            const label = context.dataset.label || '';
            const value = metricCategory === 'quality'
              ? context.parsed.y.toFixed(2)
              : context.parsed.y.toLocaleString();
            return `${label}: ${value}`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: chartTheme.textColor,
          maxRotation: 45,
          minRotation: 45,
          font: {
            size: 10,
          },
        },
        grid: {
          display: false,
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: chartTheme.textColor,
          callback: (value) => metricCategory === 'quality'
            ? value.toFixed(1)
            : value.toLocaleString(),
        },
        grid: {
          color: chartTheme.gridColor,
        },
      },
    },
  }), [chartTheme, metricCategory]);

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold text-shark dark:text-white mb-4">
        {t('benchmark.comparisonChart', 'Comparação de Métricas')} — {categoryTitles[metricCategory]}
      </h3>
      <div style={{ height: '400px' }}>
        <Bar data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}
