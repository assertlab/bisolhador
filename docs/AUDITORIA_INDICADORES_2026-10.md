# Auditoria de Indicadores — Outubro/2026

Revisão da **assertividade e credibilidade** de cada indicador do Bisolhador, feita em 2026-10-23 sobre a v3.7.0.

**Método.** Para cada indicador: (1) fonte — endpoint, amostra, paginação; (2) cálculo no código; (3) o que a interface **promete** (rótulo e tooltip em pt/en); (4) **verdade** calculada de forma independente pela API do GitHub (REST, Search, GraphQL, `/stats/*`, paginação completa) em repositórios de perfis diferentes — `assertlab/bisolhador` (pequeno), `expressjs/express` (médio, maduro), `facebook/react` → `react/react` (grande, muito ativo), `twbs/bootstrap`, `pallets/flask`, `psf/requests`, `spf13/cobra`, `spring-projects/spring-petclinic`, `immich-app/immich`, `torvalds/linux`, `renovatebot/renovate`, `f-droid/fdroidclient` e um fork. Histórico lido do Supabase só pelas RPCs públicas de leitura. Nada foi escrito em produção.

**Veredito por indicador:** ✅ correto · ⚠️ enganoso (tecnicamente certo, mas promete outra coisa ou a amostra não sustenta a conclusão) · ❌ errado (bug).

Achados já corrigidos antes desta auditoria (v3.6.4): Code Churn com sinal invertido, Code Review e Divergência sempre zerados.

---

## 1. Resumo executivo

| Gravidade | O que está errado | Quem é afetado |
|---|---|---|
| 🔴 Crítico | **30 snapshots de teste ("Mocked…") gravados em produção** como dados reais; são o snapshot mais recente de facebook/react, angular, vue e svelte → Benchmark e Ranking mostram 100 ⭐, health 14%, bus factor 100% | Todo usuário de Benchmark/Ranking/Timeline |
| 🔴 Crítico | **Repositórios hoje privados (2) ou inexistentes (5) continuam expostos** no ranking público e no histórico, com relatório completo | Privacidade de terceiros |
| 🔴 Alto | **Falhas da API de busca viram 0 silencioso** (issues abertas/fechadas, PRs, merges), sem o aviso de dados parciais, e o 0 é gravado no histórico. Hoje acontece com todo repositório **renomeado** (ex.: `facebook/react` → `react/react`: a busca usa o nome digitado e recebe 422) | Repos renomeados; usuários sem token que fazem várias buscas seguidas (inferido) |
| 🔴 Alto | **Contribuidores truncados nos 30 primeiros** (sem paginação), all-time, com bots — distorce a tabela, os **dois** Bus Factors e o Benchmark | Todo repo com mais de 30 contribuidores |
| 🔴 Alto | **Duas definições de "Bus Factor" na mesma tela, com terminologia invertida** ("Bus Factor Baixo" exibido como estado saudável) e três conjuntos de limites diferentes | Todos |
| 🔴 Alto | **Branches zumbis e "Total de Branches" limitados às 20 primeiras em ordem alfabética**; branches de release contadas como zumbis; falha da API aparece como ✅ verde | Repos com mais de 20 branches |
| 🔴 Alto | **Issue Template** só reconhece o formato antigo (arquivo único): react, bootstrap, flask, ruff, express perdem ponto no Health Score | Repos bem mantidos (justamente os bons exemplos) |
| 🔴 Alto | **Detecção de testes** não vê `test/` (singular), subpastas, `.tsx`, `_test.py`, nem árvore truncada (express e linux aparecem sem testes) | Muitos repos |
| 🔴 Alto | **Lead time** usa os 20 PRs mais recentes *criados* (os lentos ainda estão abertos → viés para baixo), média em vez de mediana, inclui bots; repos muito ativos ficam N/A | Repos ativos |
| 🔴 Alto | **Badge "Code Review (X%)" mostra a taxa de self-merge** (lê-se como "X% revisado"); o alerta recomenda revisão obrigatória mesmo quando o PR foi aprovado por outra pessoa antes do merge | Interpretação dos alunos |
| 🔴 Alto | **Permalink por data (`?repo=&date=`) não funciona** — a RPC `buscar_snapshot_por_data` devolve `null` para qualquer entrada | Quem usa/compartilha esses links |
| 🟠 Médio | Benchmark compara snapshots de datas diferentes sem mostrar a idade; lead time mistura horas e dias (até 24×); cores com string CSS inválida | Benchmark |
| 🟠 Médio | Ranking conta cada recarregamento como "análise" e apresenta como "Hall da Fama" | Ranking |
| 🟠 Médio | Gráfico de dias da semana com **10 commits**; título do gráfico de atividade mostra a idade do repo ("904 semanas") em vez das 52 plotadas; "calculando" (HTTP 202) vira linha zerada | Gráficos |
| 🟠 Médio | Forks recebem ~14% no Health Score (a API de community profile dá 404 para forks) | Alunos analisando forks |

