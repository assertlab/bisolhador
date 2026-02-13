/**
 * Factory function that returns common Chart.js options based on the current theme.
 * Individual charts should spread this base and override only what they need.
 *
 * @param {Object} chartTheme - Object from useChartTheme ({ textColor, gridColor, tooltipBg, tooltipText })
 * @param {Object} [overrides] - Deep-merged overrides for plugins, scales, etc.
 * @returns {Object} Chart.js options object
 */
export function createBaseChartOptions(chartTheme, overrides = {}) {
  const base = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: chartTheme.textColor,
          padding: 15,
          font: { size: 12 },
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: chartTheme.tooltipBg,
        titleColor: chartTheme.tooltipText,
        bodyColor: chartTheme.tooltipText,
        borderColor: chartTheme.gridColor,
        borderWidth: 1,
        padding: 12,
      },
    },
    scales: {
      x: {
        ticks: { color: chartTheme.textColor },
        grid: { color: chartTheme.gridColor },
      },
      y: {
        beginAtZero: true,
        ticks: { color: chartTheme.textColor },
        grid: { color: chartTheme.gridColor },
      },
    },
  };

  return deepMerge(base, overrides);
}

/**
 * Simple deep-merge utility (objects only, no arrays merge).
 * Arrays from source replace target arrays entirely.
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
