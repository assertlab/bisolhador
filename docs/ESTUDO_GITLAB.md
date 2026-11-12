# Estudo: GitLab como fonte de análise no Bisolhador

> Estado: **estudo e plano**, nada implementado. Data: 2026-11-11, com as medições da Fase 0 em 2026-11-12 (base: `main` em `e97140c`).
> Referências `arquivo:linha` valem para esse commit e podem ter se deslocado depois.

## Contexto e decisões

Hoje o Bisolhador só analisa repositórios do GitHub. Disciplinas e equipes que usam GitLab (gitlab.com ou uma instância institucional) ficam de fora. Este documento levanta o que no código depende do GitHub, verifica se a API do GitLab cobre os indicadores sem backend e propõe um plano em fases.

Decisões do mantenedor (2026-11-11):

- **Instâncias aceitas:** gitlab.com mais uma **lista fixa definida no build**. A CSP continua restrita, sem `connect-src https:` aberto.
- **Primeira entrega:** **Dashboard (análise ao vivo) e Turma (`/turma`)**. Histórico (snapshots no Supabase, Ranking, Timeline e Benchmark) fica para uma fase posterior.
- **Implementação:** um PR por fase, sempre seguindo o fluxo do `AGENTS.md` (sem merge automático).

Decisão de 2026-11-12:

- **Token:** só token **legado** com `read_api`. Tokens fine-grained (beta) ficam fora da 1ª entrega (seção 2.1).
- **Visibilidade `internal` = privado.** Um projeto GitLab só conta como público com `visibility: public`. `internal` e `private` seguem a regra dos repositórios privados do GitHub: o Dashboard recusa, só a Turma analisa (ao vivo, com o token de quem usa) e nada vai para o Supabase. Visibilidade ausente ou desconhecida bloqueia a análise (fail-closed). Motivo: `internal` restringe o conteúdo a quem tem login na instância, e gravar as métricas desses projetos num banco público expõe o que a instância protege. A análise de um projeto só de aluno é feita pela Turma com uma lista de 1 projeto.

---

## 1. Diagnóstico: onde o código depende do GitHub

### 1.1 Camada de dados

- `src/services/githubService.js` tem cerca de 30 fetchers e usa REST v3, GraphQL (só com token), Search API e `/stats/*`.
  - A **Search API** fornece as contagens de issues, PRs e merges (`fetchSearchCount`).
  - Os **`/stats/*`** (participation, punch_card, code_frequency, contributors) têm a semântica 202/204/422 traduzida em `COMPUTING`/`TOO_LARGE`/`FAILED` (`fetchStats`).
- `src/hooks/useRepository.js` dispara **19 chamadas em `Promise.allSettled`, lidas por índice posicional**: `results[10]`, `results[15]` e outros, em `useRepository.js:177-207,283-288`.
  - O mapeamento entre posição e nome está em `endpointNames`.
  - Adicionar, remover ou trocar uma fonte exige reindexar tudo.
  - O hook também cuida de `SELF_EXPLAINED`, `PERSIST_BLOCKERS` e `_warnings`.

**Utils que leem o formato bruto do GitHub.** Qualquer adaptador precisa ficar antes deles:

| Arquivo | O que lê |
|---|---|
| `src/utils/contributors.js` | `peopleFromStats` (`author.login`, `weeks[].{w,c}`), `peopleFromContributors`, `isBot` (sufixo `[bot]`, `type === 'Bot'`) |
| `src/utils/activityStats.js` | tuplas `[day,hour,n]` do punch card, `[week,add,del]` do code_frequency, `participation.all` |
| `src/utils/projectPractices.js` | `workflow_runs[].{event,conclusion}`, `ciRunsForBranch` (`head_branch`, `merge_group`, `gh-readonly-queue/`), commit REST, releases REST |
| `src/utils/repoTree.js`, `analyzers.calculateHealthScore` | `tree[].path`/`truncated`, community profile `files.*` |
| `src/utils/prReviewStats.js` (`analyzeLeadTime`) | PR REST (`merged_at`, `created_at`, `user`) |
| `src/utils/aiProcess.js` (`parseAiRepoContext`) | aliases da query GraphQL `fetchAiRepoContext` |
| `src/components/ActivityLogs.jsx`, `src/report/repoReportModel.js` | commit e PR REST brutos guardados em `report.recentCommits` / `report.recentPRs` |

`recentCommits` e `recentPRs` também são gravados dentro do `full_report`, então o formato do GitHub já faz parte dos dados persistidos.

**Já são neutros e podem ser reaproveitados sem mudança:**

- `toPullRequestStats` (o modelo interno de PR), usado por `analyzeReviewMetrics`, `analyzeAiPrs` e `analyzeAiSafeguards`;
- o formato `AiCommit` (`aiProcess.js`, com os adaptadores `fromRestCommit`/`fromGraphqlCommit`);
- `analyzeBranches` (`{name, committedDate, protected}`);
- `analyzeTagCadence` (`{total, dates}`);
- `busFactor.js`, `analyzeContributors`, `classroomMaturity`;
- `CI_PATTERNS` em `repoTree.js`, que já reconhece `.gitlab-ci.yml`.

### 1.2 Identidade do repositório

O app inteiro trabalha com a string `owner/repo`.