---

## 2. Dados de produção (Supabase)

Verificado pelas RPCs de leitura (`get_repo_history`, `get_leaderboard`, `buscar_snapshot_por_data`).

### 2.1 Snapshots mock (30) — ❌ crítico
Descrição "Mocked for manual verification" / "Mocked for lag measurement", 100 ⭐, 10 forks, health 14, um contribuidor. Gravados em 29–30/07/2026, durante a medição de lag da v3.5.2: o script ad-hoc mockava a API do GitHub mas **não interceptava `registrar_busca`**, então gravou em produção.

| Repositório | ids |
|---|---|
| facebook/react (12) | 1013–1018, 1027, 1031, 1035, 1039, 1043, 1047 |
| angular/angular (10) | 1029, 1030, 1033, 1034, 1037, 1038, 1041, 1042, 1045, 1049 |
| vuejs/vue (6) | 1028, 1032, 1036, 1040, 1044, 1048 |
| sveltejs/svelte (2) | 1046, 1050 |

### 2.2 Snapshots degradados (health 14, community profile falhou) — ❌ alto
`react/react`: 1001, 1024, 1064, 1117, **1163** · `facebook/react`: 407. Cada um gravado segundos depois de uma busca normal; o 1163 (22/10, 12:36 UTC) provavelmente é da primeira execução do smoke test nesta sessão, sem token e antes da interceptação existir. Causa de fundo: o app grava o relatório mesmo quando endpoints críticos falham.

### 2.3 Repositórios hoje privados ou inexistentes no ranking público — ❌ crítico (privacidade)
Privados: `ddevdan/future-grid`, `marcellobressan/future-grid`. 404 (apagados ou privados — a API não distingue): `caioagrelli/MP-SIPAT`, `LucasGrander/BCC3004-IC3A_SPHERE_SERVER`, `LucasGrander/BCC3004-IC3A_SPHERE_WEB`, `felipeevgomes/adaptwrite-frontend`, `felipeevgomes/adaptwrite-backend`. Não verificado se eram públicos quando gravados (antes da v3.5.0 o app aceitava repos privados lidos com PAT). `get_repo_history`/`obter_snapshot` não checam visibilidade.

### 2.4 Outros problemas de dados
- **Repos renomeados dividem o histórico**: as buscas reais de react desde junho estão em `react/react`, mas Timeline e Benchmark leem `facebook/react` (nome digitado), cujo histórico termina em mocks. Issues abertas/fechadas = 0 em **todos** os 26 snapshots de `react/react`.
- **Duplicatas**: até 16 snapshots no mesmo dia (cada carregamento de página grava um).
- **Snapshots sem `full_report`** (30/91 em facebook/react, 19/140 em bisolhador) entram como 0 nos gráficos, porque `get_repo_history` não devolve as colunas planas.
- **Valores de esquema antigo**: 15 snapshots de bisolhador com churn `"Infinity"`; todos os snapshots antes de 22/10 com self-merge/divergência sempre 0 (o Dashboard já normaliza isso; Benchmark e Timeline não).

---

