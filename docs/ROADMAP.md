# 🗺️ Roadmap - Bisolhador Dashboard

Este documento rastreia a evolução do Bisolhador, desde sua concepção em Vanilla JS até a arquitetura atual em React, e define os próximos passos estratégicos.

---

## 🔮 O Futuro (Próximas Versões)

### 🔭 Próximas Iterações (Planejado)
- [ ] **Reclassificar Vulnerabilidades do `npm audit` (push v3.6.1):** O push da v3.6.1 disparou um alerta do GitHub reportando 44 vulnerabilidades (1 crítica, 16 altas, 22 moderadas, 5 baixas) — número bem maior que as 15 já investigadas no security-review original. Provavelmente reflete dependências novas introduzidas pelo Playwright (`smoke:csp`), mas isso ainda precisa de confirmação, não suposição: reclassificar cada uma antes de assumir que são todas transitivas/dev-only.
- [ ] **Gamificação (Badges e Conquistas):** Badges de conquista para alunos (ex: "Clean Coder", "Bug Hunter", "Community Champion").
- [ ] **Quality Workbench (Testes Automatizados):** Hoje o projeto não tem nenhuma suíte de testes formal (unitários, integração ou e2e) além do `scripts/csp-smoke-test.mjs` recém-criado. Toda validação histórica foi manual/exploratória. Próximos passos: (1) testes unitários com Vitest para funções puras críticas em `analyzers.js` (health score, bus factor, lead time); (2) testes de componente com Testing Library para os fluxos de fail-safe documentados; (3) expandir `csp-smoke-test.mjs` para uma suíte e2e mais ampla; (4) adicionar um job de lint+build+test obrigatório em `.github/workflows`, hoje inexistente (o único workflow atual só espelha o repo para o Codeberg).
- [ ] **UX de Erros Diferenciados:** Hoje o Dashboard renderiza todo tipo de erro (403 de rate limit, 404, repositório privado, etc.) de forma idêntica — um único banner genérico com o texto cru do erro, sem diferenciação visual nem ação específica por tipo.
- [ ] **Paleta de Cores do BusFactorCard:** `src/components/BusFactorCard.jsx` usa uma paleta fixa hardcoded de 8 cores (`DEVELOPER_COLORS`) com wraparound (`% length`) para mais de 8 desenvolvedores. Candidato a usar `generateColor()` (`src/utils/colors.js`, extraído no B5) em vez da paleta fixa — achado do `/simplify` durante o trabalho de B5, não aplicado por estar fora do escopo daquele PR (mudaria as cores renderizadas num componente não solicitado).
- [ ] **Bundle Size do `pdf-vendor`:** Maior chunk do projeto (976 KB minificado, ~279 KB gzip) — identificado durante a investigação de bundle desta sessão, mas nunca endereçado: o trabalho de lazy-loading (v3.5.2, chart prefetch) cobriu páginas e `chart.js`, não o `html2pdf.js`. Candidato a uma investigação de code-splitting futura similar à já feita para o chunk principal.

---

## 🌟 O Presente (Era v3.x - Maturidade)

### 🔒 v3.6.1 - Supabase RPC Hardening ✅
- [x] **`get_leaderboard` Corrigida:** Teto de 100 no `limit_count` (`LEAST`/`GREATEST`), com `COALESCE(limit_count, 50)` cobrindo o caso de `NULL` explícito (que antes resultava em `LIMIT NULL`, isto é, sem limite).
- [x] **`registrar_busca` Corrigida:** Validação de tamanho de `full_report` via `octet_length` (tamanho lógico do JSON) em vez de `pg_column_size` (tamanho comprimido/TOAST em disco, contornável por payloads muito compressíveis), mais validação de `repo_name` (nulo ou > 300 caracteres) — ambas com `RAISE EXCEPTION` antes do `INSERT`.
- [x] **Processo:** Correções aplicadas primeiro ao vivo no Supabase após revisão via Security Advisor, depois sincronizadas em `supabase-migrations/` (`get_leaderboard.sql`, `registrar_busca.sql`).
- [x] **Decisões Documentadas no `AGENTS.md`:** RLS habilitada com zero policies em `analytics_searches` é o estado correto e esperado (INFO "RLS Enabled No Policy", não um problema); as 4 RPCs públicas `SECURITY DEFINER` (`get_leaderboard`, `get_repo_history`, `obter_snapshot`, `registrar_busca`) executáveis por `anon`/`authenticated` são intencionais — é assim que o app funciona sem exigir login.

