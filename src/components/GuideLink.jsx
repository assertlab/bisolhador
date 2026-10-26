import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { guidePath } from '../utils/indicatorGuide.js';
import { linkTargetProps, useNewTab } from '../lib/newTab.js';
import { NewTabHint } from './NewTabHint.jsx';

/**
 * "Como interpretar" link to an indicator's entry on /guia. Same tab by default; a new tab inside
 * NewTabContext (Classroom results) or with an explicit newTab prop.
 */
export function GuideLink({ id, className = '', newTab }) {
  const { t } = useTranslation();
  const inNewTab = useNewTab(newTab);
  return (
    <Link to={guidePath(id)} {...linkTargetProps(inNewTab)} className={`text-xs text-ocean hover:underline ${className}`}>
      {t('guideLinks.indicator')} →
      {inNewTab && <NewTabHint />}
    </Link>
  );
}
