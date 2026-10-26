import { describe, it, expect } from 'vitest';
import {
  normalizeLogin,
  parseCoauthors,
  toolsFromCoauthors,
  agentToolOf,
  reviewerToolOf,
  isMaintenanceBot,
  detectConfig,
  gitignoreHidesAi,
  coauthorDisabled,
} from './aiTraces.js';
import { AI_TOOLS, CONTEXT_DIRS, CLASSROOM_BOT, REGISTRY_VERSION } from './aiRegistry.js';

const tools = (msg) => toolsFromCoauthors(parseCoauthors(msg));

describe('registry shape', () => {
  it('has unique ids and the expected tools', () => {
    const ids = AI_TOOLS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(['claude', 'copilot', 'cursor', 'codex', 'gemini', 'aider', 'devin', 'jules', 'windsurf', 'junie', 'amp', 'kiro', 'cline', 'opencode', 'coderabbit', 'sourcery', 'generic']));
    expect(REGISTRY_VERSION).toBe('2026-10-25');
    expect(CLASSROOM_BOT).toBe('github-classroom');
    expect(CONTEXT_DIRS).toContain('.claude/skills');
  });
});

describe('co-authors', () => {
  it('matches co-author by email, any case, ignoring model name', () => {
    expect(tools('fix\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>')).toEqual(['claude']);
    expect(tools('x\n\nco-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>')).toEqual(['copilot']);
    expect(tools('x\n\nCo-authored-by: aider (ollama/deepseek-r1:14b) <aider@aider.chat>')).toEqual(['aider']);
  });
  it('a forged name with a personal email is not a tool', () => {
    expect(tools('x\n\nCo-authored-by: Copilot <someone@gmail.com>')).toEqual([]);
  });
  it('generic emails need the name too', () => {
    expect(tools('x\n\nCo-authored-by: Gemini <noreply@google.com>')).toEqual(['gemini']);
    expect(tools('x\n\nCo-authored-by: Jane <noreply@google.com>')).toEqual([]);
    expect(tools('x\n\nCo-authored-by: opencode (glm-5) <ai@local>')).toEqual(['opencode']);
    expect(tools('x\n\nCo-authored-by: Bob <ai@local>')).toEqual([]);
  });
  it('dedupes repeated trailers', () => {
    expect(tools('x\n\nCo-Authored-By: Claude <noreply@anthropic.com>\nCo-authored-by: Claude <noreply@anthropic.com>')).toEqual(['claude']);
  });
  it('parses name and email', () => {
    expect(parseCoauthors('x\n\nCo-authored-by: Jane Doe <jane@x.org>')).toEqual([{ name: 'Jane Doe', email: 'jane@x.org' }]);
    expect(parseCoauthors('no trailer')).toEqual([]);
  });
});

describe('logins', () => {
  it('normalizes bot logins from REST and GraphQL', () => {
    expect(normalizeLogin('coderabbitai[bot]')).toBe('coderabbitai');
    expect(normalizeLogin(null)).toBeNull();
    expect(reviewerToolOf('coderabbitai')).toBe('coderabbit');
    expect(reviewerToolOf('greptile-apps[bot]')).toBe('greptile');
    expect(reviewerToolOf('copilot-pull-request-reviewer[bot]')).toBe('copilot');
    expect(agentToolOf('Copilot')).toBe('copilot');
    expect(agentToolOf(null, '158243242+devin-ai-integration[bot]@users.noreply.github.com')).toBe('devin');
    expect(agentToolOf('alice', 'alice@x.org')).toBeNull();
    expect(agentToolOf(null)).toBeNull();
  });
  it('maintenance bots are bots outside the registry', () => {
    expect(isMaintenanceBot({ login: 'dependabot[bot]', type: 'Bot' })).toBe(true);
    expect(isMaintenanceBot({ login: 'claude', type: 'Bot' })).toBe(false);
    expect(isMaintenanceBot({ login: 'coderabbitai', type: 'Bot' })).toBe(false);
    expect(isMaintenanceBot({ login: 'alice', type: 'User' })).toBe(false);
    expect(isMaintenanceBot({ login: 'x', name: 'release bot' })).toBe(true);
    expect(isMaintenanceBot({})).toBe(false);
    // GraphQL author without login: name and e-mail identify the agent
    expect(isMaintenanceBot({ login: null, type: null, name: 'claude[bot]', email: '41898282+claude[bot]@users.noreply.github.com' })).toBe(false);
    expect(isMaintenanceBot({ login: null, name: 'renovate[bot]' })).toBe(true);
  });
});

