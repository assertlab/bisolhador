# IA no Processo — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seção "IA no Processo" no Dashboard e no Modo Turma: rastros de IA (configuração, coautoria, PRs de agentes, revisão por IA), salvaguardas, fontes em desacordo, selo "Uso responsável de IA" e, só no Modo Turma, detalhe por estudante.

**Architecture:**
- Um registro declarativo de ferramentas (`aiRegistry.js`) alimenta detectores puros (`aiTraces.js`).
- Os detectores alimentam analisadores puros, que produzem `report.aiProcess` (`aiProcess.js`) e a visão por estudante (`aiClassroom.js`).
- A busca de dados reaproveita o que já é buscado. Novidades:
  - `fetchAiRepoContext`: uma consulta GraphQL com token que traz `.gitignore`, `.claude/settings.json`, as listagens de diretório e os caminhos equivalentes do template.
  - `fetchAiConfigAuthorship`: uma consulta por repositório com configuração, só no Modo Turma.
- A UI é um componente compartilhado (`AiProcessSection`) e uma subtabela por estudante.

**Tech Stack:** React 19, Vite, Tailwind, react-i18next, Vitest, API REST e GraphQL do GitHub.

**Spec:** `docs/superpowers/specs/2026-10-25-ia-no-processo-design.md` (ler inteiro antes de começar; números de seção abaixo referem-se a ela).

## Global Constraints

- **Limite inferior:**
  - Resultado vazio = "Nenhum rastro de IA encontrado" + explicação; nunca "0% IA" sem contexto nem "Não usa IA".
  - Toda fração mostra o n.
- **Coautoria:** casa pelo **e-mail** do trailer, sem diferenciar caixa. Para e-mails genéricos (`noreply@google.com`, `ai@local`), exige também o nome.
- **Logins:** comparados sem o sufixo `[bot]` e sem diferenciar caixa.
- **Bots fora do registro = manutenção.** Os indicadores existentes (revisão, PR, commit, concentração) **não mudam**: continuam descartando todos os bots, sem novo `method`.
- **Nada de IA por pessoa** no Dashboard, no `report` ou no snapshot. Per-student só em memória, no Modo Turma; nunca no CSV, no Supabase ou no GA.
- **Desacordo:** só no nível do repositório, em tom neutro ("as fontes não concordam"), sempre com as causas legítimas.
- **Selo "Uso responsável de IA" (`Responsible AI use`):**
  - critérios `config`, `declared`, `coherent`, `agentReviewed`, `testsCi`, cada um com estado `met | unmet | na | unverified`;
  - `na` e `unverified` saem do denominador;
  - "não se aplica" quando não há rastro;
  - fora do Ranking e nunca por estudante.
- **Custo de requisições:** sem token, zero requisições novas. Com token, +1 GraphQL (`fetchAiRepoContext`) por análise. No Modo Turma, +1 GraphQL de autoria por repositório **com** configuração.
- **Snapshot:**
  - `aiProcess.method = 'ai-traces-v1'`;
  - `aiProcess.registryVersion = '2026-10-25'`;
  - falha de IA nunca entra em `PERSIST_BLOCKERS`.
- **i18n:** chaves nos dois locales (`src/locales/pt.json`, `src/locales/en.json`); números e datas via `intlLocale()`/`formatters.*`.
- **Owner e repo:** só como variáveis GraphQL. Os caminhos de arquivo nas expressões `HEAD:<path>` vêm **do registro** (constantes), nunca de dado externo. Exceção: os caminhos de autoria, que vêm da árvore do próprio repositório e também entram como **variáveis** GraphQL (`$p0`, `$p1`…), nunca interpolados.
- **Versão:** 3.15.0 (minor).

## Review Focus

1. **Trailer forjado:** `Co-authored-by: Copilot <alguem@gmail.com>` não pode contar como Copilot (o teste está na Task 1).
2. **Árvore truncada e repositório vazio:**
   - Árvore truncada sem config encontrada → config "?", e o critério `config` e o desacordo da regra 1 ficam `unverified`, nunca "unmet"/disparado.
   - Repositório vazio (409 / sem branch) → seção com "Nenhum rastro" e coberturas com n = 0, sem quebrar (Tasks 2–3).
3. **Commit de agente sem login:** na GraphQL, um bot como autor vem com `user: null`. É identificado pelo e-mail `…+Copilot@users.noreply.github.com` ou pelo nome `claude[bot]`. Não pode cair em "não identificado" (teste na Task 6).
4. **Template indisponível:** sem token, ou com `templateRepository` nulo por permissão:
   - o desacordo diz "origem não verificada";
   - no Modo Turma, o fallback é o commit mais antigo do caminho, de `github-classroom[bot]` (testes nas Tasks 3 e 6).
5. **Snapshot antigo** (sem `aiProcess`) e **snapshot com `method` desconhecido** → "não registrado nesta análise", sem erro de render (Task 3, e Task 5 no componente).

---

### Task 1: Registro de ferramentas e detectores

**Files:**
- Create: `src/utils/aiRegistry.js`, `src/utils/aiTraces.js`, `src/utils/aiTraces.test.js`
- Modify: `src/constants.js` (adicionar `AI_MIN_GROUP = 5`)

