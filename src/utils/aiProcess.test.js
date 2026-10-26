import { describe, it, expect } from 'vitest';
import {
  fromRestCommit, fromGraphqlCommit, commitAiTools, analyzeAiCommits, analyzeAiPrs, analyzeAiSafeguards,
  analyzeAiConfig, analyzeCoherence, analyzeResponsibleBadge, buildAiProcess, normalizeSnapshotAiProcess,
  parseAiRepoContext, isClassroomCreated,
} from './aiProcess.js';
import { CONTEXT_DIRS } from './aiRegistry.js';

const commit = (o = {}) => ({
  message: 'fix', authorLogin: 'alice', authorName: 'Alice', authorEmail: 'alice@example.com', authorType: 'User', date: null, parents: 1, ...o,
});

let seq = 0;
const pr = (o = {}) => {
  seq += 1;
  const ms = Date.UTC(2026, 9, 1) - seq * 3600_000;
  return { user: { login: 'alice', type: 'User' }, created_at: new Date(ms - 3600_000).toISOString(), merged_at: new Date(ms).toISOString(), ...o };
};

describe('commit adapters', () => {
  it('maps REST commits', () => {
    expect(fromRestCommit({
      author: { login: 'bob', type: 'User' }, parents: [{}, {}],
      commit: { message: 'm', author: { name: 'Bob', email: 'b@x.io', date: '2026-01-02T00:00:00Z' } },
    })).toEqual({ message: 'm', authorLogin: 'bob', authorType: 'User', authorName: 'Bob', authorEmail: 'b@x.io', date: '2026-01-02T00:00:00Z', parents: 2 });
    expect(fromRestCommit({ author: null, commit: { message: 'm', author: { name: 'Z' } } })).toMatchObject({ authorLogin: null, authorType: null, authorEmail: null, date: null, parents: 1 });
  });
  it('maps GraphQL commits (fields may be absent)', () => {
    expect(fromGraphqlCommit({
      message: 'm', committedDate: '2026-01-02T00:00:00Z', parents: { totalCount: 1 },
      author: { name: 'Copilot', email: 'c@users.noreply.github.com', user: null },
    })).toEqual({ message: 'm', authorLogin: null, authorType: null, authorName: 'Copilot', authorEmail: 'c@users.noreply.github.com', date: '2026-01-02T00:00:00Z', parents: 1 });
    expect(fromGraphqlCommit({ message: 'm', parents: { totalCount: 1 }, author: { name: 'A', user: { login: 'a' } } })).toMatchObject({ authorLogin: 'a', authorEmail: null, date: null });
  });
  it('commitAiTools combines coauthors and agent author', () => {
    expect(commitAiTools(commit({ message: 'a\n\nCo-Authored-By: Claude <noreply@anthropic.com>' }))).toEqual(['claude']);
    expect(commitAiTools(commit({ authorLogin: null, authorName: 'Copilot', authorEmail: '198982749+Copilot@users.noreply.github.com' }))).toEqual(['copilot']);
    expect(commitAiTools(commit())).toEqual([]);
  });
});

describe('analyzeAiCommits', () => {
  it('commit coverage counts co-authored and agent-authored; maintenance bots and merges out', () => {
    const r = analyzeAiCommits([
      commit({ message: 'a\n\nCo-Authored-By: Claude <noreply@anthropic.com>', date: '2026-03-12T10:00:00Z' }),
      commit({ authorLogin: null, authorName: 'Copilot', authorEmail: '198982749+Copilot@users.noreply.github.com' }),
      commit({}),
      commit({ authorLogin: 'dependabot[bot]', authorType: 'Bot' }),
      commit({ parents: 2, message: 'Merge\n\nCo-Authored-By: Claude <noreply@anthropic.com>' }),
    ]);
    expect(r).toMatchObject({ available: true, n: 3, withAi: 2, percentage: 67, firstTraceAt: '2026-03-12T10:00:00Z', tools: ['claude', 'copilot'] });
  });
  it('null input → unavailable error; empty → n 0, percentage null', () => {
    expect(analyzeAiCommits(null)).toMatchObject({ available: false, reason: 'error' });
    expect(analyzeAiCommits([])).toMatchObject({ available: true, n: 0, withAi: 0, percentage: null, firstTraceAt: null, tools: [] });
  });
  it('GraphQL agent author (no login, [bot] name) counts as AI, not as a maintenance bot', () => {
    const r = analyzeAiCommits([commit({ authorLogin: null, authorName: 'claude[bot]', authorEmail: '41898282+claude[bot]@users.noreply.github.com' }), commit({})]);
    expect(r).toMatchObject({ n: 2, withAi: 1, tools: ['claude'] });
  });
  it('a login-less author only named like an agent is not AI (names are forgeable)', () => {
    const r = analyzeAiCommits([commit({ authorLogin: null, authorName: 'claude', authorEmail: 'someone@gmail.com' }), commit({ authorLogin: null, authorName: 'claude[bot]', authorEmail: null })]);
    expect(r).toMatchObject({ n: 2, withAi: 1, tools: ['claude'] });
  });
  it('firstTraceAt is the earliest date among AI commits', () => {
    const t = 'x\n\nCo-Authored-By: Claude <noreply@anthropic.com>';
    const r = analyzeAiCommits([commit({ message: t, date: '2026-05-01T00:00:00Z' }), commit({ message: t, date: '2026-02-01T00:00:00Z' }), commit({ message: t, date: null })]);
    expect(r.firstTraceAt).toBe('2026-02-01T00:00:00Z');
  });
});

