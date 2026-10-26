// Registry of AI tools: data, not logic (detectors live in aiTraces.js).
// New tool = new entry + test. Spec: docs/superpowers/specs/2026-10-25-ia-no-processo-design.md §4.1.
//
// Verification log (2026-10-26):
// - Co-author emails, PR-author and reviewer logins marked ✓ in spec §4.2: confirmed on 2026-10-25 against real public data.
// - Claude Code co-author switch: official settings docs (code.claude.com/docs/en/settings-reference.md) confirm
//   `attribution` (false, or `attribution.commit === ''`) and the deprecated `includeCoAuthoredBy: false`.
// - Config filenames, search/code `filename:` (total_count > 0): CLAUDE.md, AGENTS.md, copilot-instructions.md,
//   .cursorrules, GEMINI.md, .aider.conf.yml, .windsurfrules, .clinerules, opencode.json, .coderabbit.yaml,
//   .sourcery.yaml, .mcp.json, and .junie/guidelines.md (`path:.junie`).
// - Documented, not search-verified (network): directory conventions .claude/{skills,commands,agents,settings.json},
//   .github/{instructions,prompts}, .cursor/rules, .windsurf/rules, .kiro/steering, .gemini. These are
//   well-established paths of each tool's docs; code search cannot match directories.
// - Greptile as reviewer: confirmed (`reviewed-by:app/greptile-apps` finds PRs; PR reviews show `greptile-apps[bot]`).
// - Cursor as PR author: NOT confirmed (search kept failing with TLS timeouts), so it stays out (agentLogins empty).

export const REGISTRY_VERSION = '2026-10-25';

// GitHub Classroom's bot creates the template-derived initial commit.
export const CLASSROOM_BOT = 'github-classroom';

// Directories listed by fetchAiRepoContext ('' = root).
export const CONTEXT_DIRS = [
  '',
  '.github',
  '.github/instructions',
  '.github/prompts',
  '.cursor',
  '.cursor/rules',
  '.claude',
  '.claude/skills',
  '.claude/commands',
  '.claude/agents',
  '.kiro/steering',
  '.windsurf/rules',
  '.junie',
  '.gemini',
];

// Every regex metacharacter, backslash included (not only '.': CodeQL js/incomplete-sanitization).
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Config patterns match a directory itself and anything under it (Classroom only sees directory listings).
const dir = (path) => new RegExp(`^${escapeRegExp(path)}(/|$)`);
// A file with this name at any depth.
const anyLevel = (name) => new RegExp(`(^|/)${escapeRegExp(name)}$`);

