import { useEffect, useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isLocaleLoaded, loadLocale, markLocaleInUse, bundleLanguage } from '../lib/lazyLocales.js';

/**
 * Loads a page-only locale bundle (src/lib/lazyLocales.js) for the current language, and again
 * when the language changes. Returns 'ready' | 'loading' | 'error'; render the texts only when
 * 'ready', otherwise t() would return raw keys.
 */
export function useLazyLocale(name) {
  const { i18n } = useTranslation();
  const lng = bundleLanguage(i18n.language);
  const ready = isLocaleLoaded(i18n, name, lng);
  const [failedLng, setFailedLng] = useState(null);
  const [, rerender] = useReducer((n) => n + 1, 0);

  useEffect(() => markLocaleInUse(name), [name]);

  useEffect(() => {
    if (ready) return undefined;
    let alive = true;
    loadLocale(i18n, name, lng).then(
      () => alive && rerender(),
      (error) => {
        console.error(`[i18n] Failed to load the "${name}" texts (${lng})`, error);
        if (alive) setFailedLng(lng);
      },
    );
    return () => { alive = false; };
  }, [i18n, name, lng, ready]);

  if (ready) return 'ready';
  return failedLng === lng ? 'error' : 'loading';
}