**Interfaces:**
- Produces (`aiRegistry.js`):
  - `REGISTRY_VERSION = '2026-10-25'`;
  - `AI_TOOLS: Array<{ id: string, label: string, config: Array<{ re: RegExp, kind: 'instructions'|'extensions' }>, coauthors: Array<{ email: RegExp, name?: RegExp }>, agentLogins: string[], reviewerLogins: string[] }>` (ids: `claude, copilot, cursor, codex, gemini, aider, devin, jules, windsurf, junie, amp, kiro, cline, opencode, coderabbit, sourcery, greptile, generic`);
  - `GITIGNORE_AI_PATTERNS: RegExp[]`;
  - `CONTEXT_DIRS: string[]` (diretórios listados por `fetchAiRepoContext`: `''` (raiz), `.github`, `.github/instructions`, `.github/prompts`, `.cursor`, `.cursor/rules`, `.claude`, `.claude/skills`, `.claude/commands`, `.claude/agents`, `.kiro/steering`, `.windsurf/rules`, `.junie`, `.gemini`);
  - `CLASSROOM_BOT = 'github-classroom'`.
- Produces (`aiTraces.js`), todas puras:
  - `normalizeLogin(login: string|null): string|null`: minúsculas, sem `[bot]`;
  - `parseCoauthors(message: string): Array<{ name: string, email: string }>`;
  - `toolsFromCoauthors(coauthors): string[]`: ids únicos;
  - `agentToolOf(login: string|null, email?: string|null): string|null`: id da ferramenta se o login ou o e-mail do **autor** é de agente;
  - `reviewerToolOf(login: string|null): string|null`;
  - `isMaintenanceBot(author: { login?: string|null, type?: string|null, name?: string|null }): boolean`: é bot pelas mesmas regras de `isBot`/regex de nome usadas em `classroom.js:69`, **e** não é agente nem revisor do registro;
  - `detectConfig(paths: string[]): Array<{ toolId: string, path: string, kind: 'instructions'|'extensions' }>`;
  - `gitignoreHidesAi(text: string|null): string[]|null`: linhas do `.gitignore` que casam com `GITIGNORE_AI_PATTERNS` (null quando text é null = não verificado);
  - `coauthorDisabled(settingsText: string|null): boolean|null`: true quando o JSON desliga o trailer, null quando não há arquivo ou o JSON é inválido.

- [ ] **Step 1: Conferir os itens ○ e "a conferir" da spec §4.1/§4.2 contra dados reais**

Para cada nome de arquivo de configuração da tabela, confirme que ele existe num repositório público real. Use `gh api -X GET search/code -f q='filename:<nome>'`, com **10 s de intervalo entre buscas**, porque a busca de código tem limite secundário. Confirme também Cursor como autor de PR (`is:pr author:app/cursor`) e Greptile como revisor (`reviewed-by:app/greptile-apps`).

Para a chave do Claude Code que desliga a coautoria, confira na documentação oficial (settings) se é `includeCoAuthoredBy: false` e/ou `attribution` (ex.: `attribution.commit === ''`).

O que não confirmar sai do registro. Registre o resultado como comentário no topo de `aiRegistry.js`, com a data.

- [ ] **Step 2: Escrever os testes que falham** (`src/utils/aiTraces.test.js`), usando os trailers reais da spec §4.2 como fixtures

```js
it('matches co-author by email, any case, ignoring model name', () => {
  expect(toolsFromCoauthors(parseCoauthors('fix\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'))).toEqual(['claude']);
  expect(toolsFromCoauthors(parseCoauthors('x\n\nco-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>'))).toEqual(['copilot']);
  expect(toolsFromCoauthors(parseCoauthors('x\n\nCo-authored-by: aider (ollama/deepseek-r1:14b) <aider@aider.chat>'))).toEqual(['aider']);
});
it('a forged name with a personal email is not a tool', () => {
  expect(toolsFromCoauthors(parseCoauthors('x\n\nCo-authored-by: Copilot <someone@gmail.com>'))).toEqual([]);
});
it('generic emails need the name too', () => {
  expect(toolsFromCoauthors(parseCoauthors('x\n\nCo-authored-by: Gemini <noreply@google.com>'))).toEqual(['gemini']);
  expect(toolsFromCoauthors(parseCoauthors('x\n\nCo-authored-by: Jane <noreply@google.com>'))).toEqual([]);
  expect(toolsFromCoauthors(parseCoauthors('x\n\nCo-authored-by: opencode (glm-5) <ai@local>'))).toEqual(['opencode']);
});
it('dedupes repeated trailers', () => {
  expect(toolsFromCoauthors(parseCoauthors('x\n\nCo-Authored-By: Claude <noreply@anthropic.com>\nCo-authored-by: Claude <noreply@anthropic.com>'))).toEqual(['claude']);
});
it('normalizes bot logins from REST and GraphQL', () => {
  expect(normalizeLogin('coderabbitai[bot]')).toBe('coderabbitai');
  expect(reviewerToolOf('coderabbitai')).toBe('coderabbit');
  expect(reviewerToolOf('copilot-pull-request-reviewer[bot]')).toBe('copilot');
  expect(agentToolOf('Copilot')).toBe('copilot');
  expect(agentToolOf(null, '158243242+devin-ai-integration[bot]@users.noreply.github.com')).toBe('devin');
});
it('maintenance bots are bots outside the registry', () => {
  expect(isMaintenanceBot({ login: 'dependabot[bot]', type: 'Bot' })).toBe(true);
  expect(isMaintenanceBot({ login: 'claude', type: 'Bot' })).toBe(false);
  expect(isMaintenanceBot({ login: 'alice', type: 'User' })).toBe(false);
});
it('detects config with kind; AGENTS.md is generic', () => {
  expect(detectConfig(['CLAUDE.md', 'pkg/AGENTS.md', '.claude/skills/x/SKILL.md', 'src/a.js'])).toEqual([
    { toolId: 'claude', path: 'CLAUDE.md', kind: 'instructions' },
    { toolId: 'generic', path: 'pkg/AGENTS.md', kind: 'instructions' },
    { toolId: 'claude', path: '.claude/skills/x/SKILL.md', kind: 'extensions' },
  ]);
  expect(detectConfig(['docs/claude.md.txt'])).toEqual([]);
});
it('gitignore and settings', () => {
  expect(gitignoreHidesAi('node_modules\n.claude/settings.local.json\nCLAUDE.local.md')).toEqual(['.claude/settings.local.json', 'CLAUDE.local.md']);
  expect(gitignoreHidesAi('dist\n')).toEqual([]);
  expect(gitignoreHidesAi(null)).toBeNull();
  expect(coauthorDisabled('{"includeCoAuthoredBy": false}')).toBe(true);
  expect(coauthorDisabled('{')).toBeNull();
  expect(coauthorDisabled(null)).toBeNull();
});
```
(Ajuste o teste de `coauthorDisabled` à chave confirmada no Step 1.)

