import { MERGED_PR_SAMPLE, AI_MIN_GROUP } from '../constants.js';
import { percentile } from './prReviewStats.js';
import {
  parseCoauthors, toolsFromCoauthors, agentToolOf, reviewerToolOf, isMaintenanceBot, authorAgentTool,
  detectConfig, gitignoreHidesAi, coauthorDisabled,
} from './aiTraces.js';
import { REGISTRY_VERSION, CONTEXT_DIRS } from './aiRegistry.js';
import { isBot } from './contributors.js';

const pct = (part, total) => Math.round((part / total) * 100);

/**
 * Config status whose "nothing found" is a verified result: 'complete' (whole tree, Dashboard) or
 * 'partial' (Classroom: the known locations were all listed; "none in the checked locations", spec §11).
 */
export const configChecked = (status) => status === 'complete' || status === 'partial';
const unique = (xs) => [...new Set(xs)];

/**
 * @typedef {{ message: string, authorLogin: string|null, authorName: string, authorEmail: string|null,
 *   authorType: 'Bot'|'User'|null, date: string|null, parents: number }} AiCommit
 */

/** GET /repos/{o}/{r}/commits item → AiCommit. */
export function fromRestCommit(c) {
  return {
    message: c.commit.message,
    authorLogin: c.author?.login ?? null,
    authorType: c.author?.type ?? null,
    authorName: c.commit.author.name,
    authorEmail: c.commit.author.email ?? null,
    date: c.commit.author.date ?? null,
    parents: c.parents?.length ?? 1,
  };
}

/** GraphQL history node → AiCommit (email and committedDate may be absent in older queries). */
export function fromGraphqlCommit(node) {
  return {
    message: node.message,
    authorLogin: node.author?.user?.login ?? null,
    authorType: null,
    authorName: node.author?.name,
    authorEmail: node.author?.email ?? null,
    date: node.committedDate ?? null,
    parents: node.parents.totalCount,
  };
}

/** Tool ids with a trace in this commit: co-author trailers plus an agent as the author. */
export function commitAiTools(c) {
  const fromTrailers = toolsFromCoauthors(parseCoauthors(c.message));
  const agent = authorAgentTool({ login: c.authorLogin, type: c.authorType, name: c.authorName, email: c.authorEmail });
  return unique(agent ? [...fromTrailers, agent] : fromTrailers);
}

/** Share of commits (no merges, no maintenance bots) with an AI trace. */
export function analyzeAiCommits(commits) {
  if (!Array.isArray(commits)) return { available: false, reason: 'error', n: 0, withAi: 0, percentage: null, firstTraceAt: null, tools: [] };
  const base = commits.filter((c) => c.parents <= 1
    && !isMaintenanceBot({ login: c.authorLogin, type: c.authorType, name: c.authorName, email: c.authorEmail }));
  const traced = base.map((c) => ({ c, tools: commitAiTools(c) })).filter((x) => x.tools.length > 0);
  const dates = traced.map((x) => x.c.date).filter((d) => d && Number.isFinite(Date.parse(d)));
  const firstTraceAt = dates.length ? dates.reduce((a, b) => (Date.parse(b) < Date.parse(a) ? b : a)) : null;
  return {
    available: true,
    n: base.length,
    withAi: traced.length,
    percentage: base.length ? pct(traced.length, base.length) : null,
    firstTraceAt,
    tools: unique(traced.flatMap((x) => x.tools)).sort(),
  };
}

// Latest merged PRs not authored by a maintenance bot; agents stay in.
function aiSample(prs, limit) {
  return prs
    .filter((p) => p.merged_at && !isMaintenanceBot({ login: p.user?.login, type: p.user?.type }))
    .sort((a, b) => Date.parse(b.merged_at) - Date.parse(a.merged_at))
    .slice(0, limit);
}

// Only a bot account opens an agent PR: a person whose login is "copilot" or "claude" is not one.
const agentToolOfPr = (p) => (isBot(p.user) ? agentToolOf(p.user.login) : null);