### 🧹 Tech Debt Cleanup (pós-v3.6.0) ✅
*Backlog secundário de `docs/TECH_DEBT_v3.1.0.md`, fechado via `/code-review`/`/simplify` nesta sessão. Apenas A4 correspondeu a um bump de versão real (v3.6.0, notificações toast); os demais são refactors sem mudança de comportamento observável, sem entrada própria no CHANGELOG.*
- [x] **A4 - Notificações Não-Bloqueantes (v3.6.0):** As 10 chamadas de `alert()` bloqueante do app (compartilhamento, exportação de PDF, validações do Benchmark, rejeição de repositório privado) substituídas por um sistema de toast (`src/components/Toast.jsx` + `src/hooks/useToast.js`). Mensagens de erro persistem até fechamento manual; sucesso/aviso somem sozinhas após 5s.
- [x] **M2 - Formatação de Data Unificada:** `Intl.DateTimeFormat`/`toLocaleString` duplicados em 6 pontos do código (`RepoInfoCard`, `BenchmarkEvolutionChart`, `Timeline`, `ActivityLogs`) consolidados em 3 funções pequenas de `src/utils/formatters.js` (`formatDateTime`, `formatDateShort`, `formatDateLong`), preservando formatos intencionalmente distintos por contexto em vez de forçar um único formato.
- [x] **M5 - Deps do `useMemo` em BenchmarkComparisonChart:** `chartData` passou a depender do prop primitivo `metricCategory` em vez de um valor derivado (`activeConfigs`), tornando o recálculo correto por construção em vez de por coincidência de referência estável.
- [x] **B5 - `generateColor()` Genérico:** Extraído de `Benchmark.jsx` para `src/utils/colors.js`, reutilizável por qualquer componente que precise de cores determinísticas e visualmente distintas a partir de um seed.
- [x] **B3 - `SkeletonChart` Compartilhado:** Componente movido de `Dashboard.jsx` para `src/components/skeletons/`, com um modo `bare` que permite reuso no gate de carregamento do Chart.js em `Timeline.jsx` sem duplicar o card visual.
- [x] **B4 - Estados de `Timeline.jsx` Extraídos:** Bloco de loading extraído para `PageLoadingState` (compartilhado com `Ranking.jsx`, que tinha o mesmo padrão duplicado); bloco de erro extraído como `TimelineErrorState` (específico do Timeline, sem forçar reuso com o estado de erro estruturalmente mais simples do Ranking).

### 🔒 v3.5.0 - Security Hardening Edition ✅
- [x] **Auditoria de Segurança Completa:** Revisão end-to-end de RLS do Supabase, superfície de ataque client-side, segredos no histórico do git e Content-Security-Policy.
- [x] **RLS Corrigida:** Removidas as policies públicas "Permitir inserts publicos" (INSERT) e "Permitir leitura publica" (SELECT) de `analytics_searches`, que liberavam acesso direto ao role `anon` bypassando as RPCs — a documentação anterior afirmava (incorretamente) que isso já estava bloqueado.
- [x] **Bloqueio de Repositórios Privados:** `useRepository.js` e `Benchmark.jsx` agora checam a visibilidade do repositório antes de processar ou persistir qualquer dado, fechando um vazamento de dados de repositório privado para usuários não autenticados.
- [x] **Rotação da Anon Key:** Identificado `.env` commitado no histórico do git (dez/2025); anon key do Supabase rotacionada no painel do Supabase.
- [x] **Sanitização de URLs:** `encodeURIComponent` aplicado nos 18 endpoints de `githubService.js` que interpolavam `owner`/`repo`/`defaultBranch` sem escapar.
- [x] **Content-Security-Policy:** Primeira CSP do projeto, adicionada em `index.html`, escopada aos domínios reais usados (GitHub, Supabase, GA4).
- [x] **react-router-dom Atualizado:** `^7.10.1` → `^7.18.2` (corrige open redirect via backslash) + validação defensiva de rota (`SAFE_GITHUB_NAME_PATTERN`) em `RepoInfoCard.jsx`.
- [x] **Primeiro Teste Automatizado:** `scripts/csp-smoke-test.mjs` (Playwright), rodável via `npm run smoke:csp`.

