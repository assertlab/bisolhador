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

// Also listed by fetchAiRepoContext (alias `workflows`, repository only, not the template): CI evidence for
// Classroom, which has no tree. Kept out of CONTEXT_DIRS on purpose: it is not AI configuration, and a failed
// listing here must not leave the AI configuration incomplete (its own unverified part, 'workflows').
export const WORKFLOWS_DIR = '.github/workflows';

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
// Display-only fields, rendered by the AI guide (/guia/ia) and checked against `re`/`email` in aiRegistry.test.js:
// config `show` ("**/" = any level, trailing "/" = directory) and co-author `examples` ("<id>+" = numeric user id),
// with `nameShow`/`nameMatch` ('contains' | 'prefix') for the entries that also require the name.
export const AI_TOOLS = [
  {
    id: 'claude',
    label: 'Claude',
    config: [
      { re: anyLevel('CLAUDE.md'), show: '**/CLAUDE.md', kind: 'instructions' },
      { re: /^\.claude$/, show: '.claude', kind: 'instructions' },
      { re: /^\.claude\/settings\.json$/, show: '.claude/settings.json', kind: 'instructions' },
      { re: dir('.claude/skills'), show: '.claude/skills/', kind: 'extensions' },
      { re: dir('.claude/commands'), show: '.claude/commands/', kind: 'extensions' },
      { re: dir('.claude/agents'), show: '.claude/agents/', kind: 'extensions' },
    ],
    coauthors: [{ email: /^noreply@anthropic\.com$/i, examples: ['noreply@anthropic.com'] }],
    agentLogins: ['claude'],
    reviewerLogins: ['claude'],
  },
  {
    id: 'copilot',
    label: 'GitHub Copilot',
    config: [
      { re: /^\.github\/copilot-instructions\.md$/, show: '.github/copilot-instructions.md', kind: 'instructions' },
      { re: dir('.github/instructions'), show: '.github/instructions/', kind: 'instructions' },
      { re: dir('.github/prompts'), show: '.github/prompts/', kind: 'extensions' },
    ],
    coauthors: [{ email: /^(\d+\+)?copilot@users\.noreply\.github\.com$/i, examples: ['<id>+Copilot@users.noreply.github.com'] }],
    agentLogins: ['copilot'],
    reviewerLogins: ['copilot-pull-request-reviewer'],
  },
  {
    id: 'cursor',
    label: 'Cursor',
    config: [
      { re: anyLevel('.cursorrules'), show: '**/.cursorrules', kind: 'instructions' },
      { re: dir('.cursor/rules'), show: '.cursor/rules/', kind: 'instructions' },
    ],
    coauthors: [{ email: /^cursoragent@cursor\.com$/i, examples: ['cursoragent@cursor.com'] }],
    agentLogins: [],
    reviewerLogins: ['cursor'],
  },
  {
    id: 'codex',
    label: 'OpenAI Codex',
    config: [],
    coauthors: [{ email: /^(codex|noreply)@openai\.com$/i, examples: ['codex@openai.com', 'noreply@openai.com'] }],
    agentLogins: ['chatgpt-codex-connector'],
    reviewerLogins: ['chatgpt-codex-connector'],
  },
  {
    id: 'gemini',
    label: 'Gemini',
    config: [
      { re: anyLevel('GEMINI.md'), show: '**/GEMINI.md', kind: 'instructions' },
      { re: dir('.gemini'), show: '.gemini/', kind: 'instructions' },
    ],
    coauthors: [{ email: /^noreply@google\.com$/i, examples: ['noreply@google.com'], name: /gemini/i, nameShow: 'Gemini', nameMatch: 'contains' }],
    agentLogins: [],
    reviewerLogins: ['gemini-code-assist'],
  },
  {
    id: 'aider',
    label: 'Aider',
    config: [{ re: anyLevel('.aider.conf.yml'), show: '**/.aider.conf.yml', kind: 'instructions' }],
    coauthors: [{ email: /^aider@aider\.chat$/i, examples: ['aider@aider.chat'] }],
    agentLogins: [],
    reviewerLogins: [],
  },
  {
    id: 'devin',
    label: 'Devin',
    config: [],
    coauthors: [{ email: /^(\d+\+)?devin-ai-integration\[bot\]@users\.noreply\.github\.com$/i, examples: ['<id>+devin-ai-integration[bot]@users.noreply.github.com'] }],
    agentLogins: ['devin-ai-integration'],
    reviewerLogins: [],
  },
  {
    id: 'jules',
    label: 'Jules',
    config: [],
    coauthors: [{ email: /^(\d+\+)?google-labs-jules\[bot\]@users\.noreply\.github\.com$/i, examples: ['<id>+google-labs-jules[bot]@users.noreply.github.com'] }],
    agentLogins: ['google-labs-jules'],
    reviewerLogins: [],
  },
  {
    id: 'windsurf',
    label: 'Windsurf',
    config: [
      { re: anyLevel('.windsurfrules'), show: '**/.windsurfrules', kind: 'instructions' },
      { re: dir('.windsurf/rules'), show: '.windsurf/rules/', kind: 'instructions' },
    ],
    coauthors: [
      { email: /^cascade@windsurf\.ai$/i, examples: ['cascade@windsurf.ai'] },
      { email: /^(\d+\+)?windsurf-bot\[bot\]@users\.noreply\.github\.com$/i, examples: ['<id>+windsurf-bot[bot]@users.noreply.github.com'] },
    ],
    agentLogins: [],
    reviewerLogins: [],
  },
  {
    id: 'junie',
    label: 'JetBrains Junie',
    config: [{ re: /^\.junie\/guidelines\.md$/, show: '.junie/guidelines.md', kind: 'instructions' }],
    coauthors: [{ email: /^junie@(jetbrains\.com|air\.dev)$/i, examples: ['junie@jetbrains.com', 'junie@air.dev'] }],
    agentLogins: [],
    reviewerLogins: [],
  },
  {
    id: 'amp',
    label: 'Amp',
    config: [],
    coauthors: [{ email: /^amp@ampcode\.com$/i, examples: ['amp@ampcode.com'] }],
    agentLogins: [],
    reviewerLogins: [],
  },
  {
    id: 'kiro',
    label: 'Kiro',
    config: [{ re: dir('.kiro/steering'), show: '.kiro/steering/', kind: 'instructions' }],
    coauthors: [{ email: /^noreply@kiro\.dev$/i, examples: ['noreply@kiro.dev'] }],
    agentLogins: [],
    reviewerLogins: [],
  },
  {
    id: 'cline',
    label: 'Cline',
    config: [{ re: anyLevel('.clinerules'), show: '**/.clinerules', kind: 'instructions' }],
    coauthors: [
      { email: /^noreply@cline\.bot$/i, examples: ['noreply@cline.bot'] },
      { email: /^(\d+\+)?cline-cloud\[bot\]@users\.noreply\.github\.com$/i, examples: ['<id>+cline-cloud[bot]@users.noreply.github.com'] },
    ],
    agentLogins: [],
    reviewerLogins: [],
  },
  {
    id: 'opencode',
    label: 'opencode',
    config: [{ re: anyLevel('opencode.json'), show: '**/opencode.json', kind: 'instructions' }],
    coauthors: [{ email: /^ai@local$/i, examples: ['ai@local'], name: /^opencode/i, nameShow: 'opencode', nameMatch: 'prefix' }],
    agentLogins: [],
    reviewerLogins: [],
  },
  {
    id: 'coderabbit',
    label: 'CodeRabbit',
    config: [{ re: anyLevel('.coderabbit.yaml'), show: '**/.coderabbit.yaml', kind: 'instructions' }],
    coauthors: [],
    agentLogins: [],
    reviewerLogins: ['coderabbitai'],
  },
  {
    id: 'sourcery',
    label: 'Sourcery',
    config: [{ re: anyLevel('.sourcery.yaml'), show: '**/.sourcery.yaml', kind: 'instructions' }],
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
      { re: anyLevel('AGENTS.md'), show: '**/AGENTS.md', kind: 'instructions' },
      { re: anyLevel('.mcp.json'), show: '**/.mcp.json', kind: 'extensions' },
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

// One readable line per GITIGNORE_AI_PATTERNS entry, same order (AI guide; checked in aiRegistry.test.js).
export const GITIGNORE_AI_EXAMPLES = ['.claude/', 'CLAUDE.local.md', '.cursor/', '.cursorrules', '.aider*'];
