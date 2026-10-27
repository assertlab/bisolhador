import { describe, it, expect } from 'vitest';
import { isChunkLoadError, claimAutoReload, RELOAD_WINDOW_MS } from './chunkErrors.js';

const memory = () => {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
};

describe('isChunkLoadError', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://x/assets/Guide-abc.js',
    'error loading dynamically imported module: https://x/assets/Guide-abc.js',
    'Importing a module script failed.',
    'Unable to preload CSS for /assets/x.css',
  ])('recognizes %s', (message) => {
    expect(isChunkLoadError(new TypeError(message))).toBe(true);
  });

  it('recognizes ChunkLoadError by name', () => {
    expect(isChunkLoadError(Object.assign(new Error('x'), { name: 'ChunkLoadError' }))).toBe(true);
  });

  it('leaves ordinary render errors alone', () => {
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'x')"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});

describe('claimAutoReload', () => {
  it('allows one reload, then none inside the window (no reload loop)', () => {
    const storage = memory();
    expect(claimAutoReload(storage, 1_000_000)).toBe(true);
    expect(claimAutoReload(storage, 1_000_000 + 5_000)).toBe(false);
    expect(claimAutoReload(storage, 1_000_000 + RELOAD_WINDOW_MS - 1)).toBe(false);
  });

  it('allows another after the window, e.g. a later deploy', () => {
    const storage = memory();
    claimAutoReload(storage, 1_000_000);
    expect(claimAutoReload(storage, 1_000_000 + RELOAD_WINDOW_MS)).toBe(true);
  });

  it('never reloads offline: the browser would show its own offline page instead of the app', () => {
    expect(claimAutoReload(memory(), 1_000_000, false)).toBe(false);
  });

  it('a throwing sessionStorage getter (blocked site data) is "no storage", not an exception', () => {
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
    try {
      expect(claimAutoReload()).toBe(false);
    } finally {
      delete globalThis.sessionStorage;
    }
  });

  it('never reloads without usable storage: nothing guards the loop', () => {
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => {} };
    expect(claimAutoReload(broken, 1_000_000, true)).toBe(false);
    expect(claimAutoReload(null, 1_000_000, true)).toBe(false);
  });
});
