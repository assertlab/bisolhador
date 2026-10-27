import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../services/analytics.js', () => ({ default: { trackRouteError: vi.fn() } }));
vi.mock('../lib/chunkErrors.js', async (importOriginal) => ({ ...(await importOriginal()), claimAutoReload: vi.fn() }));

const { RouteErrorBoundary } = await import('./RouteErrorBoundary.jsx');
const { default: analytics } = await import('../services/analytics.js');
const { claimAutoReload } = await import('../lib/chunkErrors.js');

const chunkError = new TypeError('Failed to fetch dynamically imported module: https://x/assets/Guide-abc.js');
const crash = new TypeError("Cannot read properties of undefined (reading 'x')");

describe('RouteErrorBoundary', () => {
  let reload;
  beforeEach(() => {
    reload = vi.fn();
    vi.stubGlobal('window', { location: { reload } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(claimAutoReload).mockReset();
    vi.mocked(analytics.trackRouteError).mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('turns a thrown error into state (rendered as the error page, not a blank screen)', () => {
    expect(RouteErrorBoundary.getDerivedStateFromError(crash)).toEqual({ error: crash });
  });

  it('a chunk error reloads once when the guard allows it, and reports kind "chunk"', () => {
    vi.mocked(claimAutoReload).mockReturnValue(true);
    new RouteErrorBoundary({}).componentDidCatch(chunkError, { componentStack: '' });
    expect(reload).toHaveBeenCalledTimes(1);
    expect(analytics.trackRouteError).toHaveBeenCalledWith('chunk');
  });

  it('a chunk error does not reload when the guard refuses (second failure, offline, no storage)', () => {
    vi.mocked(claimAutoReload).mockReturnValue(false);
    new RouteErrorBoundary({}).componentDidCatch(chunkError, {});
    expect(reload).not.toHaveBeenCalled();
  });

  it('an ordinary render crash never reloads, and reports kind "render"', () => {
    vi.mocked(claimAutoReload).mockReturnValue(true);
    new RouteErrorBoundary({}).componentDidCatch(crash, {});
    expect(reload).not.toHaveBeenCalled();
    expect(claimAutoReload).not.toHaveBeenCalled();
    expect(analytics.trackRouteError).toHaveBeenCalledWith('render');
  });

  it('the error clears when the route changes, and only then', () => {
    const boundary = new RouteErrorBoundary({ resetKey: '/guia' });
    boundary.setState = vi.fn();
    boundary.state = { error: crash };
    boundary.props = { resetKey: '/guia' };
    boundary.componentDidUpdate({ resetKey: '/guia' });
    expect(boundary.setState).not.toHaveBeenCalled();
    boundary.props = { resetKey: '/' };
    boundary.componentDidUpdate({ resetKey: '/guia' });
    expect(boundary.setState).toHaveBeenCalledWith({ error: null });
  });
});