/** The merged sample split once into agent and human PRs (null = PR fetch failed). */
function splitSample(prs, limit) {
  if (!Array.isArray(prs)) return null;
  const sample = aiSample(prs, limit).map((p) => ({ p, agent: agentToolOfPr(p) }));
  return {
    sample: sample.map((x) => x.p),
    agents: sample.filter((x) => x.agent).map((x) => x.p),
    humans: sample.filter((x) => !x.agent).map((x) => x.p),
    agentTools: unique(sample.map((x) => x.agent).filter(Boolean)).sort(),
  };
}

function aiPrStats(split, reviewsAvailable) {
  const noReviews = { available: false, count: null, percentage: null, tools: [] };
  if (!split) return { available: false, reason: 'error', n: 0, byAgents: 0, percentage: null, agentTools: [], aiReviewed: noReviews };
  const { sample, agents, agentTools } = split;
  const n = sample.length;
  let aiReviewed = noReviews;
  if (reviewsAvailable) {
    const reviewerTools = sample.map((p) => unique((p.aiParticipants ?? []).map(reviewerToolOf).filter(Boolean)));
    const count = reviewerTools.filter((t) => t.length > 0).length;
    aiReviewed = { available: true, count, percentage: n ? pct(count, n) : null, tools: unique(reviewerTools.flat()).sort() };
  }
  return {
    available: true,
    n,
    byAgents: agents.length,
    percentage: n ? pct(agents.length, n) : null,
    agentTools,
    aiReviewed,
  };
}

/** PRs opened by agents and PRs with an AI reviewer, over the merged sample. */
export function analyzeAiPrs(prs, { limit = MERGED_PR_SAMPLE, reviewsAvailable } = {}) {
  return aiPrStats(splitSample(prs, limit), reviewsAvailable);
}

const medianOf = (values) => percentile([...values].sort((a, b) => a - b), 0.5);

function safeguardStats(split, reviewsAvailable) {
  const emptySize = { available: false, agentMedian: null, humanMedian: null, agentN: 0, humanN: 0 };
  const off = (reason) => ({ available: false, reason, agentPrs: 0, agentUnapproved: null, size: emptySize });
  if (!reviewsAvailable) return off('noToken');
  if (!split) return off('error');
  const { agents, humans } = split;
  const lines = (group) => group.map((p) => p.changedLines).filter((x) => x != null);
  const agentLines = lines(agents);
  const humanLines = lines(humans);
  const comparable = agentLines.length >= AI_MIN_GROUP && humanLines.length >= AI_MIN_GROUP;
  return {
    available: true,
    agentPrs: agents.length,
    agentUnapproved: agents.length ? agents.filter((p) => !p.approvedByOther).length : null,
    size: {
      available: comparable,
      agentMedian: comparable ? Math.round(medianOf(agentLines)) : null,
      humanMedian: comparable ? Math.round(medianOf(humanLines)) : null,
      agentN: agentLines.length,
      humanN: humanLines.length,
    },
  };
}

/**
 * Agent PRs merged without approval, and agent vs human PR size (needs AI_MIN_GROUP per side).
 * `reviewsAvailable` must be true only for the GraphQL sample (REST items have no approvedByOther).
 */
export function analyzeAiSafeguards(prs, { limit = MERGED_PR_SAMPLE, reviewsAvailable } = {}) {
  return safeguardStats(splitSample(prs, limit), reviewsAvailable);
}

export const AI_PROCESS_METHOD = 'ai-traces-v1';

/**
 * @typedef {{ gitignore: string|null, claudeSettings: string|null, templatePaths: Set<string>|null,
 *   unverified?: Array<'gitignore'|'claudeSettings'|'listings'>, originChecked?: Set<string>, available: boolean }} AiRepoContext
 * templatePaths: null = template not verified (no context); empty Set = no template, or no AI files in it.
 * originChecked (Classroom only): paths whose origin was verified by their history; others outside the template are unverified.
 */

const listedPaths = (node) => {
  const out = [];
  CONTEXT_DIRS.forEach((dir, i) => {
    for (const entry of node?.[`d${i}`]?.entries ?? []) out.push(dir ? `${dir}/${entry.name}` : entry.name);
  });
  return out;
};

const CONTEXT_PARTS = ['gitignore', 'claudeSettings', 'listings'];