- `parseSafeRepoName` (`src/utils/repoName.js:12`) exige **exatamente 2 segmentos**. Isso barra grupos aninhados do GitLab (`grupo/subgrupo/projeto`), e esse parser é a barreira de segurança das rotas.
- Vários lugares fazem `split('/')` e descartam segmentos sem avisar:
  - `useRepository.js:97,118`
  - `Benchmark.jsx:103,145,382`
  - `useClassroomAnalysis.js:20`
  - `Classroom.jsx:89`
  - `classroom.js:26-29`, que só remove o prefixo `github.com/` e corta em 2 segmentos com `slice(0, 2)`: `gitlab.com/g/sub/p` vira `gitlab.com/g`
- `RepoInfoCard.jsx:33,44,66` monta nomes de arquivo com `replace('/', '-')`, que troca só a primeira barra.
- A validação é só `includes('/')` em `useRepository.js:85,409` e `Benchmark.jsx:80`.
- A rota `/timeline/:owner/:repo` (`App.jsx:63`) é fixa em 2 segmentos.

### 1.3 Persistência (Supabase)

- `analytics_searches` não tem coluna `provider` nem `host`.
- `registrar_busca`, `buscar_snapshot_por_data`, `get_repo_history` e `get_leaderboard` (`supabase-migrations/`) filtram e agrupam por `LOWER(repo_name)`, então `gitlab.com/foo/bar` se misturaria com `github.com/foo/bar`.
- `obter_snapshot` e o DDL da tabela não estão versionados no repositório.
- As colunas planas `subscribers`, `owner_type` (User/Organization) e `health_score` (community profile) têm semântica do GitHub.
- **Na 1ª entrega não há colisão:** a Turma nunca grava (decisão já registrada no `AGENTS.md`) e o Dashboard do GitLab também não vai gravar (seção 3).

### 1.4 Token, CSP, URLs e textos

**Token**
- Existe uma única chave `localStorage['github_token']` (`SettingsModal.jsx`, `githubService.getHeaders`).
- Os links para criar token apontam para o GitHub: `HelpModal.jsx:48` e `settings.createToken.link` nos locales.

**CSP** (`index.html:48`)
- `connect-src` só permite `https://api.github.com` (mais Supabase e GA).
- `img-src` só permite `avatars.githubusercontent.com`.
- A CSP é uma meta tag estática servida pelo GitHub Pages, sem headers. Toda instância GitLab precisa entrar nela no build.

**URLs `https://github.com/` fixas no código**
- `useRepository.js:314` (`report.url`, que também vai para o PDF)
- `snapshotAdapter.js:29`
- `Ranking.jsx:101`
- `Classroom.jsx:322`
- `HelpModal.jsx:48`

**i18n**
- "GitHub" aparece 57× em `pt.json`, 29× em `guide.pt.json`, 15× em `aiGuide.pt.json` e 8× em `report.pt.json` (contagem no idioma pt; o en é equivalente).
- Boa parte desses textos explica métricas que só existem no GitHub: Actions, community profile, o estado "computando" (202) dos `/stats`, o Approve formal e o GitHub Classroom.

**Convenções do GitHub embutidas na lógica**
- bots com sufixo `[bot]`;
- `github-classroom[bot]` (`aiRegistry.js`, `aiClassroom.js`, e por e-mail em `CLASSROOM_BOT_EMAIL`/`isClassroomCreated` no `aiProcess.js:50-59`);
- e-mails `users.noreply.github.com` nos co-autores de IA (`aiRegistry.js`);
- caminhos `.github/workflows`, `.github/ISSUE_TEMPLATE` e `.github/copilot-instructions.md`.

**`exportJson.js`**: os metadados não têm `provider` nem `source`.

---

## 2. Viabilidade da API do GitLab

Testado em 2026-11-11 com chamadas anônimas a gitlab.com, enviando `Origin` de um domínio `github.io`. O projeto de teste foi `gitlab-org/gitlab-runner`. Os itens marcados **[verificado]** vêm desses testes, não só da documentação.

### 2.1 Transporte

| Tema | Achado |
|---|---|
| CORS | **Funciona no browser.** `/api/*` (REST e GraphQL) responde `Access-Control-Allow-Origin: *` sem credenciais, e o preflight aceita `PRIVATE-TOKEN`/`Authorization` **[verificado]**. A configuração é do próprio GitLab (`Rack::Cors`), então instâncias self-hosted seguem o mesmo padrão, **a menos que um proxy reverso na frente remova os headers**. Isso precisa ser validado em cada instância da lista. |
| Headers legíveis | `Link`, `X-Total`, `X-Total-Pages`, `X-Next-Page` etc. ficam expostos. **`RateLimit-*` não fica exposto**: o SPA só consegue tratar o 429. |
| Autenticação | `PRIVATE-TOKEN: <pat>` ou `Authorization: Bearer`. Escopo mínimo: `read_api` em token **legado**. 401 = token inválido; 403 `insufficient_scope` = falta escopo. |
| Tokens fine-grained | **Não suportados na 1ª entrega.** Estão em beta: o GitLab desaconselha o uso em produção, a cobertura é de cerca de 75% dos endpoints REST e o GraphQL depende dos feature flags `granular_personal_access_tokens` e `granular_personal_access_tokens_for_graphql` ligados na instância. Como o plano usa GraphQL para flags de metadados, aprovações, `diffStatsSummary` e `repository.blobs`, um token fine-grained daria 403 em parte das chamadas, e esse 403 seria indistinguível de falta de membership. O texto de ajuda e o link de criação de token (`SettingsModal`, `HelpModal`, locales) apontam para o **token legado com `read_api`**. Reavaliar quando o recurso sair do beta. |
| Validação do token | `GET /api/v4/personal_access_tokens/self` devolve `scopes`, `expires_at`, `active` e `revoked`. O `SettingsModal` usa isso ao salvar o token para avisar se falta `read_api`, se o token expirou ou se está perto de expirar. |
| Rate limit em gitlab.com (hoje) | Anônimo: **500 req/min por IP** **[verificado]**. Autenticado: 2.000 req/min. Search: 100/min. |
| Rate limit proposto pela GitLab | Anônimo cairia para **60 req/h por IP**, sem data confirmada. Se isso entrar em vigor, o token vira praticamente obrigatório, como no GitHub. |
| Contagens | `X-Total` com `per_page=1` substitui o truque do header `Link`. **Ausente acima de 10k registros** e em `/repository/commits` e `/pipelines` **[verificado]**. |
| ID do projeto | Path completo em URL-encoding, com subgrupos: `projects/grupo%2Fsub%2Fprojeto`. |
| GraphQL | `POST /api/graphql`, funciona sem token em projeto público **[verificado]**. Complexidade máxima de 200 (anônimo) ou 250, então as queries precisam ser pequenas. |