## 3. Indicadores, um a um

### 3.1 Repositório, issues e PRs

| Indicador | Veredito | Evidência | Correção |
|---|---|---|---|
| Estrelas, forks, watchers | ✅ | Idênticos à API nos 3 repos | — |
| Releases | ✅ (erro vira 0) | 30/166/137 corretos | Erro → "n/d" |
| Idade / data de criação | ✅ (snapshot mostra idade "hoje") | — | Usar a data do snapshot |
| Issues abertas / fechadas | ❌ | react: app **0 / 0**, real **876 / 13 898** (busca 422 pelo nome antigo) | Usar `repoData.full_name`; falha → `_warnings` + "n/d"; fallback GraphQL `issues.totalCount` |
| Taxa de resolução | ⚠️ | Conta "not planned"/duplicadas como resolvidas; all-time; sufixo "% resolvidas" fixo em português também no EN | `reason:completed` ou rótulo "taxa de fechamento"; i18n |
| Total de PRs / merges | ❌ (falha → 0) · ⚠️ rótulo | react: 0 vs 20 536 / 13 139; express: só 578 de 2 715 aparecem como merged (merge manual) | Mesmo fix das issues; rótulo "PRs mergeados" |
| PRs por branch | ❌ | Branches limitadas a 20 (express 134,3 vs 122,1; react tem 1 011 branches) | Contagem real (Link `rel=last` ou GraphQL) — ou remover o indicador, cujo significado é fraco |
| Lead time | ⚠️ alto | Amostra = 20 PRs mais recentes **criados**: bisolhador 0,6 h ok; express e react **N/A** (nenhum dos 20 mergeado), real: mediana 6,0 d e 0,85 d; média 2–3× a mediana | Amostra dos últimos 50–100 **mergeados**, **mediana** + n (e p90), opção de excluir bots; tooltip diz "aprovação/merge" mas só mede merge |
| Divergência | ⚠️ | react 1,2 "Saudável", mas 22 de 24 comentários são de bots (`meta-cla`, `github-actions`); sem bots ≈ 0,1 | Excluir bots, só PRs fechados/mergeados, mostrar n, suavizar os rótulos de juízo |
| Code Review (self-merge) | ⚠️ alto | bisolhador 100% (real 90% nos últimos 42 — correto); express e react **"0%"** porque nenhum dos 20 está mergeado (real 19% e 66%); em react, 65 de 66 self-merges foram aprovados por outra pessoa antes | Medir "**mergeado sem aprovação de outra pessoa**" (`reviews(states: APPROVED)`), renomear o badge para "Self-merge X%", "n/d" sem PRs mergeados, mostrar n |
| Últimos PRs (log) | ✅ | Idêntico | — |

### 3.2 Health Score e Maturidade

| Indicador | Veredito | Evidência | Correção |
|---|---|---|---|
| README, License, Contributing, CoC, PR template, Description | ✅ (não forks) | Corretos em 12 repos, incl. arquivos herdados do repo `.github` da org (como o próprio GitHub faz) | Explicar a herança no tooltip |
| Issue Template | ❌ alto | A API só preenche para o arquivo único antigo; `.github/ISSUE_TEMPLATE/` (forms) dá null. react: app **86%**, `health_percentage` do GitHub **100** | Também aceitar o diretório `ISSUE_TEMPLATE/` na árvore e no repo `.github` da org |
| Forks | ❌ alto | Community profile dá 404 para forks → ~14% | Fallback pela árvore ou "n/d para forks" |
| Testes | ❌ alto | express **não detectado** (`test/` singular); linux não detectado (árvore truncada); ruff só por acaso; não cobre `.jsx/.tsx/.mjs`, `_test.py`, subpastas, `spec/` | Regex sobre o caminho completo; árvore truncada → "parcial" |
| CI/CD | ⚠️ | Só GitHub Actions (fdroidclient com `.gitlab-ci.yml` → ❌) | Incluir GitLab, CircleCI, Jenkins, Azure, Travis, Buildkite — ou renomear para "GitHub Actions" |
| Docker | ❌ | Só `Dockerfile`/`docker-compose.yml` na raiz (immich → ❌) | `compose.yaml`, `Dockerfile.*`, `Containerfile`, subpastas |
| Linter | ⚠️ | Calculado mas **nunca exibido**; o tooltip promete "linters e auditoria". Também não vê `eslint.config.js` (o próprio Bisolhador), biome, golangci, ruff | Exibir com padrões modernos ou corrigir o tooltip |
| Branches zumbis / total de branches | ❌ alto | Só as 20 primeiras em ordem alfabética: react **20 zumbis** (todas branches de release intencionais), "Total de Branches" **20** vs 1 011; falha da API → ✅ verde; 21 requisições sequenciais | GraphQL (contagem real + data do último commit numa chamada), excluir default/protegidas/release, falha → "n/d", amostra → rótulo |
| Árvore truncada / falha (afeta todos os detectores) | ❌ | `truncated` ignorado; falha → tudo cinza, igual a "ausente" | Distinguir **"não verificado"** de **"ausente"** em todos os badges |

