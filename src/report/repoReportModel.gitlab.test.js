import { describe, it, expect, beforeAll } from 'vitest';
import i18next from 'i18next';
import { buildRepoReportModel } from './repoReportModel.js';
import { withPlatform } from '../lib/platformText.js';
import pt from '../locales/pt.json';
import reportPt from '../locales/report.pt.json';
import guidePt from '../locales/guide.pt.json';

// The Dashboard PDF of a GitLab report, with the real Portuguese texts: no "GitHub" where the
// wording depends on the platform (GitLab variants, lib/platformText.js).
let i18n;
beforeAll(async () => {
  i18n = i18next.createInstance();
  await i18n.init({ lng: 'pt', resources: { pt: { translation: { ...pt, ...reportPt, ...guidePt } } }, interpolation: { escapeValue: false } });
});

const gitlabReport = () => ({
  provider: 'gitlab', host: 'gitlab.cin.ufpe.br',
  fullName: 'g/sub/p', url: 'https://gitlab.cin.ufpe.br/g/sub/p', description: 'd', language: null,
  createdAt: '2025-01-01T00:00:00Z', analysisDate: '2026-11-12T10:00:00Z',
  features: { pullRequests: true, issues: false },
  stats: { branches: 3, prs: 4, merges: 3, releases: 0, branchAnalysis: { checked: 3, capped: false } },
  metrics: { stars: 1, forks: 0, openIssues: null, closedIssues: null, leadTime: { n: 0, reason: 'noMerged' }, divergence: { avg: null, n: 0, categoryKey: 'repo.divergenceNone' } },
  health: { score: null, files: null, available: false, reason: 'error' },
  maturity: { treeStatus: 'truncated', testsDetected: null, ciCdDetected: true, dockerDetected: null, lintDetected: null, zombies: 0 },
  codeReview: { available: false, reason: 'error' },
  reviewProcess: { available: false, reason: 'error' },
  busFactor: { level: 'unavailable', reason: 'tooLarge' },
  busFactorAnalysis: {},
  contributors: null,
  charts: { activity: null, activityStatus: 'tooLarge', weekdays: null, weekdaysStatus: 'tooLarge', techStack: [] },
  recentCommits: null,
  recentPRs: [],
  codeChurn: { ratio: null, reason: 'tooLarge' },
  practices: { ci: { available: false, reason: 'noRuns' }, commits: { available: false, reason: 'noCommits' }, releases: { available: false, reason: 'noReleases' } },
  aiProcess: { available: false, reason: 'error' },
});

// Health uncertain, contributors from the all-time fallback, disabled MRs: other platform-dependent states.
const otherStates = () => ({
  ...gitlabReport(),
  features: { pullRequests: false, issues: true },
  health: { score: 57, available: true, uncertain: true, files: { hasReadme: true, hasLicense: true, hasContributing: false, hasDescription: true, hasCodeOfConduct: false, hasIssueTemplate: false, hasPullRequestTemplate: false } },
  busFactor: { level: 'healthy', topContributor: 'Ana', percentage: 30 },
  busFactorAnalysis: { busFactor: 3, riskLevel: 'healthy', window: 'allTime', partial: true, source: 'contributors', botsExcluded: 1, keyDevelopers: [{ login: 'Ana', percentage: 30 }] },
  contributors: [{ login: 'Ana', commits: 3, percentage: 30 }],
  codeReview: { available: false, reason: 'disabled' },
  reviewProcess: { available: false, reason: 'disabled' },
  metrics: { ...gitlabReport().metrics, leadTime: { reason: 'disabled' } },
});

describe('buildRepoReportModel: GitLab report', () => {
  it.each([['failures and limits', gitlabReport], ['uncertain health, partial contributors, MRs disabled', otherStates]])('%s: GitLab wording, no GitHub', (_, report) => {
    const t = withPlatform((key, options) => i18n.t(key, options), 'gitlab');
    const text = JSON.stringify(buildRepoReportModel(report(), t, 'pt', { now: new Date('2026-11-12T12:00:00Z') }));
    expect(text).toContain('GitLab');
    const mentions = text.match(/[^"]{0,60}GitHub[^"]{0,60}/g) ?? [];
    expect(mentions).toEqual([]);
    expect(text).not.toMatch(/\{\{\w+\}\}/); // every limit interpolated
  });
});
