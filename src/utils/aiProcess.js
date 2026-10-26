import { MERGED_PR_SAMPLE, AI_MIN_GROUP } from '../constants.js';
import { percentile } from './prReviewStats.js';
import { parseCoauthors, toolsFromCoauthors, agentToolOf, reviewerToolOf, isMaintenanceBot, authorAgentTool } from './aiTraces.js';

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