### 3.3 Pessoas e atividade

| Indicador | Veredito | Evidência | Correção |
|---|---|---|---|
| Contribuidores (base de tudo abaixo) | ❌ alto | `/contributors` sem `per_page`, sem paginação, sem `anon` → **30 primeiros**, all-time, bots incluídos | `per_page=100` + paginação + `anon=1`, ou `/stats/contributors`; excluir `[bot]` |
| Concentração no top contribuidor (tabela, "Bus Factor") | ❌/⚠️ alto | express: "tj 68,7% crítico" — **tj não comita desde 2014**; renovate: "o usuário **renovate[bot]** concentra 42,4%" | Janela recente (52 semanas) ao lado do all-time; nunca chamar bot de "usuário" |
| Bus Factor (Pareto 70%) | ❌/⚠️ alto | react: app 9 com sebmarkbage/zpao/gaearon; nas últimas 52 semanas também 9, mas outras pessoas. express: app 2 (ambos inativos), real recente 5 | Mesmos dados corrigidos; janela explícita; documentar que 70% é heurística (o truck factor de Avelino et al. usa autoria de arquivos e 50%) |
| Duas definições na mesma tela | ❌ alto | express: card "2 – Alto Risco" e tabela "Bus Factor Crítico"; react: estado verde intitulado "**Bus Factor Baixo**" (no uso padrão, *baixo* é o arriscado); tooltips se contradizem; Benchmark usa um terceiro conjunto de limites (60/80) | Renomear a métrica da tabela para "Concentração no principal contribuidor", corrigir os textos, limites únicos em `constants.js` |
| "% do Trabalho" | ❌ | Denominador = soma dos 30 primeiros (react 12,4% vs 8,9% real); "trabalho" = commits na branch padrão | Total real como denominador; "top 30 de N"; rótulo "% dos commits" |
| Commits por dia da semana | ⚠️ alto | **10 commits**: renovate → "100% sexta" (os 10 cabem em 4 horas); fuso do navegador muda o resultado (bisolhador: domingo 10 em BRT vs 1 em UTC) | `/stats/punch_card` (todos os commits) ou ≥ 100 sem bots; declarar o fuso; ocultar com n < 50 |
| Atividade semanal (52 semanas) | ❌ | Título mostra a idade do repo ("904 Semanas" no express) em vez das 52 plotadas; HTTP 202 ("calculando") vira 52 zeros e é gravado | Título com as semanas exibidas; 202 → retry + "calculando", nunca gravar zeros |
| Code churn | ⚠️ | Tooltip promete "qualidade das mudanças"; bisolhador "Refatoração Agressiva" a partir de 3 semanas com atividade; 422 (≥10k commits) e 202 aparecem como o mesmo N/A | Renomear para "Razão adições/remoções", tirar "qualidade", exigir atividade mínima, mensagens distintas para 422/202 |
| Linguagens | ✅ | Batem com a API (arredondamento soma 99%) | Uma casa decimal; explicar que a unidade é bytes |
| Últimos commits | ✅ | Idênticos (bots incluídos) | Badge de bot (opcional) |