- [ ] **Step 3: Rodar e ver falhar:** `npx vitest run src/utils/aiTraces.test.js` → FAIL (módulo inexistente)
- [ ] **Step 4: Implementar `aiRegistry.js` (dados da spec §4.1, revisados no Step 1) e as funções de `aiTraces.js`**

`parseCoauthors` lê linhas `^co-authored-by:\s*(.+?)\s*<([^>]+)>\s*$` (flags `im`). `detectConfig` devolve uma entrada por caminho que casa, na ordem dos caminhos; um caminho casa no máximo uma ferramenta (a primeira do registro).

- [ ] **Step 5: Rodar e ver passar:** `npx vitest run src/utils/aiTraces.test.js` → PASS
- [ ] **Step 6: Commit:** `git commit -m "feat(ai): tool registry and trace detectors"`

---

### Task 2: Analisadores de commits, PRs e salvaguardas (repositório)

**Files:**
- Create: `src/utils/aiProcess.js`, `src/utils/aiProcess.test.js`
- Modify: `src/utils/prReviewStats.js` (`toPullRequestStats`: novo campo), `src/utils/prReviewStats.test.js`

**Interfaces:**
- Consumes: Task 1.
- Produces (`aiProcess.js`):
  - `fromRestCommit(c) → AiCommit`;
  - `fromGraphqlCommit(node) → AiCommit`, onde `AiCommit = { message: string, authorLogin: string|null, authorName: string, authorEmail: string|null, authorType: 'Bot'|'User'|null, date: string|null, parents: number }`. Na GraphQL, `authorLogin = node.author.user?.login ?? null`, `authorType = null`, e `parents = node.parents.totalCount`;
  - `commitAiTools(c: AiCommit): string[]`: coautores + agente-autor (`agentToolOf(authorLogin ?? authorName, authorEmail)`);
  - `analyzeAiCommits(commits: AiCommit[]|null) → { available: boolean, reason?: 'error', n: number, withAi: number, percentage: number|null, firstTraceAt: string|null, tools: string[] }`. Base: `parents <= 1` e `!isMaintenanceBot`;
  - `analyzeAiPrs(prs: PrStat[]|null, { limit = MERGED_PR_SAMPLE, reviewsAvailable: boolean }) → { available, reason?, n, byAgents, percentage, agentTools: string[], aiReviewed: { available: boolean, count: number|null, percentage: number|null, tools: string[] } }`. A amostra são os `limit` mais recentes por `merged_at` entre PRs mesclados cujo autor **não** é bot de manutenção;
  - `analyzeAiSafeguards(prs, { limit, reviewsAvailable }) → { available, reason?: 'noToken'|'error', agentPrs: number, agentUnapproved: number|null, size: { available: boolean, agentMedian: number|null, humanMedian: number|null, agentN: number, humanN: number } }`. A comparação de tamanho só fica `available` se `agentN >= AI_MIN_GROUP && humanN >= AI_MIN_GROUP`.
- Produces (`prReviewStats.js`): `toPullRequestStats` acrescenta `aiParticipants: string[]`, os logins normalizados de **bots** que revisaram ou comentaram (lista única). Nenhum outro campo muda; `mergedSample` e todos os indicadores existentes ficam idênticos.
- `PrStat` = saída atual de `toPullRequestStats` (e o item REST de `fetchPullRequestStats`, que tem `user`, `merged_at` e `created_at`, sem `aiParticipants` nem `approvedByOther`).

- [ ] **Step 1: Escrever os testes que falham** (`aiProcess.test.js`)

