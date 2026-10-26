import { isBot } from './contributors.js';
import { AI_TOOLS, GITIGNORE_AI_PATTERNS } from './aiRegistry.js';

// REST returns bot logins as "name[bot]", GraphQL as "name": compare without the suffix.
export function normalizeLogin(login) {
  if (!login) return null;
  return login.replace(/\[bot\]$/i, '').toLowerCase();
}

const COAUTHOR_LINE = /^co-authored-by:\s*(.+?)\s*<([^>]+)>\s*$/gim;

export function parseCoauthors(message) {
  return [...(message ?? '').matchAll(COAUTHOR_LINE)].map((m) => ({ name: m[1], email: m[2] }));
}

// Matches by e-mail (a name alone is forgeable); shared e-mails also require the name.
function toolFromEmail(email, name) {
  return AI_TOOLS.find((t) => t.coauthors.some((c) => c.email.test(email) && (!c.name || (name != null && c.name.test(name)))))?.id ?? null;
}

export function toolsFromCoauthors(coauthors) {
  const ids = (coauthors ?? []).map((c) => toolFromEmail(c.email, c.name)).filter(Boolean);
  return [...new Set(ids)];
}

export function agentToolOf(login, email = null) {
  const l = normalizeLogin(login);
  const byLogin = l ? AI_TOOLS.find((t) => t.agentLogins.includes(l))?.id : null;
  if (byLogin) return byLogin;
  return email ? toolFromEmail(email, null) : null;
}

export function reviewerToolOf(login) {
  const l = normalizeLogin(login);
  return l ? AI_TOOLS.find((t) => t.reviewerLogins.includes(l))?.id ?? null : null;
}

// Same bot rules as analyzeCommitHistory (classroom.js): isBot or a name containing "bot".
const BOT_NAME = /(\[bot\]|\bbot\b)/i;

// GraphQL authors without a GitHub user have no login, only a git name (forgeable) and an e-mail.
// The name counts as identity only in bot form ("claude[bot]"); otherwise login or e-mail decide.
const loginOrBotName = ({ login, name }) => login ?? (/\[bot\]$/i.test(name ?? '') ? name : null);

export function authorAgentTool(author) {
  return agentToolOf(loginOrBotName(author), author.email ?? null);
}

export function authorReviewerTool(author) {
  return reviewerToolOf(loginOrBotName(author));
}

// Dependabot, Renovate, github-actions…: bots that are neither an agent nor an AI reviewer of the registry.
export function isMaintenanceBot(author) {
  if (!author) return false;
  const bot = isBot(author) || BOT_NAME.test(author.name ?? '');
  return bot && !authorAgentTool(author) && !authorReviewerTool(author);
}

// One entry per matching path, in path order; a path matches only the first tool of the registry.
export function detectConfig(paths) {
  const found = [];
  for (const path of paths ?? []) {
    for (const tool of AI_TOOLS) {
      const hit = tool.config.find((c) => c.re.test(path));
      if (hit) {
        found.push({ toolId: tool.id, path, kind: hit.kind });
        break;
      }
    }
  }
  return found;
}

// null = not verified (no file/token), [] = checked and nothing hidden.
export function gitignoreHidesAi(text) {
  if (text == null) return null;
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('!') && GITIGNORE_AI_PATTERNS.some((re) => re.test(l)));
}

// true = trailer turned off; false = on; null = no file or invalid JSON.
// Docs (code.claude.com settings): `attribution: false` or `attribution.commit: ""`; deprecated
// `includeCoAuthoredBy: false` is ignored once `attribution.commit` is set.
export function coauthorDisabled(settingsText) {
  if (settingsText == null) return null;
  let s;
  try {
    s = JSON.parse(settingsText);
  } catch {
    return null;
  }
  if (!s || typeof s !== 'object' || Array.isArray(s)) return null;
  if (s.attribution === false) return true;
  if (s.attribution && typeof s.attribution === 'object' && typeof s.attribution.commit === 'string') {
    return s.attribution.commit === '';
  }
  return s.includeCoAuthoredBy === false;
}