### 2.2 Mapeamento por indicador

| Indicador | Fonte GitLab | Situação |
|---|---|---|
| Metadados (estrelas, forks, descrição, licença, branch padrão, datas, visibilidade) | `GET /projects/:id?license=true` + GraphQL `project{archived openIssuesCount issuesEnabled mergeRequestsEnabled}` | ✅ O REST anônimo vem **reduzido** (sem `archived`, `*_access_level`, `forked_from_project`) **[verificado]**, por isso os flags vêm pelo GraphQL. `pushed_at` vira `last_activity_at`, que é atualizado no máximo de hora em hora. |
| Watchers | Não existe | ❌ N/A com motivo |
| Linguagens | `/languages` | ✅ Vem em **percentual**, não em bytes **[verificado]** |
| Issues abertas/fechadas | `/issues_statistics` (1 chamada) **[verificado]** | ✅ |
| PRs (MRs) e merges | `/merge_requests?state=…&per_page=1` → `X-Total` **[verificado]** | ✅ |
| Lead time | MRs merged (`created_at`, `merged_at`) | ✅ |
| Code review (merge sem aprovação) | GraphQL `mergeRequests{approvedBy{nodes{username bot}} author{username bot}}`; REST `/merge_requests/:iid/approvals` existe em todos os tiers **[verificado]** | ✅ |
| Tempo até a 1ª revisão, divergência | `/notes`, `/discussions` | ⚠️ REST dá 401 sem token, mas o **GraphQL devolve `notes` sem token** em projeto público (50 MRs × 50 notas numa consulta, dentro do limite de complexidade) **[verificado]**: usar o GraphQL. O GitLab não tem objeto "review": aproximar pela 1ª nota ou aprovação de alguém que não seja o autor. Exige `method` próprio. |
| Tamanho do MR | GraphQL `diffStatsSummary{additions deletions}` **[verificado]** | ✅ |
| Branches e branches zumbis | `/repository/branches` (`protected`, `commit.committed_date`) | ✅ |
| Releases e tags | `/releases`, `/repository/tags` (`X-Total` presente) | ✅ |
| Health score (7 itens) | Não há endpoint de community profile. Listagens **dirigidas e não recursivas**: raiz, `.gitlab/`, `.gitlab/issue_templates/`, `.gitlab/merge_request_templates/`, mais `license`/`readme_url` do projeto | ✅ O `gitlabService` monta os `files.*` no formato do community profile. **Não depender do fallback da árvore**: `mergeProfileWithTree` sem profile só devolve arquivos com a árvore completa, e a árvore GitLab paginada com teto pode vir truncada. As regexes atuais de `repoTree.js` (`ISSUE_TEMPLATE`, `PULL_REQUEST_TEMPLATE`) não reconhecem `issue_templates/` nem `merge_request_templates/`: precisam de padrões próprios do GitLab |
| Árvore do repositório | `/repository/tree?recursive=true`, **paginada em 100 itens** | ⚠️ Repositórios grandes custam N chamadas (o gitlab-runner tem cerca de 19 páginas). Precisa de teto e de `truncated` |
| Contribuidores, bus factor, atividade semanal, punch card, code churn | **Não há `/stats/*`** | ⚠️ Calcular a partir de `/repository/commits?since=<52 semanas>&with_stats=true` (cerca de 1 chamada a cada 100 commits), com teto de páginas e marcação de amostra |
| Login e avatar do autor do commit | REST só traz `author_name`/`author_email`. `/users?search=` dá 403 sem token **[verificado]** | ⚠️ Agrupar por e-mail; login só via MR (GraphQL `author{username}`). Definir um identificador substituto (e-mail ou nome) no campo `login` do formato de contribuidores, senão as entradas de `peopleFromStats` ficam todas com login nulo |
| CI | `/pipelines` (`status`, `ref`, `source`) | ✅ Muda o vocabulário (`push`, `merge_request_event`, `schedule`) |
| Conventional Commits | Commits REST | ✅ |
| IA no Processo | Trailers `Co-authored-by` (campo `trailers` dos commits), usuário `GitLabDuo` (`bot: true`) **[verificado]**, pipelines `source: duo_workflow` **[verificado]**, arquivos de configuração via tree ou GraphQL `repository.blobs` | ⚠️ Precisa de entradas próprias no `aiRegistry` |
| Bots | Tokens de projeto: `project_<id>_bot_<rand>`. GraphQL `UserCore.bot` | ⚠️ Padrão de grupo (`group_<id>_bot_*`) não confirmado na documentação. **`bot` não basta:** a conta `gitlab-dependency-update-bot` (gitlab-runner) vem com `bot: false` **[verificado]**, então a detecção também precisa de padrões de nome |
| Turma: importar organização | `/groups/:id/projects?include_subgroups=true` (`X-Total` presente) | ✅ |
| Turma: commits, MRs e CI no período | `commits?since&until`, GraphQL `mergeRequests(mergedAfter:, mergedBefore:)`, `pipelines?updated_after&updated_before` | ✅ Visão por aluno agrupada por e-mail e nome |
| Turma: origem do template | Não há equivalente ao `github-classroom[bot]` nem ao `templateRepository` | ❌ "Origem não verificada" |
| Total de commits | `statistics` exige papel Reporter ou acima **[verificado]** | ❌ Indisponível sem membership |