describe('analyzeAiPrs', () => {
  it('agent PR share and AI review over the mixed sample', () => {
    const prs = [pr({ user: { login: 'Copilot', type: 'Bot' }, aiParticipants: [] }), pr({ aiParticipants: ['coderabbitai'] }), pr({}), pr({ user: { login: 'dependabot[bot]', type: 'Bot' } })];
    expect(analyzeAiPrs(prs, { reviewsAvailable: true })).toMatchObject({ n: 3, byAgents: 1, percentage: 33, agentTools: ['copilot'], aiReviewed: { available: true, count: 1, percentage: 33, tools: ['coderabbit'] } });
    expect(analyzeAiPrs(prs, { reviewsAvailable: false }).aiReviewed).toMatchObject({ available: false, count: null });
  });
  it('a PR author is an agent only on a bot account (a person called "copilot" is not)', () => {
    const prs = [
      pr({ user: { login: 'Copilot', type: 'User' } }),
      pr({ user: { login: 'claude', type: 'User' } }),
      pr({ user: { login: 'Copilot', type: 'Bot' } }),
      pr({ user: { login: 'claude[bot]' } }),
    ];
    expect(analyzeAiPrs(prs, { reviewsAvailable: false })).toMatchObject({ n: 4, byAgents: 2, agentTools: ['claude', 'copilot'] });
    expect(analyzeAiSafeguards(prs.map((p) => ({ ...p, approvedByOther: false })), { reviewsAvailable: true })).toMatchObject({ agentPrs: 2, agentUnapproved: 2 });
  });
  it('a REST commit by a person account named like an agent is not AI', () => {
    expect(commitAiTools(commit({ authorLogin: 'claude', authorType: 'User', authorName: 'Claude' }))).toEqual([]);
    expect(commitAiTools(commit({ authorLogin: 'Copilot', authorType: 'Bot', authorName: 'Copilot' }))).toEqual(['copilot']);
  });
  it('limit Infinity keeps every merged PR', () => {
    const prs = Array.from({ length: 60 }, () => pr({}));
    expect(analyzeAiPrs(prs, { limit: Infinity, reviewsAvailable: true }).n).toBe(60);
    expect(analyzeAiPrs(prs, { reviewsAvailable: true }).n).toBe(50);
  });
  it('REST-shaped PRs (no aiParticipants/approvedByOther/changedLines) work without reviews', () => {
    const prs = [pr({ user: { login: 'Copilot', type: 'Bot' } }), pr({})];
    const r = analyzeAiPrs(prs, { reviewsAvailable: false });
    expect(r).toMatchObject({ n: 2, byAgents: 1, percentage: 50, aiReviewed: { available: false, count: null } });
  });
  it('null → unavailable; limit keeps the most recent merged', () => {
    expect(analyzeAiPrs(null, { reviewsAvailable: true })).toMatchObject({ available: false, reason: 'error' });
    const prs = [pr({}), pr({}), pr({ user: { login: 'Copilot', type: 'Bot' } })]; // third is the oldest
    expect(analyzeAiPrs(prs, { limit: 2, reviewsAvailable: true })).toMatchObject({ n: 2, byAgents: 0 });
  });
});

