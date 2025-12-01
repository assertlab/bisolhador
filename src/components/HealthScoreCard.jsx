import React from 'react';
import { Tooltip } from './Tooltip.jsx';

export function HealthScoreCard({ score, files }) {
  // Determinar cor baseada no score
  let scoreColor = 'text-gray-900';
  let bgColor = 'bg-gray-100';
  if (score >= 75) {
    scoreColor = 'text-green-600';
    bgColor = 'bg-green-50';
  } else if (score >= 50) {
    scoreColor = 'text-yellow-600';
    bgColor = 'bg-yellow-50';
  } else {
    scoreColor = 'text-red-600';
    bgColor = 'bg-red-50';
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          Health Score
          <Tooltip text="Mede a saúde comunitária baseada em 7 indicadores de governança open-source">
            <svg className="w-4 h-4 text-gray-300 hover:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </Tooltip>
        </h3>
      </div>

      {/* Score Central */}
      <div className={`text-center py-6 ${bgColor} rounded-lg mb-6`}>
        <div className={`text-5xl font-bold ${scoreColor}`}>
          {score}%
        </div>
        <div className="text-sm text-gray-600 mt-1">Saúde Comunitária</div>
      </div>

      {/* Checklist Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2 text-sm">
          {files.hasReadme ? '✅' : '❌'}
          <span className={files.hasReadme ? 'text-green-600' : 'text-red-600'}>
            README
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {files.hasLicense ? '✅' : '❌'}
          <span className={files.hasLicense ? 'text-green-600' : 'text-red-600'}>
            License
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {files.hasContributing ? '✅' : '❌'}
          <span className={files.hasContributing ? 'text-green-600' : 'text-red-600'}>
            Contributing
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {files.hasDescription ? '✅' : '❌'}
          <span className={files.hasDescription ? 'text-green-600' : 'text-red-600'}>
            Description
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {files.hasCodeOfConduct ? '✅' : '❌'}
          <span className={files.hasCodeOfConduct ? 'text-green-600' : 'text-red-600'}>
            Code of Conduct
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {files.hasIssueTemplate ? '✅' : '❌'}
          <span className={files.hasIssueTemplate ? 'text-green-600' : 'text-red-600'}>
            Issue Template
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm col-span-2">
          {files.hasPullRequestTemplate ? '✅' : '❌'}
          <span className={files.hasPullRequestTemplate ? 'text-green-600' : 'text-red-600'}>
            PR Template
          </span>
        </div>
      </div>
    </div>
  );
}