### 2.3 Instância institucional: `gitlab.cin.ufpe.br` (Fase 0, testado em 2026-11-11)

Primeira instância da allow-list, indicada pelo mantenedor. Testada sem token, com `Origin: https://assertlab.github.io`:

| Teste | Resultado |
|---|---|
| CORS REST e GraphQL | ✅ `Access-Control-Allow-Origin: *`; o nginx na frente **não remove** os headers |
| Preflight com `PRIVATE-TOKEN` | ✅ Aceito (`access-control-allow-headers: private-token`) |
| Headers expostos | ✅ `Link`, `X-Total`, `X-Total-Pages`, `X-Next-Page` etc., os mesmos do gitlab.com |
| Endpoints REST sem token (`/projects/:id`, `/languages`, `/issues_statistics`, `/merge_requests`, `/repository/branches`, `tags`, `releases`, `commits?with_stats=true`, `tree?recursive=true`, `pipelines`, `contributors`, `/groups`) | ✅ 200 em projeto público |
| Search API sem token | ❌ 401, como no gitlab.com |
| GraphQL: `archived`, `issuesEnabled`, `mergeRequestsEnabled`, `openIssuesCount`, `mergeRequests{mergedAt diffStatsSummary approvedBy{bot} author{bot}}`, `repository.blobs` | ✅ O schema aceita todos os campos (versão nova o bastante para as queries do plano) |
| Versão do GitLab | Não exposta sem token (`/api/v4/version` → 401) |
| Rate limit | Nenhum header `ratelimit-*` nas respostas: os limites da instância são desconhecidos e precisam ser confirmados com quem administra o servidor |
| Tamanho | 193 projetos públicos e 23 grupos visíveis sem token. A maioria dos projetos de disciplina deve ser **privada**, então a Turma vai depender de token na prática |

Observações:
- `/pipelines` devolveu `X-Total` aqui, ao contrário do gitlab.com. O código não deve depender nem da presença nem da ausência desse header.
- Um projeto público testado (`lgpss-in1054/ns3_code`) tem árvore de 4.373 itens, o que equivale a cerca de 44 páginas na listagem recursiva. Isso confirma que o health score não pode depender da árvore completa (seção 2.2).
- Limites de taxa: a página pública `/help/instance_configuration` mostra "–" (limite não ativado) para requisições não autenticadas e para os limites das APIs de arquivos, usuários, grupos e projetos (consultado em 2026-11-12). Isso bate com a ausência de headers `ratelimit-*`. Falta a confirmação da administração, porque um limite no nginx não aparece nessa página.
- Custo medido em projetos reais: seção 2.5.

### 2.4 Conclusão

É viável sem backend. A maioria dos indicadores tem equivalente direto ou pode ser calculada no cliente. Os pontos caros são:

1. As séries semanais e os contribuidores, calculados a partir de commits paginados (mais requisições, resultado amostral).
2. A revisão de MR: o REST de notas exige token, mas o GraphQL serve sem token em projeto público (seção 2.2).
3. Commits sem login nem avatar.

O custo em requisições é maior que no GitHub, principalmente na Turma (até 50 projetos), o que reforça o uso de token.

Fontes:
- https://docs.gitlab.com/api/rest/
- https://docs.gitlab.com/api/rest/authentication/
- https://docs.gitlab.com/user/gitlab_com/rate_limits/
- https://docs.gitlab.com/api/projects/
- https://docs.gitlab.com/api/repositories/
- https://docs.gitlab.com/api/merge_request_approvals/
- https://docs.gitlab.com/api/graphql/
- https://docs.gitlab.com/user/project/settings/project_access_tokens/
- https://docs.gitlab.com/auth/tokens/fine_grained_access_tokens_graphql/
- https://docs.gitlab.com/development/permissions/granular_access/graphql_architecture

### 2.5 Custo medido (Fase 0, 2026-11-12)

Script de medição só de leitura, fora do repositório. Os projetos de aluno são `internal` (visíveis só para quem tem login na instância) e por isso aparecem anonimizados: este repositório é público. Ele chama, em sequência, as fontes que o plano propõe para o Dashboard (seção 2.2) e para a Turma, com **paginação completa, sem teto**, para mostrar o custo real. Na Turma, o período foi de 2026-08-01 a 2026-11-12. Nas medições com token, foi usado um token legado `read_api`.