describe('analyzeAiSafeguards', () => {
  it('unapproved agent PRs; size comparison only with AI_MIN_GROUP per side', () => {
    const agents = Array.from({ length: 5 }, (_, i) => pr({ user: { login: 'Copilot', type: 'Bot' }, approvedByOther: i > 0, changedLines: 100 }));
    const humans = Array.from({ length: 4 }, () => pr({ changedLines: 40 }));
    const s = analyzeAiSafeguards([...agents, ...humans], { reviewsAvailable: true });
    expect(s).toMatchObject({ agentPrs: 5, agentUnapproved: 1, size: { available: false, agentN: 5, humanN: 4 } });
    const s2 = analyzeAiSafeguards([...agents, ...humans, pr({ changedLines: 60 })], { reviewsAvailable: true });
    expect(s2.size).toMatchObject({ available: true, agentMedian: 100, humanMedian: 40, agentN: 5, humanN: 5 });
  });
  it('without a token safeguards are unavailable (noToken)', () => {
    expect(analyzeAiSafeguards([pr({})], { reviewsAvailable: false })).toMatchObject({ available: false, reason: 'noToken' });
  });
  it('null prs with a token → error', () => {
    expect(analyzeAiSafeguards(null, { reviewsAvailable: true })).toMatchObject({ available: false, reason: 'error' });
  });
});

const emptyCtx = { gitignore: '', claudeSettings: null, templatePaths: new Set(), available: true };
const noAiCommits = { available: true, n: 3, withAi: 0, percentage: 0, firstTraceAt: null, tools: [] };
const noAiPrs = { available: true, n: 2, byAgents: 0, percentage: 0, agentTools: [], aiReviewed: { available: true, count: 0, percentage: 0, tools: [] } };
const CLAUDE_TRAILER = 'feat\n\nCo-Authored-By: Claude <noreply@anthropic.com>';

const badgeInput = (config, commits, prs, extra = {}) => ({
  config, commits, prs, coherence: analyzeCoherence(config, commits, prs),
  safeguards: { available: false, reason: 'noToken', agentPrs: 0, agentUnapproved: null }, maturity: null, ...extra,
});
const noTraces = badgeInput(analyzeAiConfig([], 'complete', emptyCtx), noAiCommits, noAiPrs);
const declaredWithConfig = badgeInput(analyzeAiConfig(['CLAUDE.md'], 'complete', emptyCtx), { ...noAiCommits, withAi: 2, tools: ['claude'] }, noAiPrs);
const stateOf = (b, id) => b.criteria.find((c) => c.id === id).state;

const fullFixture = {
  treePaths: ['CLAUDE.md', '.claude/skills/x/SKILL.md', 'src/a.js'],
  treeStatus: 'complete',
  ctx: emptyCtx,
  commits: [commit({ message: CLAUDE_TRAILER }), commit()],
  prs: [
    pr({ approvedByOther: true, changedLines: 20, aiParticipants: ['coderabbitai'] }),
    pr({ user: { login: 'Copilot', type: 'Bot' }, approvedByOther: true, changedLines: 30, aiParticipants: [] }),
  ],
  reviewsAvailable: true,
  maturity: { testsDetected: true, ciCdDetected: true, treeStatus: 'complete' },
};

describe('analyzeAiConfig', () => {
  it('entries with kind and template origin; gitignore and settings from the context', () => {
    const cfg = analyzeAiConfig(['CLAUDE.md', '.mcp.json', 'src/a.js'], 'complete',
      { gitignore: '.claude/\nnode_modules\n', claudeSettings: '{"attribution": false}', templatePaths: new Set(['.mcp.json']), available: true });
    expect(cfg).toEqual({
      status: 'complete',
      entries: [
        { toolId: 'claude', path: 'CLAUDE.md', kind: 'instructions', fromTemplate: false },
        { toolId: 'generic', path: '.mcp.json', kind: 'extensions', fromTemplate: true },
      ],
      hiddenLocal: ['.claude/'],
      coauthorDisabled: true,
    });
  });
  it('no context (no token) or unavailable context → template, gitignore and settings unverified', () => {
    for (const ctx of [null, { ...emptyCtx, available: false }]) {
      expect(analyzeAiConfig(['AGENTS.md'], 'complete', ctx)).toMatchObject({
        entries: [{ toolId: 'generic', fromTemplate: null }], hiddenLocal: null, coauthorDisabled: null,
      });
    }
    expect(analyzeAiConfig(null, 'unavailable', null)).toMatchObject({ status: 'unavailable', entries: [] });
  });
  it('available context without .gitignore or settings file → verified, nothing hidden, trailer not disabled', () => {
    const cfg = analyzeAiConfig([], 'complete', { ...emptyCtx, gitignore: null, claudeSettings: null });
    expect(cfg).toMatchObject({ hiddenLocal: [], coauthorDisabled: false });
    expect(analyzeCoherence(cfg, noAiCommits, noAiPrs).unverified).not.toContain('gitignore');
    for (const ctx of [null, { ...emptyCtx, available: false }]) {
      const off = analyzeAiConfig([], 'complete', ctx);
      expect(off).toMatchObject({ hiddenLocal: null, coauthorDisabled: null });
      expect(analyzeCoherence(off, noAiCommits, noAiPrs).unverified).toContain('gitignore');
    }
  });
});