// Order matters: a path matches at most one tool, the first in this list ('generic' stays last).
// An entry with `name` requires the trailer name too (shared, generic e-mails).
export const AI_TOOLS = [
  {
    id: 'claude',
    label: 'Claude',
    config: [
      { re: anyLevel('CLAUDE.md'), kind: 'instructions' },
      { re: /^\.claude$/, kind: 'instructions' },
      { re: /^\.claude\/settings\.json$/, kind: 'instructions' },
      { re: dir('.claude/skills'), kind: 'extensions' },
      { re: dir('.claude/commands'), kind: 'extensions' },
      { re: dir('.claude/agents'), kind: 'extensions' },
    ],
    coauthors: [{ email: /^noreply@anthropic\.com$/i }],
    agentLogins: ['claude'],
    reviewerLogins: ['claude'],
  },
  {
    id: 'copilot',
    label: 'GitHub Copilot',
    config: [
      { re: /^\.github\/copilot-instructions\.md$/, kind: 'instructions' },
      { re: dir('.github/instructions'), kind: 'instructions' },
      { re: dir('.github/prompts'), kind: 'extensions' },
    ],
    coauthors: [{ email: /^(\d+\+)?copilot@users\.noreply\.github\.com$/i }],
    agentLogins: ['copilot'],
    reviewerLogins: ['copilot-pull-request-reviewer'],
  },
  {
    id: 'cursor',
    label: 'Cursor',
    config: [
      { re: anyLevel('.cursorrules'), kind: 'instructions' },
      { re: dir('.cursor/rules'), kind: 'instructions' },
    ],
    coauthors: [{ email: /^cursoragent@cursor\.com$/i }],
    agentLogins: [],
    reviewerLogins: ['cursor'],
  },
  {
    id: 'codex',
    label: 'OpenAI Codex',
    config: [],
    coauthors: [{ email: /^(codex|noreply)@openai\.com$/i }],
    agentLogins: ['chatgpt-codex-connector'],
    reviewerLogins: ['chatgpt-codex-connector'],
  },
  {
    id: 'gemini',
    label: 'Gemini',
    config: [
      { re: anyLevel('GEMINI.md'), kind: 'instructions' },
      { re: dir('.gemini'), kind: 'instructions' },
    ],
    coauthors: [{ email: /^noreply@google\.com$/i, name: /gemini/i }],
    agentLogins: [],
    reviewerLogins: ['gemini-code-assist'],
  },
  {
    id: 'aider',
    label: 'Aider',
    config: [{ re: anyLevel('.aider.conf.yml'), kind: 'instructions' }],
    coauthors: [{ email: /^aider@aider\.chat$/i }],
    agentLogins: [],
    reviewerLogins: [],
  },
  {
    id: 'devin',
    label: 'Devin',
    config: [],
    coauthors: [{ email: /^(\d+\+)?devin-ai-integration\[bot\]@users\.noreply\.github\.com$/i }],
    agentLogins: ['devin-ai-integration'],
    reviewerLogins: [],
  },
  {
    id: 'jules',
    label: 'Jules',
    config: [],
    coauthors: [{ email: /^(\d+\+)?google-labs-jules\[bot\]@users\.noreply\.github\.com$/i }],
    agentLogins: ['google-labs-jules'],
    reviewerLogins: [],
  },
  {
    id: 'windsurf',
    label: 'Windsurf',
    config: [
      { re: anyLevel('.windsurfrules'), kind: 'instructions' },
      { re: dir('.windsurf/rules'), kind: 'instructions' },
    ],
    coauthors: [
      { email: /^cascade@windsurf\.ai$/i },
      { email: /^(\d+\+)?windsurf-bot\[bot\]@users\.noreply\.github\.com$/i },
    ],
    agentLogins: [],
    reviewerLogins: [],
  },
  {
    id: 'junie',
    label: 'JetBrains Junie',
    config: [{ re: /^\.junie\/guidelines\.md$/, kind: 'instructions' }],
    coauthors: [{ email: /^junie@(jetbrains\.com|air\.dev)$/i }],
    agentLogins: [],
    reviewerLogins: [],
  },
  {
    id: 'amp',
    label: 'Amp',
    config: [],
    coauthors: [{ email: /^amp@ampcode\.com$/i }],
    agentLogins: [],
    reviewerLogins: [],
  },
  {
    id: 'kiro',
    label: 'Kiro',
    config: [{ re: dir('.kiro/steering'), kind: 'instructions' }],
    coauthors: [{ email: /^noreply@kiro\.dev$/i }],
    agentLogins: [],
    reviewerLogins: [],
  },
  {
    id: 'cline',
    label: 'Cline',
    config: [{ re: anyLevel('.clinerules'), kind: 'instructions' }],
    coauthors: [
      { email: /^noreply@cline\.bot$/i },
      { email: /^(\d+\+)?cline-cloud\[bot\]@users\.noreply\.github\.com$/i },
    ],
    agentLogins: [],
    reviewerLogins: [],
  },
  {
    id: 'opencode',
    label: 'opencode',
    config: [{ re: anyLevel('opencode.json'), kind: 'instructions' }],
    coauthors: [{ email: /^ai@local$/i, name: /^opencode/i }],
    agentLogins: [],
    reviewerLogins: [],
  },
  {
    id: 'coderabbit',
    label: 'CodeRabbit',
    config: [{ re: anyLevel('.coderabbit.yaml'), kind: 'instructions' }],
    coauthors: [],
    agentLogins: [],
    reviewerLogins: ['coderabbitai'],
  },
  {
    id: 'sourcery',
    label: 'Sourcery',
    config: [{ re: anyLevel('.sourcery.yaml'), kind: 'instructions' }],
    coauthors: [],
    agentLogins: [],
    reviewerLogins: ['sourcery-ai'],
  },
  {
    id: 'greptile',
    label: 'Greptile',
    config: [],
    coauthors: [],
    agentLogins: [],
    reviewerLogins: ['greptile-apps'],
  },
  {
    id: 'generic',
    label: 'Agentes (genérico)',
    config: [
      { re: anyLevel('AGENTS.md'), kind: 'instructions' },
      { re: anyLevel('.mcp.json'), kind: 'extensions' },
    ],
    coauthors: [],
    agentLogins: [],
    reviewerLogins: [],
  },
];

// .gitignore lines that hide AI artifacts: evidence of local, unversioned use.
export const GITIGNORE_AI_PATTERNS = [
  /^(\*\*\/)?\/?\.claude(\/.*)?$/,
  /^(\*\*\/)?\/?CLAUDE\.local\.md$/,
  /^(\*\*\/)?\/?\.cursor(\/.*)?$/,
  /^(\*\*\/)?\/?\.cursorrules$/,
  /^(\*\*\/)?\/?\.aider/,
];
