// "Guia de IA no Processo" (/guia/ia): structure and data. Texts live in locales (aiGuide.*);
// what the app detects is generated from the registry (aiRegistry.js), never copied into locales.
import { AI_TOOLS, GITIGNORE_AI_EXAMPLES, REGISTRY_VERSION, CONTEXT_DIRS } from './aiRegistry.js';
import { AI_PROCESS_METHOD } from './aiProcess.js';
import {
  GITHUB_PER_PAGE_COMMITS, MERGED_PR_SAMPLE, MERGED_PR_SCAN, CLOSED_PR_SCAN,
  AUTHORSHIP_MAX_PATHS, AUTHORSHIP_COMMITS_PER_PATH, CLASSROOM_COMMIT_PAGES, CLASSROOM_PR_SCAN,
} from '../constants.js';

/** Page blocks in display order (anchors on /guia/ia). */
export const AI_GUIDE_BLOCKS = ['overview', 'declare', 'detect', 'teachers', 'faq', 'limits'];

/**
 * Block 2, "how to make AI use visible", one entry per tool (registry ids).
 * - 'verified': instructions in aiGuide.declare.tools.<id>, checked against the tool's own docs or source
 *   on `checked`; `sources` are shown as links.
 * - 'emailOnly': the mechanism could not be confirmed in official documentation, so the page shows only
 *   the e-mail Bisolhador recognizes (from the registry), with no instructions.
 * Verification log (2026-10-26):
 * - claude: code.claude.com/docs/en/settings-reference.md, "Git and attribution": `attribution.commit` default
 *   `Co-Authored-By: <name> <noreply@anthropic.com>`; `attribution: false` / `attribution.commit: ""` hide it;
 *   `includeCoAuthoredBy` deprecated. code.claude.com/docs/en/settings: shared `.claude/settings.json` applies to
 *   everyone who clones it, but `.claude/settings.local.json` (personal, not versioned) takes precedence.
 * - copilot: github.blog/changelog/2026-03-20-trace-any-copilot-coding-agent-commit-to-its-session-logs — the coding
 *   agent's commits are "authored by Copilot, with the human who gave Copilot the task marked as the co-author".
 * - aider: aider.chat/docs/config/options.html — `--attribute-co-authored-by` (default: True); aider/repo.py
 *   (github.com/Aider-AI/aider) writes "Co-authored-by: aider (<model>) <aider@aider.chat>".
 * - cursor: cursor.com/help/integrations/git.md — agent commits get a "Made with Cursor" trailer (on by default,
 *   Settings > Agent > Attribution). That is not a Co-authored-by trailer, so Bisolhador doesn't count it; the
 *   cursoragent@cursor.com co-author was seen in real commits (spec §4.2), not in the docs.
 * - email only (no official doc found on 2026-10-26): codex (the trailer "Co-authored-by: Codex <noreply@openai.com>"
 *   is in openai/codex source tests, but how it is turned on is not documented), gemini, junie, amp, kiro, cline,
 *   windsurf, opencode.
 */
export const DECLARATION_TOOLS = [
  {
    id: 'claude',
    mode: 'verified',
    checked: '2026-10-26',
    sources: ['https://code.claude.com/docs/en/settings-reference#attribution', 'https://code.claude.com/docs/en/settings'],
  },
  {
    id: 'copilot',
    mode: 'verified',
    checked: '2026-10-26',
    sources: ['https://github.blog/changelog/2026-03-20-trace-any-copilot-coding-agent-commit-to-its-session-logs'],
  },
  { id: 'cursor', mode: 'verified', checked: '2026-10-26', sources: ['https://cursor.com/help/integrations/git'] },
  { id: 'aider', mode: 'verified', checked: '2026-10-26', sources: ['https://aider.chat/docs/config/options.html'] },
  { id: 'codex', mode: 'emailOnly' },
  { id: 'gemini', mode: 'emailOnly' },
  { id: 'junie', mode: 'emailOnly' },
  { id: 'amp', mode: 'emailOnly' },
  { id: 'kiro', mode: 'emailOnly' },
  { id: 'cline', mode: 'emailOnly' },
  { id: 'windsurf', mode: 'emailOnly' },
  { id: 'opencode', mode: 'emailOnly' },
];

const TOOLS_BY_ID = new Map(AI_TOOLS.map((tool) => [tool.id, tool]));

/** Co-author e-mails of a registry tool, as shown on screen (with the name rule when there is one). */
export const coauthorExamples = (id) => (TOOLS_BY_ID.get(id)?.coauthors ?? []).map((c) => ({
  emails: c.examples,
  nameShow: c.nameShow ?? null,
  nameMatch: c.nameMatch ?? null,
}));

/** Block 3 table: one row per registry tool, in registry order. */
export function detectionRows() {
  return AI_TOOLS.map((tool) => ({
    id: tool.id,
    config: tool.config.map((c) => ({ show: c.show, kind: c.kind })),
    coauthors: coauthorExamples(tool.id),
    agentLogins: tool.agentLogins,
    reviewerLogins: tool.reviewerLogins,
  }));
}

export const GITIGNORE_EXAMPLES = GITIGNORE_AI_EXAMPLES;

/** Numbers quoted by the texts (interpolated, so they follow the code). */
export const AI_GUIDE_NUMBERS = {
  commits: GITHUB_PER_PAGE_COMMITS,
  prSample: MERGED_PR_SAMPLE,
  prScan: MERGED_PR_SCAN,
  closedScan: CLOSED_PR_SCAN,
  classroomCommits: CLASSROOM_COMMIT_PAGES * 100, // pages of 100 (fetchCommitHistoryInPeriod)
  classroomPrScan: CLASSROOM_PR_SCAN,
  dirs: CONTEXT_DIRS.filter(Boolean).join(', '),
  authorshipPaths: AUTHORSHIP_MAX_PATHS,
  authorshipCommits: AUTHORSHIP_COMMITS_PER_PATH,
  registryVersion: REGISTRY_VERSION,
  method: AI_PROCESS_METHOD,
};

/** Block 5: questions, in order (aiGuide.faq.items.<id>.{q, a}). */
export const AI_GUIDE_FAQ = [
  'zero', 'disagree', 'notAvailable', 'token', 'badge', 'generic', 'fakeTrailer', 'readsCode', 'saved', 'grade',
];

/** Block 6: one entry per limit (aiGuide.limits.items.<id>), each linked to its /guia entry. */
export const AI_GUIDE_LIMITS = [
  { id: 'samples', guide: 'ai-commits' },
  { id: 'token', guide: 'ai-review' },
  { id: 'classroomLocations', guide: 'ai-tools' },
  { id: 'classroomTestsCi', guide: 'ai-badge' },
  { id: 'authorship', guide: 'classroom' },
  { id: 'personalBots', guide: 'ai-prs' },
  { id: 'reviewOnly', guide: 'ai-badge' },
  { id: 'dashboardTemplate', guide: 'ai-coherence' },
  { id: 'method', guide: 'ai-tools' },
];
