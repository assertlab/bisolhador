import { describe, it, expect } from 'vitest';
import { parseRepoList, parsePeriod, analyzeCommitHistory, releasesInPeriod, analyzeTeamRepo, CLASSROOM_MAX_REPOS } from './classroom.js';
import { parseAiRepoContext } from './aiProcess.js';

describe('parseRepoList', () => {
  it('accepts owner/repo and GitHub URLs, any separator; dedupes case-insensitively', () => {
    const r = parseRepoList('a/b\nhttps://github.com/c/d.git, https://github.com/E/F/tree/main  a/B;g/h?tab=x github.com/i/j');
    expect(r).toEqual({ repos: ['a/b', 'c/d', 'E/F', 'g/h', 'i/j'], invalid: [], truncated: false });
  });

  it('rejects names that are not safe owner/repo (they go into a search query)', () => {
    const r = parseRepoList('ok/repo  justname  ../x  a/b"is:private');
    expect(r.repos).toEqual(['ok/repo']);
    expect(r.invalid).toEqual(['justname', '../x', 'a/b"is:private']);
  });

  it(`caps at ${CLASSROOM_MAX_REPOS}`, () => {
    const r = parseRepoList(Array.from({ length: 60 }, (_, i) => `o/r${i}`).join('\n'));
    expect(r.repos).toHaveLength(CLASSROOM_MAX_REPOS);
    expect(r.truncated).toBe(true);
  });
});

describe('parsePeriod', () => {
  it('UTC day bounds; invalid or inverted → null', () => {
    expect(parsePeriod('2026-08-01', '2026-11-30')).toEqual({ from: '2026-08-01', to: '2026-11-30', since: '2026-08-01T00:00:00.000Z', until: '2026-11-30T23:59:59.000Z' });
    expect(parsePeriod('2026-11-30', '2026-08-01')).toBeNull();
    expect(parsePeriod('2026-13-01', '2026-12-01')).toBeNull();
    expect(parsePeriod('', '2026-12-01')).toBeNull();
  });
});

const node = (login, { msg = 'feat: x', parents = 1, name } = {}) => ({ message: msg, parents: { totalCount: parents }, author: { name: name ?? login ?? 'Someone', user: login ? { login } : null } });

describe('analyzeCommitHistory', () => {
  it('active authors and top share over human non-merge commits; merges and bots excluded', () => {
    const r = analyzeCommitHistory({ totalCount: 8, capped: false, nodes: [
      node('ana'), node('ana'), node('ana'), node('bia', { msg: 'wip' }), node(null, { name: 'Carlos' }),
      node('ana', { parents: 2, msg: 'Merge branch' }), node('dependabot[bot]'), node(null, { name: 'Renovate Bot' }),
    ] });
    expect(r).toMatchObject({ available: true, commits: 8, authors: 3, topSharePercentage: 60, sampled: 8 });
    expect(r.conventional).toMatchObject({ available: true, percentage: 80, n: 5 });
  });

  it('failed fetch → unavailable; no human commits → null share', () => {
    expect(analyzeCommitHistory(null)).toEqual({ available: false, reason: 'error' });
    expect(analyzeCommitHistory({ totalCount: 1, capped: false, nodes: [node('dependabot[bot]')] }).topSharePercentage).toBeNull();
  });
});

describe('releasesInPeriod', () => {
  const p = parsePeriod('2026-08-01', '2026-11-30');
  it('counts by min(tag date, publication); drafts excluded', () => {
    expect(releasesInPeriod([
      { created_at: '2026-09-01T00:00:00Z', published_at: '2026-09-02T00:00:00Z' },
      { created_at: '2026-07-01T00:00:00Z', published_at: '2026-08-15T00:00:00Z' }, // tag before the period
      { created_at: '2026-10-01T00:00:00Z', published_at: '2026-10-01T00:00:00Z', draft: true },
    ], p)).toEqual({ count: 1, capped: false });
    expect(releasesInPeriod(null, p)).toBeNull();
  });

  it('a full page (100) whose oldest release is inside the period is a minimum', () => {
    const many = Array.from({ length: 100 }, (_, i) => ({ created_at: `2026-09-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`, published_at: '2026-10-01T00:00:00Z' }));
    expect(releasesInPeriod(many, p)).toEqual({ count: 100, capped: true });
  });
});