| Projeto | Modo | Dashboard | Turma (por projeto) | Tempo total |
|---|---|---|---|---|
| Projeto de aluno A (CIn, `internal`) | token | 25 | 4 | 5,6 s |
| Projeto de aluno B (CIn, `internal`) | token | 28 | 4 | 6,5 s |
| Projeto de aluno C (CIn, `internal`) | token | 32 | 4 | 9,8 s |
| A, B e C | sem token | 404 na 1ª chamada | 404 | — |
| `lgpss-in1054/ns3_code` (CIn, público) | sem token | 67 | 4 | 29 s |
| `gitlab-org/gitlab-runner` (gitlab.com) | sem token | 115 | 143 | 240 s |

Para onde vão as requisições:

- **Projetos de aluno (CIn):** 1 chamada para cada fonte de metadados e contagens, mais:
  - a árvore recursiva, com 5 páginas (cerca de 440 itens);
  - 1 página de commits das últimas 52 semanas (15 a 29 commits);
  - 1 chamada REST de notas por MR mergeado (1, 4 e 8 chamadas).
- **gitlab-runner:**
  - notas por MR: 50 chamadas REST, todas com 401 sem token;
  - árvore: 19 páginas;
  - commits de 52 semanas com estatísticas: 24 páginas (2.332 commits);
  - branches: 5 páginas.
  - Na Turma, os commits do período em todas as branches custaram 75 páginas e os pipelines, 56.
- **ns3_code:** 44 das 67 chamadas são a árvore recursiva (4.373 itens).

Achados:

1. **Visibilidade `internal`.** Os 3 projetos de aluno são `internal`: qualquer usuário logado na instância os vê, mas sem token a API responde **404, igual a um projeto inexistente**. O GitHub não tem esse nível de visibilidade. Consequências:
   - Na prática, projeto de disciplina exige token.
   - A mensagem de erro do 404 sem token precisa dizer "não encontrado ou exige login nesta instância".
   - **Decidido em 2026-11-12:** `internal` é tratado como privado (ver "Contexto e decisões"). O Dashboard recusa esses projetos e explica que a análise é feita na Turma.
2. **Notas de MR via GraphQL.** Trocar as chamadas REST por MR (que, sem token, dão 401) por uma consulta GraphQL. A consulta funciona sem token e economiza até 50 chamadas por análise.
3. **CI rodando só em MRs.** O projeto A não tem pipeline de push na `main`: todos rodam com `ref = refs/merge-requests/<iid>/head` e `source = merge_request_event`. Para saber a branch de destino, é preciso cruzar o iid com o MR. Se o indicador de CI do Dashboard contar só pipelines da branch padrão (como faz hoje com o GitHub), esse projeto aparece "sem CI". A Turma precisa do equivalente ao `ciRunsForBranch`.
4. **Configuração de IA não registrada.** Os 3 projetos de aluno têm `.agent/` e `.pi/` na raiz, que parecem configuração de agentes de IA. A ferramenta de cada um ainda não está identificada, e nenhum dos dois está no `aiRegistry`. Verificar antes de registrar, como manda a política do guia de IA.
5. **Bots:** ver a linha "Bots" da seção 2.2 (`bot: false` numa conta de bot).
6. **Latência.** Feitas em sequência, as chamadas levaram de 0,2 a 0,4 s cada no CIn (0,4 s no projeto público sem token, com a árvore grande) e cerca de 0,9 s no gitlab.com, medidos daqui. O `gitlabService` precisa paralelizar as fontes (como o `Promise.allSettled` do GitHub) e ter tetos de paginação. Nos commits, o endpoint não devolve `X-Total`, então não dá para saber de antemão quantas páginas existem. Como a paginação é por offset (`page=N`) e o teto é fixo, dá para pedir as páginas em lotes paralelos e parar no primeiro lote que vier incompleto.

Tetos propostos para `src/constants.js`, com marcação `truncated`/`capped` e o resultado tratado como amostra, nunca como total:

| Constante (proposta) | Valor | Efeito medido |
|---|---|---|
| `GITLAB_TREE_MAX_PAGES` | 10 (1.000 itens) | Os projetos de aluno ficam inteiros; gitlab-runner (19) e ns3_code (44) ficam `truncated`, e os detectores de maturidade já tratam isso como "?". O health score não pode depender dessa árvore: sem community profile, `mergeProfileWithTree` com árvore truncada dá resultado incerto ou nulo. Por isso ele vem das listagens dirigidas da seção 2.2 |
| `GITLAB_COMMIT_MAX_PAGES` | 10 (1.000 commits) | As 52 semanas dos alunos ficam inteiras; gitlab-runner vira amostra (24 → 10) |
| `GITLAB_BRANCH_MAX_PAGES` | 5 | Cobre o gitlab-runner (423 branches) |
| Pipelines na Turma | `CLASSROOM_CI_RUN_PAGES` (3), o mesmo do GitHub | gitlab-runner: 56 → 3 |
| Commits do período na Turma | `CLASSROOM_COMMIT_PAGES` (3), o mesmo do GitHub, para que a amostra de uma turma não dependa da plataforma | Alunos: 1 página; gitlab-runner: 75 → 3 |

Estimativa com esses tetos e notas via GraphQL:
- **Dashboard:** cerca de 25 requisições por projeto de aluno e cerca de 43 no gitlab-runner, contando a consulta GraphQL de notas no lugar das chamadas REST.
- **Turma:** cerca de 4 por projeto de aluno, sem contar o contexto de IA, que ainda não foi medido. Uma turma de 50 projetos fica em cerca de 200 requisições mais o custo da IA (no GitHub, +1 GraphQL por repositório e uma consulta condicional de autoria).