### 3.4 Histórico e comparação

| Recurso | Veredito | Evidência | Correção |
|---|---|---|---|
| Permalink por data | ❌ alto | `buscar_snapshot_por_data` → `null` para tudo (inclusive dia com 16 snapshots e o exemplo do README). Provável causa: função SECURITY INVOKER batendo na RLS sem policies desde a v3.5.0 — o SQL dela **não está no repositório** (não verificado) | Versionar o SQL em `supabase-migrations/` como SECURITY DEFINER, incluir no smoke test; usar fuso fixo (hoje o mesmo link mostra janelas diferentes por fuso) |
| Timeline | ⚠️ | Eixo de categorias (16 pontos de uma tarde ocupam o espaço de meses); snapshots sem relatório viram 0 ("+100 ⭐" de crescimento falso); "+" fixo mostra "+-X" em quedas | Um ponto por dia, eixo de tempo, colunas planas no RPC, sinal correto |
| Benchmark | ⚠️ alto | Compara o último snapshot de cada repo sem mostrar a data (`lastUpdate` calculado e nunca exibido); filtro de período só afeta a linha; lead time em horas plotado como dias; `hsl(...)` + alfa hex = cor inválida; não aplica a normalização de snapshots | Mostrar "dados de DD/MM", alertar diferença de datas, converter unidades, `hsla()`, aplicar o normalizador |
| Ranking (Bisolhômetro) | ⚠️ | Conta linhas (cada recarregamento vale 1): bisolhador lidera com 140, quase tudo testes da equipe; apresentado como "Hall da Fama" com medalhas; mostra o health do último snapshot, mock incluído | Contar dias distintos, excluir dados sinalizados, rótulo "Mais analisados" sem tom de mérito, esconder privados/404 |

---

## 4. Causas de fundo (corrigir uma vez, conserta vários indicadores)

1. **Falha silenciosa vira valor**: vários fetchers fazem `catch → return 0/null/[]`, e o hook aplica `|| 0`. Resultado: "não consegui medir" aparece como "zero" ou "ausente", é exibido sem aviso e é **gravado** no histórico. Precisa de três estados em todo indicador: **medido**, **indisponível (com motivo)** e **parcial (com amostra)** — o mesmo padrão já aplicado em Code Review/Divergência na v3.6.4.
2. **Amostras pequenas, sem paginação e sem declaração**: 20 PRs, 20 branches, 30 contribuidores, 10 commits. Todo indicador amostral deve mostrar **n** e a **janela**.
3. **Bots contados como pessoas**: dependabot, renovate, github-actions, meta-cla distorcem bus factor, divergência, lead time e dias da semana.
4. **Nome digitado em vez do canônico** (`repoData.full_name`): quebra a busca e divide o histórico de repos renomeados.
5. **Gravação incondicional**: todo carregamento grava um snapshot, mesmo parcial, duplicado ou de teste.
6. **Juízo sem base**: rótulos como "Saudável", "Debate Intenso", "Refatoração Agressiva", "Hall da Fama" afirmam mais do que o dado sustenta.

---

## 5. Plano de correção sugerido

**Onda 0 — dados de produção (precisa de autorização; SQL no painel do Supabase):** apagar os 30 mocks (§2.1), os 6 degradados (§2.2) e os registros dos 7 repos privados/404 (§2.3); regra no AGENTS.md: todo script ad-hoc intercepta `registrar_busca`.

**Onda 1 — credibilidade (bugs que levam a conclusões erradas):**
1. Três estados (medido/indisponível/parcial) nos fetchers + `_warnings` + não gravar snapshot com falha crítica.
2. Nome canônico em busca, gravação, Timeline e Benchmark.
3. Contribuidores completos, sem bots, com janela recente → corrige tabela, os dois bus factors e o Benchmark; unificar a terminologia e os limites.
4. Branches via GraphQL (contagem real, zumbis sem release/protegidas).
5. Issue Template (diretório), detecção de testes/Docker/CI ampliada, linter exibido, "não verificado" ≠ "ausente", fallback para forks.
6. Lead time sobre PRs mergeados com mediana; Code Review como "mergeado sem aprovação de outra pessoa".
7. Corrigir e versionar `buscar_snapshot_por_data`.

