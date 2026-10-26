import { Tooltip } from '../Tooltip.jsx';

// Small shared pieces of the AI in the Process section.

export function InfoTip({ text }) {
  return (
    <Tooltip text={text}>
      <svg className="w-4 h-4 text-gray-300 dark:text-slate-500 hover:text-gray-500 dark:hover:text-slate-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </Tooltip>
  );
}

const CHIP_TONES = {
  trace: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  neutral: 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-200',
  green: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
};

/** Chip whose state is always in the text; color is only a secondary cue. */
export function Chip({ children, tone = 'neutral', tooltip }) {
  const chip = (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CHIP_TONES[tone]}`}>{children}</span>
  );
  return tooltip ? <Tooltip text={tooltip}>{chip}</Tooltip> : chip;
}

export function BlockTitle({ children, tooltip }) {
  return (
    <h5 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
      {children}
      {tooltip && <InfoTip text={tooltip} />}
    </h5>
  );
}
