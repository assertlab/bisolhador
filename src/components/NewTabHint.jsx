import { usePlatformTranslation } from '../lib/platformText.js';

/** Visually hidden "(opens in a new tab)" for screen readers; goes inside a target="_blank" link. */
export function NewTabHint() {
  const { t } = usePlatformTranslation();
  return <span className="sr-only"> ({t('app.opensInNewTab')})</span>;
}
