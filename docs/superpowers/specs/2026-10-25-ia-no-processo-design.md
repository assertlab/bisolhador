# IA no Processo — desenho

Data: 2026-10-25 · Branch: `feat/ia-no-processo` · Status: aguardando aprovação do mantenedor

## 1. Intenção

O desenvolvimento assistido por IA cresceu, e quem usa o Bisolhador (professores e estudantes de engenharia de software) quer saber **se e como** a IA participou do processo de um repositório. O GitHub não diz se um código foi escrito por IA. Ele guarda **rastros**: arquivos de configuração de agentes, coautoria declarada em commits, PRs abertos por agentes e revisões feitas por bots de IA.

A seção **"IA no Processo"** (*AI in the Process*) mostra esses rastros e responde a três perguntas:

1. **Adoção declarada:** o projeto orienta agentes de IA? Com quais ferramentas?
2. **Participação visível:** que fração dos commits e PRs tem um agente como autor ou coautor?
3. **Salvaguardas:** o que a IA produziu passou por revisão humana?

O foco é **processo**, não "quanto código é IA". A terceira pergunta é a que mais interessa para o ensino: a IA vira um caso do que o Bisolhador já mede (revisão, tamanho de PR), não um placar à parte.

## 2. Princípio central: limite inferior

Tudo nesta seção é **limite inferior**. "Nenhum rastro" nunca aparece como "não usa IA": o autocomplete do Copilot não deixa marca, e trailers de coautoria dependem da ferramenta e da configuração de quem commita. É a mesma regra do projeto de que "não medido ≠ zero", aplicada aqui como "sem rastro ≠ sem IA".

Consequências:
- O rótulo de um resultado vazio é "Nenhum rastro de IA encontrado", com uma explicação. Nunca "0% IA" sem contexto nem "Não usa IA".
- Toda fração mostra o n ("12 de 100 commits").
- Na visão por estudante (Modo Turma), um aviso fixo explica que só aparece o uso **declarado**, que ausência de declaração não significa ausência de uso, e que o indicador não deve ser usado como nota (ver §7.3).

## 3. Objetivos, não-objetivos e antiobjetivos

**Objetivos (fase 1)**
- Dashboard: seção "IA no Processo" com ferramentas detectadas (com a origem da evidência), cobertura em commits, cobertura em PRs, revisão por IA e salvaguardas.
- Modo Turma: colunas de IA por repositório, detalhe por estudante ao expandir a linha (aberto por padrão quando há um único repositório) e colunas por repositório no CSV.
- Snapshot persistido com método versionado; snapshots antigos mostram "não registrado nesta análise".
- Guia "Como interpretar" com uma entrada por indicador novo.
- **Zero requisições novas** no Dashboard; no Modo Turma, no máximo campos a mais em consultas que já existem.

**Não-objetivos (agora)**
- Ler o conteúdo dos workflows de CI (item 5 da conversa). Pode voltar como fase 2, só com token, numa única consulta GraphQL com aliases.
- Ler a descrição (corpo) dos PRs em busca de marcadores como "🤖 Generated with Claude Code": deixa a resposta mais pesada.
- Comparar IA no Benchmark, na Timeline ou no Ranking. Os dados vão para o snapshot, então isso pode vir depois.
- Copilot Metrics API (organização, exige admin).

**Antiobjetivos (seria um fracasso mesmo funcionando)**
- **Detector de cola.** Não detectar IA pelo conteúdo do código (não há método confiável) e não apresentar a visão por estudante como acusação ou nota.
- **Atribuir uso a quem não declarou.** Nada de heurísticas de estilo, de horário ou de volume.
- **Punir a transparência sem avisar.** Quem declara aparece e quem não declara não aparece. A tela precisa dizer isso.
- **Enviar dados por estudante para fora do navegador.** Sem Supabase, sem GA e sem CSV por estudante.

## 4. Fontes de evidência

