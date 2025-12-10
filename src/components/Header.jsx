import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { HelpModal } from './HelpModal.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import { LanguageSwitcher } from './LanguageSwitcher.jsx';

export function Header({ onSettingsClick }) {
  const { t } = useTranslation();
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  return (
    <header className="bg-shark border-b border-gray-800 sticky top-0 z-[100]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Logo / Título */}
          <Link to="/" className="flex-shrink-0 flex items-center gap-3">
            {/* --- NOVO: O LOGO --- */}
            <img
              src={`${import.meta.env.BASE_URL}logo_assert.png`}
              alt="Powered by ASSERT Lab"
              className="h-8 w-auto" // Altura de 32px (padrão de header)
            />
            {/* -------------------- */}
            <span className="text-2xl font-bold text-white tracking-tight">
              {t('header.title')}
            </span>
            <span className="bg-ocean/20 text-ocean text-xs font-medium px-2.5 py-0.5 rounded border border-ocean/30 hidden sm:inline-block">
              {t('header.version')}
            </span>
          </Link>

          {/* Toolbar (Botões) */}
          <div className="flex items-center gap-3">

            <Link to="/" className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-200 dark:hover:text-blue-400 transition-colors">
              <span>🔍</span>
              <span>Buscar</span>
            </Link>

            <Link to="/ranking" className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-200 dark:hover:text-blue-400 transition-colors">
              <span>🏆</span>
              <span>Ranking</span>
            </Link>

            <ThemeToggle />

            <LanguageSwitcher />

            {/* Botão Ajuda (?) */}
            <button
              type="button"
              onClick={() => setIsHelpOpen(true)}
              className="bg-white dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 text-shark dark:text-white border border-gray-200 dark:border-slate-600 focus:ring-4 focus:ring-gray-200 dark:focus:ring-slate-500 font-medium rounded-lg text-sm p-2.5 inline-flex items-center transition-colors"
              title={t('header.helpTitle')}
            >
              <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </button>

            {/* Botão Configurações (Token) */}
            <button
              type="button"
              onClick={onSettingsClick}
              className="bg-white dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 text-shark dark:text-white border border-gray-200 dark:border-slate-600 focus:ring-4 focus:ring-gray-200 dark:focus:ring-slate-500 font-medium rounded-lg text-sm p-2.5 inline-flex items-center transition-colors"
              title={t('header.settingsTitle')}
            >
              <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
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