```js
it('commit coverage counts co-authored and agent-authored; maintenance bots and merges out', () => {
  const r = analyzeAiCommits([
    commit({ message: 'a\n\nCo-Authored-By: Claude <noreply@anthropic.com>', date: '2026-03-12T10:00:00Z' }),
    commit({ authorLogin: null, authorName: 'Copilot', authorEmail: '198982749+Copilot@users.noreply.github.com' }),
    commit({}),
    commit({ authorLogin: 'dependabot[bot]', authorType: 'Bot' }),
    commit({ parents: 2, message: 'Merge\n\nCo-Authored-By: Claude <noreply@anthropic.com>' }),
  ]);
  expect(r).toMatchObject({ available: true, n: 3, withAi: 2, percentage: 67, firstTraceAt: '2026-03-12T10:00:00Z', tools: ['claude', 'copilot'] });
});
it('null input → unavailable error; empty → n 0, percentage null', () => {
  expect(analyzeAiCommits(null)).toMatchObject({ available: false, reason: 'error' });
  expect(analyzeAiCommits([])).toMatchObject({ available: true, n: 0, withAi: 0, percentage: null });
});
it('agent PR share and AI review over the mixed sample', () => {
  const prs = [pr({ user: { login: 'Copilot', type: 'Bot' }, aiParticipants: [] }), pr({ aiParticipants: ['coderabbitai'] }), pr({}), pr({ user: { login: 'dependabot[bot]', type: 'Bot' } })];
  expect(analyzeAiPrs(prs, { reviewsAvailable: true })).toMatchObject({ n: 3, byAgents: 1, percentage: 33, agentTools: ['copilot'], aiReviewed: { available: true, count: 1, percentage: 33, tools: ['coderabbit'] } });
  expect(analyzeAiPrs(prs, { reviewsAvailable: false }).aiReviewed).toMatchObject({ available: false, count: null });
});
it('safeguards: unapproved agent PRs; size comparison only with AI_MIN_GROUP per side', () => {
  const agents = Array.from({ length: 5 }, (_, i) => pr({ user: { login: 'Copilot', type: 'Bot' }, approvedByOther: i > 0, changedLines: 100 }));
  const humans = Array.from({ length: 4 }, () => pr({ changedLines: 40 }));
  const s = analyzeAiSafeguards([...agents, ...humans], { reviewsAvailable: true });
  expect(s).toMatchObject({ agentPrs: 5, agentUnapproved: 1, size: { available: false, agentN: 5, humanN: 4 } });
});
it('without a token safeguards are unavailable (noToken)', () => {
  expect(analyzeAiSafeguards([pr({})], { reviewsAvailable: false })).toMatchObject({ available: false, reason: 'noToken' });
});
```
(`commit()`/`pr()` são factories locais com defaults humanos, `merged_at` decrescente e `parents: 1`.) Em `prReviewStats.test.js`: `toPullRequestStats` com uma review de `coderabbitai` (`__typename: 'Bot'`) e um comentário de `claude` → `aiParticipants` contém os dois, e `approvedByOther`, `comments` etc. ficam iguais ao teste existente.

- [ ] **Step 2: Rodar e ver falhar:** `npx vitest run src/utils/aiProcess.test.js src/utils/prReviewStats.test.js` → FAIL
- [ ] **Step 3: Implementar.** Percentuais com `Math.round`, como `classroom.js`; a mediana de tamanho usa `percentile(sorted, 0.5)` de `prReviewStats.js`.
- [ ] **Step 4: Rodar e ver passar** (os mesmos arquivos, mais `npm test` inteiro para provar que os indicadores existentes não mudaram) → PASS
- [ ] **Step 5: Commit:** `git commit -m "feat(ai): commit, PR and safeguard analyzers"`

---

### Task 3: Configuração, desacordo, selo, `report.aiProcess` e normalizador

**Files:**
- Modify: `src/utils/aiProcess.js`, `src/utils/aiProcess.test.js`

**Interfaces:**
- Consumes: Tasks 1–2; `maturity` de `repoTree.analyzeMaturity` (`testsDetected`, `ciCdDetected`, `treeStatus`).
- Produces:
  - `AiRepoContext = { gitignore: string|null, claudeSettings: string|null, templatePaths: Set<string>|null, available: boolean }`. `templatePaths` null = template não verificado; Set vazio = verificado, sem template ou sem arquivos de IA nele.
  - `analyzeAiConfig(paths: string[]|null, treeStatus: 'complete'|'truncated'|'unavailable', ctx: AiRepoContext|null) → { status, entries: Array<{ toolId, path, kind, fromTemplate: boolean|null }>, hiddenLocal: string[]|null, coauthorDisabled: boolean|null }`.
  - `analyzeCoherence(config, commits, prs) → { flags: Array<'configWithoutDeclaration'|'hiddenWithoutDeclaration'>, unverified: Array<'config'|'template'|'gitignore'>, toolMismatch: boolean, coauthorDisabled: boolean }`. Regras da spec §5.6, com estes casos:
    - **Regra 1:** entradas com `fromTemplate !== true`, `commits.withAi === 0` e nenhum PR de agente.
    - **Regra 2:** `hiddenLocal?.length > 0` e nenhuma declaração.
    - **Árvore truncada sem entradas:** a regra 1 não dispara e `'config'` vai para `unverified`.
    - **`fromTemplate === null`:** a regra 1 ainda dispara, e `'template'` vai para `unverified`.
  - `analyzeResponsibleBadge({ config, commits, prs, safeguards, coherence, maturity }) → { applicable: boolean, criteria: Array<{ id: 'config'|'declared'|'coherent'|'agentReviewed'|'testsCi', state: 'met'|'unmet'|'na'|'unverified' }>, met: number, total: number }`. `applicable` = há algum rastro (config não-template, commit, PR de agente ou revisão de IA). Para cada critério:
    - **`agentReviewed`:** `na` sem PRs de agentes; `unverified` sem token; `met` só se `agentUnapproved === 0`.
    - **`testsCi`:** `met` se os dois forem `true`; `unverified` se algum for `null` ou `maturity` estiver ausente (Modo Turma); `unmet` caso contrário.
    - **`total`:** conta só os critérios `met`/`unmet`.
  - `buildAiProcess({ treePaths, treeStatus, ctx, commits, prs, reviewsAvailable, maturity, prLimit }) → AiProcess`, onde `AiProcess = { method: 'ai-traces-v1', registryVersion, tools: Array<{ id, sources: Array<'config'|'commit'|'pr'|'review'>, configKind: 'instructions'|'extensions'|null, fromTemplate: boolean }>, config, commits, prs, safeguards, coherence, badge }`. O objeto não carrega nenhum login de pessoa.
  - `normalizeSnapshotAiProcess(report) → report`: sem `aiProcess.method === 'ai-traces-v1'`, vira `{ ...report, aiProcess: { available: false, reason: 'snapshot' } }`.

- [ ] **Step 1: Escrever os testes que falham**

