import { buildStatCards } from '../utils/dashboardCards.js';
import { repoAgeText } from '../utils/repoAge.js';
import { trimCommitSeries, PUNCH_CARD_MAX_COMMITS, WEEKDAYS_MIN_SAMPLE } from '../utils/activityStats.js';
import { formatters } from '../utils/formatters.js';
import { badgeScoreText } from '../utils/aiProcess.js';
import { plainText } from './plainText.js';
import { toolLabel } from '../components/ai/toolLabel.js';
import { AI_MIN_GROUP, BRANCH_SCAN_MAX, ZOMBIE_BRANCH_DAYS } from '../constants.js';

// The Dashboard report (one repository) as plain, ready-to-print data. Pure: text comes from `t`, so the
// PDF says what the screen says, and "couldn't measure" stays "N/A"/"not verified", never zero.
// No avatars (a remote image would need more CSP) and no ✓/✗ glyphs (the report font has none): states are words.

const CONTRIBUTOR_ROWS = 15;
const RECENT_ITEMS = 10;
const stripTags = (text) => String(text).replace(/<\/?[a-z]+>/gi, '');

/**
 * @param {object} data - the report (live or snapshot-normalized)
 * @param {Function} t - i18next translator (guide, report and main texts loaded)
 * @param {string} locale
 * @param {{ isSnapshot?: boolean, now?: Date }} [opts]
 */
export function buildRepoReportModel(data, t, locale, { isSnapshot = false, now = new Date() } = {}) {
  const state = (value) => t(`report.repo.state.${value === true ? 'yes' : value === false ? 'no' : 'unknown'}`);
  return {
    header: {
      fullName: plainText(data.fullName),
      url: data.url,
      // Text written by the repository's people (gitmoji, emoji in descriptions) is not in the report font either
      description: plainText(data.description) || t('repo.noDescription'),
      language: plainText(data.language) ?? null,
      age: repoAgeText(data.createdAt, t, now),
      since: t('repo.since', { createdAt: data.createdAt ? formatters.formatDate(data.createdAt, locale) : 'N/A' }),
      analysisDate: data.analysisDate ?? null,
      isSnapshot,
      branches: data.stats?.branches ?? null,
      prs: data.stats?.prs ?? null,
      merges: data.stats?.merges ?? null,
      releases: data.stats?.releases ?? null,
    },
    warnings: data._warnings ?? [],
    cards: buildStatCards(data, t, locale),
    health: healthSection(data.health, t, state),
    maturity: maturitySection(data, t, state),
    bus: busSection(data.busFactorAnalysis, t),
    contributors: contributorsSection(data, t),
    activity: activitySection(data, t, now),
    weekdays: weekdaysSection(data, t, locale),
    languages: (data.charts?.techStack ?? []).map(({ language, percentage }) => ({ language, percentage })),
    ai: aiSection(data.aiProcess, t, locale),
    recent: {
      commits: Array.isArray(data.recentCommits)
        ? data.recentCommits.slice(0, RECENT_ITEMS).map((c) => ({
            message: plainText(String(c.commit?.message ?? '').split('\n')[0]),
            by: t('activity.commitBy', { author: plainText(c.commit?.author?.name ?? ''), date: c.commit?.author?.date ? formatters.formatDateLong(c.commit.author.date, locale) : '' }),
          }))
        : null,
      commitsNote: Array.isArray(data.recentCommits)
        ? (data.recentCommits.length === 0 ? t(isSnapshot ? 'activity.commitsNotRecorded' : 'activity.noCommits') : null)
        : t(isSnapshot ? 'activity.commitsNotRecorded' : 'activity.commitsUnavailable'),
      prs: (data.recentPRs ?? []).slice(0, RECENT_ITEMS).map((pr) => ({
        title: plainText(pr.title),
        state: t(`activity.prStates.${pr.merged_at ? 'merged' : pr.state === 'open' ? 'open' : 'closed'}`),
        date: pr.created_at ? formatters.formatDate(pr.created_at, locale) : '',
      })),
    },
  };
}

