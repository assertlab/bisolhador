import { describe, it, expect } from 'vitest';
import { tokenKey, GITHUB_TOKEN_KEY } from './tokens.js';

describe('tokenKey', () => {
  it('GitHub keeps its historical key; each GitLab host has its own', () => {
    expect(tokenKey({ provider: 'github', host: 'github.com' })).toBe(GITHUB_TOKEN_KEY);
    expect(GITHUB_TOKEN_KEY).toBe('github_token');
    expect(tokenKey({ provider: 'gitlab', host: 'gitlab.com' })).toBe('gitlab_token:gitlab.com');
    expect(tokenKey({ provider: 'gitlab', host: 'gitlab.cin.ufpe.br' })).toBe('gitlab_token:gitlab.cin.ufpe.br');
  });
});
