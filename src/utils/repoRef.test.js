import { describe, it, expect } from 'vitest';
import { vi } from 'vitest';
import { parseRepoRef, withPath, repoKey, repoWebUrl, repoFileSlug, parseGitlabHosts, parseGitlabGroup, repoListName, ownerAndRepo, GITLAB_MAX_SEGMENTS } from './repoRef.js';

const HOSTS = { gitlabHosts: ['gitlab.com', 'gitlab.cin.ufpe.br'] };
const parse = (input) => parseRepoRef(input, HOSTS);

describe('parseRepoRef: GitHub (unchanged inputs)', () => {
  it.each([
    ['facebook/react', 'facebook/react'],
    ['a/b.c_d-e', 'a/b.c_d-e'],
    ['github/.github', 'github/.github'], // repository names may start with '.', '_' or '-'
    ['o/_private-notes', 'o/_private-notes'],
    ['facebook/react/tree/main', 'facebook/react'], // a GitHub page path copied without the host
    ['facebook/react/pulls', 'facebook/react'],
    ['https://github.com/c/d.git', 'c/d'],
    ['https://github.com/E/F/tree/main', 'E/F'],
    ['github.com/i/j', 'i/j'],
    ['www.github.com/i/j', 'i/j'],
    ['g/h?tab=x', 'g/h'],
    ['  o/r/  ', 'o/r'],
  ])('%j → github %s', (input, path) => {
    expect(parse(input).ref).toMatchObject({ provider: 'github', host: 'github.com', path });
  });

  it.each(['facebook', '../x/y', 'a/..', 'a/.', 'a/b"is:private', 'a\\b/c', '/react', '', null, 'https://github.com/only', '.x/repo'])('%j → invalid', (input) => {
    expect(parse(input)).toEqual({ error: 'invalid' });
  });

  it('3+ segments with no host: asks for the host instead of guessing', () => {
    expect(parse('group/sub/project')).toEqual({ error: 'hostRequired' });
  });
});

describe('parseRepoRef: GitLab', () => {
  it.each([
    ['gitlab.com/group/project', 'gitlab.com', ['group', 'project']],
    ['https://gitlab.com/g/sub/p', 'gitlab.com', ['g', 'sub', 'p']],
    ['https://gitlab.cin.ufpe.br/grupo/projeto/-/tree/main?ref_type=heads', 'gitlab.cin.ufpe.br', ['grupo', 'projeto']],
    ['HTTPS://GitLab.com/_infra/tool.git', 'gitlab.com', ['_infra', 'tool']],
  ])('%j → %s %j', (input, host, segments) => {
    expect(parse(input).ref).toEqual({ provider: 'gitlab', host, path: segments.join('/'), segments });
  });

  it('a host outside the allow-list is refused (fail-closed), with or without a scheme', () => {
    expect(parse('https://gitlab.example.org/g/p')).toEqual({ error: 'hostNotAllowed' });
    expect(parse('bitbucket.org/o/r')).toEqual({ error: 'hostNotAllowed' });
    expect(parse('a.b/c')).toEqual({ error: 'hostNotAllowed' }); // GitHub owners have no dots
    expect(parseRepoRef('gitlab.cin.ufpe.br/projeto', { gitlabHosts: ['gitlab.com'] })).toEqual({ error: 'hostNotAllowed' });
    expect(parseRepoRef('https://gitlab.cin.ufpe.br/g/p', { gitlabHosts: ['gitlab.com'] })).toEqual({ error: 'hostNotAllowed' });
  });

  it.each([
    'gitlab.com/only',
    'gitlab.com/-g/p',
    'gitlab.com/.hidden/p',
    'gitlab.com/g/../p',
    'gitlab.com/g/p.atom',
    'gitlab.com/g/p%2Fx',
    'gitlab.com/g/p;rm',
    `gitlab.com/${Array.from({ length: GITLAB_MAX_SEGMENTS + 1 }, (_, i) => `s${i}`).join('/')}`,
  ])('%j → invalid', (input) => {
    expect(parse(input)).toEqual({ error: 'invalid' });
  });
});