```js
it('config from template does not count; unknown template still flags but says unverified', () => {
  const ctx = { gitignore: '', claudeSettings: null, templatePaths: new Set(['AGENTS.md']), available: true };
  const cfg = analyzeAiConfig(['AGENTS.md'], 'complete', ctx);
  expect(cfg.entries[0].fromTemplate).toBe(true);
  expect(analyzeCoherence(cfg, noAiCommits, noAiPrs).flags).toEqual([]);
  const unknown = analyzeAiConfig(['CLAUDE.md'], 'complete', { ...ctx, templatePaths: null });
  expect(analyzeCoherence(unknown, noAiCommits, noAiPrs)).toMatchObject({ flags: ['configWithoutDeclaration'], unverified: ['template'] });
});
it('hidden local use without declaration; coauthorDisabled is reported as explanation', () => {
  const cfg = analyzeAiConfig([], 'complete', { gitignore: '.claude/\n', claudeSettings: '{"includeCoAuthoredBy": false}', templatePaths: new Set(), available: true });
  expect(analyzeCoherence(cfg, noAiCommits, noAiPrs)).toMatchObject({ flags: ['hiddenWithoutDeclaration'], coauthorDisabled: true });
});
it('truncated tree with nothing found: no flag, config unverified', () => {
  const cfg = analyzeAiConfig(['src/a.js'], 'truncated', null);
  expect(cfg.status).toBe('truncated');
  expect(analyzeCoherence(cfg, noAiCommits, noAiPrs)).toMatchObject({ flags: [], unverified: expect.arrayContaining(['config']) });
});
it('declared commits silence rule 1; different tool is informative only', () => {
  const cfg = analyzeAiConfig(['.cursorrules'], 'complete', emptyCtx);
  const r = analyzeCoherence(cfg, { ...noAiCommits, withAi: 2, tools: ['claude'] }, noAiPrs);
  expect(r).toMatchObject({ flags: [], toolMismatch: true });
});
it('badge: not applicable without traces; na/unverified leave the denominator', () => {
  expect(analyzeResponsibleBadge(noTraces).applicable).toBe(false);
  const b = analyzeResponsibleBadge({ ...declaredWithConfig, safeguards: { available: true, agentPrs: 0 }, maturity: { testsDetected: true, ciCdDetected: null } });
  expect(b.criteria.find((c) => c.id === 'agentReviewed').state).toBe('na');
  expect(b.criteria.find((c) => c.id === 'testsCi').state).toBe('unverified');
  expect(b).toMatchObject({ applicable: true, met: 3, total: 3 });
});
it('buildAiProcess has no person logins and the method/version', () => {
  const ai = buildAiProcess(fullFixture);
  expect(ai).toMatchObject({ method: 'ai-traces-v1', registryVersion: '2026-10-25' });
  expect(JSON.stringify(ai)).not.toContain('alice');
});
it('empty repository → no traces, nothing crashes', () => {
  const ai = buildAiProcess({ treePaths: [], treeStatus: 'complete', ctx: null, commits: [], prs: [], reviewsAvailable: false, maturity: null });
  expect(ai.tools).toEqual([]);
  expect(ai.badge.applicable).toBe(false);
});
it('normalizer: old or unknown method → not recorded', () => {
  expect(normalizeSnapshotAiProcess({ fullName: 'a/b' }).aiProcess).toEqual({ available: false, reason: 'snapshot' });
  expect(normalizeSnapshotAiProcess({ aiProcess: { method: 'x' } }).aiProcess.reason).toBe('snapshot');
});
```
(`fullFixture` inclui um commit humano de `alice` com trailer do Claude.)

- [ ] **Step 2: Rodar e ver falhar:** `npx vitest run src/utils/aiProcess.test.js` → FAIL
- [ ] **Step 3: Implementar.** `tools` junta as fontes: `config` vem das entradas que não são de template; `commit`, `pr` e `review` vêm das listas de ferramentas.
- [ ] **Step 4: Rodar e ver passar** → PASS
- [ ] **Step 5: Commit:** `git commit -m "feat(ai): config, coherence, responsible-use badge and snapshot normalizer"`

---

### Task 4: Busca de dados (githubService)

**Files:**
- Modify: `src/services/githubService.js`, `src/utils/aiProcess.js` (parser do contexto), `src/utils/aiProcess.test.js`

**Interfaces:**
- Produces:
  - `githubService.fetchAiRepoContext(owner, repo) → raw GraphQL data`. Exige token e lança erro sem ele. Uma consulta com:
    - `gitignore: object(expression: "HEAD:.gitignore") { ... on Blob { text } }`;
    - `claudeSettings: object(expression: "HEAD:.claude/settings.json") { ... on Blob { text } }`;
    - um alias `d<i>: object(expression: "HEAD:<CONTEXT_DIRS[i]>") { ... on Tree { entries { name type } } }` por diretório;
    - `templateRepository { nameWithOwner <os mesmos aliases d<i>> }`.

    As expressões são montadas só a partir de `CONTEXT_DIRS` (constantes). Owner e repo vão como variáveis.
  - `parseAiRepoContext(data) → AiRepoContext` (em `aiProcess.js`, puro):
    - `templatePaths` = caminhos (`dir/name`) das listagens do template que casam com `detectConfig`, mais os caminhos sob os diretórios `.claude`, `.cursor` etc. listados;
    - `templateRepository` null → `templatePaths: null`;
    - também devolve `contextPaths: string[]`, os caminhos listados do próprio repositório, usados pelo Modo Turma, que não tem árvore.
  - `githubService.fetchCommitHistoryInPeriod`: o nó passa a pedir `author { name email user { login } } committedDate`. Nada mais muda.
  - `githubService.fetchAiConfigAuthorship(owner, repo, paths: string[]) → Array<{ path, commits: Array<{ login: string|null, name: string, email: string|null, date: string }>, complete: boolean }>`. Uma consulta com `defaultBranchRef.target.history(path: $p<i>, first: 50)` por caminho (no máximo 10, os primeiros por ordem do registro). Os caminhos vão como variáveis `$p<i>: String!`, e `complete = !hasNextPage`.