/**
 * Parts of the context that a partial GraphQL error left unread: 'gitignore', 'claudeSettings',
 * 'listings' (a directory alias d<i>) and 'template' (anything under templateRepository).
 * An error that can't be placed makes every part unverified (fail closed).
 */
function unreadParts(errors) {
  const out = new Set();
  for (const e of errors ?? []) {
    const [root, field] = Array.isArray(e?.path) ? e.path : [];
    if (root === 'repository' && (field === 'gitignore' || field === 'claudeSettings')) out.add(field);
    else if (root === 'repository' && field === 'templateRepository') out.add('template');
    else if (root === 'repository' && /^d\d+$/.test(field ?? '')) out.add('listings');
    else [...CONTEXT_PARTS, 'template'].forEach((part) => out.add(part));
  }
  return out;
}

/**
 * Turns the raw `fetchAiRepoContext` response ({ repository, errors }) into an AiRepoContext plus
 * `contextPaths` (every path listed in the repository itself, for Classroom, which has no tree).
 * gitignore/claudeSettings are null when the file does not exist; a part with a partial error is
 * listed in `unverified` instead (and a template error leaves templatePaths null).
 * allowPrivateTemplate (Classroom only): read a private template's listings; elsewhere its origin is unverified.
 * templateRepository null counts as "no template": GitHub can't tell that from a template the
 * user can't see, but "origin ?" on every repository would be noise (Classroom falls back to
 * the github-classroom[bot] initial commit).
 */
export function parseAiRepoContext(data, { allowPrivateTemplate = false } = {}) {
  const repo = data?.repository;
  const template = repo?.templateRepository ?? null;
  const unread = unreadParts(data?.errors);
  let templatePaths = new Set();
  // The Dashboard never reads a private repository, the template included (visibility unknown = private).
  // Classroom may: it already analyzes private repositories in memory (AGENTS.md decision, v3.14.0).
  if (unread.has('template') || (template && template.isPrivate !== false && !allowPrivateTemplate)) templatePaths = null;
  else if (template) templatePaths = new Set(detectConfig(listedPaths(template)).map((e) => e.path));
  return {
    gitignore: repo?.gitignore?.text ?? null,
    claudeSettings: repo?.claudeSettings?.text ?? null,
    templatePaths,
    contextPaths: listedPaths(repo),
    unverified: CONTEXT_PARTS.filter((part) => unread.has(part)),
    available: true,
  };
}

/**
 * Template origin of one config path: true/false, or null when not verified. `originChecked` (Classroom)
 * lists the paths whose own history was read; without it (Dashboard) the template listing decides alone.
 */
function originOf(path, templatePaths, originChecked) {
  if (!templatePaths) return null;
  if (templatePaths.has(path)) return true;
  return originChecked && !originChecked.has(path) ? null : false;
}

/** Versioned AI config in the tree, with template origin, AI paths hidden by .gitignore and the co-author switch. */
export function analyzeAiConfig(paths, treeStatus, ctx) {
  const context = ctx?.available ? ctx : null;
  const templatePaths = context?.templatePaths ?? null;
  const originChecked = context?.originChecked ?? null;
  // With an available context, a missing file was verified: nothing hidden, trailer not turned off.
  // A file whose read failed (partial GraphQL error) stays not verified.
  const read = (part) => Boolean(context) && !context.unverified?.includes(part);
  return {
    status: Array.isArray(paths) ? treeStatus : 'unavailable',
    entries: detectConfig(paths).map((e) => ({ ...e, fromTemplate: originOf(e.path, templatePaths, originChecked) })),
    hiddenLocal: gitignoreHidesAi(read('gitignore') ? (context.gitignore ?? '') : null),
    coauthorDisabled: read('claudeSettings') ? (context.claudeSettings == null ? false : coauthorDisabled(context.claudeSettings)) : null,
  };
}

// Template files are listed, but never count as a trace of the repository's own use.
const ownEntries = (config) => config.entries.filter((e) => e.fromTemplate !== true);
const declares = (commits, prs) => commits.withAi > 0 || prs.byAgents > 0;