**Onda 2 — histórico e comparação:** normalizador de snapshots em Benchmark/Timeline, um ponto por dia em eixo de tempo, idade dos snapshots no Benchmark, unidades do lead time, cores, Ranking por dias distintos.

**Onda 3 — clareza:** dias da semana via `punch_card` com fuso declarado, título e 202 do gráfico de atividade, renomear churn e rótulos de juízo, i18n da taxa de resolução.

---

## 6. Ideação: novos indicadores e features

Critério: ajuda o aluno a **aprender engenharia de software** e é **mensurável com confiança** pela API pública.

### Indicadores
| Ideia | Por que importa para o ensino | Fonte | Esforço |
|---|---|---|---|
| **Cobertura de revisão**: % de PRs mergeados com ≥ 1 aprovação de outra pessoa; tempo até a primeira revisão | É o indicador que o badge de Code Review tenta ser | GraphQL `reviews` | Baixo (reaproveita a consulta da v3.6.4) |
| **Tamanho dos PRs** (mediana de linhas alteradas; % de PRs pequenos, < 400 linhas) | PRs pequenos são boa prática central e fácil de ensinar | GraphQL `additions/deletions` | Baixo |
| **Tempo até a primeira resposta** em issues e PRs | Mede responsividade da comunidade (métrica CHAOSS) | GraphQL `timelineItems` | Médio |
| **Saúde do CI**: taxa de sucesso e duração mediana das execuções | Mostra se o CI é levado a sério, não só se existe | REST `actions/runs` | Baixo |
| **Adesão a Conventional Commits** (% das mensagens) | Disciplina de mensagens, muito ensinada | Commits já buscados | Baixo |
| **Cadência de releases** (intervalo mediano, adesão a SemVer) | Gestão de versões | REST `releases` | Baixo |
| **Higiene de segurança**: `SECURITY.md`, Dependabot/Renovate configurado, branch padrão protegida; nota do **OpenSSF Scorecard** | Segurança da cadeia de suprimentos | Árvore + `api.securityscorecards.dev` (público; exige liberar na CSP) | Baixo/Médio |
| **Contribuidores ativos por mês** e **retenção de novatos** | Sustentabilidade da comunidade, complementa o bus factor | `/stats/contributors` | Médio |
| **Issues "velhas"** (% abertas há > 90 dias sem atividade) e uso de labels | Gestão de backlog | GraphQL | Médio |

### Features
- **Selo de confiança por indicador**: amostra (n), janela, fonte e horário em cada card, mais o estado medido/indisponível/parcial. É a resposta direta a esta auditoria.
- **"Como interpretar"** em cada indicador: definição, limitações e referência (alinhar com as **métricas CHAOSS**, padrão da comunidade open source, dá credibilidade acadêmica).
- **Modo turma para professores**: comparar os repositórios de uma turma (lista colada ou organização do GitHub), exportar CSV/JSON — o Benchmark atual já é a base.
- **Excluir bots** como opção global, ligada por padrão.
- **Comparar com o próprio passado** ("este mês vs. 3 meses atrás") no Dashboard, usando o histórico já gravado — depois da limpeza dos dados.

---

## 7. Limitações desta auditoria
- Não verificado: a causa exata da falha de `buscar_snapshot_por_data` (o SQL não está no repo); se os repos hoje privados eram públicos quando gravados; que os snapshots degradados de julho a setembro vieram de execuções de teste; a aparência real das cores inválidas no Benchmark; churn e participação de repos que ficaram em 202 durante toda a auditoria.
- Amostra de repositórios escolhida por perfil, não estatística; o ranking tem 100 entradas e foi checado por inteiro só quanto à visibilidade.
