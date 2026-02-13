import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import useChartTheme from '../../hooks/useChartTheme';
import { createBaseChartOptions } from '../../lib/chartDefaults';

/**
 * Gráfico de evolução temporal comparativa
 * Mostra a evolução de uma métrica específica para múltiplos repositórios
 */
export default function BenchmarkEvolutionChart({ repos, metric = 'stars' }) {
  const { t, i18n } = useTranslation();
  const chartTheme = useChartTheme();

  const metricLabels = {
    stars: t('timeline.metrics.stars', 'Stars'),
    forks: t('timeline.metrics.forks', 'Forks'),
    openIssues: t('stats.openIssues', 'Open Issues'),
  };

  const datasets = useMemo(() => {
    if (!repos || repos.length === 0) return null;

    return repos.map((repo) => {
      const sortedHistory = [...repo.history].sort((a, b) => a.date - b.date);
      return {
        label: repo.fullName,
        data: sortedHistory.map((point) => ({
          x: point.date,
          y: point[metric] || 0,
        })),
        borderColor: repo.color,
        backgroundColor: repo.color + '20',
        tension: 0.4,
        fill: false,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2,
      };
    });
  }, [repos, metric]);

  const chartOptions = useMemo(
    () =>
      createBaseChartOptions(chartTheme, {
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true },
          tooltip: {
            displayColors: true,
            callbacks: {
              title: (context) => {
                if (context[0]?.parsed?.x) {
                  return new Intl.DateTimeFormat(
                    i18n.language === 'pt' ? 'pt-BR' : 'en-US',
                    { day: '2-digit', month: 'short', year: 'numeric' },
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
            time: { unit: 'day', displayFormats: { day: 'MMM dd' } },
            ticks: { maxRotation: 45, minRotation: 0 },
            grid: { display: true },
          },
          y: {
            ticks: { callback: (value) => value.toLocaleString() },
          },
        },
      }),
    [chartTheme, i18n.language],
  );

  if (!datasets) return null;

  const chartData = { datasets };

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
