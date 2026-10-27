// Failed dynamic imports surface with browser-specific messages (Chromium, Firefox, Safari) and
// Vite's own preload helper; there is no stable error class to test for.
const CHUNK_ERROR_PATTERNS = [
  /failed to fetch dynamically imported module/i, // Chromium
  /error loading dynamically imported module/i, // Firefox
  /importing a module script failed/i, // Safari
  /unable to preload css/i, // Vite
  /ChunkLoadError/i,
];

export const isChunkLoadError = (error) => {
  const text = `${error?.name ?? ''} ${error?.message ?? ''}`;
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(text));
};

const RELOAD_KEY = 'bisolhador:chunk-reload';
export const RELOAD_WINDOW_MS = 60_000;

/**
 * One automatic reload per window for a chunk that no longer exists (a tab opened before a deploy):
 * the reload fetches the new index.html with the new hashes. A second failure inside the window
 * means the reload didn't fix it (chunk really missing): no loop, the user sees the error. Without
 * usable storage there is no loop guard, so no automatic reload either; offline there is nothing to
 * reload into (the browser would swap the app for its own offline page).
 * `storage` is resolved inside the try: the sessionStorage getter itself throws when site data is blocked.
 */
export function claimAutoReload(storage, now = Date.now(), online = globalThis.navigator?.onLine) {
  if (online === false) return false;
  try {
    storage ??= globalThis.sessionStorage;
    const last = Number(storage.getItem(RELOAD_KEY));
    if (Number.isFinite(last) && last > 0 && now - last < RELOAD_WINDOW_MS) return false;
    storage.setItem(RELOAD_KEY, String(now));
    return true;
  } catch {
    return false;
  }
}