function healthSection(health, t, state) {
  const { score, files, reason } = health ?? {};
  const notes = [];
  if (health?.uncertain) notes.push(t('health.uncertain'));
  if (health?.source === 'tree') notes.push(t('health.fromTree'));
  if (score == null) notes.push(t(`health.unavailable.${reason}`, { defaultValue: t('health.unavailable.error') }));
  const items = files
    ? [
        ['readme', files.hasReadme], ['license', files.hasLicense], ['contributing', files.hasContributing],
        ['description', files.hasDescription], ['codeOfConduct', files.hasCodeOfConduct],
        // An issue template the tree couldn't confirm is "not verified", not a miss
        ['issueTemplate', files.hasIssueTemplate ? true : health.uncertain ? null : false],
        ['prTemplate', files.hasPullRequestTemplate],
      ].map(([key, value]) => ({ label: t(`health.files.${key}`), state: state(value) }))
    : null;
  return { score: score == null ? t('health.notAvailable') : `${score}%`, items, notes };
}

function maturitySection(data, t, state) {
  const { maturity = {}, codeReview, stats } = data;
  const branchAnalysis = stats?.branchAnalysis;
  const legacy = !maturity.treeStatus; // snapshot from before 2026-10: failures read as false
  const detector = (key, detected) => {
    const value = detected == null || (legacy && detected === false) ? null : detected;
    return { label: t(`maturity.badges.${key}`), state: state(value), note: value === null ? t(`maturity.notVerified.${legacy ? 'legacy' : maturity.treeStatus}`) : null };
  };
  const detectors = [detector('tests', maturity.testsDetected), detector('ciCd', maturity.ciCdDetected), detector('docker', maturity.dockerDetected)];
  if (maturity.treeStatus) detectors.push(detector('linter', maturity.lintDetected));

  const reviewAvailable = codeReview?.available === true;
  const zombieCriteria = branchAnalysis?.checked != null
    ? `${t('maturity.zombieCriteria', { checked: branchAnalysis.checked, days: ZOMBIE_BRANCH_DAYS })}${branchAnalysis.capped ? ` ${t('maturity.zombieCapped', { max: BRANCH_SCAN_MAX })}` : ''}`
    : null;
  const zombieCount = branchAnalysis?.capped ? `>= ${maturity.zombies}` : maturity.zombies;
  return {
    detectors,
    codeReview: reviewAvailable
      ? { text: t('maturity.badges.codeReview', { percentage: codeReview.unapprovedPercentage }), detail: t('maturity.codeReviewDetail', { n: codeReview.n, unapproved: codeReview.unapprovedPercentage, selfMerge: codeReview.selfMergePercentage }) }
      : { text: t('maturity.badges.codeReviewUnavailable'), detail: t(`maturity.unavailable.${codeReview?.reason}`, { defaultValue: t('maturity.unavailable.error') }) },
    alert: reviewAvailable && codeReview.color !== 'green'
      ? { title: t('maturity.alert.title'), message: t('maturity.alert.message', { percentage: codeReview.unapprovedPercentage, n: codeReview.n }) }
      : null,
    zombies: {
      text: maturity.zombies == null ? t('maturity.badges.zombiesUnavailable') : maturity.zombies === 0 ? t('maturity.badges.noZombies') : t('maturity.badges.zombies', { count: zombieCount }),
      detail: zombieCriteria,
    },
  };
}

function scopeText(analysis, t) {
  if (!analysis?.window) return null; // snapshots before 2026-10 don't record it
  return [
    t(`contributors.scope.${analysis.partial ? 'allTimeOnly' : analysis.window}`),
    analysis.botsExcluded > 0 && t('contributors.scope.botsExcluded', { count: analysis.botsExcluded }),
    analysis.capped && t('contributors.scope.capped'),
  ].filter(Boolean).join(' · ');
}