| Fonte | Dashboard | Modo Turma | Custo |
|---|---|---|---|
| Arquivos de configuração | árvore recursiva já buscada (`repoTree.js`) | entradas da raiz e de `.github/` na consulta de histórico já existente | zero / campos a mais |
| Coautoria em commits | amostra REST de commits recentes (`GITHUB_PER_PAGE_COMMITS` = 100) | histórico do período (`fetchCommitHistoryInPeriod`, já traz `message` e autor) | zero |
| Autoria de PR por agente | amostra GraphQL de PRs mesclados (com token) ou REST de PRs fechados (sem token) | PRs mesclados no período (`fetchMergedPullRequestsInPeriod`) | zero |
| Revisão por IA | `reviews`/`comments` da amostra GraphQL (com token) | `reviews` da consulta do período | zero |

Sem token, a revisão por IA fica "n/d" com a explicação que já existe para os outros indicadores de revisão. As demais fontes funcionam sem token.

### 4.1 Registro de ferramentas

Um único módulo de dados, `src/utils/aiTraces.js`, com um registro declarativo por ferramenta. Cada entrada traz `id`, `label`, `configPatterns` (regex sobre caminhos), `coauthorEmails` (regex sobre o e-mail do trailer), `agentLogins` (autores de PR) e `reviewerLogins` (revisores e comentaristas). As regras de detecção são funções puras sobre esse registro e têm testes.

**Regra de coautoria:** casa pelo **e-mail** do trailer `Co-authored-by:` (sem diferenciar maiúsculas de minúsculas), nunca só pelo nome, porque qualquer pessoa pode escrever "Co-authored-by: Copilot". O nome do modelo varia ("Claude Opus 5.5", "aider (ollama/…)") e é ignorado.

`AGENTS.md` é um padrão compartilhado por várias ferramentas: aparece como **"Agentes (genérico)"** e não é atribuído a nenhuma ferramenta.

**Regra de login:** a REST devolve logins de bot com sufixo `[bot]` (`coderabbitai[bot]`) e a GraphQL devolve sem sufixo e com `__typename: "Bot"` (`coderabbitai`). O registro guarda o login **sem** o sufixo, e a comparação remove `[bot]` antes de comparar. O agente de código do Copilot aparece como login `Copilot`, tipo `Bot`.

**Registro inicial** (✓ = confirmado em dados reais em 2026-10-25, ver §4.2; ○ = nome de arquivo pela documentação da ferramenta, a conferir na implementação):

| Ferramenta | Configuração (○) | Coautoria (e-mail do trailer) ✓ | Autor de PR (login) | Revisor (login) |
|---|---|---|---|---|
| Claude | `CLAUDE.md` (qualquer nível), `.claude/` | `noreply@anthropic.com` | `claude` ✓ | `claude` ✓ |
| GitHub Copilot | `.github/copilot-instructions.md`, `.github/instructions/*.instructions.md`, `.github/prompts/` | `<id>+Copilot@users.noreply.github.com` | `Copilot` ✓ | `copilot-pull-request-reviewer` ✓ |
| Cursor | `.cursorrules`, `.cursor/rules/` | `cursoragent@cursor.com` | ? (busca falhou) | `cursor` ✓ (Bugbot) |
| OpenAI Codex | — (usa `AGENTS.md`) | `codex@openai.com`, `noreply@openai.com` | `chatgpt-codex-connector` ✓ (raro) | `chatgpt-codex-connector` ✓ |
| Gemini | `GEMINI.md`, `.gemini/` | `noreply@google.com` **e** nome contém "Gemini" | — | `gemini-code-assist` ✓ |
| Aider | `.aider.conf.yml` | `aider@aider.chat` | — | — |
| Devin | — | `<id>+devin-ai-integration[bot]@users.noreply.github.com` | `devin-ai-integration` ✓ | — |
| Jules | — | `<id>+google-labs-jules[bot]@users.noreply.github.com` | `google-labs-jules` ✓ | — |
| Windsurf | `.windsurfrules`, `.windsurf/rules/` | `cascade@windsurf.ai`, `<id>+windsurf-bot[bot]@…` | — | — |
| JetBrains Junie | `.junie/guidelines.md` | `junie@jetbrains.com`, `junie@air.dev` | — | — |
| Amp | — (usa `AGENTS.md`) | `amp@ampcode.com` | — | — |
| Kiro | `.kiro/steering/` | `noreply@kiro.dev` | — | — |
| Cline | `.clinerules` | `noreply@cline.bot`, `<id>+cline-cloud[bot]@…` | — | — |
| opencode | `opencode.json` | e-mail genérico `ai@local` **e** nome começa com "opencode" | — | — |
| CodeRabbit | `.coderabbit.yaml` | — | — | `coderabbitai` ✓ (comentários) |
| Sourcery | `.sourcery.yaml` | — | — | `sourcery-ai` ✓ |
| Greptile | — | — | — | `greptile-apps` (busca falhou, a conferir) |
| Agentes (genérico) | `AGENTS.md` (qualquer nível), `.mcp.json` | — | — | — |