- [ ] **Step 1: Escrever os testes que falham** para `parseAiRepoContext` com fixtures de resposta GraphQL:
  - template com `AGENTS.md` → `templatePaths` contém `'AGENTS.md'`;
  - `templateRepository: null` → `templatePaths: null`;
  - `gitignore: null` (arquivo inexistente) → `gitignore: null`;
  - `.claude` listado com `skills` (`type: 'tree'`) → `contextPaths` contém `'.claude/skills'`.
- [ ] **Step 2: Rodar e ver falhar:** `npx vitest run src/utils/aiProcess.test.js` → FAIL
- [ ] **Step 3: Implementar o parser e os dois fetchers.** Use `graphql(...)` e `withExponentialBackoff(..., 1, 1000)`, como os vizinhos. Uma falha de qualquer um deles lança erro, e quem chama trata.
- [ ] **Step 4: Rodar e ver passar** e conferir manualmente uma vez com token. Rode um script ad-hoc no scratchpad que importa só `githubService` com `SMOKE_GITHUB_TOKEN` (regra do AGENTS.md; nenhuma escrita no Supabase porque não carrega o app). Execute `fetchAiRepoContext('assertlab', 'bisolhador')` e espere ver o `CLAUDE.md`/`AGENTS.md` da raiz em `contextPaths`. → PASS
- [ ] **Step 5: Commit:** `git commit -m "feat(ai): GitHub fetchers for AI repo context and config authorship"`

---

### Task 5: Dashboard e snapshot (subseção Repositório)

**Files:**
- Create: `src/components/ai/AiProcessSection.jsx`
- Modify: `src/hooks/useRepository.js`, `src/hooks/useSnapshot.js`, `src/pages/Dashboard.jsx`, `src/locales/pt.json`, `src/locales/en.json`

**Interfaces:**
- Consumes: `buildAiProcess`, `parseAiRepoContext`, `fromRestCommit`, `normalizeSnapshotAiProcess`, `fetchAiRepoContext`.
- Produces: `<AiProcessSection aiProcess={AiProcess|{available:false,reason}} />`, usado também pelo Modo Turma (Task 6). Chaves i18n sob `aiProcess.*` (lista abaixo).

- [ ] **Step 1: Ligar no `useRepository`**
  - Acrescente `hasToken ? githubService.fetchAiRepoContext(owner, repo) : Promise.resolve(null)` **ao final** do `Promise.allSettled` e `'aiContext'` ao final de `endpointNames`.
  - Inclua `'aiContext'` em `SELF_EXPLAINED`: a seção explica a falha e o banner de dados parciais não aparece.
  - Monte `report.aiProcess = buildAiProcess({ treePaths: treePathsOf(repositoryTree), treeStatus: treeStatusOf(repositoryTree), ctx, commits: results[0] fulfilled ? value.map(fromRestCommit) : null, prs: prReviewStats ?? pullRequestsStats, reviewsAvailable: Boolean(prReviewStats), maturity, prLimit: MERGED_PR_SAMPLE })`.
  - **Não** tocar em `PERSIST_BLOCKERS`.
- [ ] **Step 2: `useSnapshot`:** encadeie `normalizeSnapshotAiProcess` aos normalizadores em `toRepoData`.
- [ ] **Step 3: Implementar `AiProcessSection`** no padrão visual de `MaturityCard`: card, badges com estado no texto (✓/✗/?) e `Tooltip`. Ordem:
  1. ferramentas com selos de origem (`config`/`commit`/`PR`/`revisão`; template marcado "do template");
  2. profundidade (instruções / + extensões; "uso local ignorado");
  3. três números com n ("12 de 100 commits");
  4. salvaguardas;
  5. bloco "Fontes em desacordo" (só quando `flags.length`), com as causas legítimas e, quando `coauthorDisabled`, a frase "declaração desligada na configuração";
  6. selo "Uso responsável de IA" ("x de y", critérios no tooltip; "não se aplica" quando `!applicable`);
  7. nota de limite inferior;
  8. `GuideLink` por bloco (ids da Task 7).

  `available:false, reason:'snapshot'` → um card só com `aiProcess.notRecorded`. Cores neutras para o desacordo (sem vermelho), para não sugerir acusação.
- [ ] **Step 4: Dashboard:** renderizar `<h3>{t('aiProcess.title')}</h3><AiProcessSection …/>` logo após o bloco de Bus Factor.
- [ ] **Step 5: Locales.** Chaves `aiProcess.title` ("IA no Processo" / "AI in the Process"), `aiProcess.repoSubtitle` ("Repositório" / "Repository"), `noTraces`, `lowerBoundNote`, `sources.{config,commit,pr,review,template}`, `depth.{instructions,extensions,hiddenLocal}`, `commits`, `prs`, `aiReviewed`, `safeguards.*`, `coherence.{title,configWithoutDeclaration,hiddenWithoutDeclaration,toolMismatch,coauthorDisabled,legitimateCauses,templateUnverified,configUnverified}`, `badge.{title,notApplicable,score,criteria.*,states.*,tooltip}`, `unavailable.{noToken,error,snapshot}`, `notRecorded`.
  - O título do selo é "Uso responsável de IA" / "Responsible AI use".
  - O tooltip do selo diz que ele verifica práticas observáveis e coerência entre rastros, não uso real nem caráter.
  - `coherence.title` = "As fontes não concordam" / "The sources disagree".
