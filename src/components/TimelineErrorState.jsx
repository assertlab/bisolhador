import { Header } from './Header';
import { SettingsModal } from './SettingsModal';

// Timeline-specific, not a generic PageErrorState: Timeline can be reached
// directly via a shared permalink with no other nav on screen, so unlike
// Ranking.jsx's bare-text error (reached only from the primary nav), this
// keeps the page chrome (Header + SettingsModal) and a way back.
export function TimelineErrorState({
  title,
  message,
  backButtonLabel,
  onBack,
  isSettingsOpen,
  setIsSettingsOpen,
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col">
      <Header onSettingsClick={() => setIsSettingsOpen(true)} />
      <div className="flex-grow flex items-center justify-center">
        <div className="text-center max-w-md">
          <svg
            className="mx-auto h-16 w-16 text-red-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">
            {title}
          </h2>
          <p className="text-gray-600 dark:text-slate-400 mb-6">
            {message}
          </p>
          <button
            onClick={onBack}
            className="px-6 py-2 bg-shark hover:bg-shark/90 text-white font-medium rounded-lg transition-colors"
          >
            {backButtonLabel}
          </button>
        </div>
      </div>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