describe('analyzeCoherence', () => {
  it('config from template does not count; unknown template still flags but says unverified', () => {
    const ctx = { gitignore: '', claudeSettings: null, templatePaths: new Set(['AGENTS.md']), available: true };
    const cfg = analyzeAiConfig(['AGENTS.md'], 'complete', ctx);
    expect(cfg.entries[0].fromTemplate).toBe(true);
    expect(analyzeCoherence(cfg, noAiCommits, noAiPrs).flags).toEqual([]);
    const unknown = analyzeAiConfig(['CLAUDE.md'], 'complete', { ...ctx, templatePaths: null });
    expect(analyzeCoherence(unknown, noAiCommits, noAiPrs)).toMatchObject({ flags: ['configWithoutDeclaration'], unverified: ['template'] });
  });
  it('hidden local use without declaration; coauthorDisabled is reported as explanation', () => {
    const cfg = analyzeAiConfig([], 'complete', { gitignore: '.claude/\n', claudeSettings: '{"includeCoAuthoredBy": false}', templatePaths: new Set(), available: true });
    expect(analyzeCoherence(cfg, noAiCommits, noAiPrs)).toMatchObject({ flags: ['hiddenWithoutDeclaration'], coauthorDisabled: true });
  });
  it('truncated tree with nothing found: no flag, config unverified', () => {
    const cfg = analyzeAiConfig(['src/a.js'], 'truncated', null);
    expect(cfg.status).toBe('truncated');
    expect(analyzeCoherence(cfg, noAiCommits, noAiPrs)).toMatchObject({ flags: [], unverified: expect.arrayContaining(['config']) });
  });
  it('declared commits silence rule 1; different tool is informative only', () => {
    const cfg = analyzeAiConfig(['.cursorrules'], 'complete', emptyCtx);
    const r = analyzeCoherence(cfg, { ...noAiCommits, withAi: 2, tools: ['claude'] }, noAiPrs);
    expect(r).toMatchObject({ flags: [], toolMismatch: true });
  });
  it('an agent PR also counts as declaration; generic config never causes a tool mismatch', () => {
    const cfg = analyzeAiConfig(['AGENTS.md'], 'complete', emptyCtx);
    expect(analyzeCoherence(cfg, noAiCommits, { ...noAiPrs, byAgents: 1, agentTools: ['copilot'] })).toMatchObject({ flags: [], toolMismatch: false });
  });
  it('PRs not measured: rules still fire from commits, prs goes to unverified', () => {
    const cfg = analyzeAiConfig(['CLAUDE.md'], 'complete', emptyCtx);
    const r = analyzeCoherence(cfg, noAiCommits, analyzeAiPrs(null, { reviewsAvailable: true }));
    expect(r).toMatchObject({ flags: ['configWithoutDeclaration'], unverified: ['prs'] });
  });
  it('measured but empty commit sample (n = 0): no rule fires and commits go to unverified', () => {
    const cfg = analyzeAiConfig(['CLAUDE.md'], 'complete', { ...emptyCtx, gitignore: '.cursor/' });
    const r = analyzeCoherence(cfg, { ...noAiCommits, n: 0, percentage: null }, noAiPrs);
    expect(r.flags).toEqual([]);
    expect(r.unverified).toContain('commits');
  });
  it('commits not measured: no rule fires and commits go to unverified', () => {
    const cfg = analyzeAiConfig(['CLAUDE.md'], 'complete', { ...emptyCtx, gitignore: '.cursor/' });
    const r = analyzeCoherence(cfg, analyzeAiCommits(null), noAiPrs);
    expect(r.flags).toEqual([]);
    expect(r.unverified).toContain('commits');
  });
});

