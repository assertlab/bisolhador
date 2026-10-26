import { MERGED_PR_SAMPLE, AI_MIN_GROUP } from '../constants.js';
import { percentile } from './prReviewStats.js';
import {
  parseCoauthors, toolsFromCoauthors, agentToolOf, reviewerToolOf, isMaintenanceBot, authorAgentTool,
  detectConfig, gitignoreHidesAi, coauthorDisabled,
} from './aiTraces.js';
import { REGISTRY_VERSION, CONTEXT_DIRS } from './aiRegistry.js';

const pct = (part, total) => Math.round((part / total) * 100);
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
  const agent = authorAgentTool({ login: c.authorLogin, name: c.authorName, email: c.authorEmail });
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

const agentToolOfPr = (p) => agentToolOf(p.user?.login);

/** PRs opened by agents and PRs with an AI reviewer, over the merged sample. */
export function analyzeAiPrs(prs, { limit = MERGED_PR_SAMPLE, reviewsAvailable } = {}) {
  const noReviews = { available: false, count: null, percentage: null, tools: [] };
  if (!Array.isArray(prs)) return { available: false, reason: 'error', n: 0, byAgents: 0, percentage: null, agentTools: [], aiReviewed: noReviews };
  const sample = aiSample(prs, limit);
  const n = sample.length;
  const agentPrs = sample.filter((p) => agentToolOfPr(p));
  let aiReviewed = noReviews;
  if (reviewsAvailable) {
    const reviewerTools = sample.map((p) => unique((p.aiParticipants ?? []).map(reviewerToolOf).filter(Boolean)));
    const count = reviewerTools.filter((t) => t.length > 0).length;
    aiReviewed = { available: true, count, percentage: n ? pct(count, n) : null, tools: unique(reviewerTools.flat()).sort() };
  }
  return {
    available: true,
    n,
    byAgents: agentPrs.length,
    percentage: n ? pct(agentPrs.length, n) : null,
    agentTools: unique(agentPrs.map(agentToolOfPr)).sort(),
    aiReviewed,
  };
}

const medianOf = (values) => percentile([...values].sort((a, b) => a - b), 0.5);

/**
 * Agent PRs merged without approval, and agent vs human PR size (needs AI_MIN_GROUP per side).
 * `reviewsAvailable` must be true only for the GraphQL sample (REST items have no approvedByOther).
 */
export function analyzeAiSafeguards(prs, { limit = MERGED_PR_SAMPLE, reviewsAvailable } = {}) {
  const emptySize = { available: false, agentMedian: null, humanMedian: null, agentN: 0, humanN: 0 };
  const off = (reason) => ({ available: false, reason, agentPrs: 0, agentUnapproved: null, size: emptySize });
  if (!reviewsAvailable) return off('noToken');
  if (!Array.isArray(prs)) return off('error');
  const sample = aiSample(prs, limit);
  const agents = sample.filter(agentToolOfPr);
  const humans = sample.filter((p) => !agentToolOfPr(p));
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

export const AI_PROCESS_METHOD = 'ai-traces-v1';

/**
 * @typedef {{ gitignore: string|null, claudeSettings: string|null, templatePaths: Set<string>|null, available: boolean }} AiRepoContext
 * templatePaths: null = template not verified; empty Set = verified, no template or no AI files in it.
 */

const listedPaths = (node) => {
  const out = [];
  CONTEXT_DIRS.forEach((dir, i) => {
    for (const entry of node?.[`d${i}`]?.entries ?? []) out.push(dir ? `${dir}/${entry.name}` : entry.name);
  });
  return out;
};

/**
 * Turns the raw `fetchAiRepoContext` response into an AiRepoContext plus `contextPaths`
 * (every path listed in the repository itself, for Classroom, which has no tree).
 * gitignore/claudeSettings are null only when the file does not exist.
 */
export function parseAiRepoContext(data) {
  const repo = data?.repository;
  const template = repo?.templateRepository ?? null;
  return {
    gitignore: repo?.gitignore?.text ?? null,
    claudeSettings: repo?.claudeSettings?.text ?? null,
    templatePaths: template ? new Set(detectConfig(listedPaths(template)).map((e) => e.path)) : null,
    contextPaths: listedPaths(repo),
    available: true,
  };
}

/** Versioned AI config in the tree, with template origin, AI paths hidden by .gitignore and the co-author switch. */
export function analyzeAiConfig(paths, treeStatus, ctx) {
  const context = ctx?.available ? ctx : null;
  const templatePaths = context?.templatePaths ?? null;
  return {
    status: Array.isArray(paths) ? treeStatus : 'unavailable',
    entries: detectConfig(paths).map((e) => ({ ...e, fromTemplate: templatePaths ? templatePaths.has(e.path) : null })),
    // With an available context, a missing file was verified: nothing hidden, trailer not turned off.
    hiddenLocal: gitignoreHidesAi(context ? (context.gitignore ?? '') : null),
    coauthorDisabled: context ? (context.claudeSettings == null ? false : coauthorDisabled(context.claudeSettings)) : null,
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
  const measured = commits.available;
  const declared = declares(commits, prs);
  const unverified = [];
  if (config.status !== 'complete') unverified.push('config');
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

function configState(config) {
  if (ownEntries(config).length > 0) return 'met';
  return config.status === 'complete' ? 'unmet' : 'unverified';
}

function declaredState(commits) {
  if (!commits.available) return 'unverified';
  return commits.withAi > 0 ? 'met' : 'unmet';
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
  const applicable = ownEntries(config).length > 0
    || config.hiddenLocal?.length > 0
    || commits.withAi > 0
    || prs.byAgents > 0
    || prs.aiReviewed?.count > 0;
  const criteria = [
    { id: 'config', state: configState(config) },
    { id: 'declared', state: declaredState(commits) },
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
  const options = { limit: prLimit ?? MERGED_PR_SAMPLE, reviewsAvailable };
  const config = analyzeAiConfig(treePaths, treeStatus, ctx);
  const commitStats = analyzeAiCommits(commits);
  const prStats = analyzeAiPrs(prs, options);
  const safeguards = analyzeAiSafeguards(prs, options);
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

/** Snapshots without the current method → "not recorded in this snapshot". */
export function normalizeSnapshotAiProcess(report) {
  if (!report || typeof report !== 'object') return report;
  if (report.aiProcess?.method === AI_PROCESS_METHOD) return report;
  return { ...report, aiProcess: { available: false, reason: 'snapshot' } };
}
