import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { version } from '../../package.json';
import { HelpModal } from './HelpModal.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import { LanguageSwitcher } from './LanguageSwitcher.jsx';

const NAV_ITEMS = [
  { to: '/', icon: '🔍', label: 'header.nav.search' },
  { to: '/ranking', icon: '🏆', label: 'header.nav.ranking' },
  { to: '/benchmark', icon: '📊', label: 'header.nav.benchmark' },
  { to: '/turma', icon: '🎓', label: 'header.nav.classroom' },
  { to: '/guia', icon: '📖', label: 'header.nav.guide' },
];

const ICON_BUTTON = 'bg-white dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 text-shark dark:text-white border border-gray-200 dark:border-slate-600 focus:ring-4 focus:ring-gray-200 dark:focus:ring-slate-500 font-medium rounded-lg text-sm p-2.5 inline-flex items-center transition-colors';

// Below xl (1280px) the bar keeps logo, settings and a menu button; links, theme,
// language and help move to a panel (the full toolbar was ~930px wide and
// scrolled the whole page sideways on phones; at 1024px it was still 33px too wide).
export function Header({ onSettingsClick }) {
  const { t } = useTranslation();
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const toggleRef = useRef(null);
  const { key: locationKey } = useLocation();

  // Close the menu on any navigation (incl. back/forward within the same page)
  const [menuLocation, setMenuLocation] = useState(locationKey);
  if (menuLocation !== locationKey) {
    setMenuLocation(locationKey);
    setIsMenuOpen(false);
  }

  // Escape closes (focus back on the toggle); widening to desktop closes too
  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
        toggleRef.current?.focus();
      }
    };
    const desktop = window.matchMedia('(min-width: 1280px)');
    const onResize = (e) => { if (e.matches) setIsMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    desktop.addEventListener('change', onResize);
    return () => {
      document.removeEventListener('keydown', onKey);
      desktop.removeEventListener('change', onResize);
    };
  }, [isMenuOpen]);

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
            <span className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {t('header.title')}
            </span>
            <span className="bg-ocean/20 text-ocean text-xs font-medium px-2.5 py-0.5 rounded border border-ocean/30 hidden sm:inline-block">
              v{version}
            </span>
          </Link>

          {/* Toolbar (Botões) */}
          <div className="flex items-center gap-2 xl:gap-3">

            {/* Desktop: links in the bar. Mobile: in the menu panel below. */}
            <nav aria-label={t('header.navLabel')} className="hidden xl:flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'text-blue-400 underline underline-offset-4' : 'text-gray-200 hover:text-blue-400'}`}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  <span>{t(item.label)}</span>
                </NavLink>
              ))}
            </nav>

            {/* One ThemeToggle for every width: useTheme keeps local state, and two
                mounted instances (bar + menu) drifted apart */}
            <ThemeToggle />

            <div className="hidden xl:flex items-center gap-3">
              <LanguageSwitcher />

              <HelpButton onClick={() => setIsHelpOpen(true)} title={t('header.helpTitle')} />
            </div>

            {/* Botão Configurações (Token) */}
            <button
              type="button"
              onClick={() => { setIsMenuOpen(false); onSettingsClick(); }}
              className={ICON_BUTTON}
              title={t('header.settingsTitle')}
              aria-label={t('header.settingsTitle')}
            >
              <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
            </button>

            {/* Mobile menu toggle */}
            <button
              ref={toggleRef}
              type="button"
              onClick={() => setIsMenuOpen((open) => !open)}
              className={`xl:hidden ${ICON_BUTTON}`}
              aria-expanded={isMenuOpen}
              aria-controls="mobile-menu"
              aria-label={t(isMenuOpen ? 'header.menuClose' : 'header.menuOpen')}
            >
              <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMenuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu panel */}
      {/* Always rendered (aria-controls target), hidden when closed */}
      <div id="mobile-menu" hidden={!isMenuOpen} className="xl:hidden border-t border-gray-800 bg-shark px-4 pb-4 max-h-[calc(100vh-4rem)] overflow-y-auto">
          <nav aria-label={t('header.navLabel')} className="flex flex-col py-2">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setIsMenuOpen(false)}
                className={({ isActive }) => `flex items-center gap-3 px-2 py-3 text-base font-medium rounded ${isActive ? 'text-blue-400 underline underline-offset-4' : 'text-gray-200 hover:text-blue-400'}`}
              >
                <span aria-hidden="true">{item.icon}</span>
                <span>{t(item.label)}</span>
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3 pt-2 border-t border-gray-800">
            <LanguageSwitcher />
            <HelpButton onClick={() => { setIsMenuOpen(false); setIsHelpOpen(true); toggleRef.current?.focus(); }} title={t('header.helpTitle')} />
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

function HelpButton({ onClick, title }) {
  return (
    <button type="button" onClick={onClick} className={ICON_BUTTON} title={title} aria-label={title}>
      <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
    </button>
  );
}

