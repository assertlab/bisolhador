import React, { useState } from 'react';
import { HelpModal } from './HelpModal.jsx';
import { exportToPDF } from '../utils/pdfExporter.js';

export function Header({ onSettingsClick }) {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  return (
    <header className="bg-shark border-b border-gray-800 sticky top-0 z-[100]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Logo / Título */}
          <div className="flex-shrink-0 flex items-center gap-3">
            {/* --- NOVO: O LOGO --- */}
            <img
              src={`${import.meta.env.BASE_URL}logo_assert.png`}
              alt="Powered by ASSERT Lab"
              className="h-8 w-auto" // Altura de 32px (padrão de header)
            />
            {/* -------------------- */}
            <span className="text-2xl font-bold text-white tracking-tight">
              Bisolhador
            </span>
            <span className="bg-ocean/20 text-ocean text-xs font-medium px-2.5 py-0.5 rounded border border-ocean/30 hidden sm:inline-block">
              v2.2.0
            </span>
          </div>

          {/* Toolbar (Botões) */}
          <div className="flex items-center gap-3">
            
            {/* Botão Ajuda (?) */}
            <button
              type="button"
              onClick={() => setIsHelpOpen(true)}
              className="bg-white hover:bg-gray-100 text-shark border border-gray-200 focus:ring-4 focus:ring-gray-200 font-medium rounded-lg text-sm p-2.5 inline-flex items-center transition-colors"
              title="Como usar"
            >
              <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </button>

            {/* Botão Configurações (Token) */}
            <button
              type="button"
              onClick={onSettingsClick}
              className="bg-white hover:bg-gray-100 text-shark border border-gray-200 focus:ring-4 focus:ring-gray-200 font-medium rounded-lg text-sm p-2.5 inline-flex items-center transition-colors"
              title="Configurar Token GitHub"
            >
              <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
            </button>

            {/* Botão Baixar Relatório */}
            <button
              type="button"
              onClick={exportToPDF}
              className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 flex items-center gap-2 transition-colors"
              title="Baixar relatório em PDF"
            >
              <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <span className="hidden sm:inline">Baixar Relatório</span>
            </button>

          </div>
        </div>
      </div>

      {/* Help Modal */}
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </header>
  );
}