### ☢️ v3.4.0 - Governance & Risk Edition ✅
- [x] **Análise de Risco Avançada (Bus Factor):** Motor matemático baseado em limite de 70% de esforço (Pareto) e novo componente visual BusFactorCard (Barra Horizontal Empilhada) para alertar sobre centralização de conhecimento.

### 📊 v3.3.0 - Data Science Edition ✅
- [x] **Exportação Avançada (CSV):** Motor nativo de exportação CSV (sem bibliotecas externas) com escape RFC 4180 e UTF-8 BOM para compatibilidade com Excel. Integrado no Dashboard (13 métricas do repositório) e na Tabela Comparativa do Benchmark (exporta colunas idênticas à tabela visual). Headers traduzidos dinamicamente via i18n (PT-BR/EN-US).

### 🛡️ v3.2.0 - Resilience & Stability ✅
- [x] **Resiliência de Analytics (Exponential Backoff):** Implementação de lógica de retentativas com Exponential Backoff no serviço de analytics do Supabase, garantindo que oscilações de rede não percam dados.
- [x] **UX de Falhas Parciais (PartialDataAlert):** Componente `PartialDataAlert` no GitHub Service para tratamento de falhas parciais da API (ex: Rate Limit de commits). O painel renderiza os dados disponíveis e exibe um banner amigável detalhando os dados ausentes.

### 🐛 v3.1.2 - Patch Fix ✅
- [x] **Correções de UI e Versionamento Dinâmico**: Header exibe versão dinamicamente do `package.json` (elimina strings hardcoded).
- [x] **Sincronização de Documentação**: CHANGELOG, README, CLAUDE.md e ROADMAP atualizados para v3.1.2.

### 🛠️ v3.1.1 - Refactoring Edition ✅
*Marco de maturidade técnica: refatoração completa em 5 sprints baseada no Tech Debt Report v3.1.0.*
- [x] **Bug Fixes**: Correção de `useChartTheme` (tooltips dark mode), safe localStorage wrapper, remoção de dead code.
- [x] **Performance**: `useMemo` em todos os charts para evitar re-criação de canvas Chart.js a cada render.
- [x] **DRY**: Hook `useTimeFilter` e componente `<TimeRangeFilter>` unificados, eliminando duplicação entre Timeline e Benchmark.
- [x] **Clean Architecture**: Dashboard extraído para `src/pages/Dashboard.jsx`, Benchmark componentizado em 5 sub-componentes.
- [x] **Security & Polish**: Proteção XSS (substituição de `dangerouslySetInnerHTML`), i18n completo, constantes extraídas para `src/constants.js`.
- [x] **Documentação**: Migração de `docs/CONTEXT.md` para `CLAUDE.md` (padrão oficial Claude Code).

### 🎯 v3.1.0 - Benchmark Edition ✅
- [x] **Benchmark de Repositórios (Comparação Multi-Repo):** Página dedicada `/benchmark` para comparação simultânea de até 10 repositórios com gráficos de evolução temporal (Chart.js time-series), bar charts comparativos por categoria (Popularidade, Velocidade, Qualidade) e tabela comparativa detalhada. Seleção via chips com cores distintas por repo.
- [x] **Filtros Temporais Unificados (Time Range):** Sistema de filtros (7d, 30d, 60d, 90d, todo histórico) implementado no Benchmark e expandido na Timeline (novo filtro 60d), normalizando visualizações para repositórios com datas de início diferentes.
- [x] **Internacionalização Benchmark:** Todas as strings traduzidas em PT-BR e EN-US.

### 🔭 v3.0.0 - v3.0.1 - Time Machine ✅
*Nota: A infraestrutura de backend (snapshots históricos) foi antecipada na v2.7.2, permitindo foco na experiência temporal.*
- [x] **Timeline Histórica (Time Machine):** Visualização temporal de métricas através de gráficos de evolução baseados nos snapshots armazenados (Stars, Forks, Watchers). Implementado com página dedicada `/timeline/:owner/:repo` e botão "Ver Evolução" no RepoInfoCard.
- [x] **Filtros Temporais:** Controles de período (7d, 30d, 90d, todo histórico) para análise focada de intervalos específicos na Timeline.
- [x] **Security Hotfix (v3.0.1):** Atualização crítica de dependências (html2pdf.js, jspdf) para mitigar vulnerabilidades CVE.

