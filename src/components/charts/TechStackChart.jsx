import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Tooltip } from '../Tooltip.jsx';

export function TechStackChart({ data }) {
  // Configuração dos dados para o Chart.js
  const chartData = {
    labels: data.map(item => item.language),
    datasets: [
      {
        data: data.map(item => item.percentage),
        backgroundColor: data.map(item => item.color),
        borderWidth: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right', // Legenda ao lado fica mais elegante
        labels: { usePointStyle: true, boxWidth: 8 }
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
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 flex flex-col h-80 hover:shadow-md transition-shadow relative overflow-visible hover:z-50">
      <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
        Stack Tecnológica
        <Tooltip text="Linguagens de programação utilizadas no repositório">
          <svg className="w-4 h-4 text-gray-300 hover:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