/**
 * Repository-level cross-check between sources (spec §5.6). Flags are neutral: "the sources do not agree",
 * always shown with the legitimate causes. Rules only fire when commits were measured; unmeasured PRs
 * count as no agent PR (agent work usually also leaves agent-authored commits) and are listed in unverified.
 * @returns {{ flags: Array<'configWithoutDeclaration'|'hiddenWithoutDeclaration'>,
 *   unverified: Array<'config'|'template'|'gitignore'|'commits'|'prs'>, toolMismatch: boolean, coauthorDisabled: boolean }}
 */
export function analyzeCoherence(config, commits, prs) {
  const own = ownEntries(config);
  // An empty sample (n = 0) can't show a declaration: no rule fires on it.
  const measured = commits.available && commits.n > 0;
  const declared = declares(commits, prs);
  const unverified = [];
  if (!configChecked(config.status)) unverified.push('config');
  if (own.some((e) => e.fromTemplate === null)) unverified.push('template');
  if (config.hiddenLocal === null) unverified.push('gitignore');
  if (!measured) unverified.push('commits');
  if (!prs.available) unverified.push('prs');

  const flags = [];
  if (measured && !declared) {
    if (own.length > 0) flags.push('configWithoutDeclaration');
    if (config.hiddenLocal?.length > 0) flags.push('hiddenWithoutDeclaration');
  }

  // 'generic' (AGENTS.md, .mcp.json) belongs to no tool in particular, so it never mismatches.
  const configTools = unique(own.map((e) => e.toolId).filter((id) => id !== 'generic'));
  const declaredTools = unique([...(commits.tools ?? []), ...(prs.agentTools ?? [])]);
  const toolMismatch = configTools.length > 0 && declaredTools.length > 0 && !configTools.some((t) => declaredTools.includes(t));

  return { flags, unverified, toolMismatch, coauthorDisabled: config.coauthorDisabled === true };
}

// onlyReviews: an AI reviewer is the only trace. It is an external app: the repository needs no
// config for it and its commits have nothing to declare, so those two criteria don't apply.
function configState(config, onlyReviews) {
  if (ownEntries(config).length > 0) return 'met';
  if (!configChecked(config.status)) return 'unverified';
  return onlyReviews ? 'na' : 'unmet';
}

// An empty sample can't show a declaration either way (same rule as analyzeCoherence).
function declaredState(commits, onlyReviews) {
  if (!commits.available || commits.n === 0) return 'unverified';
  if (commits.withAi > 0) return 'met';
  return onlyReviews ? 'na' : 'unmet';
}

// No flag is "met" only when the rules could have fired: when declared, they never can.
function coherentState(coherence, declared) {
  if (coherence.flags.length > 0) return 'unmet';
  if (declared) return 'met';
  const blind = coherence.unverified.some((u) => u === 'commits' || u === 'config' || u === 'gitignore');
  return blind ? 'unverified' : 'met';
}

function agentReviewedState(prs, safeguards) {
  if (safeguards?.available) {
    if (!safeguards.agentPrs) return 'na';
    return safeguards.agentUnapproved === 0 ? 'met' : 'unmet';
  }
  if (prs.available && prs.byAgents === 0) return 'na';
  return 'unverified';
}

function testsCiState(maturity) {
  if (!maturity || maturity.testsDetected == null || maturity.ciCdDetected == null) return 'unverified';
  return maturity.testsDetected && maturity.ciCdDetected ? 'met' : 'unmet';
}

/**
 * "Responsible AI use" badge (spec §5.7): observable practices and coherence between traces, never real use.
 * Applies only with some AI trace; 'na' and 'unverified' criteria stay out of the denominator.
 */
export function analyzeResponsibleBadge({ config, commits, prs, safeguards, coherence, maturity }) {
  const otherTraces = ownEntries(config).length > 0
    || config.hiddenLocal?.length > 0
    || commits.withAi > 0
    || prs.byAgents > 0;
  const onlyReviews = !otherTraces && prs.aiReviewed?.count > 0;
  const applicable = otherTraces || onlyReviews;
  const criteria = [
    { id: 'config', state: configState(config, onlyReviews) },
    { id: 'declared', state: declaredState(commits, onlyReviews) },
    { id: 'coherent', state: coherentState(coherence, declares(commits, prs)) },
    { id: 'agentReviewed', state: agentReviewedState(prs, safeguards) },
    { id: 'testsCi', state: testsCiState(maturity) },
  ];
  return {
    applicable,
    criteria,
    met: criteria.filter((c) => c.state === 'met').length,
    total: criteria.filter((c) => c.state === 'met' || c.state === 'unmet').length,
  };
}