---

## 📚 O Passado Recente (Era v2.x - React)

### v2.8.2 - Global Timezones & Auto-Persistence ✅
- [x] **Correção de Persistência / Banco de Dados:** Implementação da estratégia "Save on Load" para garantir integridade histórica e IDs únicos automaticamente.
- [x] **Suporte a Timezones / Internacionalização de datas:** Detecção automática de fuso horário usando `Intl.DateTimeFormat().resolvedOptions().timeZone` nas buscas por data.

### v2.7.4 - Hotfix - Correção de loop infinito ✅
- [x] **Guard Clause**: Implementação de useRef para prevenir fetches duplicados no endpoint `buscar_snapshot_por_data`.

### v2.7.3 - Semantic Time Machine ✅
- [x] **Busca Semântica Histórica:** URLs legíveis (`/?repo=owner/project&date=YYYY-MM-DD`) para snapshots por data.
- [x] **Data da Análise:** Badge temporal no RepoInfoCard mostrando quando os dados foram coletados.
- [x] **Timezone Handling:** Correção de UTC vs Local na busca de snapshots por data.

### v2.7.2 - Deep Linking & Snapshots ✅
- [x] **Deep Linking:** URLs de busca ao vivo (`/?q=owner/repo`) para compartilhamento direto.
- [x] **Snapshots por ID:** Permalinks imutáveis (`/?id=123`) com dados congelados.
- [x] **Security Hardening:** RPCs seguras e bloqueio de INSERT direto para usuários anônimos.
- [x] **Schema Update:** Migração para IDs BIGINT e scores NUMERIC no Supabase.

### v2.7.1 - Security Hardening ✅
- [x] **Backend RPC:** Implementação de RPC (`registrar_busca`) no Supabase para escrita segura.
- [x] **Security Hardening:** Bloqueio total de INSERT direto na tabela `analytics_searches` para role anon via RLS.
- [x] **Fix i18n:** Correção de internacionalização em métricas hardcoded (Lead Time/Divergência).

### v2.7.0 - Data Mining & Fixes ✅
Ver [Especificação Técnica v2.7.0](docs/SPECS_v2.7.md)
- [x] **Auditoria de Segurança:** Varredura completa para segredos hardcoded, vazamentos em logs e exposição de chaves.
- [x] **Limpeza de Código Morto:** Remoção de logs de debug e comentários obsoletos.
- [x] **Resiliência de Analytics:** Fortalecimento do tratamento de erros no serviço de analytics.

### v2.6.0 - O Bisolhômetro (Leaderboard) ✅
Ver [Especificação Técnica v2.6.0](docs/SPECS_v2.6.md)

### v2.5.0 - Analytics & Persistência (Dezembro 2025)
*Foco: Persistência de dados bypassing AdBlock.*
- [x] **Supabase Integration:** Implementação de persistência de buscas em banco de dados Supabase para bypassing AdBlock.
- [x] **Analytics Híbrido:** Estratégia combinada Supabase (dados críticos) + GA4 (métricas de vaidade).
- [x] **Resiliência:** Melhoria no tratamento de falhas da API com fail-safe aprimorado.

### v2.4.0 - Analytics & Qualidade (Dezembro 2025)
*Foco: Telemetria e qualidade de código.*
- [x] **Google Analytics 4:** Implementação completa de rastreamento de eventos e PageViews para monitoramento de crescimento do projeto.
- [x] **ESLint Otimizado:** Ajuste nas regras de linting para ignorar pastas de build e legado, garantindo um CI/CD limpo.

### v2.3.0 - Experiência Global (Dezembro 2025)
*Foco: Acessibilidade, Internacionalização e Identidade.*
- [x] **Dark Mode:** Implementar alternância de tema (Claro/Escuro) utilizando classes `dark:` do Tailwind e persistência no localStorage.
- [x] **Internacionalização (i18n):** Suporte a múltiplos idiomas (PT-BR / EN-US) utilizando `react-i18next`.
- [x] **Design System Refinement:** Padronização final de tokens de espaçamento e tipografia.

