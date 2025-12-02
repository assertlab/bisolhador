import React from 'react';
import { Bar } from 'react-chartjs-2';
import { Tooltip } from '../Tooltip.jsx';

function WeekDaysChart({ commits }) {
  // Count commits by day of week
  const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
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

  // Chart data
  const chartData = {
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
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `${context.label}: ${context.raw} commits`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { precision: 0 }
      },
      x: {
        grid: { display: false }
      }
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 flex flex-col h-80 hover:shadow-md transition-shadow relative overflow-visible hover:z-50">
      <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
        Commits por Dia da Semana (Amostra: {commits.length} commits)
        <Tooltip text="Distribuição de commits ao longo dos dias da semana. Ajuda a identificar padrões de trabalho da equipe.">
          <svg className="w-4 h-4 text-gray-300 hover:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
