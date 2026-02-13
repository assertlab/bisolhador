import { Line } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import useChartTheme from '../../hooks/useChartTheme';

/**
 * Gráfico de evolução temporal comparativa
 * Mostra a evolução de uma métrica específica para múltiplos repositórios
 */
export default function BenchmarkEvolutionChart({ repos, metric = 'stars' }) {
  const { t, i18n } = useTranslation();
  const chartTheme = useChartTheme();

  if (!repos || repos.length === 0) {
    return null;
  }

  // Mapeia nome da métrica para labels
  const metricLabels = {
    stars: t('timeline.metrics.stars', 'Stars'),
    forks: t('timeline.metrics.forks', 'Forks'),
    openIssues: t('stats.openIssues', 'Open Issues'),
  };

  // Prepara datasets para cada repositório
  const datasets = repos.map((repo) => {
    // Ordena histórico por data
    const sortedHistory = [...repo.history].sort((a, b) => a.date - b.date);

    return {
      label: repo.fullName,
      data: sortedHistory.map((point) => ({
        x: point.date,
        y: point[metric] || 0,
      })),
      borderColor: repo.color,
      backgroundColor: repo.color + '20', // Add transparency
      tension: 0.4,
      fill: false,
      pointRadius: 3,
      pointHoverRadius: 5,
      borderWidth: 2,
    };
  });

  const chartData = {
    datasets,
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          color: chartTheme.textColor,
          usePointStyle: true,
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
        displayColors: true,
        callbacks: {
          title: (context) => {
            if (context[0]?.parsed?.x) {
              return new Intl.DateTimeFormat(
                i18n.language === 'pt' ? 'pt-BR' : 'en-US',
                {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                }
              ).format(new Date(context[0].parsed.x));
            }
            return '';
          },
          label: (context) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y.toLocaleString();
            return `${label}: ${value}`;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'day',
          displayFormats: {
            day: 'MMM dd',
          },
        },
        ticks: {
          color: chartTheme.textColor,
          maxRotation: 45,
          minRotation: 0,
        },
        grid: {
          color: chartTheme.gridColor,
          display: true,
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: chartTheme.textColor,
          callback: (value) => value.toLocaleString(),
        },
        grid: {
          color: chartTheme.gridColor,
        },
      },
    },
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold text-shark dark:text-white mb-4">
        {t('benchmark.evolutionChart', 'Evolução de')} {metricLabels[metric]}
      </h3>
      <div style={{ height: '400px' }}>
        <Line data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}
