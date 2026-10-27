import { useTranslation } from 'react-i18next';
import { GuideLink } from '../GuideLink.jsx';
import { badgeScoreText } from '../../utils/aiProcess.js';
import { BlockTitle, Chip } from './AiParts.jsx';

const STATE_TONE = { met: 'green', unmet: 'neutral', na: 'neutral', unverified: 'neutral' };

/**
 * "Responsible AI use" badge: observable practices and coherence between traces.
 * Not applicable without any AI trace (never a 0 score); 'na'/'unverified' are out of the denominator.
 */
export function AiResponsibleBadge({ badge }) {
  const { t } = useTranslation();
  const complete = badge.applicable && badge.total > 0 && badge.met === badge.total;
  let summary;
  if (!badge.applicable) summary = t('aiProcess.badge.notApplicable');
  else if (badge.total === 0) summary = t('aiProcess.badge.noCriteria');
  else summary = badgeScoreText(badge, t);

  return (
    <div>
      <BlockTitle tooltip={t('aiProcess.badge.tooltip')}>
        {t('aiProcess.badge.title')}
        <Chip tone={complete ? 'green' : 'neutral'}>{summary}</Chip>
      </BlockTitle>
      {badge.applicable && (
        <ul className="flex flex-wrap gap-2">
          {badge.criteria.map((c) => (
            <li key={c.id}>
              <Chip tone={STATE_TONE[c.state]}>
                {t(`aiProcess.badge.criteria.${c.id}`)} {t(`aiProcess.badge.states.${c.state}`)}
              </Chip>
            </li>
          ))}
        </ul>
      )}
      <GuideLink id="ai-badge" className="mt-2 inline-block" />
    </div>
  );
}