describe('analyzeResponsibleBadge', () => {
  it('badge: not applicable without traces; na/unverified leave the denominator', () => {
    expect(analyzeResponsibleBadge(noTraces).applicable).toBe(false);
    const b = analyzeResponsibleBadge({ ...declaredWithConfig, safeguards: { available: true, agentPrs: 0 }, maturity: { testsDetected: true, ciCdDetected: null } });
    expect(b.criteria.find((c) => c.id === 'agentReviewed').state).toBe('na');
    expect(b.criteria.find((c) => c.id === 'testsCi').state).toBe('unverified');
    expect(b).toMatchObject({ applicable: true, met: 3, total: 3 });
  });
  it('hidden local use alone makes it applicable; flags make coherent unmet', () => {
    const cfg = analyzeAiConfig([], 'complete', { ...emptyCtx, gitignore: '.aider*' });
    const b = analyzeResponsibleBadge(badgeInput(cfg, noAiCommits, noAiPrs, { maturity: { testsDetected: false, ciCdDetected: true } }));
    expect(b.applicable).toBe(true);
    expect(b.criteria.map((c) => [c.id, c.state])).toEqual([
      ['config', 'unmet'], ['declared', 'unmet'], ['coherent', 'unmet'], ['agentReviewed', 'na'], ['testsCi', 'unmet'],
    ]);
    expect(b).toMatchObject({ met: 0, total: 4 });
  });
  it('template-only config is not a trace', () => {
    const cfg = analyzeAiConfig(['CLAUDE.md'], 'complete', { ...emptyCtx, templatePaths: new Set(['CLAUDE.md']) });
    expect(analyzeResponsibleBadge(badgeInput(cfg, noAiCommits, noAiPrs)).applicable).toBe(false);
  });
  it('agentReviewed: unverified without a token, met only with zero unapproved', () => {
    const prs = { ...noAiPrs, byAgents: 2, agentTools: ['copilot'] };
    const cfg = analyzeAiConfig([], 'complete', emptyCtx);
    expect(stateOf(analyzeResponsibleBadge(badgeInput(cfg, noAiCommits, prs)), 'agentReviewed')).toBe('unverified');
    const with1 = { available: true, agentPrs: 2, agentUnapproved: 1 };
    expect(stateOf(analyzeResponsibleBadge(badgeInput(cfg, noAiCommits, prs, { safeguards: with1 })), 'agentReviewed')).toBe('unmet');
    expect(stateOf(analyzeResponsibleBadge(badgeInput(cfg, noAiCommits, prs, { safeguards: { ...with1, agentUnapproved: 0 } })), 'agentReviewed')).toBe('met');
  });
  it('AI reviews as the only trace: config and declared do not apply (an external reviewer needs neither)', () => {
    const reviewed = { ...noAiPrs, aiReviewed: { available: true, count: 1, percentage: 50, tools: ['coderabbit'] } };
    const b = analyzeResponsibleBadge(badgeInput(analyzeAiConfig([], 'complete', emptyCtx), noAiCommits, reviewed));
    expect(b.applicable).toBe(true);
    expect(['config', 'declared'].map((id) => stateOf(b, id))).toEqual(['na', 'na']);
    // Any other trace and the criteria apply again
    const hidden = analyzeAiConfig([], 'complete', { ...emptyCtx, gitignore: '.cursor/' });
    expect(['config', 'declared'].map((id) => stateOf(analyzeResponsibleBadge(badgeInput(hidden, noAiCommits, reviewed)), id))).toEqual(['unmet', 'unmet']);
  });
  it('known locations only (Classroom, status partial): rules and criteria as for a complete tree', () => {
    const cfg = analyzeAiConfig([], 'partial', emptyCtx);
    expect(analyzeCoherence(cfg, noAiCommits, noAiPrs).unverified).not.toContain('config');
    const withConfig = analyzeAiConfig(['AGENTS.md'], 'partial', emptyCtx);
    expect(analyzeCoherence(withConfig, noAiCommits, noAiPrs).flags).toEqual(['configWithoutDeclaration']);
    const hidden = analyzeAiConfig([], 'partial', { ...emptyCtx, gitignore: '.aider*' });
    expect(stateOf(analyzeResponsibleBadge(badgeInput(hidden, noAiCommits, noAiPrs)), 'config')).toBe('unmet');
  });
  it('empty commit sample (n = 0): declared is unverified, not unmet', () => {
    const cfg = analyzeAiConfig(['CLAUDE.md'], 'complete', emptyCtx);
    const empty = { ...noAiCommits, n: 0, percentage: null };
    expect(stateOf(analyzeResponsibleBadge(badgeInput(cfg, empty, noAiPrs)), 'declared')).toBe('unverified');
  });
  it('commits not measured: declared and coherent unverified; truncated tree: config unverified', () => {
    const cfg = analyzeAiConfig(['src/a.js'], 'truncated', null);
    const b = analyzeResponsibleBadge(badgeInput(cfg, analyzeAiCommits(null), { ...noAiPrs, aiReviewed: { available: true, count: 1, tools: ['coderabbit'] } }));
    expect(b.applicable).toBe(true);
    expect(['config', 'declared', 'coherent'].map((id) => stateOf(b, id))).toEqual(['unverified', 'unverified', 'unverified']);
  });
});

