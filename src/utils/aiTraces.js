import { isBot } from './contributors.js';
import { AI_TOOLS, GITIGNORE_AI_PATTERNS } from './aiRegistry.js';

// REST returns bot logins as "name[bot]", GraphQL as "name": compare without the suffix.
export function normalizeLogin(login) {
  if (!login) return null;
  return login.replace(/\[bot\]$/i, '').toLowerCase();
}

const COAUTHOR_PREFIX = 'co-authored-by:';
const TRAILER_WINDOW = 4096; // trailers close the message; the rest is never scanned

// "Co-authored-by: Name <email>" → { name, email }, or null. Plain string scanning, no regex:
// commit messages are attacker-controlled and a backtracking regex froze the page (ReDoS).
function parseCoauthorLine(raw) {
  const line = raw.trim();
  if (line.slice(0, COAUTHOR_PREFIX.length).toLowerCase() !== COAUTHOR_PREFIX) return null;
  const rest = line.slice(COAUTHOR_PREFIX.length);
  const open = rest.lastIndexOf('<');
  const close = open < 0 ? -1 : rest.indexOf('>', open);
  if (close < 0 || close !== rest.length - 1) return null; // nothing may follow the e-mail
  const name = rest.slice(0, open).trim();
  const email = rest.slice(open + 1, close);
  return name && email ? { name, email } : null;
}

/** Co-author trailers of a commit message, read from its last TRAILER_WINDOW characters. */
export function parseCoauthors(message) {
  let text = message ?? '';
  if (text.length > TRAILER_WINDOW) {
    text = text.slice(-TRAILER_WINDOW);
    text = text.slice(text.indexOf('\n') + 1); // drop the line cut in half
  }
  return text.split('\n').map(parseCoauthorLine).filter(Boolean);
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

// A login names an agent only on a bot account (REST type 'Bot' or the "[bot]" suffix): a person's
// account called "claude" or "copilot" is not an agent. A REST author of type 'User' is a person.
// GraphQL commit authors have no type and their `user` is always a person: there only a [bot] git
// name or the e-mail identify an agent.
export function authorAgentTool(author) {
  const { login, type, name } = author;
  if (login && type === 'User') return null;
  let identity = null;
  if (login && isBot({ login, type })) identity = login;
  else if (/\[bot\]$/i.test(name ?? '')) identity = name;
  return agentToolOf(identity, author.email ?? null);
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

const GITIGNORE_LINE_MAX = 200;
const GITIGNORE_LINES_MAX = 20;

// null = not verified (no file/token), [] = checked and nothing hidden. The lines go on screen and into
// the snapshot, so a crafted .gitignore is capped (characters per line and number of lines).
export function gitignoreHidesAi(text) {
  if (text == null) return null;
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('!') && GITIGNORE_AI_PATTERNS.some((re) => re.test(l)))
    .slice(0, GITIGNORE_LINES_MAX)
    .map((l) => l.slice(0, GITIGNORE_LINE_MAX));
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