function busSection(analysis, t) {
  if (!analysis || !(analysis.busFactor > 0)) return null;
  const { busFactor, riskLevel, keyDevelopers = [] } = analysis;
  const keyTotal = keyDevelopers.reduce((sum, d) => sum + d.percentage, 0);
  return {
    value: busFactor,
    risk: t(`busFactor.risk.${riskLevel}`, { defaultValue: t('busFactor.risk.critical') }),
    description: t('busFactor.description', { count: busFactor }),
    scope: scopeText(analysis, t),
    developers: keyDevelopers.map((d) => ({ login: plainText(d.login), percentage: d.percentage })),
    others: Math.max(0, Math.round((100 - keyTotal) * 10) / 10),
    othersLabel: t('busFactor.others'),
  };
}

function contributorsSection(data, t) {
  const { contributors, busFactor, busFactorAnalysis } = data;
  const unavailable = !contributors || ['unavailable', 'notRecorded'].includes(busFactor?.level);
  const level = busFactor?.level === 'notRecorded' ? 'notRecorded' : unavailable ? 'unavailable' : busFactor?.level;
  return {
    title: t(`contributors.busFactor.${level}.title`),
    message: stripTags(t(`contributors.busFactor.${level}.message`, { contributor: plainText(busFactor?.topContributor), percentage: busFactor?.percentage })),
    scope: scopeText(busFactorAnalysis, t),
    rows: unavailable ? [] : contributors.slice(0, CONTRIBUTOR_ROWS).map((c) => ({ login: plainText(c.login), commits: c.commits ?? c.contributions, percentage: c.percentage })),
    more: unavailable ? 0 : Math.max(0, contributors.length - CONTRIBUTOR_ROWS),
  };
}

function activitySection(data, t, now) {
  const raw = data.charts?.activity?.datasets?.[0]?.data;
  if (!Array.isArray(raw) || raw.length === 0) {
    return { title: t('charts.commitActivity.titleNoData'), unavailable: t(`charts.statsUnavailable.${data.charts?.activityStatus ?? 'snapshot'}`, { defaultValue: t('charts.statsUnavailable.error') }) };
  }
  const { values, labels } = trimCommitSeries(raw, data.createdAt, now);
  return { title: t('charts.commitActivity.title', { count: values.length }), values, labels };
}

function weekdaysSection(data, t, locale) {
  const weekdays = data.charts?.weekdays;
  const title = t('charts.weekdays.title');
  if (!weekdays?.counts) {
    return { title, unavailable: t(`charts.statsUnavailable.${data.charts?.weekdaysStatus ?? 'notRecordedWeekdays'}`, { defaultValue: t('charts.statsUnavailable.error') }) };
  }
  const { counts, total } = weekdays;
  return {
    title,
    days: t('charts.weekdays.days', { returnObjects: true }),
    counts,
    note: `${t(total >= PUNCH_CARD_MAX_COMMITS ? 'charts.weekdays.scopeCapped' : 'charts.weekdays.scope', { count: total, n: formatters.formatNumber(total, locale) })}${total < WEEKDAYS_MIN_SAMPLE ? ` ${t('charts.weekdays.smallSample')}` : ''}`,
  };
}

