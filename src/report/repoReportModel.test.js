import { describe, it, expect } from 'vitest';
import { buildRepoReportModel } from './repoReportModel.js';

const t = (key, opts = {}) => {
  if (opts.returnObjects) return ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  const { defaultValue, ...rest } = opts;
  void defaultValue;
  return Object.keys(rest).length ? `${key}:${JSON.stringify(rest)}` : key;
};
const NOW = new Date('2026-10-27T12:00:00Z');
const model = (data, opts = {}) => buildRepoReportModel(data, t, 'pt', { now: NOW, ...opts });

const aiProcess = (over = {}) => ({
  available: true, withToken: true,
  tools: [{ id: 'claude', sources: ['config', 'commit'], configKind: 'extensions', fromTemplate: false }],
  config: { status: 'complete', entries: [], hiddenLocal: [] },
  commits: { available: true, n: 10, withAi: 4, percentage: 40 },
  prs: { available: true, n: 5, byAgents: 0, percentage: 0, aiReviewed: { available: true, count: 0, percentage: 0 } },
  safeguards: { available: true, agentPrs: 0 },
  coherence: { flags: [], unverified: [], toolMismatch: false, coauthorDisabled: false },
  badge: { applicable: true, met: 3, total: 3, criteria: [{ id: 'config', state: 'met' }, { id: 'testsCi', state: 'unverified' }] },
  ...over,
});

const full = () => ({
  fullName: 'o/r', url: 'https://github.com/o/r', description: 'desc', language: 'JavaScript',
  createdAt: '2020-01-01T00:00:00Z', analysisDate: '2026-10-27T10:00:00Z',
  stats: { branches: 3, prs: 10, merges: 8, releases: 2, branchAnalysis: { checked: 3, capped: false } },
  metrics: { stars: 5, forks: 1, openIssues: 2, closedIssues: 3, leadTime: { n: 0 }, divergence: { avg: null, n: 0, categoryKey: 'repo.divergenceNone' } },
  health: { score: 86, files: { hasReadme: true, hasLicense: true, hasContributing: false, hasDescription: true, hasCodeOfConduct: false, hasIssueTemplate: false, hasPullRequestTemplate: true } },
  maturity: { treeStatus: 'complete', testsDetected: true, ciCdDetected: false, dockerDetected: null, lintDetected: true, zombies: 2 },
  codeReview: { available: true, unapprovedPercentage: 50, selfMergePercentage: 10, n: 10, color: 'red' },
  busFactor: { level: 'critical', topContributor: 'ana', percentage: 80 },
  busFactorAnalysis: { busFactor: 1, riskLevel: 'critical', window: '12months', botsExcluded: 1, keyDevelopers: [{ login: 'ana', percentage: 80 }] },
  contributors: Array.from({ length: 20 }, (_, i) => ({ login: `p${i}`, commits: 20 - i, percentage: 5 })),
  charts: { activity: { datasets: [{ data: [0, 2, 4] }] }, activityStatus: 'ok', weekdays: { counts: [1, 2, 3, 4, 5, 6, 7], total: 28 }, techStack: [{ language: 'JavaScript', percentage: 90 }, { language: 'HTML', percentage: 10 }] },
  recentCommits: [{ commit: { message: 'feat: x\n\nbody', author: { name: 'Ana', date: '2026-10-01T00:00:00Z' } } }],
  recentPRs: [{ title: 'PR 1', state: 'closed', merged_at: '2026-10-02T00:00:00Z', created_at: '2026-10-01T00:00:00Z' }],
  practices: { ci: { available: false, reason: 'noRuns' }, commits: {}, releases: {} },
  reviewProcess: { available: false, reason: 'noToken' },
  codeChurn: { ratio: '1.2', categoryKey: 'balanced' },
  aiProcess: aiProcess(),
});

