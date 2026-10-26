import { useTranslation } from 'react-i18next';
import { GuideLink } from '../GuideLink.jsx';

const CAUSES = ['squash', 'otherMember', 'noTrailer', 'disabled'];

/**
 * Repository-level cross-check between sources. Neutral tone and colors (no red):
 * a disagreement is not an accusation, and the legitimate causes are always listed.
 * `skipUnverified`: reasons already explained elsewhere (e.g. the no-token note).
 */
export function AiCoherence({ coherence, skipUnverified = [] }) {
  const { t } = useTranslation();
  const unverified = coherence.unverified.filter((u) => !skipUnverified.includes(u));
  const hasFlags = coherence.flags.length > 0;
  if (!hasFlags && !coherence.toolMismatch && !coherence.coauthorDisabled && unverified.length === 0) return null;

  return (
    <div className="space-y-2">
      {hasFlags && (
        <div className="p-3 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40 text-sm text-gray-700 dark:text-slate-200">
          <h5 className="font-semibold text-gray-900 dark:text-white mb-1">{t('aiProcess.coherence.title')}</h5>
          <p className="mb-2">{t('aiProcess.coherence.intro')}</p>
          <ul className="list-disc pl-5 space-y-1">
            {coherence.flags.map((flag) => <li key={flag}>{t(`aiProcess.coherence.${flag}`)}</li>)}
          </ul>
          {coherence.coauthorDisabled && <p className="mt-2 font-medium">{t('aiProcess.coherence.coauthorDisabled')}</p>}
          <p className="mt-2">{t('aiProcess.coherence.legitimateCausesTitle')}</p>
          <ul className="list-disc pl-5">
            {CAUSES.map((cause) => <li key={cause}>{t(`aiProcess.coherence.legitimateCauses.${cause}`)}</li>)}
          </ul>
        </div>
      )}
      {coherence.toolMismatch && (
        <p className="text-xs text-gray-600 dark:text-slate-300">{t('aiProcess.coherence.toolMismatch')}</p>
      )}
      {!hasFlags && coherence.coauthorDisabled && (
        <p className="text-xs text-gray-600 dark:text-slate-300">{t('aiProcess.coherence.coauthorDisabled')}</p>
      )}
      {unverified.length > 0 && (
        <p className="text-xs text-gray-500 dark:text-slate-400">
          {t('aiProcess.coherence.unverifiedTitle')}{' '}
          {unverified.map((u) => t(`aiProcess.coherence.${u}Unverified`)).join('; ')}.
        </p>
      )}
      <GuideLink id="ai-coherence" className="inline-block" />
    </div>
  );
}
