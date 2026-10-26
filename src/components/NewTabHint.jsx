import { useTranslation } from 'react-i18next';

/** Visually hidden "(opens in a new tab)" for screen readers; goes inside a target="_blank" link. */
export function NewTabHint() {
  const { t } = useTranslation();
  return <span className="sr-only"> ({t('app.opensInNewTab')})</span>;
}