- [ ] **Step 6: Verificar:**
  - `npm test && npm run lint && npm run build`, tudo verde.
  - Depois, `npm run dev` e uma busca real com token, usando um script Playwright ad-hoc **que intercepta `**/rest/v1/rpc/registrar_busca`** (copiar o padrão de `scripts/csp-smoke-test.mjs`).
  - Repositório de teste: `assertlab/bisolhador`. Esperado: a seção mostra Claude com origem config e commit e o selo aplicável.
  - Abrir um `?id=893` antigo. Esperado: "não registrado nesta análise".
- [ ] **Step 7: Commit:** `git commit -m "feat(ai): AI in the Process section on the Dashboard"`

---

### Task 6: Modo Turma (colunas, linha expandida, por estudante)

**Files:**
- Create: `src/utils/aiClassroom.js`, `src/utils/aiClassroom.test.js`, `src/components/ai/AiStudentTable.jsx`
- Modify: `src/hooks/useClassroomAnalysis.js`, `src/utils/classroom.js` (`analyzeTeamRepo` ganha `ai`), `src/pages/Classroom.jsx`, locales

**Interfaces:**
- Consumes: Tasks 1–5 (`AiProcessSection`).
- Produces:
  - `analyzeStudents(commits: AiCommit[], authorship: Array<{path, commits, complete}>|null, period, templatePaths: Set|null) → { rows: Array<{ key: string, kind: 'person'|'agent'|'unidentified', login: string|null, agentToolId: string|null, commits: number, withAi: number, percentage: number|null, tools: string[], configPaths: string[] }>, authorshipAvailable: boolean }`. Agrupamento:
    - **Agente:** o commit cujo autor é agente (`agentToolOf`) vai para a linha `agent` daquela ferramenta.
    - **Pessoa:** commit com login vai para `person`.
    - **Sem login:** vai para uma única linha `unidentified`. Commits não são agrupados por nome.
    - **Fora da base:** bots de manutenção e merges ficam fora.
    - **`configPaths`:** caminhos cujos commits **no período** têm aquele login.
  - `templateFromAuthorship(authorship) → Set<string>`: caminhos cujo commit mais antigo (o último da lista, só quando `complete`) tem login `github-classroom` (normalizado).
  - Em `analyzeTeamRepo`: `ai: buildAiProcess({ treePaths: ctx?.contextPaths ?? null, treeStatus: ctx ? 'complete' : 'unavailable', ctx: ctx com templatePaths = união(templatePaths ?? ∅, templateFromAuthorship) ou null se ambos indisponíveis, commits: history.nodes.map(fromGraphqlCommit), prs: prs.stats, reviewsAvailable: true, maturity: null, prLimit: Infinity })`, mais `students: analyzeStudents(...)`.

- [ ] **Step 1: Escrever os testes que falham** (`aiClassroom.test.js`):

```js
it('groups by login; agent-authored commits get an agent row; unlinked go to one unidentified row', () => {
  const r = analyzeStudents([
    c({ authorLogin: 'alice', message: 'x\n\nCo-Authored-By: Claude <noreply@anthropic.com>' }),
    c({ authorLogin: 'alice' }),
    c({ authorLogin: null, authorName: 'Copilot', authorEmail: '198982749+Copilot@users.noreply.github.com' }),
    c({ authorLogin: null, authorName: 'Bob Laptop' }),
    c({ authorLogin: null, authorName: 'bob' }),
  ], null, period, null);
  expect(r.rows).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: 'person', login: 'alice', commits: 2, withAi: 1, percentage: 50, tools: ['claude'] }),
    expect.objectContaining({ kind: 'agent', agentToolId: 'copilot', commits: 1, withAi: 1 }),
    expect.objectContaining({ kind: 'unidentified', commits: 2 }),
  ]));
  expect(r.authorshipAvailable).toBe(false);
});
it('config authorship in period, template-origin paths excluded', () => {
  const authorship = [{ path: 'CLAUDE.md', complete: true, commits: [{ login: 'alice', date: inPeriod }, { login: 'github-classroom[bot]', date: beforePeriod }] }];
  expect(templateFromAuthorship(authorship)).toEqual(new Set(['CLAUDE.md']));
  const r = analyzeStudents([c({ authorLogin: 'alice' })], authorship, period, new Set(['CLAUDE.md']));
  expect(r.rows[0].configPaths).toEqual([]);
});
```

- [ ] **Step 2: Rodar e ver falhar:** `npx vitest run src/utils/aiClassroom.test.js` → FAIL
- [ ] **Step 3: Implementar `aiClassroom.js` e ligar no hook.** Em `analyzeRepository`, acrescente `githubService.fetchAiRepoContext(o, r)` ao `Promise.allSettled` existente e registre no `console.warn` por parte. Depois de obter o contexto e o histórico, se houver entradas de configuração (`detectConfig(ctx.contextPaths)`), chame `fetchAiConfigAuthorship(o, r, paths)`. Uma falha aí deixa `authorship: null`, e a coluna fica "n/d".
- [ ] **Step 4: Classroom.jsx**
  - **Colunas:** acrescente ao `COLUMNS` `aiTools` (texto com siglas), `aiCommits` (pct, `sampled: commitsCapped`), `aiPrs` (pct, `sampled: r.prs.capped`), `aiCoherence` (ícone neutro "≠" com tooltip quando `flags.length`, senão "—") e `aiBadge` ("x/y", ou "—" quando não se aplica). Todas com `guide` (ids da Task 7).
  - **Expansão:** cada linha ganha um botão de expandir (`aria-expanded`, `aria-controls`). Uma linha extra com `colSpan` total renderiza `<AiProcessSection aiProcess={row.ai} />` e `<AiStudentTable students={row.students} />`. Com `requested.repos.length === 1`, a linha começa expandida.
