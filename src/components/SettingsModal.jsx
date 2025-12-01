import React, { useState } from 'react';

export function SettingsModal({ isOpen, onClose }) {
  const [token, setToken] = useState(() => localStorage.getItem('github_token') || '');
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSave = () => {
    if (token.trim() === '') {
      localStorage.removeItem('github_token');
    } else {
      localStorage.setItem('github_token', token.trim());
    }
    setShowSuccess(true);

    // Fechar modal após 2 segundos
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  const handleCancel = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Configurar Token do GitHub
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p className="text-sm text-gray-600 mb-4">
            Adicione seu Personal Access Token para aumentar o limite de 60 para 5.000 requisições/hora.
          </p>

          <div className="mb-4">
            <label htmlFor="token" className="block text-sm font-medium text-gray-700 mb-1">
              Personal Access Token
            </label>
            <input
              type="password"
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-ocean focus:border-ocean"
            />
          </div>

          {showSuccess && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800">
                Token salvo com sucesso!
              </p>
            </div>
          )}

          <div className="text-xs text-gray-500">
            <p>
              Como criar um token:{' '}
              <a
                href="https://github.com/settings/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-ocean hover:underline"
              >
                github.com/settings/tokens
              </a>
            </p>
            <p className="mt-1">
              O token fica salvo apenas no seu navegador.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-ocean border border-transparent rounded-md hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ocean"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