/** AI in the Process, repository level: counts and tool ids only (report.aiProcess has nothing per person). */
function aiSection(ai, t, locale) {
  if (!ai?.available) {
    return { unavailable: ai?.reason === 'snapshot' || !ai ? t('aiProcess.notRecorded') : t('aiProcess.unavailable.error') };
  }
  const { tools, config, commits, prs, safeguards, coherence, badge } = ai;
  const num = (v) => formatters.formatNumber(v, locale);
  const noToken = aiProcessNoToken(ai);
  const lines = {
    notes: [noToken && t('aiProcess.unavailable.noToken'), (!commits.available || !prs.available) && t('aiProcess.unavailable.error')].filter(Boolean),
    tools: tools.length > 0
      ? tools.map((tool) => `${toolLabel(tool.id, t)}: ${[...tool.sources.map((src) => t(`aiProcess.sources.${src}`)), tool.fromTemplate && t('aiProcess.sources.template')].filter(Boolean).join(', ')}`)
      : [config.hiddenLocal?.length > 0 ? t('aiProcess.hiddenOnly') : `${t('aiProcess.noTraces')} ${t('aiProcess.noTracesDetail')}`],
    depth: depthLines(tools, config, t),
    stats: [
      { label: t('aiProcess.commitsLabel'), value: !commits.available ? t('aiProcess.notAvailable') : commits.n === 0 ? t('aiProcess.emptySample') : `${t('aiProcess.commits', { withAi: num(commits.withAi), n: num(commits.n) })} (${commits.percentage}%)` },
      { label: t('aiProcess.prsLabel'), value: !prs.available ? t('aiProcess.notAvailable') : prs.n === 0 ? t('aiProcess.emptySample') : `${t('aiProcess.prs', { byAgents: num(prs.byAgents), n: num(prs.n) })} (${prs.percentage}%)` },
      { label: t('aiProcess.aiReviewedLabel'), value: !prs.available || !prs.aiReviewed?.available ? t('aiProcess.notAvailable') : prs.n === 0 ? t('aiProcess.emptySample') : `${t('aiProcess.aiReviewed', { reviewed: num(prs.aiReviewed.count), n: num(prs.n) })} (${prs.aiReviewed.percentage}%)` },
    ],
    safeguards: safeguardLines(safeguards, noToken, num, t),
    coherence: coherence.flags.length > 0
      ? { title: t('aiProcess.coherence.title'), intro: t('aiProcess.coherence.intro'), flags: coherence.flags.map((f) => t(`aiProcess.coherence.${f}`)) }
      : null,
    badge: !badge.applicable
      ? { summary: t('aiProcess.badge.notApplicable'), criteria: [] }
      : { summary: badge.total === 0 ? t('aiProcess.badge.noCriteria') : badgeScoreText(badge, t), criteria: badge.criteria.map((c) => `${t(`aiProcess.badge.criteria.${c.id}`)}: ${t(`report.repo.criterion.${c.state}`)}`) },
    lowerBound: t('aiProcess.lowerBoundNote'),
  };
  return lines;
}

const aiProcessNoToken = (ai) => ai.withToken === false;

function depthLines(tools, config, t) {
  const configured = tools.filter((tool) => tool.configKind);
  const lines = configured.map((tool) => `${toolLabel(tool.id, t)}: ${t(`aiProcess.depth.${tool.configKind}`)}${tool.fromTemplate ? ` (${t('aiProcess.sources.template')})` : ''}`);
  if (configured.length === 0) {
    if (config.status === 'complete') lines.push(t('aiProcess.depth.none'));
    else if (config.status === 'partial') lines.push(t('aiProcess.depth.nonePartial'));
  }
  if (config.status === 'truncated') lines.push(t('aiProcess.depth.treeTruncated'));
  if (config.status === 'unavailable') lines.push(t('aiProcess.depth.treeUnavailable'));
  if (config.status === 'incomplete') lines.push(t('aiProcess.depth.listingIncomplete'));
  if (config.hiddenLocal?.length > 0) lines.push(t('aiProcess.depth.hiddenLocal', { paths: config.hiddenLocal.join(', ') }));
  return lines;
}

function safeguardLines(safeguards, noToken, num, t) {
  if (!safeguards.available) return [`${t('aiProcess.notAvailable')} — ${t(noToken ? 'aiProcess.needsToken' : 'aiProcess.fetchFailed')}`];
  if (!safeguards.agentPrs) return [t('aiProcess.safeguards.noAgentPrs')];
  const { size } = safeguards;
  return [
    t('aiProcess.safeguards.agentUnapproved', { unapproved: num(safeguards.agentUnapproved), agentPrs: num(safeguards.agentPrs) }),
    size.available
      ? t('aiProcess.safeguards.size', { agent: num(size.agentMedian), agentN: num(size.agentN), human: num(size.humanMedian), humanN: num(size.humanN) })
      : t('aiProcess.safeguards.sizeUnavailable', { min: AI_MIN_GROUP, agentN: num(size.agentN), humanN: num(size.humanN) }),
  ];
}
