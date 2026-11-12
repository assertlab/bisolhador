// Access tokens per platform and host, in the browser's localStorage (the
// same safe wrapper as before). GitHub keeps its historical key; each GitLab
// instance gets its own, so a gitlab.cin.ufpe.br token is never sent to
// gitlab.com or the other way round (docs/ESTUDO_GITLAB.md, section 3.4).
import { getItem } from '../utils/storage.js';

export const GITHUB_TOKEN_KEY = 'github_token';

/** Ref for code that only talks to GitHub (githubService). */
export const GITHUB_REF = Object.freeze({ provider: 'github', host: 'github.com' });

/** localStorage key for the ref's platform and host. */
export const tokenKey = (ref) => (ref.provider === 'github' ? GITHUB_TOKEN_KEY : `gitlab_token:${ref.host}`);

export const getToken = (ref) => getItem(tokenKey(ref)) || null;

export const hasToken = (ref) => Boolean(getToken(ref));

/**
 * The platform refused the token that was sent (HTTP 401 with a token: wrong, revoked or expired).
 * code TOKEN_REJECTED + host, so the page says which token to fix instead of a generic failure.
 * Without a token, a 401 is just "needs login" and stays a plain HTTP error.
 */
export function tokenRejectedError(host, label) {
  return Object.assign(new Error(`${label} failed: HTTP 401 (token rejected by ${host})`), { status: 401, code: 'TOKEN_REJECTED', host });
}