O custo base cabe com folga nos limites atuais do gitlab.com e, ao que tudo indica, do CIn. O custo da IA precisa ser medido na Fase 3. Nada disso cabe nos 60 req/h anônimos anunciados pela GitLab, o que reforça o token.

---

## 3. Arquitetura proposta

1. **`RepoRef` no lugar da string `owner/repo`** (`src/utils/repoName.js`)
   - `parseRepoRef(input)` → `{ provider: 'github' | 'gitlab', host, path, segments }`.
   - Aceita:
     - `owner/repo`, que continua sendo GitHub, como hoje;
     - `gitlab.com/g/sub/p`;
     - `https://<host>/g/sub/p` (inclusive com `/-/tree/...`);
     - `https://github.com/o/r`.
   - Valida cada segmento com um padrão **por provider**: o do GitHub é o atual (`SAFE_GITHUB_NAME_PATTERN`); o do GitLab precisa aceitar caminhos válidos lá, como os que começam com `_` (ex.: `_infra/tool`), e segue as regras de path do GitLab. Valida também o **host contra a allow-list** `GITLAB_HOSTS` (em `src/utils/repoRef.js`), que vem de `VITE_GITLAB_HOSTS` e sempre inclui `gitlab.com`. Host fora da lista: bloqueia (fail-closed).
   - Entrada **sem host** com 2 segmentos continua sendo GitHub; sem host com 3 ou mais segmentos é recusada com mensagem pedindo o host (`gitlab.com/...`), sem adivinhar.
   - `parseSafeRepoName` continua valendo para o GitHub e para dados persistidos.
   - Funções auxiliares: `repoKey(ref)` (com host), `repoWebUrl(ref)` e `repoFileSlug(ref)` (troca todas as barras).

2. **Provider como contrato** (`src/services/providers/index.js`)
   - `getProvider(ref)` devolve o `githubService` atual, sem mudança, ou um novo `gitlabService.js`.
   - **O `gitlabService` devolve os mesmos formatos internos que os utils já consomem:**
     - séries no formato `participation.all`;
     - punch card em tuplas;
     - CI no formato `{event, conclusion}`;
     - `files.*` no formato de community profile;
     - commits no formato REST usado por `fromRestCommit`/`ActivityLogs` (`html_url` vem de `web_url`, `author.login` fica `null`);
     - PRs via `toPullRequestStats`.
   - Assim utils, cards, PDF e CSV quase não mudam, e o `full_report` mantém um formato só.
   - Migrar para tipos totalmente neutros fica como dívida técnica opcional, não como pré-requisito.

3. **`useRepository`**
   - Trocar os índices posicionais por resultados nomeados.
   - Escolher o provider pelo `RepoRef`.
   - Gravar `report.provider` e `report.host`.
   - **Com `provider !== 'github'`, não chamar `saveSearch`**, e a UI avisa que o histórico ainda não está disponível para GitLab.
   - Métrica sem fonte (watchers, origem do template) segue o padrão de "indisponível com motivo", nunca zero.
   - Valor calculado a partir de amostra de commits leva `source: 'commits'`/`capped` e `method` próprio (`gitlab-v1`), para não se misturar com a metodologia do GitHub.

4. **Token por host**
   - `localStorage['gitlab_token:<host>']`, com escopo `read_api`, pelo mesmo wrapper de storage seguro do `github_token`. O risco é o mesmo do token do GitHub: qualquer script na origem lê o `localStorage`, e a mitigação é a CSP restrita (sem `'unsafe-inline'` em `script-src`). Por isso o texto de ajuda pede só `read_api` e validade curta.
   - Uma seção GitLab no `SettingsModal`.
   - `hasToken(ref)` substitui `hasGithubToken` nos chamadores (`useRepository`, `Classroom`).
   - O token só é enviado para o próprio host.
   - Ao salvar, validar com `GET /personal_access_tokens/self` (seção 2.1): exigir `read_api` e mostrar a data de expiração. Token fine-grained ou sem `read_api` gera aviso, não bloqueio silencioso.
   - **Falha parcial:** um 403 numa fonte específica vira "indisponível com motivo" só para aquele indicador e não derruba a análise inteira. Isso cobre o `statistics`, que exige papel Reporter ou acima, e endpoints negados a tokens fine-grained que alguém crie mesmo assim. O 401 continua sendo erro global de token inválido.

5. **CSP**
   - Substituição no build (`%VITE_…%` no `index.html`, como já é feito com `VITE_SUPABASE_URL`, ou um plugin no `vite.config.js`) para incluir `https://gitlab.com` mais os hosts da lista em `connect-src` e `img-src`.
   - Incluir também `secure.gravatar.com` em `img-src`, por causa dos avatares.
   - Atualizar o comentário que justifica a CSP no `index.html`.

6. **Bots e IA**
   - A detecção de bots do GitLab olha o **e-mail** (`project_<id>_bot_*@noreply.<host>`) e o nome, além de `username`/`user.bot === true` quando vêm do GraphQL: nos contribuidores calculados a partir de commits o login é nulo, e uma checagem só por login deixaria o bot como "desenvolvedor-chave" no bus factor.
   - O `aiRegistry` ganha `GitLabDuo` e `duo_workflow`.
   - Os caminhos `.gitlab/` entram em `PROFILE_DIRS`/`CONTEXT_DIRS`.
   - A detecção do `github-classroom[bot]` fica restrita ao GitHub, incluindo o teste por e-mail em `aiProcess.js` (`CLASSROOM_BOT_EMAIL`, `isClassroomCreated`); no GitLab a origem fica "não verificada".

