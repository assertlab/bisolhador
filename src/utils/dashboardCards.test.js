import { describe, it, expect } from 'vitest';
import { buildStatCards } from './dashboardCards.js';
import { trimCommitSeries } from './activityStats.js';
import { repoAgeText } from './repoAge.js';

// Fake translator: the key plus its parameters, so a card says exactly which text it asked for
const t = (key, opts) => (opts && Object.keys(opts).filter((k) => k !== 'defaultValue').length ? `${key}:${JSON.stringify(opts)}` : key);

const live = () => ({
  metrics: {
    stars: 10, forks: 2, openIssues: 4, closedIssues: 6,
    leadTime: { n: 5, value: 2, unit: 'hours', p90Hours: 30 },
    divergence: { avg: 1.5, n: 4, categoryKey: 'repo.divergenceLow' },
  },
  codeChurn: { ratio: '1.95', categoryKey: 'balanced' },
  reviewProcess: {
    available: true,
    coverage: { approvedPercentage: 40, reviewedPercentage: 60, n: 10 },
    firstReview: { n: 3, medianHours: 4, p90Hours: 20 },
    prSize: { n: 8, medianLines: 120, smallPercentage: 75 },
  },
  practices: {
    ci: { available: true, successPercentage: 90, medianMinutes: 3, n: 40 },
    commits: { available: true, percentage: 80, n: 100 },
    releases: { available: true, last12Months: 4, capped: false, medianIntervalDays: 30, daysSinceLast: 5, semverPercentage: 100 },
  },
});

describe('buildStatCards', () => {
  it('groups the cards the Dashboard shows, in screen order', () => {
    const cards = buildStatCards(live(), t, 'pt');
    expect(cards.volume.map((c) => c.id)).toEqual(['stars', 'forks', 'openIssues', 'closedIssues', 'codeChurn']);
    expect(cards.review.map((c) => c.id)).toEqual(['leadTime', 'divergence', 'reviewCoverage', 'firstReview', 'prSize']);
    expect(cards.practices.map((c) => c.id)).toEqual(['ci', 'conventional', 'releases']);
    expect(cards.review[0]).toMatchObject({ guideId: 'lead-time', title: 'stats.leadTime' });
  });

  it('carries values, samples and the explanation (tooltip) of each card', () => {
    const [stars] = buildStatCards(live(), t, 'pt').volume;
    expect(stars).toMatchObject({ value: 10, tooltip: 'stats.starsTooltip' });
    const ci = buildStatCards(live(), t, 'pt').practices[0];
    expect(ci.value).toBe('90%');
    expect(ci.subValue).toContain('"count":40');
  });

  it('what could not be measured stays N/A with its reason, never zero', () => {
    const data = live();
    data.reviewProcess = { available: false, reason: 'noToken' };
    data.practices = { ci: { available: false, reason: 'noRuns' }, commits: {}, releases: {} };
    data.metrics.leadTime = { n: 0, reason: 'error' };
    const cards = buildStatCards(data, t, 'pt');
    const byId = Object.fromEntries([...cards.review, ...cards.practices].map((c) => [c.id, c]));
    expect(byId.leadTime.value).toBe('N/A');
    expect(byId.reviewCoverage.value).toBe('N/A');
    expect(byId.reviewCoverage.subValue).toContain('stats.reviewProcessUnavailable.noToken');
    expect(byId.firstReview.value).toBe('N/A');
    expect(byId.prSize.value).toBe('N/A');
    expect(byId.ci.value).toBe('N/A');
    expect(byId.ci.subValue).toContain('stats.practiceUnavailable.noRuns');
  });

  it('an old snapshot (no review process, no practices) says "not recorded" per card', () => {
    const data = live();
    delete data.reviewProcess;
    delete data.practices;
    const cards = buildStatCards(data, t, 'pt');
    expect(cards.review.find((c) => c.id === 'reviewCoverage').subValue).toContain('stats.reviewProcessUnavailable.snapshot');
    expect(cards.practices.every((c) => c.value === 'N/A')).toBe(true);
    expect(cards.practices[0].subValue).toContain('stats.practiceUnavailable.snapshot');
  });
});

describe('trimCommitSeries', () => {
  const now = new Date('2026-10-27T12:00:00');

  it('an old project shows up to 52 weeks, starting two weeks before the first commit', () => {
    const raw = [0, 0, 0, 0, 5, 3, 0, 2];
    const { values, labels } = trimCommitSeries(raw, '2015-01-01', now);
    expect(values).toEqual([0, 0, 5, 3, 0, 2]);
    expect(labels).toHaveLength(6);
    expect(labels.at(-1)).toBe('27/10'); // the last week is "now"
    expect(labels.at(-2)).toBe('20/10');
  });

  it('a young project is trimmed to its age plus a buffer', () => {
    const raw = Array.from({ length: 52 }, (_, i) => (i === 51 ? 3 : 0));
    const { values } = trimCommitSeries(raw, '2026-10-01', now); // ~4 weeks old
    expect(values.length).toBeLessThanOrEqual(8);
    expect(values.at(-1)).toBe(3);
  });

  it('no activity at all: an old project keeps the whole series, a young one only its recent weeks', () => {
    expect(trimCommitSeries(new Array(52).fill(0), '2015-01-01', now).values).toHaveLength(52);
    expect(trimCommitSeries(new Array(52).fill(0), '2026-10-10', now).values.length).toBeLessThan(10);
  });

  it('a missing or invalid creation date falls back to 52 weeks', () => {
    expect(trimCommitSeries([1, 2, 3], undefined, now).weeksOld).toBe(52);
    expect(trimCommitSeries([1, 2, 3], 'not a date', now).weeksOld).toBe(52);
  });
});

describe('repoAgeText', () => {
  const now = new Date('2026-10-27T12:00:00Z');
  const age = (iso) => repoAgeText(iso, (key, o) => (o ? `${key}:${o.count}` : key), now);

  it('picks the unit by size', () => {
    expect(age('2026-10-27T01:00:00Z')).toBe('repo.ageLessThanDay');
    expect(age('2026-10-26T00:00:00Z')).toBe('repo.ageOneDay');
    expect(age('2026-10-20T00:00:00Z')).toBe('repo.ageOneWeek');
    expect(age('2026-08-27T00:00:00Z')).toBe('repo.ageMonths:2');
    expect(age('2025-10-27T00:00:00Z')).toBe('repo.ageOneYear');
    expect(age('2013-05-24T00:00:00Z')).toBe('repo.ageYears:13');
  });

  it('no creation date is N/A', () => {
    expect(age(undefined)).toBe('N/A');
  });
});
