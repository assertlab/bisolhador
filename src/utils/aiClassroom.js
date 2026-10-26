import { AI_TOOLS, CLASSROOM_BOT } from './aiRegistry.js';
import { normalizeLogin, authorAgentTool, isMaintenanceBot, detectConfig } from './aiTraces.js';
import { commitAiTools } from './aiProcess.js';

// Classroom Mode only: "AI in the Process › Per student". Everything here stays in the
// browser's memory — never in the CSV, Supabase or GA (spec §3 anti-goals, §7.3).

export const AUTHORSHIP_MAX_PATHS = 10; // same cap as githubService.fetchAiConfigAuthorship

const TOOL_ORDER = new Map(AI_TOOLS.map((tool, i) => [tool.id, i]));

/**
 * Paths created by GitHub Classroom: the oldest commit of a complete per-path history
 * (the last element, newest first) is github-classroom[bot]. Without a login, the git name decides.
 */
export function templateFromAuthorship(authorship) {
  const out = new Set();
  for (const entry of Array.isArray(authorship) ? authorship : []) {
    const oldest = entry.complete ? entry.commits?.[entry.commits.length - 1] : null;
    if (!oldest) continue;
    const who = oldest.login ? normalizeLogin(oldest.login) : normalizeLogin(oldest.name);
    if (who === CLASSROOM_BOT) out.add(entry.path);
  }
  return out;
}

const depthOf = (path) => path.split('/').length;

/**
 * AI-config paths worth an authorship query: not from the template, top-level first (AGENTS.md,
 * CLAUDE.md, .claude… before files deep in a rules directory), then registry order, capped.
 * Paths left out keep an unverified origin (classroomAiContext).
 */
export function authorshipPaths(ctx) {
  if (!ctx) return [];
  return detectConfig(ctx.contextPaths)
    .filter((e) => !ctx.templatePaths?.has(e.path))
    .sort((a, b) => depthOf(a.path) - depthOf(b.path) || TOOL_ORDER.get(a.toolId) - TOOL_ORDER.get(b.toolId))
    .slice(0, AUTHORSHIP_MAX_PATHS)
    .map((e) => e.path);
}

/**
 * Context for buildAiProcess in Classroom: template = the template repository's AI files plus the
 * files GitHub Classroom committed. null = context query failed. When the authorship query failed and
 * no template file is known, the origin stays "not verified" (null): Classroom repositories often have
 * no visible templateRepository, and the github-classroom fallback is what was missing.
 * originChecked: paths whose complete history was read. Any other path outside the template (beyond the
 * query cap, incomplete history, failed query) keeps an unverified origin instead of "own configuration".
 */
export function classroomAiContext(ctx, authorship) {
  if (!ctx) return null;
  const known = ctx.templatePaths ?? new Set();
  if (authorship == null && known.size === 0) return { ...ctx, templatePaths: null };
  const checked = (Array.isArray(authorship) ? authorship : []).filter((e) => e.complete).map((e) => e.path);
  return { ...ctx, templatePaths: new Set([...known, ...templateFromAuthorship(authorship)]), originChecked: new Set(checked) };
}

const inPeriod = (date, since, until) => {
  const at = Date.parse(date);
  return Number.isFinite(at) && at >= since && at <= until;
};

// Who an authorship commit is: an agent tool, or a normalized login (null = not linked to an account).
const authorKey = (a) => {
  const agent = authorAgentTool({ login: a.login, name: a.name, email: a.email });
  if (agent) return `agent:${agent}`;
  const login = normalizeLogin(a.login);
  return login ? `person:${login}` : null;
};

const KIND_ORDER = { person: 0, agent: 1, unidentified: 2 };

/**
 * One row per commit author of the period (sample): people by login, one row per agent, and a single
 * "unidentified" row for commits not linked to an account (never grouped by git name). Merges and
 * maintenance bots are out, as in the repository's AI commit share, so the rows add up to that base.
 * configPaths: AI-config paths (template excluded) with a commit in the period by that author.
 * @param {import('./aiProcess.js').AiCommit[]|null} commits
 * @param {Array<{path: string, commits: Array<{login, name, email, date}>, complete: boolean}>|null} authorship
 * @param {{since: string, until: string}} period
 * @param {Set<string>|null} templatePaths
 */
export function analyzeStudents(commits, authorship, period, templatePaths) {
  const authorshipAvailable = Array.isArray(authorship);
  if (!Array.isArray(commits)) return { available: false, rows: [], authorshipAvailable };

  const rows = new Map();
  for (const c of commits) {
    if (c.parents > 1) continue;
    const author = { login: c.authorLogin, type: c.authorType, name: c.authorName, email: c.authorEmail };
    if (isMaintenanceBot(author)) continue;
    const agent = authorAgentTool(author);
    const login = normalizeLogin(c.authorLogin);
    let key;
    let base;
    if (agent) {
      key = `agent:${agent}`;
      base = { kind: 'agent', login: null, agentToolId: agent };
    } else if (login) {
      key = `person:${login}`;
      base = { kind: 'person', login: c.authorLogin, agentToolId: null };
    } else {
      key = 'unidentified';
      base = { kind: 'unidentified', login: null, agentToolId: null };
    }
    const row = rows.get(key) ?? { key, ...base, commits: 0, withAi: 0, tools: new Set() };
    const tools = commitAiTools(c);
    row.commits += 1;
    if (tools.length > 0) row.withAi += 1;
    tools.forEach((id) => row.tools.add(id));
    rows.set(key, row);
  }

  const since = Date.parse(period.since);
  const until = Date.parse(period.until);
  const pathsByKey = new Map();
  for (const entry of authorshipAvailable ? authorship : []) {
    if (templatePaths?.has(entry.path)) continue;
    for (const a of entry.commits ?? []) {
      const key = authorKey(a);
      if (!key || !inPeriod(a.date, since, until)) continue;
      const paths = pathsByKey.get(key) ?? new Set();
      paths.add(entry.path);
      pathsByKey.set(key, paths);
    }
  }

  return {
    available: true,
    authorshipAvailable,
    rows: [...rows.values()]
      .map((r) => ({
        ...r,
        percentage: Math.round((r.withAi / r.commits) * 100),
        tools: [...r.tools].sort(),
        configPaths: r.kind === 'unidentified' ? [] : [...(pathsByKey.get(r.key) ?? [])].sort(),
      }))
      .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || b.commits - a.commits || a.key.localeCompare(b.key)),
  };
}
