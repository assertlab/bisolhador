import { describe, it, expect } from 'vitest';
import {
  isGitlabBot, toRepoData, toRestCommit, weeklySeries, punchCard, codeFrequency, contributorStats,
  profileFromListings, toRestPullRequest, toReviewNodes, toWorkflowRuns, toRelease, toHistoryNode, classroomPipelines,
} from './gitlabData.js';
import { analyzeCommitHistory } from './classroom.js';
import { fromGraphqlCommit } from './aiProcess.js';
import { toPullRequestStats } from './prReviewStats.js';
import { peopleFromStats } from './contributors.js';
import { weekdaysFromPunchCard, addDeleteRatio } from './activityStats.js';
import { analyzeCiRuns } from './projectPractices.js';

const NOW = Date.parse('2026-11-12T12:00:00Z');
const daysAgo = (d, tz = 'Z') => new Date(NOW - d * 864e5).toISOString().replace('Z', tz);
const commit = (over = {}) => ({
  id: 'abc', web_url: 'https://gitlab.com/g/p/-/commit/abc', message: 'feat: x', author_name: 'Ana', author_email: 'ana@x.org',
  authored_date: daysAgo(1), parent_ids: ['p1'], stats: { additions: 10, deletions: 2 }, ...over,
});

describe('isGitlabBot', () => {
  it.each([
    [{ bot: true, username: 'someone' }],
    [{ username: 'project_123_bot_ab12' }],
    [{ username: 'gitlab-dependency-update-bot', bot: false }], // bot:false on gitlab.com, measured 2026-11-12
    [{ username: 'GitLabDuo' }],
    [{ email: 'project_42_bot_x1@noreply.gitlab.cin.ufpe.br', name: 'Deploy' }],
    [{ name: 'renovate[bot]' }],
  ])('%j → bot', (user) => expect(isGitlabBot(user)).toBe(true));

  it.each([[{ username: 'abbott' }], [{ username: 'robotics' }], [{ name: 'Ana', email: 'ana@x.org' }], [{}]])('%j → human', (user) => {
    expect(isGitlabBot(user)).toBe(false);
  });
});

describe('toRepoData', () => {
  const project = {
    path_with_namespace: 'g/sub/p', visibility: 'public', default_branch: 'main', description: 'd', created_at: '2020-01-01T00:00:00Z',
    last_activity_at: '2026-11-01T00:00:00Z', namespace: { kind: 'group' }, star_count: 5, forks_count: 2, web_url: 'https://gitlab.com/g/sub/p',
  };

  it('maps to the GitHub fields; watchers and language unavailable, not zero', () => {
    expect(toRepoData(project)).toMatchObject({
      full_name: 'g/sub/p', private: false, default_branch: 'main', stargazers_count: 5, forks_count: 2,
      subscribers_count: null, language: null, owner: { type: 'Organization' }, has_issues: true, has_pull_requests: true,
    });
  });

  it('only "public" is public: internal, private and a missing visibility count as private (fail-closed)', () => {
    expect(toRepoData({ ...project, visibility: 'internal' }).private).toBe(true);
    expect(toRepoData({ ...project, visibility: 'private' }).private).toBe(true);
    expect(toRepoData({ ...project, visibility: undefined }).private).toBeNull(); // unknown: useRepository refuses it too
    expect(toRepoData({ ...project, visibility: undefined }, { visibility: 'PUBLIC' }).private).toBe(false);
  });

  it('features turned off come from the GraphQL flags (the anonymous REST response omits them)', () => {
    expect(toRepoData(project, { issuesEnabled: false, mergeRequestsEnabled: false })).toMatchObject({ has_issues: false, has_pull_requests: false });
  });
});

