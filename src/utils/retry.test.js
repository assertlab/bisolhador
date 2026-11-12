import { describe, it, expect, vi } from 'vitest';

describe('withExponentialBackoff: final errors', () => {
  it('a refused token or a missing repository is not retried', async () => {
    const { withExponentialBackoff } = await import('./retry.js');
    for (const code of ['TOKEN_REJECTED', 'NOT_FOUND']) {
      const fn = vi.fn(async () => { throw Object.assign(new Error(code), { code }); });
      await expect(withExponentialBackoff(fn, 3, 1)).rejects.toMatchObject({ code });
      expect(fn).toHaveBeenCalledTimes(1);
    }
  });

  it('other failures still are', async () => {
    const { withExponentialBackoff } = await import('./retry.js');
    const fn = vi.fn().mockRejectedValueOnce(new Error('502')).mockResolvedValue('ok');
    await expect(withExponentialBackoff(fn, 3, 1)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