describe('ref helpers', () => {
  const gl = parse('https://gitlab.cin.ufpe.br/Grupo/Sub/Projeto').ref;
  const gh = parse('facebook/react').ref;

  it('repoKey tells platforms apart and ignores case', () => {
    expect(repoKey(gl)).toBe('gitlab.cin.ufpe.br/grupo/sub/projeto');
    expect(repoKey(gh)).toBe('github.com/facebook/react');
    expect(repoKey(parse('gitlab.com/facebook/react').ref)).not.toBe(repoKey(gh));
  });

  it('repoWebUrl and repoFileSlug', () => {
    expect(repoWebUrl(gl)).toBe('https://gitlab.cin.ufpe.br/Grupo/Sub/Projeto');
    expect(repoWebUrl(gh)).toBe('https://github.com/facebook/react');
    expect(repoFileSlug('a/b/c')).toBe('a-b-c');
  });

  it('withPath keeps the platform and validates the new path', () => {
    expect(withPath(gh, 'react/react')).toMatchObject({ provider: 'github', path: 'react/react' });
    expect(withPath(gl, 'grupo/novo')).toMatchObject({ provider: 'gitlab', host: 'gitlab.cin.ufpe.br', path: 'grupo/novo' });
    expect(withPath(gh, 'evil/../x')).toBeNull();
    expect(withPath(gh, 'a/b/c')).toBeNull();
    expect(withPath(gh, 'o/r/tree')).toBeNull(); // not truncated like typed input
    expect(withPath(gh, 'org/.github')).toMatchObject({ path: 'org/.github' });
  });
});

describe('parseGitlabHosts', () => {
  it('always gitlab.com; adds valid host names, lowercased and deduplicated', () => {
    expect(parseGitlabHosts(undefined)).toEqual(['gitlab.com']);
    expect(parseGitlabHosts(' GitLab.CIn.ufpe.br, gitlab.com,gitlab.cin.ufpe.br ')).toEqual(['gitlab.com', 'gitlab.cin.ufpe.br']);
  });

  it('drops anything that is not a host name, and github.com, with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseGitlabHosts('https://x.org,evil.com/path,*.foo.com,localhost,10.0.0.1,github.com,ok.example.org')).toEqual(['gitlab.com', 'ok.example.org']);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('accepts a host with a port, which parseRepoRef then matches', () => {
    const hosts = parseGitlabHosts('git.example.edu:8443');
    expect(hosts).toEqual(['gitlab.com', 'git.example.edu:8443']);
    expect(parseRepoRef('https://git.example.edu:8443/g/p', { gitlabHosts: hosts }).ref).toMatchObject({ provider: 'gitlab', host: 'git.example.edu:8443', path: 'g/p' });
  });
});

describe('Classroom helpers', () => {
  it('repoListName round-trips through parseRepoRef; ownerAndRepo splits the namespace', () => {
    for (const input of ['facebook/react', 'gitlab.cin.ufpe.br/g/sub/p']) {
      const { ref } = parse(input);
      expect(repoListName(ref)).toBe(input);
      expect(parse(repoListName(ref)).ref).toEqual(ref);
    }
    expect(ownerAndRepo(parse('gitlab.com/g/sub/p').ref)).toEqual(['g/sub', 'p']);
    expect(ownerAndRepo(parse('o/r').ref)).toEqual(['o', 'r']);
  });

  it('parseGitlabGroup: allowed host + safe group path; anything else null', () => {
    expect(parseGitlabGroup('gitlab.cin.ufpe.br/disciplina/2026-1', HOSTS)).toEqual({ host: 'gitlab.cin.ufpe.br', path: 'disciplina/2026-1' });
    expect(parseGitlabGroup('https://gitlab.com/grupo/', HOSTS)).toEqual({ host: 'gitlab.com', path: 'grupo' });
    expect(parseGitlabGroup('https://gitlab.com/grupo/sub/-/merge_requests', HOSTS)).toEqual({ host: 'gitlab.com', path: 'grupo/sub' });
    for (const bad of ['ufpe-org', 'gitlab.example.org/g', 'gitlab.com', 'gitlab.com/../x', 'gitlab.com/-g']) expect(parseGitlabGroup(bad, HOSTS), bad).toBeNull();
  });
});