O registro é dado, não lógica. Uma ferramenta nova é uma entrada nova com teste, sem mudar os detectores. Quando o e-mail é genérico (`noreply@google.com`, `ai@local`), a entrada exige **e-mail e nome**, para não confundir com outros commits que usem o mesmo e-mail.

### 4.2 Reconhecimento feito (2026-10-25)

Os formatos de coautoria e os logins marcados com ✓ foram conferidos pela busca do GitHub em commits e PRs públicos reais (`search/commits` por trailer, `search/issues` com `author:app/…`, `reviewed-by:app/…` e `commenter:app/…`). Ficaram de fora ou sem confirmação:
- **Sufixo `(aider)` no nome do autor** (formato antigo do Aider): não confirmado; entra só o e-mail.
- **Cursor como autor de PR** e **Greptile como revisor**: a busca falhou (timeout/limite). Conferir na implementação; se não confirmar, não entra.
- **Nomes de arquivo de configuração**: tirados da documentação das ferramentas, não da busca. Conferir cada um na implementação (busca de código ou repositório de exemplo).
- **Bots-agente pessoais** (apps próprios, como `fulano-agent[bot]`, vistos em commits com "🤖 Generated with Claude Code"): não dá para classificar pelo login. Contam como bots de manutenção. É um limite declarado no guia.

Quem implementar deve repetir a conferência para qualquer ferramenta nova. Os trailers coletados viram fixtures de teste.

## 5. Indicadores

### 5.1 Ferramentas detectadas
Uma lista de ferramentas, cada uma com selos da **origem**: `config`, `commit`, `PR` ou `revisão`. Árvore truncada ou indisponível: a origem `config` vira "?" (não verificado), como nos detectores de maturidade.

### 5.2 Cobertura em commits
`commitsComIA / commitsAnalisados`, com os dois números visíveis. Base: commits sem merge (no máximo 1 pai), **incluindo** commits de bots-agente (um commit cujo autor é `claude[bot]` ou `Copilot` conta como IA) e excluindo bots de manutenção (Dependabot, Renovate, github-actions). Também mostra a data do primeiro rastro na amostra ("primeiro rastro na amostra: 12/03/2026"), dizendo que é o primeiro **na amostra**, não no repositório.

### 5.3 Cobertura em PRs
Sobre os PRs mesclados da amostra (o mesmo conjunto buscado hoje, mas sem descartar agentes):
- **PRs de agentes:** `PRs cujo autor é agente / (PRs de humanos + PRs de agentes)`. Bots de manutenção ficam fora do numerador e do denominador.
- **PRs com revisão de IA:** fração dos PRs com pelo menos uma revisão ou comentário de um revisor de IA (só com token).

### 5.4 Salvaguardas (só com token e com amostra mínima)
- **PRs de agentes mesclados sem aprovação humana:** mesma regra de "aprovação" do indicador atual (`APPROVED` antes do merge, de alguém que não é o autor e não é bot). O número é mostrado mesmo com n pequeno, sempre com o n.
- **Tamanho mediano: PRs de agentes × PRs de humanos:** só quando os dois grupos têm n ≥ `AI_MIN_GROUP` (constante nova; minha sugestão é 5).