- [ ] **Step 5: `AiStudentTable`**
  - **Colunas:** autor, commits, commits com IA declarada (n e %), ferramentas declaradas, configuração adicionada ou alterada.
  - **Linhas especiais:** agente = "Copilot (agente)"; não identificado = `aiProcess.students.unidentified`.
  - **Visual:** sem cores de alerta.
  - **Aviso fixo acima da tabela** (`aiProcess.students.notice`), em pt literalmente:
    > Mostra só o uso de IA **declarado** nos commits (coautoria) e quem **configurou** ferramentas de IA no repositório. Configurar não é o mesmo que usar: num grupo, uma pessoa pode montar a configuração para todos. Quem não declara não aparece aqui, então ausência de registro não significa ausência de uso. Não use este dado como nota ou prova.

    Acrescente o limite: "Quem usa agentes na nuvem pode aparecer com menos IA declarada do que usou: commits feitos pelo próprio agente aparecem na linha do agente." Escreva também a tradução em inglês.
- [ ] **Step 6: CSV.** Adicione só as colunas por repositório novas, por meio do mesmo `COLUMNS`. **Não** inclua nada de `students`. Teste manual: exporte e confira que não aparece nenhum login.
- [ ] **Step 7: Verificar:**
  - `npm test && npm run lint && npm run build`.
  - `npm run dev`, depois `/turma` com token e `assertlab/bisolhador` sozinho. Esperado: a linha já vem expandida e a subtabela mostra os autores.
  - Rodar com 3 repositórios. Esperado: as linhas vêm fechadas e expandem.
  - O GA continua desligado em `/turma` (nenhum hit de `collect` na aba de rede).
- [ ] **Step 8: Commit:** `git commit -m "feat(ai): AI columns and per-student view in Classroom mode"`

---

### Task 7: Guia "Como interpretar"

**Files:**
- Modify: `src/utils/indicatorGuide.js`, `src/locales/pt.json`, `src/locales/en.json`, `src/utils/indicatorGuide.test.js` (se precisar ajustar contagens)

**Interfaces:**
- Produces: a seção `{ id: 'ai', items: [ai-tools, ai-config-depth, ai-commits, ai-prs, ai-review, ai-safeguards, ai-coherence, ai-badge] }`, todos com `chaoss: []` e `relation: 'none'`, inserida depois de `governance`. Chaves `guide.sections.ai` e `guide.items.<id>.{name, what, read, limits, chaossNote}`.

- [ ] **Step 1: Rodar `npx vitest run src/utils/indicatorGuide.test.js`** depois de adicionar a estrutura sem textos. Esperado: falha, porque o teste de estrutura exige textos nos dois locales.
- [ ] **Step 2: Escrever os textos.** Cada `limits` precisa dizer:
  - que o dado é limite inferior e o que a fonte não enxerga (autocomplete, ferramenta sem trailer, bots-agente pessoais);
  - no Modo Turma, a configuração é verificada só na raiz e nos diretórios conhecidos, enquanto o Dashboard procura `CLAUDE.md`/`AGENTS.md` em qualquer nível;
  - o desacordo não detecta edição de mensagens, só incoerência;
  - o selo mede práticas, não caráter.

  Nos itens existentes `review-coverage`, `lead-time`, `first-review`, `pr-size` e `divergence`, acrescente ao `limits` uma frase dizendo que PRs abertos por agentes de IA ficam de fora e aparecem em "IA no Processo".
- [ ] **Step 3: Rodar** `npx vitest run src/utils/indicatorGuide.test.js` → PASS. Abra `/guia#ai-badge` no dev server.
- [ ] **Step 4: Commit:** `git commit -m "docs(guide): AI in the Process indicators"`

---

### Task 8: Documentação, versão e fluxo de revisão

**Files:**
- Modify: `AGENTS.md`, `README.md`, `docs/CHANGELOG.md`, `package.json`, `package-lock.json`

- [ ] **Step 1: AGENTS.md**
  - **Folder Structure:** acrescente `aiRegistry.js`, `aiTraces.js`, `aiProcess.js`, `aiClassroom.js` e `components/ai/`.
  - **Classroom Mode:** visão por estudante de IA; +1 consulta de contexto por repositório; +1 de autoria quando há configuração.
  - **Error Handling:** contexto de IA em `SELF_EXPLAINED`, sem bloquear a persistência.
  - **Decisões Arquiteturais:** nova entrada datada de 2026-10-26, decidida pelo mantenedor. A visão por estudante de IA no Modo Turma é exceção à regra de não nomear autores, restrita a essa visão. Nada de IA por pessoa no Dashboard nem no snapshot. Desacordo só por repositório. O selo fica fora do Ranking e nunca é por estudante. Indicadores de revisão continuam só com humanos.
  - **Token System:** a frase "Bots … are excluded" passa a dizer que agentes de código são medidos à parte, em `aiProcess`.
- [ ] **Step 2: Versão e textos públicos**
  - `package.json` → `3.15.0`;
  - `npm install --package-lock-only`;
  - entrada `## [3.15.0]` no CHANGELOG;
  - `### v3.15.0 - IA no Processo` no README, porque `scripts/release-notes.mjs` lê esse título.
- [ ] **Step 3: Fluxo do AGENTS.md:** `/code-review`, `/simplify` e `/security-review` sobre o diff da branch. O security review se justifica porque o diff toca GitHub API, dados de estudantes e persistência. Corrija achados altos e críticos.
- [ ] **Step 4: Verificação final:** `npm test && npm run lint && npm run build && npm run smoke:csp` (com `SMOKE_SNAPSHOT_ID=893`) → tudo verde. Copie a saída para o relatório.
- [ ] **Step 5: Commit, push e PR:** `git commit -m "docs: AI in the Process (v3.15.0)"`, depois `git push -u origin feat/ia-no-processo` e `gh pr create`. Nunca dar merge.
