import { describe, it, expect } from 'vitest';
import { tokenKey, GITHUB_TOKEN_KEY, rateLimitedError } from './tokens.js';

describe('tokenKey', () => {
  it('GitHub keeps its historical key; each GitLab host has its own', () => {
    expect(tokenKey({ provider: 'github', host: 'github.com' })).toBe(GITHUB_TOKEN_KEY);
    expect(GITHUB_TOKEN_KEY).toBe('github_token');
    expect(tokenKey({ provider: 'gitlab', host: 'gitlab.com' })).toBe('gitlab_token:gitlab.com');
    expect(tokenKey({ provider: 'gitlab', host: 'gitlab.cin.ufpe.br' })).toBe('gitlab_token:gitlab.cin.ufpe.br');
  });
});

describe('rateLimitedError', () => {
  const res = (status, headers = {}) => ({ status, headers: new Headers(headers) });

  it('429, or GitHub 403 with no requests left / Retry-After → RATE_LIMITED with the reset time when given', () => {
    expect(rateLimitedError(res(429), 'gitlab.cin.ufpe.br', 'x')).toMatchObject({ code: 'RATE_LIMITED', host: 'gitlab.cin.ufpe.br', resetAt: null });
    const reset = Math.floor(Date.now() / 1000) + 600;
    expect(rateLimitedError(res(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) }), 'github.com', 'x'))
      .toMatchObject({ code: 'RATE_LIMITED', resetAt: reset * 1000 });
    const before = Date.now();
    const secondary = rateLimitedError(res(403, { 'retry-after': '60' }), 'github.com', 'x');
    expect(secondary.resetAt).toBeGreaterThanOrEqual(before + 60000);
  });

  it('an implausible reset (years ahead, garbage) is dropped, the limit is kept', () => {
    expect(rateLimitedError(res(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '99999999999' }), 'github.com', 'x')).toMatchObject({ code: 'RATE_LIMITED', resetAt: null });
    expect(rateLimitedError(res(429, { 'retry-after': '1e20' }), 'gitlab.com', 'x')).toMatchObject({ resetAt: null });
  });

  it('Retry-After as an HTTP date', () => {
    const at = new Date(Date.now() + 120000).toUTCString();
    expect(rateLimitedError(res(403, { 'retry-after': at }), 'github.com', 'x').resetAt).toBe(Date.parse(at));
  });

  it('GitHub secondary limit with no headers: read from the body', async () => {
    const { rateLimitedFrom } = await import('./tokens.js');
    const limited = new Response('{"message":"You have exceeded a secondary rate limit"}', { status: 403 });
    await expect(rateLimitedFrom(limited, 'github.com', 'x')).resolves.toMatchObject({ code: 'RATE_LIMITED', resetAt: null });
    const noAccess = new Response('{"message":"Resource not accessible"}', { status: 403 });
    await expect(rateLimitedFrom(noAccess, 'github.com', 'x')).resolves.toBeNull();
  });

  it('any other 403 (no access) is not a usage limit', () => {
    expect(rateLimitedError(res(403, { 'x-ratelimit-remaining': '40' }), 'github.com', 'x')).toBeNull();
    expect(rateLimitedError(res(500), 'github.com', 'x')).toBeNull();
  });
});
