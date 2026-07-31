// Full-page centered spinner, shared by any page that shows a bare loading
// state before it has enough data to render its own layout (no Header —
// pages using this haven't decided yet whether there's anything to show
// chrome around). Timeline.jsx and Ranking.jsx both had this inline,
// byte-identical except for the message.
export function PageLoadingState({ message }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-shark mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-slate-400">{message}</p>
      </div>
    </div>
  );
}