describe('commit-derived series', () => {
  const commits = [
    commit({ authored_date: daysAgo(1, '-03:00') }),
    commit({ authored_date: daysAgo(8) }),
    commit({ authored_date: daysAgo(400) }), // outside the 52 weeks
    commit({ parent_ids: ['a', 'b'], authored_date: daysAgo(2) }), // merge
  ];

  it('weeklySeries: 52 weeks, last = current week, merges counted like GitHub participation', () => {
    const { all } = weeklySeries(commits, { nowMs: NOW });
    expect(all).toHaveLength(52);
    expect(all[51]).toBe(2);
    expect(all[50]).toBe(1);
    expect(all.reduce((a, b) => a + b)).toBe(3);
  });

  it('punchCard: non-merge commits by local weekday/hour, readable by weekdaysFromPunchCard', () => {
    const card = punchCard([commit({ authored_date: '2026-11-09T23:30:00.000-03:00' }), commit({ parent_ids: ['a', 'b'] })]);
    expect(card).toEqual([[1, 23, 1]]); // Monday 23h in the author's time zone (UTC would be Tuesday 02h)
    expect(weekdaysFromPunchCard(card).total).toBe(1);
  });

  it('codeFrequency: weekly [start, additions, -deletions], oldest first, readable by addDeleteRatio', () => {
    const rows = codeFrequency(commits, { nowMs: NOW });
    expect(rows).toHaveLength(52);
    expect(rows[51].slice(1)).toEqual([10, -2]);
    expect(rows[50].slice(1)).toEqual([10, -2]);
    expect(addDeleteRatio(rows).reason).toBe('lowActivity'); // 2 active weeks
  });

  it('contributorStats: grouped by e-mail, named, bots flagged, merges out; peopleFromStats reads it', () => {
    const stats = contributorStats([
      commit({ author_email: 'ANA@x.org' }), commit(), commit({ author_name: 'Bia', author_email: 'bia@x.org' }),
      commit({ author_name: 'Deploy', author_email: 'project_7_bot_q@noreply.gitlab.com' }), commit({ parent_ids: ['a', 'b'] }),
    ], { nowMs: NOW });
    expect(stats.map((s) => [s.author.login, s.author.type, s.total])).toEqual([['Ana', 'User', 2], ['Bia', 'User', 1], ['Deploy', 'Bot', 1]]);
    const people = peopleFromStats(stats, { nowSeconds: NOW / 1000 });
    expect(people.recent.map((p) => [p.login, p.commits])).toEqual([['Ana', 2], ['Bia', 1]]);
    expect(people.botsExcluded).toBe(1);
  });
});

describe('profileFromListings', () => {
  const blob = (path) => ({ type: 'blob', name: path.split('/').pop(), path });

  it('root files + .gitlab templates → community profile files', () => {
    const { files } = profileFromListings({
      root: [blob('README.md'), blob('LICENSE'), blob('CONTRIBUTING.md'), { type: 'tree', name: 'CODE_OF_CONDUCT.md', path: 'CODE_OF_CONDUCT.md' }],
      issueTemplates: [blob('.gitlab/issue_templates/Bug.md')],
      mergeRequestTemplates: null,
    });
    expect(files).toMatchObject({ readme: { path: 'README.md' }, license: { path: 'LICENSE' }, contributing: { path: 'CONTRIBUTING.md' } });
    expect(files.code_of_conduct).toBeNull(); // a directory, not a file
    expect(files.issue_template).toEqual({ path: '.gitlab/issue_templates/Bug.md' });
    expect(files.pull_request_template).toBeNull();
  });

  it("falls back to the project's readme_url and detected license", () => {
    const { files } = profileFromListings({ root: [], project: { readme_url: 'https://x/README.rst', license: { key: 'mit' } } });
    expect(files.readme).toEqual({ url: 'https://x/README.rst' });
    expect(files.license).toEqual({ key: 'mit' });
  });
});

describe('merge requests', () => {
  it('toRestPullRequest: state, link and author as the REST PR', () => {
    expect(toRestPullRequest({ iid: 3, title: 't', web_url: 'u', state: 'merged', created_at: 'c', merged_at: 'm', author: { username: 'ana' } }))
      .toEqual({ number: 3, title: 't', html_url: 'u', state: 'closed', created_at: 'c', merged_at: 'm', user: { login: 'ana', type: 'User' } });
    expect(toRestPullRequest({ state: 'opened', author: { username: 'project_1_bot_x' } })).toMatchObject({ state: 'open', user: { type: 'Bot' } });
  });

  it('toReviewNodes → toPullRequestStats: approvals by others, notes as comments, bots out, size', () => {
    const [pr] = toPullRequestStats(toReviewNodes([{
      iid: 1, createdAt: '2026-11-01T10:00:00Z', mergedAt: '2026-11-02T10:00:00Z',
      author: { username: 'ana', bot: false }, mergeUser: { username: 'bia' },
      approvedBy: { nodes: [{ username: 'bia', bot: false }, { username: 'ana', bot: false }] },
      notes: { nodes: [
        { system: true, createdAt: '2026-11-01T11:00:00Z', author: { username: 'bia' } },
        { system: false, createdAt: '2026-11-01T12:00:00Z', author: { username: 'bia', bot: false } },
        { system: false, createdAt: '2026-11-01T13:00:00Z', author: { username: 'GitLabDuo', bot: true } },
      ] },
      diffStatsSummary: { additions: 30, deletions: 5 },
    }]));
    expect(pr).toMatchObject({
      user: { login: 'ana', type: 'User' }, approvedByOther: true, comments: 1, changedLines: 35,
      firstReviewAt: '2026-11-01T12:00:00.000Z', readyAt: '2026-11-01T10:00:00Z', aiParticipants: ['gitlabduo'],
    });
  });

  it('an approval without a comment is a review, timed by its system note', () => {
    const [pr] = toPullRequestStats(toReviewNodes([{
      iid: 2, createdAt: '2026-11-01T10:00:00Z', mergedAt: '2026-11-03T10:00:00Z', author: { username: 'ana' },
      approvedBy: { nodes: [{ username: 'bia' }] },
      notes: { nodes: [{ system: true, body: 'approved this merge request', createdAt: '2026-11-02T10:00:00Z', author: { username: 'bia' } }] },
    }]));
    expect(pr).toMatchObject({ approvedByOther: true, firstReviewAt: '2026-11-02T10:00:00.000Z', comments: 0 });
  });

  it('a failed size query marks the PR, the others stay measured', () => {
    const [pr] = toPullRequestStats(toReviewNodes([{ iid: 1, createdAt: 'a', mergedAt: 'b', author: { username: 'x' }, sizeFailed: true }]));
    expect(pr).toMatchObject({ sizeFailed: true, changedLines: null });
  });
});

