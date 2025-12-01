import React from 'react';
import { Line } from 'react-chartjs-2';
import { Tooltip } from '../Tooltip.jsx';

export function CommitActivityChart({ data, createdAt }) {
  // Debug log
  console.log('CommitActivityChart renderizado');
  console.log('Data recebida:', data);
  console.log('createdAt recebida:', createdAt);

  // Calculate exact project age in weeks
  let weeksOld = 52; // Default to 52 weeks
  if (createdAt) {
    try {
      const createdDate = new Date(createdAt);
      const now = new Date();
      if (!isNaN(createdDate.getTime())) {
        const ageInMs = now - createdDate;
        weeksOld = Math.ceil(ageInMs / (1000 * 60 * 60 * 24 * 7));
        console.log('Idade exata em semanas:', weeksOld, 'createdAt:', createdAt);
      }
    } catch (error) {
      console.warn('Error calculating project age:', error);
      weeksOld = 52;
    }
  }

  // Smart trimming: find first non-zero value and show relevant period
  let processedData = data;
  if (data && data.datasets && data.datasets[0] && data.datasets[0].data) {
    const rawData = data.datasets[0].data;
    let startIndex = 0;
    let itemsToShow = 52; // Default

    // Find first non-zero value
    const firstNonZeroIndex = rawData.findIndex(value => value > 0);

    if (firstNonZeroIndex !== -1) {
      // Found activity - show from a few weeks before first activity
      startIndex = Math.max(0, firstNonZeroIndex - 2); // 2 weeks of context before activity
      itemsToShow = Math.min(rawData.length - startIndex, weeksOld < 52 ? weeksOld + 4 : 52);
    } else if (weeksOld < 52) {
      // No activity found but project is young - show recent period
      startIndex = Math.max(0, rawData.length - (weeksOld + 2));
      itemsToShow = rawData.length - startIndex;
    }

    // Slice the data
    const trimmedValues = rawData.slice(startIndex, startIndex + itemsToShow);
    const trimmedLabels = data.labels ? data.labels.slice(startIndex, startIndex + itemsToShow) : [];

    // Generate labels if needed
    let finalLabels = trimmedLabels;
    if (!finalLabels.length || finalLabels.length !== trimmedValues.length) {
      finalLabels = [];
      for (let i = itemsToShow - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - (i * 7));
        const label = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
        finalLabels.push(label);
      }
    }

    processedData = {
      labels: finalLabels,
      datasets: [{
        ...data.datasets[0],
        data: trimmedValues
      }]
    };

    console.log('Smart trim aplicado:', {
      originalLength: rawData.length,
      firstActivityIndex: firstNonZeroIndex,
      startIndex,
      itemsToShow,
      trimmedLength: trimmedValues.length
    });
  } else {
    console.warn('Dados do gráfico não estão no formato esperado:', data);
  }

  // Check if we have any data at all (accepts arrays with zeros)
  const hasData = processedData?.datasets?.[0]?.data !== undefined;

  if (!hasData) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 flex flex-col h-80 hover:shadow-md transition-shadow relative overflow-visible hover:z-50">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          Fluxo de Trabalho (Amostra: {weeksOld} Semanas)
          <Tooltip text="Frequência de commits ao longo do tempo">
            <svg className="w-4 h-4 text-gray-300 hover:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </Tooltip>
        </h3>
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
            </svg>
            <p className="text-sm">Dados de fluxo indisponíveis no momento</p>
            <p className="text-xs text-gray-400 mt-1">GitHub está calculando as estatísticas</p>
          </div>
        </div>
      </div>
    );
  }

  const chartData = processedData;

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }, // Esconde legenda "Commits" pois é óbvio
      tooltip: { mode: 'index', intersect: false }
    },
    scales: {
      y: { beginAtZero: true, grid: { borderDash: [2, 4] } },
      x: { grid: { display: false } }
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 flex flex-col h-80 hover:shadow-md transition-shadow relative overflow-visible hover:z-50">
      <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
        Fluxo de Trabalho (Amostra: {weeksOld} Semanas)
        <Tooltip text="Frequência de commits ao longo do tempo">
          <svg className="w-4 h-4 text-gray-300 hover:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