describe('buildRepoReportModel', () => {
  it('header: name, description, age, provenance (live vs snapshot)', () => {
    const live = model(full());
    expect(live.header).toMatchObject({ fullName: 'o/r', description: 'desc', language: 'JavaScript', isSnapshot: false, branches: 3, releases: 2 });
    expect(live.header.age).toContain('repo.ageYears');
    expect(model(full(), { isSnapshot: true }).header.isSnapshot).toBe(true);
    expect(model({ ...full(), description: null }).header.description).toBe('repo.noDescription');
  });

  it('text written by the repository (gitmoji commits, emoji in the description) is stripped too: the font has no emoji', () => {
    const data = full();
    data.description = '🚀 Fast router';
    data.recentCommits = [{ commit: { message: '✨ feat: add thing', author: { name: 'Ana 🦈', date: '2026-10-01T00:00:00Z' } } }];
    data.recentPRs = [{ title: '🐛 fix: crash', state: 'open', created_at: '2026-10-01T00:00:00Z' }];
    const m = model(data);
    expect(m.header.description).toBe('Fast router');
    expect(m.recent.commits[0].message).toBe('feat: add thing');
    expect(m.recent.commits[0].by).toContain('"author":"Ana"');
    expect(m.recent.prs[0].title).toBe('fix: crash');
    expect(model({ ...data, description: '🚀' }).header.description).toBe('repo.noDescription'); // nothing left: the fallback text
  });

  it('health: checklist as words; an issue template the tree could not confirm is "unknown", not a miss', () => {
    const items = Object.fromEntries(model(full()).health.items.map((i) => [i.label, i.state]));
    expect(items['health.files.readme']).toBe('report.repo.state.yes');
    expect(items['health.files.contributing']).toBe('report.repo.state.no');
    expect(items['health.files.issueTemplate']).toBe('report.repo.state.no');
    const uncertain = { ...full(), health: { ...full().health, uncertain: true } };
    expect(model(uncertain).health.items.find((i) => i.label === 'health.files.issueTemplate').state).toBe('report.repo.state.unknown');
    expect(model(uncertain).health.notes).toContain('health.uncertain');
  });

  it('health unavailable: N/A text plus the reason, no checklist', () => {
    const m = model({ ...full(), health: { score: null, reason: 'fork', files: null } });
    expect(m.health.score).toBe('health.notAvailable');
    expect(m.health.items).toBeNull();
    expect(m.health.notes[0]).toContain('health.unavailable.fork');
  });

  it('maturity: detectors in words; not found vs not verified; legacy snapshots read failures as unverified', () => {
    const states = Object.fromEntries(model(full()).maturity.detectors.map((d) => [d.label, d.state]));
    expect(states['maturity.badges.tests']).toBe('report.repo.state.yes');
    expect(states['maturity.badges.ciCd']).toBe('report.repo.state.no');
    expect(states['maturity.badges.docker']).toBe('report.repo.state.unknown');
    const legacy = model({ ...full(), maturity: { testsDetected: false, ciCdDetected: true, zombies: 0 } }).maturity;
    expect(legacy.detectors.find((d) => d.label === 'maturity.badges.tests').state).toBe('report.repo.state.unknown');
    expect(legacy.detectors.some((d) => d.label === 'maturity.badges.linter')).toBe(false);
  });

  it('maturity: code review alert only when not green; unavailable review says why; zombies with its criteria', () => {
    const m = model(full()).maturity;
    expect(m.alert).not.toBeNull();
    expect(m.codeReview.detail).toContain('maturity.codeReviewDetail');
    expect(m.zombies.text).toContain('maturity.badges.zombies');
    expect(m.zombies.detail).toContain('maturity.zombieCriteria');
    const off = model({ ...full(), codeReview: { available: false, reason: 'noToken' } }).maturity;
    expect(off.alert).toBeNull();
    expect(off.codeReview.text).toBe('maturity.badges.codeReviewUnavailable');
    expect(off.codeReview.detail).toContain('maturity.unavailable.noToken');
  });

  it('bus factor only when computed; contributors capped at 15 with the remainder counted; no avatars', () => {
    const m = model(full());
    expect(m.bus).toMatchObject({ value: 1, others: 20 });
    expect(m.bus.scope).toContain('contributors.scope.12months');
    expect(m.contributors.rows).toHaveLength(15);
    expect(m.contributors.more).toBe(5);
    expect(JSON.stringify(m)).not.toContain('avatar');
    expect(model({ ...full(), busFactorAnalysis: { busFactor: 0 } }).bus).toBeNull();
  });

  it('contributors unavailable or not recorded: the message, no rows', () => {
    const m = model({ ...full(), contributors: null, busFactor: { level: 'notRecorded' } }).contributors;
    expect(m.rows).toEqual([]);
    expect(m.title).toBe('contributors.busFactor.notRecorded.title');
  });

  it('activity series trimmed like the screen; unavailable says why', () => {
    const a = model(full()).activity;
    expect(a.values).toEqual([0, 2, 4]);
    expect(a.labels).toHaveLength(3);
    const off = model({ ...full(), charts: { ...full().charts, activity: null, activityStatus: 'computing' } }).activity;
    expect(off.unavailable).toContain('charts.statsUnavailable.computing');
    expect(off.values).toBeUndefined();
  });

  it('weekdays: counts with the scope note (small sample flagged); old snapshots "not recorded"', () => {
    const w = model(full()).weekdays;
    expect(w.counts).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(w.days).toHaveLength(7);
    expect(w.note).toContain('charts.weekdays.smallSample'); // 28 < 50
    const old = model({ ...full(), charts: { ...full().charts, weekdays: null } }).weekdays;
    expect(old.unavailable).toContain('charts.statsUnavailable.notRecordedWeekdays');
  });

  it('recent activity: failed vs empty vs snapshot, never an empty list that looks like "none"', () => {
    expect(model(full()).recent.commits[0].message).toBe('feat: x');
    expect(model({ ...full(), recentCommits: null }).recent.commitsNote).toBe('activity.commitsUnavailable');
    expect(model({ ...full(), recentCommits: [] }).recent.commitsNote).toBe('activity.noCommits');
    expect(model({ ...full(), recentCommits: [] }, { isSnapshot: true }).recent.commitsNote).toBe('activity.commitsNotRecorded');
    expect(model(full()).recent.prs[0].state).toBe('activity.prStates.merged');
  });

  it('warnings of partial data are carried', () => {
    expect(model({ ...full(), _warnings: ['issues'] }).warnings).toEqual(['issues']);
  });

  describe('AI in the Process', () => {
    it('lines for tools (with their sources), config depth, the three counts, safeguards and the badge in words', () => {
      const ai = model(full()).ai;
      expect(ai.tools[0]).toContain('Claude');
      expect(ai.depth[0]).toContain('aiProcess.depth.extensions');
      expect(ai.stats.map((s) => s.label)).toEqual(['aiProcess.commitsLabel', 'aiProcess.prsLabel', 'aiProcess.aiReviewedLabel']);
      expect(ai.safeguards).toEqual(['aiProcess.safeguards.noAgentPrs']);
      expect(ai.badge.summary).toContain('aiProcess.badge.scoreUnassessed'); // "3 of 3 (1 not assessed)"
      expect(ai.badge.criteria).toEqual(['aiProcess.badge.criteria.config: report.repo.criterion.met', 'aiProcess.badge.criteria.testsCi: report.repo.criterion.unverified']);
      expect(ai.lowerBound).toBe('aiProcess.lowerBoundNote');
    });

    it('no trace: says so with the lower-bound explanation; "not applicable" badge', () => {
      const ai = model({ ...full(), aiProcess: aiProcess({ tools: [], badge: { applicable: false, criteria: [] } }) }).ai;
      expect(ai.tools[0]).toContain('aiProcess.noTraces');
      expect(ai.badge.summary).toBe('aiProcess.badge.notApplicable');
    });

    it('sources that disagree are listed with the neutral intro', () => {
      const ai = model({ ...full(), aiProcess: aiProcess({ coherence: { flags: ['configWithoutDeclaration'], unverified: [] } }) }).ai;
      expect(ai.coherence.flags).toEqual(['aiProcess.coherence.configWithoutDeclaration']);
      expect(ai.coherence.intro).toBe('aiProcess.coherence.intro');
    });

    it('without a token or with failures: notes, N/A and "needs token", never zero', () => {
      const ai = model({ ...full(), aiProcess: aiProcess({ withToken: false, prs: { available: false }, safeguards: { available: false } }) }).ai;
      expect(ai.notes).toContain('aiProcess.unavailable.noToken');
      expect(ai.stats[1].value).toBe('aiProcess.notAvailable');
      expect(ai.safeguards[0]).toContain('aiProcess.needsToken');
    });

    it('an old snapshot says "not recorded"; a failed section says it failed', () => {
      expect(model({ ...full(), aiProcess: { available: false, reason: 'snapshot' } }).ai.unavailable).toBe('aiProcess.notRecorded');
      expect(model({ ...full(), aiProcess: undefined }).ai.unavailable).toBe('aiProcess.notRecorded');
      expect(model({ ...full(), aiProcess: { available: false, reason: 'error' } }).ai.unavailable).toBe('aiProcess.unavailable.error');
    });

    it('carries nothing per person: only counts, tool labels and texts', () => {
      const json = JSON.stringify(model(full()).ai);
      expect(json).not.toMatch(/login|email|avatar/i);
    });
  });
});