describe('pipelines and releases', () => {
  it('toWorkflowRuns: push pipelines count for CI health, MR pipelines are pull_request', () => {
    const runs = toWorkflowRuns([
      { source: 'push', status: 'success', ref: 'main', created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-01T10:10:00Z' },
      { source: 'push', status: 'failed', ref: 'main', created_at: '2026-11-01T11:00:00Z', updated_at: '2026-11-01T11:04:00Z' },
      { source: 'merge_request_event', status: 'success', ref: 'refs/merge-requests/1/head' },
    ], 3);
    expect(runs.workflow_runs.map((r) => [r.event, r.conclusion])).toEqual([['push', 'success'], ['push', 'failure'], ['pull_request', 'success']]);
    expect(analyzeCiRuns(runs)).toMatchObject({ available: true, successPercentage: 50, n: 2, medianMinutes: 7 });
  });

  it('toRelease', () => {
    expect(toRelease({ tag_name: 'v1', created_at: 'c', released_at: 'r' })).toEqual({ tag_name: 'v1', created_at: 'c', published_at: 'r', draft: false });
  });
});

describe('toRestCommit', () => {
  it('keeps message, author name/e-mail/date and parents; no account', () => {
    expect(toRestCommit(commit({ parent_ids: ['a', 'b'] }))).toMatchObject({
      sha: 'abc', html_url: 'https://gitlab.com/g/p/-/commit/abc', author: null, parents: [{ sha: 'a' }, { sha: 'b' }],
      commit: { message: 'feat: x', author: { name: 'Ana', email: 'ana@x.org' } },
    });
  });
});

describe('Classroom shapes', () => {
  it('toHistoryNode: the GraphQL history node Classroom reads; the author name stands in for the login; bots get [bot]', () => {
    const nodes = [
      commit({ author_name: 'Ana', message: 'feat: a' }), commit({ author_name: 'Ana', message: 'fix: b' }), commit({ author_name: 'Bia', message: 'wip' }),
      commit({ author_name: 'Deploy', author_email: 'project_9_bot_x@noreply.gitlab.com' }), commit({ parent_ids: ['a', 'b'], author_name: 'Ana' }),
    ].map(toHistoryNode);
    expect(nodes[0]).toMatchObject({ message: 'feat: a', parents: { totalCount: 1 }, author: { name: 'Ana', email: 'ana@x.org', user: { login: 'Ana' } } });
    expect(nodes[3].author.user.login).toBe('Deploy[bot]');
    expect(fromGraphqlCommit(nodes[0])).toMatchObject({ authorLogin: 'Ana', authorEmail: 'ana@x.org', parents: 1 });
    const h = analyzeCommitHistory({ totalCount: 5, capped: false, nodes });
    expect(h).toMatchObject({ commits: 5, authors: 2, humanCommits: 3, topSharePercentage: 67 });
  });

  it('classroomPipelines: pushes to the default branch and merge request pipelines', () => {
    const kept = classroomPipelines([
      { source: 'push', ref: 'main' }, { source: 'push', ref: 'feature' }, { source: 'merge_request_event', ref: 'refs/merge-requests/3/head' }, { source: 'schedule', ref: 'main' },
    ], 'main');
    expect(kept.map((p) => p.source + ':' + p.ref)).toEqual(['push:main', 'merge_request_event:refs/merge-requests/3/head']);
  });
});
