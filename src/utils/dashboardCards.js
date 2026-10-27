import { MERGED_PR_SAMPLE } from '../constants.js';
import { formatDuration, SMALL_PR_LINES } from './prReviewStats.js';
import { formatters } from './formatters.js';
import { closedShareOf, ADD_DELETE_WEEKS, ADD_DELETE_MIN_ACTIVE_WEEKS } from './activityStats.js';

// The Dashboard's stat cards as plain data, shared by the screen (StatCard) and the PDF report, so both
// say the same thing. Text only: icons and layout stay with each renderer.
// Card: { id, guideId, title, value, subValue?, tooltip }. Value strings are final ("N/A" included):
// "couldn't measure" is never turned into zero here.

/**
 * @param {object} data - the report (live or snapshot-normalized), `displayData` in the Dashboard
 * @param {Function} t - i18next translator
 * @param {string} locale - Intl locale (intlLocale)
 * @returns {{ volume: object[], review: object[], practices: object[] }}
 */
export function buildStatCards(data, t, locale) {
  const leadTime = data?.metrics?.leadTime ?? {};
  const leadTimeP90 = leadTime.p90Hours != null ? formatDuration(leadTime.p90Hours) : null;
  const duration = ({ value, unit }) => `${value.toLocaleString(locale)} ${t('units.' + unit, { count: value })}`;
  const closedPct = closedShareOf(data?.metrics);
  // Coverage, time to first review, PR size (GraphQL, token required)
  const review = data?.reviewProcess ?? { available: false, reason: 'snapshot' };
  const reviewUnavailable = review.available ? undefined : t(`stats.reviewProcessUnavailable.${review.reason}`, { defaultValue: t('stats.reviewProcessUnavailable.error') });
  const practices = data?.practices ?? { ci: {}, commits: {}, releases: {} };
  const practiceUnavailable = (p) => t(`stats.practiceUnavailable.${p.reason ?? 'snapshot'}`, { defaultValue: t('stats.practiceUnavailable.error') });
  const churn = data?.codeChurn;
  const churnNote = churn?.categoryKey
    ? t(`stats.addDelete.${churn.categoryKey}`)
    : churn?.reason && t(`stats.addDeleteUnavailable.${churn.reason}`, { defaultValue: t('stats.addDeleteUnavailable.error') });
  const divergence = data?.metrics?.divergence ?? {};

  const volume = [
    { id: 'stars', guideId: 'stars-forks', title: t('stats.stars'), value: data.metrics.stars, tooltip: t('stats.starsTooltip') },
    { id: 'forks', guideId: 'stars-forks', title: t('stats.forks'), value: data.metrics.forks, tooltip: t('stats.forksTooltip') },
    { id: 'openIssues', guideId: 'issues', title: t('stats.openIssues'), value: data.metrics.openIssues, tooltip: t('stats.openIssuesTooltip') },
    {
      id: 'closedIssues', guideId: 'issues', title: t('stats.closedIssues'), value: data.metrics.closedIssues,
      subValue: closedPct == null ? undefined : t('stats.closedShare', { pct: closedPct }), tooltip: t('stats.closedIssuesTooltip'),
    },
    {
      id: 'codeChurn', guideId: 'add-delete', title: t('stats.codeChurn'),
      value: formatters.formatDecimal(parseFloat(churn?.ratio), locale, 2), subValue: churnNote || undefined,
      tooltip: t('stats.codeChurnTooltip', { weeks: ADD_DELETE_WEEKS, min: ADD_DELETE_MIN_ACTIVE_WEEKS }),
    },
  ];

  const reviewCards = [
    {
      id: 'leadTime', guideId: 'lead-time', title: t('stats.leadTime'),
      value: leadTime.n > 0 ? duration(leadTime) : 'N/A',
      subValue: leadTime.n > 0 && leadTimeP90
        ? t('stats.leadTimeSample', { n: leadTime.n, p90: duration(leadTimeP90) })
        : t(`stats.leadTimeUnavailable.${leadTime.reason}`, { defaultValue: t('stats.leadTimeUnavailable.error') }),
      tooltip: t('stats.leadTimeTooltip', { n: MERGED_PR_SAMPLE }),
    },
    {
      id: 'divergence', guideId: 'divergence', title: t('stats.divergence'),
      value: divergence.avg ?? 'N/A',
      subValue: divergence.n > 0
        ? `${t(divergence.categoryKey)} · ${t('stats.prSample', { n: divergence.n })}`
        : t(divergence.categoryKey),
      tooltip: t('stats.divergenceTooltip', { n: MERGED_PR_SAMPLE }),
    },
    {
      id: 'reviewCoverage', guideId: 'review-coverage', title: t('stats.reviewCoverage'),
      value: review.available ? formatters.formatPercent(review.coverage.approvedPercentage, locale) : 'N/A',
      subValue: review.available
        ? review.coverage.reviewedPercentage == null
          ? t('stats.reviewCoverageSampleShort', { n: review.coverage.n })
          : t('stats.reviewCoverageSample', { reviewed: review.coverage.reviewedPercentage, n: review.coverage.n })
        : reviewUnavailable,
      tooltip: t('stats.reviewCoverageTooltip', { n: MERGED_PR_SAMPLE }),
    },
    {
      id: 'firstReview', guideId: 'first-review', title: t('stats.firstReview'),
      value: review.available && review.firstReview.n > 0 ? duration(formatDuration(review.firstReview.medianHours)) : 'N/A',
      subValue: review.available
        ? review.firstReview.n > 0
          ? t('stats.firstReviewSample', { n: review.firstReview.n, p90: duration(formatDuration(review.firstReview.p90Hours)) })
          : review.firstReview.unavailable ? t('stats.reviewProcessUnavailable.error') : t('stats.firstReviewNone')
        : reviewUnavailable,
      tooltip: t('stats.firstReviewTooltip'),
    },
    {
      id: 'prSize', guideId: 'pr-size', title: t('stats.prSize'),
      value: review.available && review.prSize.n > 0 ? t('stats.prSizeValue', { lines: formatters.formatNumber(review.prSize.medianLines, locale) }) : 'N/A',
      subValue: review.available
        ? review.prSize.n > 0 ? t('stats.prSizeSample', { small: review.prSize.smallPercentage, max: SMALL_PR_LINES, n: review.prSize.n }) : t('stats.reviewProcessUnavailable.error')
        : reviewUnavailable,
      tooltip: t('stats.prSizeTooltip', { max: SMALL_PR_LINES }),
    },
  ];

  const practiceCards = [
    {
      id: 'ci', guideId: 'ci-health', title: t('stats.ciHealth'),
      value: practices.ci.available ? formatters.formatPercent(practices.ci.successPercentage, locale) : 'N/A',
      subValue: practices.ci.available
        ? t('stats.ciHealthSample', { minutes: practices.ci.medianMinutes == null ? 'N/A' : practices.ci.medianMinutes.toLocaleString(locale), count: practices.ci.n })
        : practiceUnavailable(practices.ci),
      tooltip: t('stats.ciHealthTooltip'),
    },
    {
      id: 'conventional', guideId: 'conventional-commits', title: t('stats.conventionalCommits'),
      value: practices.commits.available ? formatters.formatPercent(practices.commits.percentage, locale) : 'N/A',
      subValue: practices.commits.available ? t('stats.conventionalCommitsSample', { count: practices.commits.n }) : practiceUnavailable(practices.commits),
      tooltip: t('stats.conventionalCommitsTooltip'),
    },
    {
      id: 'releases', guideId: 'release-cadence', title: t('stats.releaseCadence'),
      value: practices.releases.available
        ? t(practices.releases.capped ? 'stats.releasesLast12Capped' : 'stats.releasesLast12', { count: practices.releases.last12Months })
        : 'N/A',
      subValue: practices.releases.available
        ? [
            practices.releases.medianIntervalDays != null && t('stats.releaseEvery', { days: practices.releases.medianIntervalDays.toLocaleString(locale), count: practices.releases.medianIntervalDays }),
            t('stats.releaseLast', { count: practices.releases.daysSinceLast }),
            t('stats.releaseSemver', { semver: practices.releases.semverPercentage }),
          ].filter(Boolean).join(' · ')
        : practiceUnavailable(practices.releases),
      tooltip: t('stats.releaseCadenceTooltip'),
    },
  ];

  return { volume, review: reviewCards, practices: practiceCards };
}
