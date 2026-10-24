import { describe, it, expect } from 'vitest';
import { parseSafeRepoName } from './repoName.js';

describe('parseSafeRepoName', () => {
  it.each([['facebook/react', ['facebook', 'react']], ['a.b/c_d-e', ['a.b', 'c_d-e']]])('%s → ok', (name, parts) => {
    expect(parseSafeRepoName(name)).toEqual(parts);
  });

  it.each(['facebook', 'a/b/c', '../x/y', 'a/..', 'a/b?x=1', 'a\\b/c', '/react', null, ''])('%j → null', (name) => {
    expect(parseSafeRepoName(name)).toBeNull();
  });
});