7. **i18n**
   - Interpolação `{{platform}}` nos textos genéricos.
   - Variantes `*.gitlab` só onde a métrica muda de natureza: pipelines, health score inferido, séries a partir de commits, revisão via notas, criação de token.
   - O guia ganha a seção "Diferenças no GitLab".

---

## 4. Plano de trabalho

### Fase 0: validação (spike, sem merge de código)

- ✅ Instância institucional: `gitlab.cin.ufpe.br`. CORS e endpoints validados (seção 2.3).
- ✅ Custo medido em 3 projetos de aluno, em 1 projeto público do CIn e no `gitlab-org/gitlab-runner` (seção 2.5). No gitlab.com a medição foi só sem token, porque não havia token disponível lá.
- ✅ O GraphQL sem token devolve `notes` de MR (seção 2.2).
- Medições com token usam **token legado com `read_api`** no `gitlab.cin.ufpe.br`, com validade curta e guardado fora do repositório (no Keychain do macOS, lido para a variável de ambiente `SMOKE_GITLAB_TOKEN` só durante a execução). Tokens fine-grained ficam fora da Fase 0 (seção 2.1).
- Pendente:
  - a confirmação dos limites de taxa pela administração do CIn (a página pública indica que não há limite ativado, seção 2.3);
- **Saída:** os números da seção 2.5. Os tetos propostos entram em `src/constants.js` na Fase 2.

### Fase 1: fundação, sem mudança visível no GitHub

- ✅ `RepoRef`, `parseRepoRef` e funções auxiliares (`src/utils/repoRef.js`), com testes de subgrupos, host fora da lista e URL colada. Allow-list `GITLAB_HOSTS` no próprio `repoRef.js`, a partir de `VITE_GITLAB_HOSTS` (host com porta opcional; entrada inválida é descartada com aviso no console). Primeiro segmento com ponto é lido como host mesmo sem `https://`, porque owner do GitHub não tem ponto.
- ✅ `split('/')` e `replace('/')`: o Dashboard (`useRepository`), a lista da Turma (`parseRepoList`) e os nomes de arquivo (`RepoInfoCard`) passam pelo `RepoRef`. Ficam como estão, porque só recebem nomes do GitHub já validados: `Benchmark.jsx` (histórico, Fase 4), `useClassroomAnalysis.js` e `Classroom.jsx:89` (Fase 3).
- ✅ `useRepository` com resultados nomeados.
- ✅ `providers/index.js` com o GitHub como único provider. Um endereço GitLab dá erro `PROVIDER_UNAVAILABLE` antes de qualquer requisição.
- ✅ Token por host: `src/services/tokens.js` (`gitlab_token:<host>`). **A seção GitLab do `SettingsModal` fica para a Fase 2:** sem o `gitlabService`, um campo de token que não faz nada só confundiria.
- `{{platform}}` nas strings genéricas: **movido para a Fase 2**, junto com os textos que mudam de natureza, para que a lista de strings saia do uso real.
- **Critério de aceite:** testes atuais verdes e `npm run smoke:csp` passando sem alteração.

### Fase 2: `gitlabService` e Dashboard ao vivo

Dividida em dois PRs. **PR 1 (feito, 2026-11-12):**

- ✅ `src/services/gitlabService.js` (um serviço por host, `createGitlabService`) e `src/utils/gitlabData.js` (transformações puras para os formatos do GitHub), com testes (`fetch` simulado; falha lança erro em vez de virar zero).
  - Falha parcial: cada fonte falha sozinha (o `Promise.allSettled` do `useRepository` deixa só aquele indicador indisponível). **Pendente:** um 401 de token inválido ainda aparece como o erro genérico da busca, não como "token inválido".
- ✅ Agregadores a partir de uma leitura das 52 semanas de commits: séries semanais, punch card, churn e contribuidores por e-mail.
- ✅ Health score pelas listagens dirigidas (raiz e `.gitlab/`), não pela árvore.
- ✅ Métricas de MR via GraphQL (duas consultas: núcleo e tamanho) e CI via pipelines. Revisão, branches zumbis e datas das tags funcionam **sem token** no GitLab (`detailsWithoutToken`), medido no gitlab-runner e no CIn.
- ✅ `report.provider/host`, sem persistência (bloqueio `provider gitlab`), com aviso na UI; botão da Timeline escondido e o Compartilhar explica que não há link permanente.
- ✅ `internal` e `private` recusados no Dashboard (`errors.gitlabNotPublic`).
- ✅ CSP com a allow-list (plugin `gitlab-csp-hosts` no `vite.config.js`), `VITE_GITLAB_HOSTS` no `deploy.yml` e no job `smoke`, e um terceiro fluxo no `scripts/csp-smoke-test.mjs` com o gitlab.com simulado.
- ✅ Seção GitLab no `SettingsModal`: um token por host, validado ao salvar (`/personal_access_tokens/self`).
- ✅ **Teste manual (navegador, build de produção, 2026-11-12):** `gitlab-org/gitlab-runner` (43 requisições, ~12 s, todos os indicadores de revisão preenchidos), `lgpss-in1054/ns3_code` (35 requisições, ~7 s) e um projeto `internal` de aluno (recusado com 2 requisições). Zero violação de CSP, zero erro de página, nada gravado.

