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