describe('buildAiProcess', () => {
  it('buildAiProcess has no person logins and the method/version', () => {
    const ai = buildAiProcess(fullFixture);
    expect(ai).toMatchObject({ method: 'ai-traces-v1', registryVersion: '2026-10-25' });
    expect(JSON.stringify(ai)).not.toContain('alice');
  });
  it('merges sources per tool; template-only tools are flagged fromTemplate and have no config source', () => {
    const ai = buildAiProcess({ ...fullFixture, treePaths: [...fullFixture.treePaths, 'AGENTS.md'], ctx: { ...emptyCtx, templatePaths: new Set(['AGENTS.md']) } });
    expect(ai.tools).toEqual([
      { id: 'claude', sources: ['config', 'commit'], configKind: 'extensions', fromTemplate: false },
      { id: 'coderabbit', sources: ['review'], configKind: null, fromTemplate: false },
      { id: 'copilot', sources: ['pr'], configKind: null, fromTemplate: false },
      { id: 'generic', sources: [], configKind: 'instructions', fromTemplate: true },
    ]);
    expect(ai.commits).toMatchObject({ n: 2, withAi: 1 });
    expect(ai.prs).toMatchObject({ n: 2, byAgents: 1 });
    expect(ai.safeguards).toMatchObject({ available: true, agentPrs: 1, agentUnapproved: 0 });
    expect(ai.badge).toMatchObject({ applicable: true, met: 5, total: 5 });
  });
  it('prLimit bounds the PR sample', () => {
    expect(buildAiProcess({ ...fullFixture, prLimit: 1 }).prs.n).toBe(1);
  });
  it('empty repository → no traces, nothing crashes', () => {
    const ai = buildAiProcess({ treePaths: [], treeStatus: 'complete', ctx: null, commits: [], prs: [], reviewsAvailable: false, maturity: null });
    expect(ai.tools).toEqual([]);
    expect(ai.badge.applicable).toBe(false);
  });
  it('failed sources → unavailable parts, still builds', () => {
    const ai = buildAiProcess({ treePaths: null, treeStatus: 'unavailable', ctx: null, commits: null, prs: null, reviewsAvailable: true, maturity: null });
    expect(ai).toMatchObject({ commits: { available: false }, prs: { available: false }, safeguards: { available: false, reason: 'error' }, tools: [] });
  });
});

describe('repositories created by GitHub Classroom', () => {
  const CLASSROOM_EMAIL = '66690702+github-classroom[bot]@users.noreply.github.com';
  const restRoot = fromRestCommit({
    author: { login: 'github-classroom[bot]', type: 'Bot' }, parents: [],
    commit: { message: 'Initial commit', author: { name: 'github-classroom[bot]', email: CLASSROOM_EMAIL, date: '2026-09-01T00:00:00Z' } },
  });
  const graphqlRoot = fromGraphqlCommit({
    message: 'add deadline', parents: { totalCount: 0 },
    author: { name: 'github-classroom[bot]', email: CLASSROOM_EMAIL, user: null },
  });
  const sample = (root) => [commit(), commit({ message: 'feat: x' }), root];

  it('detects a root commit by github-classroom[bot] (REST and GraphQL shapes, login or email)', () => {
    expect(isClassroomCreated(sample(restRoot))).toBe(true);
    expect(isClassroomCreated(sample(graphqlRoot))).toBe(true);
    expect(isClassroomCreated([commit({ authorLogin: 'github-classroom[bot]', authorEmail: null, parents: 0 })])).toBe(true);
    expect(isClassroomCreated([commit({ authorLogin: null, authorEmail: 'github-classroom[bot]@users.noreply.github.com', parents: 0 })])).toBe(true);
  });
  it('a non-root commit by the bot, a human root commit or no sample does not count', () => {
    expect(isClassroomCreated([commit(), { ...restRoot, parents: 1 }])).toBe(false);
    expect(isClassroomCreated([commit({ parents: 0, message: 'Initial commit' })])).toBe(false);
    expect(isClassroomCreated([])).toBe(false);
    expect(isClassroomCreated(null)).toBe(false);
  });
  it('Dashboard: config origin becomes unverified, so rule 1 says "template" in unverified', () => {
    const base = { treePaths: ['AGENTS.md', 'src/a.js'], treeStatus: 'complete', ctx: emptyCtx, prs: [], reviewsAvailable: false, maturity: null };
    const ai = buildAiProcess({ ...base, commits: sample(restRoot) });
    expect(ai.config.entries).toEqual([{ toolId: 'generic', path: 'AGENTS.md', kind: 'instructions', fromTemplate: null }]);
    expect(ai.coherence.flags).toEqual(['configWithoutDeclaration']);
    expect(ai.coherence.unverified).toContain('template');
    // Without the Classroom root commit, templateRepository null still means "no template".
    const own = buildAiProcess({ ...base, commits: sample(commit({ parents: 0 })) });
    expect(own.config.entries[0].fromTemplate).toBe(false);
    expect(own.coherence.unverified).not.toContain('template');
  });
  it('keeps a definite answer: template listing (true) and, in Classroom, a checked history (false)', () => {
    const tpl = buildAiProcess({ treePaths: ['AGENTS.md'], treeStatus: 'complete', ctx: { ...emptyCtx, templatePaths: new Set(['AGENTS.md']) }, commits: sample(restRoot), prs: [], reviewsAvailable: false, maturity: null });
    expect(tpl.config.entries[0].fromTemplate).toBe(true);
    const ctx = { ...emptyCtx, templatePaths: new Set(['CLAUDE.md']), originChecked: new Set(['CLAUDE.md', 'AGENTS.md']) };
    const classroom = buildAiProcess({ treePaths: ['AGENTS.md', 'CLAUDE.md', '.cursorrules'], treeStatus: 'partial', ctx, commits: sample(graphqlRoot), prs: [], reviewsAvailable: true, maturity: null, prLimit: Infinity });
    expect(Object.fromEntries(classroom.config.entries.map((e) => [e.path, e.fromTemplate])))
      .toEqual({ 'CLAUDE.md': true, 'AGENTS.md': false, '.cursorrules': null });
  });
});

