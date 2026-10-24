import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { guidePath } from '../utils/indicatorGuide.js';

/** "Como interpretar" link to an indicator's entry on /guia. */
export function GuideLink({ id, className = '' }) {
  const { t } = useTranslation();
  return (
    <Link to={guidePath(id)} className={`text-xs text-ocean hover:underline ${className}`}>
      {t('guide.link')} →
    </Link>
  );
}