**PR 2 (textos, feito, 2026-11-12; v3.26.0 junto com o PR 1):**

- ✅ Em vez de `{{platform}}` em cada string, contexto do i18next: num relatório do GitLab, `t` lê `<chave>_gitlab` quando existe e cai em `<chave>` quando não (plural incluído). `src/lib/platformText.js` (`PlatformProvider` em volta do relatório no Dashboard, `usePlatformTranslation` em **todos** os componentes, com teste que impede voltar ao `useTranslation`, e `withPlatform` nos cards e no PDF). Os limites citados nos textos vêm das constantes (`gitlabLimits()`). Só ganham variante os textos que mudam: pipelines, health por listagens, séries a partir de commits, revisão por notas e aprovações, MRs/issues desativados, árvore truncada, mensagens de falha da API. Testes garantem que toda variante tem a chave-base, existe em pt e en e não fala de GitHub.
- ✅ Entrada "Diferenças no GitLab" no guia "Como interpretar" (seção Plataformas), ligada ao aviso do Dashboard.
- ✅ PDF: as mesmas variantes, e a nota de método cita a instância e que a análise não é gravada.
- Rótulos genéricos como "Total de PRs" continuam "PRs" (o termo do app); os tooltips do GitLab falam em merge requests.

### Fase 3: Turma com GitLab

Feita em 2026-11-12 (v3.27.0):

- ✅ `parseRepoList` aceita endereços do GitLab com host; a lista guarda `repoListName` (GitHub `owner/repo`, GitLab `host/caminho`).
- ✅ Importação de grupo com subgrupos: o campo aceita `<host habilitado>/grupo` (`parseGitlabGroup`, `fetchGroupProjects`).
- ✅ `analyzeRepository` escolhe o serviço pelo `RepoRef`, com o token do host; fontes GitLab no período: commits do branch principal, MRs mergeados (filtro por data de merge no GraphQL) e pipelines concluídos de push no branch principal ou de MR.
- ✅ Visibilidade: `internal` e `private` são analisados aqui (como os privados do GitHub), com o token do host; visibilidade ausente bloqueia (fail-closed). A análise só começa quando há token para todas as plataformas da lista.
- **Mudança em relação ao plano:** a visão por aluno agrupa pelo **nome** que aparece nos commits, não pelo e-mail, para não exibir e-mails na tela. Consequência: a mesma pessoa com nomes diferentes aparece em mais de uma linha (dito na nota da tabela).
- **Mudança em relação ao plano:** sem coluna de plataforma no CSV e no PDF. O nome do repositório do GitLab já traz o host (`gitlab.cin.ufpe.br/g/p`), o que identifica a plataforma sem mudar as colunas do CSV.
- IA no Processo: sem contexto de configuração no GitLab, como no Dashboard.
- ✅ **Teste (navegador, build de produção, 2026-11-12):** importação do grupo de uma disciplina no gitlab.cin.ufpe.br (12 projetos, todos `internal`) e análise de 3 projetos de 01/08 a 12/11. Foram 19 requisições no total, com todas as colunas preenchidas, visão por estudante, PDF gerado, zero violação de CSP e nada gravado.

### Fase 4: histórico (fora da 1ª entrega)

- Versionar antes `obter_snapshot` e o DDL de `analytics_searches`.
- Migração com `provider text default 'github'` e `host text default 'github.com'`.
- Novas assinaturas das RPCs (DROP + CREATE, atenção ao PGRST203 de overload ambíguo) com chave `(provider, host, lower(repo_name))`.
- Ligar `saveSearch` para o GitLab.
- Timeline com rota splat + host; Benchmark e Ranking com filtro e rótulo de plataforma.
- Decidir se o Ranking mistura plataformas, já que o health score inferido não é idêntico ao do GitHub.

### Fase 5: documentação

Feita em 2026-11-12 (v3.27.1); `AGENTS.md`, `CHANGELOG` e o guia foram atualizados a cada fase.

- ✅ Modal "Como usar": formatos de endereço do GitHub e do GitLab, projetos do GitLab, Modo Turma e como criar o token `read_api` do GitLab (hosts da lista do build).
- ✅ Placeholder da busca com um exemplo do GitLab.
- ✅ README: descrição, busca, Modo Turma, privacidade (exceção da Turma) e a seção "Como informar repositórios"; recursos de histórico marcados como só GitHub.
- ✅ Como interpretar: a entrada "Modo turma" aponta para "Diferenças no GitLab". Guia de IA: limite "GitLab" (o que ainda não é verificado).
- ✅ ROADMAP: 1ª entrega marcada, fase 4 e pendências em aberto.

### Riscos

1. **Limite anônimo de 60 req/h anunciado pela GitLab:** o token vira praticamente obrigatório.
2. **Custo da Turma com 50 projetos:** manter a concorrência em 3 e definir tetos por projeto.
3. **Métricas "equivalentes" com metodologia diferente** (séries amostradas, revisão via notas): exigem `method`/`source` explícitos e textos que deixem a diferença clara.
4. **CSP presa à lista do build:** uma instância nova exige novo deploy.
5. **Proxy de instância self-hosted removendo CORS:** a análise não funciona sem backend. Fica fora do escopo e é detectado na Fase 0.
6. **Tokens fine-grained em beta:** usuários podem criá-los por engano, já que a tela do GitLab oferece essa opção. A mitigação é a validação via `/personal_access_tokens/self`, o tratamento de falha parcial por indicador e um texto de ajuda que peça o token legado explicitamente.