describe('normalizeSnapshotAiProcess', () => {
  it('normalizer: old or unknown method → not recorded', () => {
    expect(normalizeSnapshotAiProcess({ fullName: 'a/b' }).aiProcess).toEqual({ available: false, reason: 'snapshot' });
    expect(normalizeSnapshotAiProcess({ aiProcess: { method: 'x' } }).aiProcess.reason).toBe('snapshot');
  });
  it('current method with a malformed shape → not recorded', () => {
    const { coherence: _c, ...noCoherence } = buildAiProcess(fullFixture);
    expect(normalizeSnapshotAiProcess({ aiProcess: noCoherence }).aiProcess).toEqual({ available: false, reason: 'snapshot' });
    const ai = buildAiProcess(fullFixture);
    expect(normalizeSnapshotAiProcess({ aiProcess: { ...ai, tools: null } }).aiProcess.reason).toBe('snapshot');
    expect(normalizeSnapshotAiProcess({ aiProcess: { ...ai, coherence: { ...ai.coherence, flags: 'x' } } }).aiProcess.reason).toBe('snapshot');
    expect(normalizeSnapshotAiProcess({ aiProcess: { ...ai, badge: null } }).aiProcess.reason).toBe('snapshot');
  });
  it('current method but a field the UI dereferences is malformed → not recorded', () => {
    const ai = buildAiProcess(fullFixture);
    const broken = [
      { ...ai, config: { ...ai.config, entries: null } },
      { ...ai, config: { ...ai.config, hiddenLocal: 'x' } },
      { ...ai, prs: { ...ai.prs, aiReviewed: null } },
      { ...ai, safeguards: { ...ai.safeguards, size: 3 } },
      { ...ai, tools: [{ id: 'claude', sources: null }] },
      { ...ai, tools: [null] },
      { ...ai, badge: { ...ai.badge, criteria: {} } },
    ];
    for (const aiProcess of broken) expect(normalizeSnapshotAiProcess({ aiProcess }).aiProcess.reason).toBe('snapshot');
    const noHidden = { ...ai, config: { ...ai.config, hiddenLocal: null } };
    expect(normalizeSnapshotAiProcess({ aiProcess: noHidden }).aiProcess).toBe(noHidden);
  });
  it('current method is kept as is', () => {
    const report = { fullName: 'a/b', aiProcess: buildAiProcess(fullFixture) };
    expect(normalizeSnapshotAiProcess(report)).toBe(report);
  });
});