describe('detectConfig', () => {
  it('detects config with kind; AGENTS.md is generic', () => {
    expect(detectConfig(['CLAUDE.md', 'pkg/AGENTS.md', '.claude/skills/x/SKILL.md', 'src/a.js'])).toEqual([
      { toolId: 'claude', path: 'CLAUDE.md', kind: 'instructions' },
      { toolId: 'generic', path: 'pkg/AGENTS.md', kind: 'instructions' },
      { toolId: 'claude', path: '.claude/skills/x/SKILL.md', kind: 'extensions' },
    ]);
    expect(detectConfig(['docs/claude.md.txt'])).toEqual([]);
  });
  it('matches directory listings (Classroom) as well as files under them', () => {
    expect(detectConfig(['.claude/skills'])).toEqual([{ toolId: 'claude', path: '.claude/skills', kind: 'extensions' }]);
    expect(detectConfig(['.claude/commands', '.claude/agents', '.github/prompts']).map((e) => [e.toolId, e.kind])).toEqual([
      ['claude', 'extensions'], ['claude', 'extensions'], ['copilot', 'extensions'],
    ]);
    expect(detectConfig(['.cursor/rules', '.kiro/steering', '.windsurf/rules']).map((e) => e.toolId)).toEqual(['cursor', 'kiro', 'windsurf']);
    expect(detectConfig(['.claude/skillset'])).toEqual([]);
  });
  it('bare .claude and settings.json count as Claude instructions', () => {
    expect(detectConfig(['.claude', '.claude/settings.json'])).toEqual([
      { toolId: 'claude', path: '.claude', kind: 'instructions' },
      { toolId: 'claude', path: '.claude/settings.json', kind: 'instructions' },
    ]);
  });
  it('detects other tools and .mcp.json', () => {
    expect(detectConfig(['.github/copilot-instructions.md', '.cursorrules', 'GEMINI.md', '.aider.conf.yml', '.mcp.json']).map((e) => [e.toolId, e.kind])).toEqual([
      ['copilot', 'instructions'], ['cursor', 'instructions'], ['gemini', 'instructions'], ['aider', 'instructions'], ['generic', 'extensions'],
    ]);
  });
});

describe('gitignore and settings', () => {
  it('finds AI-hiding lines', () => {
    expect(gitignoreHidesAi('node_modules\n.claude/settings.local.json\nCLAUDE.local.md')).toEqual(['.claude/settings.local.json', 'CLAUDE.local.md']);
    expect(gitignoreHidesAi('dist\n')).toEqual([]);
    expect(gitignoreHidesAi(null)).toBeNull();
  });
  it('matches plain .claude and .cursor lines, ignores comments and negations', () => {
    expect(gitignoreHidesAi('.claude/\n.claude\n.cursor/\n# .claude\n!.claude/settings.json\n.aider*')).toEqual(['.claude/', '.claude', '.cursor/', '.aider*']);
  });
  it('detects the disabled co-author trailer', () => {
    expect(coauthorDisabled('{"includeCoAuthoredBy": false}')).toBe(true);
    expect(coauthorDisabled('{"attribution": false}')).toBe(true);
    expect(coauthorDisabled('{"attribution": {"commit": ""}}')).toBe(true);
    expect(coauthorDisabled('{"attribution": {"commit": "x", "pr": ""}, "includeCoAuthoredBy": false}')).toBe(false);
    expect(coauthorDisabled('{"includeCoAuthoredBy": true}')).toBe(false);
    expect(coauthorDisabled('{}')).toBe(false);
    expect(coauthorDisabled('{')).toBeNull();
    expect(coauthorDisabled('[]')).toBeNull();
    expect(coauthorDisabled(null)).toBeNull();
  });
});
