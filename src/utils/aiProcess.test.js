import { describe, it, expect } from 'vitest';
import {
  fromRestCommit, fromGraphqlCommit, commitAiTools, analyzeAiCommits, analyzeAiPrs, analyzeAiSafeguards,
} from './aiProcess.js';

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