### v2.2.0 - Performance & UX (Dezembro 2025)
*Foco: Resolver a lentidão percebida e modernizar a camada de dados.*
- [x] **TanStack Query (React Query):** Substituir `useEffect` por `useQuery` para cache inteligente, deduplicação de requisições e "stale-while-revalidate".
- [x] **Skeleton Screens:** Implementar estados de carregamento pulsantes (esqueletos) para substituir spinners bloqueantes e melhorar o LCP (Largest Contentful Paint).
- [x] **Code Splitting:** Implementar `React.lazy` e `Suspense` para carregar bibliotecas pesadas (Chart.js, html2pdf) apenas quando necessárias.

### v2.1.0 - Polimento & Distribuição (Dezembro 2025)
- [x] **Exportação PDF:** Funcionalidade completa de relatórios com correção de quebra de página.
- [x] **Dados Precisos:** Correção crítica nas queries da Search API (Merges/Issues zerados) e lógica de "Smart Trim" para gráficos de projetos novos.
- [x] **Identidade Visual:** Implementação do logo oficial ASSERT Lab e Favicon.
- [x] **Deploy Automatizado:** Fluxo CI/CD para GitHub Pages via branch `gh-pages`.

### v2.0.0 - A Grande Migração (Novembro 2025)
- [x] **Reescrita Arquitetural:** Migração total de Vanilla JS para **React + Vite**.
- [x] **Design System v2:** Adoção do **Tailwind CSS** com paleta "Ocean Tech" (Shark/Ocean) e estilo inspirado no Flowbite.
- [x] **Componentização:** Criação de componentes atômicos (`StatCard`, `Header`, `Charts`).
- [x] **Novas Métricas:** Implementação de Code Churn, Zombie Branches, Lead Time e Divergência.

---

## 🏛️ O Passado: A Era Vanilla (v1.0)
*Esta seção preserva o plano original de implementação do MVP em JavaScript Puro.*

### Visão Geral v1
Dashboard SPA focado no ensino de Engenharia de Software.
**Stack Original:** HTML5, JS ES6 Modules, Tailwind CDN, Chart.js.

#### Phase 1: Scaffolding (Concluído)
- [x] **Directory Structure:** `/src`, `/modules`, `/assets`.
- [x] **Base HTML:** Estrutura semântica com Tailwind via CDN.
- [x] **Config:** Configuração inicial de constantes e Rate Limits.

#### Phase 2: Core Logic (Concluído)
- [x] **GitHub API Module:** Encapsulamento de `fetch` e tratamento de erros (403/404).
- [x] **Data Processing:** Agregação de commits por dia e cálculo de métricas de volume.
- [x] **Error Handling:** Estratégia Fail-Safe para APIs secundárias.

#### Phase 3: UI/UX (Concluído)
- [x] **Search Component:** Input com sanitização e validação.
- [x] **Metrics Cards:** Cards de Stars, Forks, Issues (Open/Closed).
- [x] **Charts:** Gráfico de barras (Commits/Dia) e Rosca (Stack Tecnológica).
- [x] **Layout:** Design responsivo Mobile-first.
- [x] **State Management:** Gerenciamento manual de estado (Loading/Error/Success).

#### Phase 4: Integration & Polish (Concluído)
- [x] **Entry Point:** Orquestração via `main.js`.
- [x] **Health Score:** Algoritmo próprio de governança (Readme, License, Contributing).
- [x] **Bus Factor:** Análise de centralização de código na tabela de contribuidores.
- [x] **Crunch Detector:** Análise de horários de commit (Madrugada/Fim de semana).

---

## 📝 Última Atualização

Sessão de trabalho cobriu, em sequência: security hardening (v3.5.0), fix de sincronização de router (v3.5.1), prefetch de chart.js (v3.5.2), reestruturação do `AGENTS.md` (migração de conteúdo do `CLAUDE.md`, novo critério de quando rodar `/code-review`/`/simplify` — não é mais "código vs. documentação", e sim se a mudança afirma algo verificável sobre o comportamento atual do sistema), o backlog secundário de tech debt do `/code-review`/`/simplify` (A4, M2, M5, B3, B4, B5) revisado e fechado, e o hardening de RPC da v3.6.1 (`get_leaderboard`, `registrar_busca`, corrigidas após revisão via Supabase Security Advisor). Processo de release: tags `v3.6.0` e `v3.6.1` publicadas, com correção de uma tag que apontava para o commit errado.

**Próximo passo escolhido:** a decidir — reclassificação das 44 vulnerabilidades do npm audit ainda pendente.

---

**Mantido por [ASSERT Lab](https://assertlab.com)** 🦈