describe('analyzeTeamRepo', () => {
  const p = parsePeriod('2026-08-01', '2026-11-30');
  const ok = (value) => ({ status: 'fulfilled', value });
  const fail = { status: 'rejected', reason: new Error('x') };
  const pr = (approved) => ({ user: { login: 'a', type: 'User' }, merged_by: { login: 'a' }, created_at: '2026-09-01T00:00:00Z', merged_at: '2026-09-01T10:00:00Z', comments: 0, review_comments: 0, approvedByOther: approved, firstReviewAt: approved ? '2026-09-01T02:00:00Z' : null, readyAt: '2026-09-01T00:00:00Z', changedLines: 100 });

  it('uses every PR merged in the period (not only 50) and each part fails on its own', () => {
    const stats = Array.from({ length: 60 }, (_, i) => pr(i % 2 === 0));
    const row = analyzeTeamRepo({ history: fail, prs: ok({ capped: false, stats }), runs: ok({ total_count: 0, workflow_runs: [] }), releases: fail }, p);
    expect(row.prs).toMatchObject({ available: true, merged: 60, approvedPercentage: 50, firstReviewHours: 2, prSizeLines: 100, leadTimeHours: 10, capped: false });
    expect(row.commits).toEqual({ available: false, reason: 'error' });
    expect(row.ci).toMatchObject({ available: false, reason: 'noRuns' });
    expect(row.releases).toBeNull();
  });

  it('no merged PRs (teams pushing straight to main) → 0 merged, review columns N/A', () => {
    const row = analyzeTeamRepo({ history: fail, prs: ok({ capped: false, stats: [] }), runs: fail, releases: ok([]) }, p);
    expect(row.prs).toMatchObject({ merged: 0, approvedPercentage: null, firstReviewHours: null });
    expect(row.releases).toEqual({ count: 0, capped: false });
  });

  const node = (o = {}) => ({ message: 'fix', committedDate: '2026-09-02T00:00:00Z', parents: { totalCount: 1 }, author: { name: 'Alice', email: 'a@x.io', user: { login: 'alice' } }, ...o });
  const history = ok({ totalCount: 2, capped: false, nodes: [node(), node({ message: 'x\n\nCo-Authored-By: Claude <noreply@anthropic.com>' })] });
  // The hook parses the context once (Classroom may read a private template) and passes it in
  const parsed = (raw) => parseAiRepoContext(raw, { allowPrivateTemplate: true });

  it('AI: repository section without people, students in memory; context failure → config unavailable, authorship n/d', () => {
    const row = analyzeTeamRepo({ history, prs: ok({ capped: false, stats: [] }), runs: fail, releases: fail }, p, { ctx: null, authorship: null });
    expect(row.ai).toMatchObject({ available: true, withToken: true, config: { status: 'unavailable' }, commits: { n: 2, withAi: 1 } });
    expect(JSON.stringify(row.ai)).not.toContain('alice');
    expect(row.students).toMatchObject({ available: true, authorshipAvailable: false, sampled: false });
    expect(row.students.rows).toEqual([expect.objectContaining({ login: 'alice', commits: 2, withAi: 1 })]);
    expect(row.commits).toMatchObject({ commits: 2, authors: 1 }); // existing indicators unchanged
  });

  it('AI: a failed directory listing leaves the configuration not fully verified', () => {
    const raw = { repository: { d0: { entries: [] }, templateRepository: null }, errors: [{ message: 'x', path: ['repository', 'd6'] }] };
    const row = analyzeTeamRepo({ history, prs: ok({ capped: false, stats: [] }), runs: fail, releases: fail }, p, { ctx: parsed(raw), authorship: [] });
    expect(row.ai.config.status).toBe('incomplete');
    expect(row.ai.coherence.unverified).toContain('config');
  });

  it('AI: configuration is read only in known locations (status partial); a private template counts', () => {
    const raw = { repository: {
      d0: { entries: [{ name: 'AGENTS.md', type: 'blob' }] },
      templateRepository: { nameWithOwner: 'prof/template', isPrivate: true, d0: { entries: [{ name: 'AGENTS.md', type: 'blob' }] } },
    }, errors: [] };
    const row = analyzeTeamRepo({ history, prs: ok({ capped: false, stats: [] }), runs: fail, releases: fail }, p, { ctx: parsed(raw), authorship: [] });
    expect(row.ai.config.status).toBe('partial');
    expect(row.ai.config.entries).toEqual([expect.objectContaining({ path: 'AGENTS.md', fromTemplate: true })]);
    expect(row.ai.coherence.unverified).not.toContain('config');
  });

  it('AI: github-classroom files are template, not student configuration', () => {
    const raw = { repository: { d0: { entries: [{ name: 'CLAUDE.md', type: 'blob' }, { name: 'AGENTS.md', type: 'blob' }] }, templateRepository: null } };
    const authorship = [
      { path: 'CLAUDE.md', complete: true, commits: [{ login: 'github-classroom[bot]', date: '2026-07-01T00:00:00Z' }] },
      { path: 'AGENTS.md', complete: true, commits: [{ login: 'alice', date: '2026-09-02T00:00:00Z' }, { login: 'github-classroom[bot]', date: '2026-07-01T00:00:00Z' }] },
    ];
    const row = analyzeTeamRepo({ history, prs: ok({ capped: false, stats: [] }), runs: fail, releases: fail }, p, { ctx: parsed(raw), authorship });
    expect(row.ai.config.entries.map((e) => [e.path, e.fromTemplate])).toEqual([['CLAUDE.md', true], ['AGENTS.md', true]]);
    expect(row.students.rows[0].configPaths).toEqual([]);
  });
});
