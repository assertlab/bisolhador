import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// GA must go off before the name of a repository that may be private reaches the URL (?q=):
// GA4 enhanced measurement would send it (history page views, site search on `q`).
const { tokens } = vi.hoisted(() => ({ tokens: new Set() }));
vi.mock('react-ga4', () => ({ default: { initialize: vi.fn(), gtag: vi.fn(), send: vi.fn(), event: vi.fn() } }));
vi.mock('./supabase.js', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('./tokens.js', () => ({ hasToken: (ref) => tokens.has(ref.provider === 'github' ? 'github' : ref.host) }));

import analytics, { searchMayBePrivate } from './analytics.js';

const GA_ID = 'G-TEST';
const flag = () => window[`ga-disable-${GA_ID}`];

beforeEach(() => {
  tokens.clear();
  vi.stubEnv('VITE_GA_ID', GA_ID);
  vi.stubGlobal('window', { location: { origin: 'https://bisolhador.assertlab.com', pathname: '/', search: '' } });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('searchMayBePrivate', () => {
  it('only with a token for that platform and host (without one, a private repository answers 404)', () => {
    expect(searchMayBePrivate('o/r')).toBe(false);
    tokens.add('github');
    expect(searchMayBePrivate('o/r')).toBe(true);
    expect(searchMayBePrivate('https://github.com/o/r')).toBe(true);
    expect(searchMayBePrivate('gitlab.com/g/p')).toBe(false); // the GitHub token doesn't reach GitLab
    tokens.add('gitlab.com');
    expect(searchMayBePrivate('gitlab.com/g/sub/p')).toBe(true);
  });

  it('invalid or empty input is never "private" (it is refused before any request)', () => {
    tokens.add('github');
    for (const input of [null, undefined, '', 'x', 'a/b/c']) expect(searchMayBePrivate(input)).toBe(false);
  });
});

describe('GA switched off for a possibly private search', () => {
  it('disableIfPrivateSearch: off with a token, untouched without one', () => {
    analytics.disableIfPrivateSearch('o/r');
    expect(flag()).toBeUndefined();
    tokens.add('github');
    analytics.disableIfPrivateSearch('o/r');
    expect(flag()).toBe(true);
  });

  it('initialize: a Dashboard link opened directly (/?q=…) with a token turns GA off before anything is sent', () => {
    tokens.add('github');
    window.location.search = '?q=o%2Fr';
    analytics.initialize();
    expect(flag()).toBe(true);
  });

  it('initialize: a public-only visit keeps GA', () => {
    window.location.search = '?q=o%2Fr';
    analytics.initialize();
    expect(flag()).toBeUndefined();
  });

  it('once off, page views are not sent for the rest of the session', async () => {
    const ReactGA = (await import('react-ga4')).default;
    ReactGA.send.mockClear();
    analytics.disable();
    analytics.trackPageView('/ranking');
    expect(ReactGA.send).not.toHaveBeenCalled();
  });
});
