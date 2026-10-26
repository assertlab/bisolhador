import { describe, it, expect } from 'vitest';
import { analyzeStudents, templateFromAuthorship, authorshipPaths, classroomAiContext } from './aiClassroom.js';

const period = { since: '2026-08-01T00:00:00.000Z', until: '2026-10-26T23:59:59.000Z' };
const inPeriod = '2026-09-10T12:00:00Z';
const beforePeriod = '2026-07-01T12:00:00Z';
const c = (o = {}) => ({
  message: 'fix', authorLogin: 'alice', authorName: 'Alice', authorEmail: 'alice@example.com', authorType: null, date: inPeriod, parents: 1, ...o,
});
const rowOf = (r, kind, login) => r.rows.find((x) => x.kind === kind && (login === undefined || x.login === login));

describe('analyzeStudents', () => {
  it('groups by login; agent-authored commits get an agent row; unlinked go to one unidentified row', () => {
    const r = analyzeStudents([
      c({ authorLogin: 'alice', message: 'x\n\nCo-Authored-By: Claude <noreply@anthropic.com>' }),
      c({ authorLogin: 'alice' }),
      c({ authorLogin: null, authorName: 'Copilot', authorEmail: '198982749+Copilot@users.noreply.github.com' }),
      c({ authorLogin: null, authorName: 'Bob Laptop' }),
      c({ authorLogin: null, authorName: 'bob' }),
    ], null, period, null);
    expect(r.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'person', login: 'alice', commits: 2, withAi: 1, percentage: 50, tools: ['claude'] }),
      expect.objectContaining({ kind: 'agent', agentToolId: 'copilot', commits: 1, withAi: 1 }),
      expect.objectContaining({ kind: 'unidentified', commits: 2 }),
    ]));
    expect(r.rows).toHaveLength(3);
    expect(r.authorshipAvailable).toBe(false);
  });

  it('config authorship in period, template-origin paths excluded', () => {
    const authorship = [{ path: 'CLAUDE.md', complete: true, commits: [{ login: 'alice', date: inPeriod }, { login: 'github-classroom[bot]', date: beforePeriod }] }];
    expect(templateFromAuthorship(authorship)).toEqual(new Set(['CLAUDE.md']));
    const r = analyzeStudents([c({ authorLogin: 'alice' })], authorship, period, new Set(['CLAUDE.md']));
    expect(r.rows[0].configPaths).toEqual([]);
    expect(r.authorshipAvailable).toBe(true);
  });

  it('configPaths: only commits in the period by that login (case and [bot] suffix ignored)', () => {
    const authorship = [
      { path: 'AGENTS.md', complete: true, commits: [{ login: 'Alice', date: inPeriod }] },
      { path: 'CLAUDE.md', complete: true, commits: [{ login: 'alice', date: beforePeriod }] },
      { path: '.cursor/rules/a.mdc', complete: false, commits: [{ login: 'bob', date: inPeriod }] },
    ];
    const r = analyzeStudents([c({ authorLogin: 'alice' }), c({ authorLogin: 'bob' })], authorship, period, new Set());
    expect(rowOf(r, 'person', 'alice').configPaths).toEqual(['AGENTS.md']);
    expect(rowOf(r, 'person', 'bob').configPaths).toEqual(['.cursor/rules/a.mdc']);
  });

  it('agent rows get config paths authored by that agent; unidentified rows never do', () => {
    const authorship = [{ path: 'AGENTS.md', complete: true, commits: [{ login: 'Copilot', name: 'Copilot', date: inPeriod }, { login: null, name: 'Bob', date: inPeriod }] }];
    const r = analyzeStudents([c({ authorLogin: 'Copilot', authorName: 'Copilot' }), c({ authorLogin: null, authorName: 'Bob' })], authorship, period, new Set());
    expect(rowOf(r, 'agent').configPaths).toEqual(['AGENTS.md']);
    expect(rowOf(r, 'unidentified').configPaths).toEqual([]);
  });

  it('maintenance bots and merges are out of the base; logins are grouped case-insensitively', () => {
    const r = analyzeStudents([
      c({ authorLogin: 'dependabot[bot]', authorName: 'dependabot[bot]' }),
      c({ authorLogin: 'github-actions', authorName: 'github-actions[bot]' }),
      c({ authorLogin: 'alice', parents: 2 }),
      c({ authorLogin: 'Alice' }),
      c({ authorLogin: 'alice' }),
    ], [], period, new Set());
    expect(r.rows).toEqual([expect.objectContaining({ kind: 'person', commits: 2, withAi: 0, percentage: 0, tools: [] })]);
  });

  it('rows: people by commits, then agents, then unidentified; rows sum to the base', () => {
    const r = analyzeStudents([
      c({ authorLogin: null, authorName: 'x' }),
      c({ authorLogin: 'claude', authorName: 'claude[bot]' }),
      c({ authorLogin: 'bob' }), c({ authorLogin: 'bob' }), c({ authorLogin: 'alice' }),
    ], [], period, new Set());
    expect(r.rows.map((x) => x.key)).toEqual(['person:bob', 'person:alice', 'agent:claude', 'unidentified']);
    expect(r.rows.reduce((s, x) => s + x.commits, 0)).toBe(5);
  });

  it('history unavailable → not available, no rows', () => {
    expect(analyzeStudents(null, [], period, new Set())).toMatchObject({ available: false, rows: [] });
  });
});

