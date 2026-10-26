import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Scrolls to the element named by the URL #hash and focuses it (keyboard and screen-reader users);
 * without one, scrolls to the top. react-router does neither on navigation. Returns the target id.
 * Pass ready=false while the page can't render its content yet (lazy texts): it scrolls once ready.
 */
export function useHashScroll(ready = true) {
  const { hash } = useLocation();
  const target = decodeURIComponent(hash.slice(1));

  useEffect(() => {
    if (!ready) return;
    const el = target && document.getElementById(target);
    if (!el) {
      window.scrollTo(0, 0);
      return;
    }
    el.scrollIntoView({ block: 'start' });
    el.focus({ preventScroll: true });
  }, [target, ready]);

  return target;
}