## 6. Bots: manutenção × agentes de código

Hoje `isBot` (`contributors.js`) descarta qualquer bot de **todos** os indicadores de revisão, PR e commit. Esta feature cria uma classificação `botKind(author)` → `'maintenance' | 'agent' | 'reviewer' | null`, com `agent`/`reviewer` vindos do registro e o resto dos bots como `maintenance`.

Só a seção de IA usa essa classificação. Os indicadores de revisão, PR e commit existentes continuam descartando todos os bots, como hoje (decisão do mantenedor, §11). A seção de IA explica isso, e o guia dos indicadores de revisão ganha uma frase dizendo que PRs de agentes ficam de fora e onde vê-los.

## 7. Interface

### 7.1 Dashboard
Uma seção nova "IA no Processo", depois de saúde, maturidade e bus factor (posição exata a cargo de quem implementar, seguindo o padrão visual de `MaturityCard`), com:
- ferramentas detectadas (selos de origem);
- três números: cobertura em commits, PRs de agentes e PRs com revisão de IA;
- bloco de salvaguardas;
- uma nota fixa de limite inferior;
- `GuideLink` para cada indicador.

O PDF e o JSON incluem a seção, que vem do mesmo `report`.

### 7.2 Modo Turma: tabela
Três colunas novas por repositório: **Ferramentas IA** (ícones ou siglas com legenda), **% commits com IA** e **% PRs de agentes**. Cada linha pode ser expandida (botão acessível, `aria-expanded`). Com um único repositório, a linha já vem expandida.

### 7.3 Modo Turma: detalhe por estudante
Uma subtabela por autor de commit do período: autor (login, ou "autor não identificado" quando o commit não está ligado a uma conta), commits, commits com IA declarada (n e %) e ferramentas. Commits sem login **não** são agrupados por nome, para não adivinhar identidades: todos vão para uma única linha "não identificado".

Aviso fixo, acima da subtabela (texto final nos locales):
> Mostra só o uso de IA **declarado** nos commits (coautoria). Quem não declara não aparece aqui, então ausência de registro não significa ausência de uso. Não use este dado como nota ou prova.

O CSV recebe só as colunas por repositório. **O detalhe por estudante não vai para o CSV** (decisão minha, §10).

## 8. Snapshot e método

- Chave nova no `report`: `aiProcess`, com `method: 'ai-traces-v1'`, `registryVersion` (data do registro) e os campos de §5 (`n` sempre presente).
- `normalizeSnapshotAiProcess(report)`, no padrão dos normalizadores existentes, chamado em `useSnapshot`: sem `method` atual → `{ available: false, reason: 'snapshot' }` → "não registrado nesta análise".
- A falha de uma fonte de IA **não** bloqueia a persistência (não entra em `PERSIST_BLOCKERS`). O indicador correspondente fica `available: false, reason: 'error'`.
- Classificar uma ferramenta nova no registro muda os números de análises futuras. Por isso o snapshot grava `registryVersion`.

## 9. Guia "Como interpretar"

Uma nova seção `ai` em `GUIDE_SECTIONS`, com itens `ai-tools`, `ai-commits`, `ai-prs`, `ai-review` e `ai-safeguards`, todos `relation: 'none'` (não encontrei métrica CHAOSS equivalente; conferir na implementação). Os textos em `guide.items.<id>` nos dois locales precisam dizer o limite inferior e o que cada fonte não enxerga.

## 10. Decisões tomadas