describe('templateFromAuthorship', () => {
  it('needs a complete history whose oldest commit is github-classroom (login, or name without login)', () => {
    const a = [
      { path: 'a', complete: false, commits: [{ login: 'github-classroom[bot]' }] },
      { path: 'b', complete: true, commits: [{ login: 'alice' }, { login: null, name: 'github-classroom[bot]' }] },
      { path: 'c', complete: true, commits: [{ login: 'GitHub-Classroom' }, { login: 'alice' }] },
      { path: 'd', complete: true, commits: [] },
    ];
    expect(templateFromAuthorship(a)).toEqual(new Set(['b']));
    expect(templateFromAuthorship(null)).toEqual(new Set());
  });
});

describe('authorshipPaths / classroomAiContext', () => {
  const ctx = (paths, template = new Set()) => ({ gitignore: '', claudeSettings: null, templatePaths: template, available: true, contextPaths: paths });

  it('non-template config paths in registry order, at most 10', () => {
    expect(authorshipPaths(ctx(['AGENTS.md', 'README.md', '.github/copilot-instructions.md', 'CLAUDE.md'], new Set(['CLAUDE.md']))))
      .toEqual(['.github/copilot-instructions.md', 'AGENTS.md']);
    const many = Array.from({ length: 12 }, (_, i) => `.cursor/rules/r${i}.mdc`);
    expect(authorshipPaths(ctx(many))).toHaveLength(10);
    expect(authorshipPaths(null)).toEqual([]);
  });

  it('template set = context template ∪ github-classroom origin; failed context → null', () => {
    const authorship = [{ path: 'CLAUDE.md', complete: true, commits: [{ login: 'github-classroom' }] }];
    expect(classroomAiContext(ctx(['CLAUDE.md', 'AGENTS.md'], new Set(['AGENTS.md'])), authorship).templatePaths)
      .toEqual(new Set(['AGENTS.md', 'CLAUDE.md']));
    expect(classroomAiContext(null, authorship)).toBeNull();
  });

  it('authorship failed and no template known → template origin not verified (null)', () => {
    expect(classroomAiContext(ctx(['CLAUDE.md']), null).templatePaths).toBeNull();
    expect(classroomAiContext(ctx(['CLAUDE.md'], new Set(['CLAUDE.md'])), null).templatePaths).toEqual(new Set(['CLAUDE.md']));
    expect(classroomAiContext(ctx(['CLAUDE.md']), []).templatePaths).toEqual(new Set());
  });
});