describe('parseAiRepoContext', () => {
  const dirs = (map) => Object.fromEntries(
    CONTEXT_DIRS.map((d, i) => [`d${i}`, map[d] ? { entries: map[d].map(([name, type = 'blob']) => ({ name, type })) } : null]),
  );
  const blob = (text) => ({ text });

  it('collects template paths that detectConfig recognizes', () => {
    const ctx = parseAiRepoContext({ repository: {
      gitignore: blob('node_modules'), claudeSettings: null, ...dirs({ '': [['README.md']] }),
      templateRepository: { nameWithOwner: 'o/t', isPrivate: false, ...dirs({ '': [['AGENTS.md'], ['README.md']] }) },
    } });
    expect(ctx.available).toBe(true);
    expect(ctx.gitignore).toBe('node_modules');
    expect(ctx.claudeSettings).toBeNull();
    expect(ctx.templatePaths).toEqual(new Set(['AGENTS.md']));
  });
  it('a private template is not read on the Dashboard (origin not verified); Classroom may read it', () => {
    const data = (isPrivate) => ({ repository: {
      gitignore: null, claudeSettings: null, ...dirs({ '': [['AGENTS.md']] }),
      templateRepository: { nameWithOwner: 'o/t', isPrivate, ...dirs({ '': [['AGENTS.md']] }) },
    } });
    expect(parseAiRepoContext(data(true)).templatePaths).toBeNull();
    expect(parseAiRepoContext(data(undefined)).templatePaths).toBeNull(); // visibility unknown: fail closed
    expect(parseAiRepoContext(data(true), { allowPrivateTemplate: true }).templatePaths).toEqual(new Set(['AGENTS.md']));
    expect(parseAiRepoContext(data(false)).templatePaths).toEqual(new Set(['AGENTS.md']));
  });
  it('templateRepository null under a successful fetch = verified, no template (empty Set)', () => {
    const ctx = parseAiRepoContext({ repository: { gitignore: null, claudeSettings: null, ...dirs({}), templateRepository: null } });
    expect(ctx.templatePaths).toEqual(new Set());
    expect(ctx.gitignore).toBeNull();
  });
  it('partial GraphQL errors: the field that failed is unverified, never "file absent"', () => {
    const repository = { gitignore: null, claudeSettings: null, templateRepository: null, ...dirs({ '': [['CLAUDE.md']] }) };
    const err = (...path) => ({ message: 'timeout', path: ['repository', ...path] });
    const ctxOf = (...errors) => parseAiRepoContext({ repository, errors });
    expect(ctxOf().unverified).toEqual([]);
    const gi = analyzeAiConfig(['CLAUDE.md'], 'complete', ctxOf(err('gitignore')));
    expect(gi).toMatchObject({ hiddenLocal: null, coauthorDisabled: false });
    const cs = analyzeAiConfig(['CLAUDE.md'], 'complete', ctxOf(err('claudeSettings')));
    expect(cs).toMatchObject({ hiddenLocal: [], coauthorDisabled: null });
    expect(ctxOf(err('templateRepository', 'd0')).templatePaths).toBeNull();
    expect(ctxOf(err('d3')).unverified).toEqual(['listings']);
    // An error that can't be placed: nothing from the context counts as verified
    const unknown = ctxOf({ message: 'boom' });
    expect(unknown).toMatchObject({ templatePaths: null, unverified: ['gitignore', 'claudeSettings', 'listings', 'workflows'] });
  });
  it('.github/workflows listing: dir/name paths, root directories, and its own unverified part', () => {
    const ctx = parseAiRepoContext({ repository: {
      gitignore: null, claudeSettings: null, templateRepository: null,
      ...dirs({ '': [['tests', 'tree'], ['README.md'], ['.circleci', 'tree']] }),
      workflows: { entries: [{ name: 'ci.yml', type: 'blob' }] },
    } });
    expect(ctx.workflowPaths).toEqual(['.github/workflows/ci.yml']);
    expect(ctx.rootDirs).toEqual(['tests', '.circleci']);
    expect(ctx.unverified).toEqual([]);
    // No .github/workflows directory: verified empty, not unverified
    expect(parseAiRepoContext({ repository: { templateRepository: null, ...dirs({}), workflows: null } }).workflowPaths).toEqual([]);
    const failed = parseAiRepoContext({ repository: { templateRepository: null, ...dirs({}) }, errors: [{ message: 'x', path: ['repository', 'workflows'] }] });
    expect(failed.unverified).toEqual(['workflows']);
  });
  it('lists nested paths without leading or trailing slashes, trees included', () => {
    const ctx = parseAiRepoContext({ repository: {
      gitignore: null, claudeSettings: blob('{}'), templateRepository: null,
      ...dirs({ '': [['CLAUDE.md'], ['.claude', 'tree']], '.claude': [['skills', 'tree'], ['settings.json']] }),
    } });
    expect(ctx.claudeSettings).toBe('{}');
    expect(ctx.contextPaths).toEqual(expect.arrayContaining(['CLAUDE.md', '.claude', '.claude/skills', '.claude/settings.json']));
  });
});
