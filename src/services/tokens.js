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

/**
 * The platform refused the request for a usage limit: 429, or GitHub's 403 with no requests left
 * (X-RateLimit-Remaining: 0) or a Retry-After (secondary limit). code RATE_LIMITED + host + resetAt
 * (ms, when the platform says and it is plausible: within a day; GitHub exposes it through CORS,
 * GitLab doesn't). Returns null for any other failure. Retrying at once can't help (isFinalError).
 */
const DAY_MS = 24 * 3600 * 1000;
export function rateLimitedError(response, host, label, { bodySaysLimit = false } = {}) {
  const { status, headers } = response;
  const remaining = headers?.get?.('x-ratelimit-remaining');
  const retryAfterRaw = headers?.get?.('retry-after');
  // Retry-After is seconds or an HTTP date
  const retryAt = retryAfterRaw == null ? null
    : /^\d+$/.test(retryAfterRaw.trim()) ? Date.now() + Number(retryAfterRaw) * 1000 : Date.parse(retryAfterRaw);
  const limited = status === 429 || (status === 403 && (remaining === '0' || Number.isFinite(retryAt) || bodySaysLimit));
  if (!limited) return null;
  const reset = Number(headers?.get?.('x-ratelimit-reset'));
  const candidate = Number.isFinite(retryAt) ? retryAt : remaining === '0' && Number.isFinite(reset) ? reset * 1000 : null;
  const now = Date.now();
  const resetAt = candidate != null && candidate > now - 60_000 && candidate <= now + DAY_MS ? candidate : null;
  return Object.assign(new Error(`${label} failed: HTTP ${status} (rate limited by ${host})`), { status, code: 'RATE_LIMITED', host, resetAt });
}

/**
 * rateLimitedError, also reading the body of a 403 that has no limit headers: GitHub's secondary
 * limit can come without Retry-After ("You have exceeded a secondary rate limit"). Reads a clone,
 * so the caller can still read the response.
 */
export async function rateLimitedFrom(response, host, label) {
  if (response.status !== 403 && response.status !== 429) return null;
  const quick = rateLimitedError(response, host, label);
  if (quick || response.status !== 403) return quick;
  const text = await response.clone().text().catch(() => '');
  return rateLimitedError(response, host, label, { bodySaysLimit: /rate limit/i.test(text) });
}
