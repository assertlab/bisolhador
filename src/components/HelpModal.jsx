import React from 'react';

export function HelpModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Como usar o Bisolhador
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Sobre o Bisolhador</h3>
            <p className="text-sm text-gray-600">
              O Bisolhador é uma ferramenta analítica para avaliar repositórios GitHub como um Tech Lead.
              Ele analisa métricas de volume, governança, maturidade e atividade para fornecer insights sobre
              saúde e eficiência do projeto.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 mb-2">Por que configurar um Token?</h3>
            <p className="text-sm text-gray-600 mb-3">
              Sem token, o GitHub limita a 60 requisições por hora. Com um Personal Access Token,
              você pode fazer até 5.000 requisições por hora, permitindo análises mais completas.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
              <p className="text-sm text-yellow-800">
                <strong>Importante:</strong> O token fica salvo apenas no seu navegador e nunca é enviado
                para nossos servidores. Sua privacidade está protegida.
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 mb-2">Como criar um Token</h3>
            <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
              <li>Acesse <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-ocean hover:underline">github.com/settings/tokens</a></li>
              <li>Clique em "Generate new token (classic)"</li>
              <li>Dê um nome descritivo (ex: "Bisolhador Analysis")</li>
              <li>Selecione apenas a permissão "public_repo" (para repositórios públicos)</li>
              <li>Clique em "Generate token"</li>
              <li>Copie o token gerado (começa com "ghp_")</li>
            </ol>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 mb-2">Como usar</h3>
            <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
              <li>Digite o nome do repositório no formato "owner/repo"</li>
              <li>Clique em "Buscar" ou pressione Enter</li>
              <li>Aguarde a análise dos dados</li>
              <li>Explore as métricas e gráficos gerados</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-ocean border border-transparent rounded-md hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ocean"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