const SOURCE_ORDER = ['config', 'commit', 'pr', 'review'];
const configKindOf = (entries) => {
  if (entries.length === 0) return null;
  return entries.some((e) => e.kind === 'extensions') ? 'extensions' : 'instructions';
};

// One row per tool with the sources that show it. Template-only tools are listed with no 'config' source.
// `fromTemplate` describes only the config origin: true when every config entry of the tool came from the
// template. A tool with a commit, PR or review source is still a real trace of the repository's own use.
function mergeTools(config, commits, prs) {
  const own = ownEntries(config);
  const template = config.entries.filter((e) => e.fromTemplate === true);
  const bySource = {
    config: own.map((e) => e.toolId),
    commit: commits.tools ?? [],
    pr: prs.agentTools ?? [],
    review: prs.aiReviewed?.tools ?? [],
  };
  const ids = unique([...Object.values(bySource).flat(), ...template.map((e) => e.toolId)]).sort();
  return ids.map((id) => {
    const mine = own.filter((e) => e.toolId === id);
    const fromTemplate = mine.length === 0 && template.some((e) => e.toolId === id);
    return {
      id,
      sources: SOURCE_ORDER.filter((src) => bySource[src].includes(id)),
      configKind: configKindOf(fromTemplate ? template.filter((e) => e.toolId === id) : mine),
      fromTemplate,
    };
  });
}

/**
 * report.aiProcess. Carries no person login or name (spec §3 anti-goals): analyzers only return counts and tool ids.
 * commits: AiCommit[]|null, prs: merged PR stats|null (null = fetch failed).
 */
export function buildAiProcess({ treePaths, treeStatus, ctx, commits, prs, reviewsAvailable, maturity, prLimit }) {
  const split = splitSample(prs, prLimit ?? MERGED_PR_SAMPLE);
  const config = analyzeAiConfig(treePaths, treeStatus, ctx);
  const commitStats = analyzeAiCommits(commits);
  const prStats = aiPrStats(split, reviewsAvailable);
  const safeguards = safeguardStats(split, reviewsAvailable);
  const coherence = analyzeCoherence(config, commitStats, prStats);
  const badge = analyzeResponsibleBadge({ config, commits: commitStats, prs: prStats, safeguards, coherence, maturity });
  return {
    available: true,
    method: AI_PROCESS_METHOD,
    registryVersion: REGISTRY_VERSION,
    tools: mergeTools(config, commitStats, prStats),
    config,
    commits: commitStats,
    prs: prStats,
    safeguards,
    coherence,
    badge,
  };
}

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

// Persisted data may be edited outside the app: the UI reads these fields without guards.
function hasCurrentShape(ai) {
  return isObject(ai)
    && ai.method === AI_PROCESS_METHOD
    && ['config', 'commits', 'prs', 'safeguards', 'coherence', 'badge'].every((k) => isObject(ai[k]))
    && Array.isArray(ai.tools)
    && ai.tools.every((tool) => isObject(tool) && Array.isArray(tool.sources))
    && Array.isArray(ai.config.entries)
    && (ai.config.hiddenLocal === null || Array.isArray(ai.config.hiddenLocal))
    && isObject(ai.prs.aiReviewed)
    && isObject(ai.safeguards.size)
    && Array.isArray(ai.coherence.unverified)
    && Array.isArray(ai.coherence.flags)
    && Array.isArray(ai.badge.criteria);
}

/** Snapshots without the current method (or with a malformed aiProcess) → "not recorded in this snapshot". */
export function normalizeSnapshotAiProcess(report) {
  if (!report || typeof report !== 'object') return report;
  if (hasCurrentShape(report.aiProcess)) return report;
  return { ...report, aiProcess: { available: false, reason: 'snapshot' } };
}