**Do mantenedor (nesta conversa):**
- Nome da seção: "IA no Processo".
- Fase 1 = configuração + autoria de PR + revisão por IA + coautoria em commits. Workflows de CI ficam fora (custo de rate limit).
- Indicadores de revisão existentes continuam só com humanos; agentes são medidos só na seção de IA (aditivo, minor).
- Modo Turma mostra detalhe por estudante, disponível ao expandir a linha, mesmo com vários repositórios. Isso é uma **exceção** à regra atual de não nomear autores no Modo Turma, restrita a esta visão e registrada no AGENTS.md (§ Decisões Arquiteturais) como decisão do mantenedor.

**Minhas (conferíveis):**
- Detalhe por estudante fora do CSV.
- Coautoria casada por e-mail, não por nome.
- `AGENTS.md` como "Agentes (genérico)".
- Commits sem login não agrupados por nome.
- `AI_MIN_GROUP = 5` para comparar tamanho de PR.
- Falha de IA não bloqueia a persistência.

## 11. Pendências e decisões da revisão independente

**Decidida pelo mantenedor (2026-10-25): não.** Os indicadores de revisão existentes (lead time, cobertura de revisão, primeira revisão, tamanho de PR, divergência, no Dashboard e no Modo Turma) continuam medindo **só PRs de humanos**, sem mudança de `method`. A seção de IA mede os PRs de agentes à parte (§5.3/§5.4). A mudança é aditiva → **minor**.

**Resolvidas por mim (conferíveis):**
- **Amostra dos indicadores de PR de IA (§5.3/§5.4):** a mesma varredura de hoje (`MERGED_PR_SCAN` = 100 mesclados, por atualização). Dela, sem os bots de manutenção, ficam os `MERGED_PR_SAMPLE` = 50 mais recentes por data de merge, **humanos e agentes juntos**, recalculados à parte da amostra só-humanos. Assim agentes e humanos ficam na mesma janela de tempo na comparação de tamanho. No Modo Turma: todos os PRs mesclados no período, sem os bots de manutenção.
- **Commits com autor agente no Modo Turma (§7.3):** o commit cujo autor é um bot-agente (`Copilot`, `claude[bot]`, `devin-ai-integration[bot]`…) ganha uma linha própria por agente ("Copilot (agente)") e conta como IA. Ele **não** é atribuído ao estudante coautor nem ao committer, para não adivinhar identidades. As linhas somam o total do repositório. Limite declarado no aviso: quem usa agentes na nuvem pode aparecer com menos IA declarada do que usou. Hoje esses commits somem (`classroom.js:69` descarta bots); passam a contar só na visão de IA, e os indicadores atuais de commit continuam como estão.
- **Configuração no Modo Turma (§4):** a consulta de histórico ganha aliases `object(expression: "HEAD:<dir>")` para a raiz e para cada diretório do registro (`.github`, `.github/instructions`, `.github/prompts`, `.cursor/rules`, `.kiro/steering`, `.windsurf/rules`, `.junie`, `.claude`, `.gemini`). A busca por `CLAUDE.md`/`AGENTS.md` "em qualquer nível" fica só no Dashboard (árvore recursiva), e o guia registra a diferença. No Modo Turma, "nenhuma configuração" quer dizer "nenhuma nos locais verificados".
- `botKind` de logins que são autor e revisor ao mesmo tempo (`claude`, `chatgpt-codex-connector`): decidido pelo contexto (autor do PR = agente; review/comentário = revisor).

## 12. Testes e documentação

- Testes unitários (Vitest) colocados junto ao código: detecção por caminho, por trailer (variações de caixa e de nome de modelo, e-mail falso com nome "Copilot"), `botKind`, coberturas com n = 0, árvore truncada → "?", normalizador de snapshot e visão por estudante (agrupamento, "não identificado").
- Fixtures com trailers reais coletados no reconhecimento (§4.2).
- Atualizar: AGENTS.md (Architecture, Folder Structure, Classroom Mode, Decisões), README, guia (dois locales), CHANGELOG e versão. Minor (comportamento novo e aditivo; nenhum indicador existente muda de método).
- Fluxo do AGENTS.md: `/code-review`, `/simplify`, `/security-review` (toca integração com o GitHub, dados de estudantes e persistência), lint e build.
