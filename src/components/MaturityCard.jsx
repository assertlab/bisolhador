import React from 'react';

export function MaturityCard({ maturity, codeReview }) {
  // Função auxiliar para renderizar badge
  const renderBadge = (text, detected, customColor) => {
    let bgColor = 'bg-gray-500';
    if (customColor) {
      if (customColor === 'green') bgColor = 'bg-green-500';
      else if (customColor === 'yellow') bgColor = 'bg-yellow-500';
      else bgColor = 'bg-red-500';
    } else if (detected) {
      bgColor = 'bg-green-500';
    }

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold text-white ${bgColor}`}>
        {text}
      </span>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          Maturidade de Engenharia
          <span className="text-gray-300 cursor-help" title="Verifica presença de infraestrutura profissional: testes, CI/CD, linters e auditoria">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </span>
        </h3>
      </div>

      {/* Badges de Tecnologias */}
      <div className="flex flex-wrap gap-2 mb-4">
        {renderBadge('🧪 Testes Detectados', maturity.testsDetected)}
        {renderBadge('⚡ CI/CD', maturity.ciCdDetected)}
        {renderBadge('🐳 Docker', maturity.dockerDetected)}
        {renderBadge('🛡️ Code Review (' + codeReview.selfMergePercentage + '%)', true, codeReview.color)}
        {maturity.zombies === 0
          ? renderBadge('✅ Nenhuma Branch Zumbi', true, 'green')
          : renderBadge('🧟 ' + maturity.zombies + ' Branches Zumbis detectadas', true, 'red')
        }
      </div>

      {/* Alerta de Code Review */}
      {codeReview.selfMergePercentage > 0 && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Atenção: Self-Merges Detectados
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  {codeReview.selfMergePercentage}% dos PRs foram merged pelo próprio autor.
                  Considere implementar revisões obrigatórias para melhorar a qualidade.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
