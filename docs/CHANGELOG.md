# 📋 Changelog - Bisolhador Dashboard

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.4.0] - 2026-02-19

### ☢️ Governance & Risk Edition

- **FEAT: Fator de Ônibus (Bus Factor) com cálculo rigoroso (Pareto 70%)**: Novo motor matemático em `src/utils/busFactor.js` que ordena contribuidores por commits, acumula até o limiar de 70% do esforço total e determina o número mínimo de desenvolvedores críticos. Classificação em 4 níveis de risco: Crítico (1 dev), Alto (2), Moderado (3-4) e Saudável (5+).
- **FEAT: Risk Card no Dashboard com avatares, classificação de risco e barra de progresso nativa em Tailwind**: Novo componente `BusFactorCard` com número central do Bus Factor com cor semântica por risco, avatares dos key developers com borda colorida, barra horizontal empilhada (divs Tailwind com largura inline proporcional) e legenda. Integrado como seção "Análise de Risco" entre Governança/Maturidade e Gráficos. i18n completo (PT-BR/EN-US).

---

## [3.3.0] - 2026-02-19

### 📊 Data Science Edition

- **FEAT: Exportação Avançada (CSV)**: Adicionado suporte nativo para download de métricas em formato CSV (separado por vírgulas e compatível com Excel via UTF-8 BOM). Motor próprio sem dependências externas, com escape RFC 4180 para campos com caracteres especiais.
- **FEAT: Integração CSV no Dashboard e Benchmark**: Botão "CSV" no Dashboard exporta 13 métricas do repositório (Stars, Forks, Issues, Health Score, Lead Time, Code Churn, Divergência, Branches, PRs, Merges, Releases). Botão "Exportar CSV" na Tabela Comparativa do Benchmark exporta colunas idênticas à tabela visual (Health Score, Lead Time, Divergência, Code Churn, Risco Bus Factor). Headers traduzidos dinamicamente via i18n (PT-BR/EN-US).

---

## [3.2.0] - 2026-02-19

### 🛡️ Resilience & Stability

- **FEAT: Exponential Backoff para Analytics**: Implementação de lógica de retentativas (Exponential Backoff) para envios de analytics ao Supabase, garantindo que oscilações de rede não percam dados. O serviço agora tenta reenviar automaticamente antes de desistir silenciosamente.
- **FEAT: Tratamento de Falhas Parciais (PartialDataAlert)**: Tratamento de falhas parciais da API do GitHub (ex: Rate Limit de commits). O painel agora renderiza o que conseguiu carregar e exibe um banner amigável (`PartialDataAlert`) detalhando os dados ausentes, em vez de silenciar erros.

---

## [3.1.2] - 2026-02-13

### 🐛 Patch Fix

- **Dynamic Version Display**: O componente `Header` agora exibe a versão da aplicação dinamicamente lendo do `package.json`, eliminando strings hardcoded e garantindo sincronização automática com o versionamento do projeto.

---

## [3.1.1] - 2026-02-13

### Refactoring Edition — 5 Sprints de Maturidade Técnica

Refatoração completa da codebase baseada no [Tech Debt Report v3.1.0](docs/TECH_DEBT_v3.1.0.md), executada em 5 sprints incrementais.

### 🐛 Sprint 1 — Bug Fixes & Quick Wins
- **Fix `useChartTheme`**: Adicionadas propriedades `tooltipBg`/`tooltipText` + `useMemo` no retorno do hook para corrigir tooltips sem cor em dark mode.
- **Safe localStorage**: Criado wrapper `src/utils/storage.js` com try-catch para evitar exceções em navegação privada (Safari/Firefox).
- **Dead code removido**: `sanitizeForJson.js` e export `allSuccess` não utilizado em `useBenchmarkRepos`.

### ⚡ Sprint 2 — Performance (useMemo em Charts)
- **Memoização de charts**: `chartData` e `chartOptions` envolvidos em `useMemo` em `Timeline.jsx`, `BenchmarkEvolutionChart.jsx`, `BenchmarkComparisonChart.jsx` e `CommitActivityChart.jsx`.
- **Padronização**: Todos os gráficos seguem o mesmo padrão de memoização para evitar re-criação do canvas Chart.js.

### 🔄 Sprint 3 — DRY (useTimeFilter Unificado)
- **`useTimeFilter` hook**: Lógica de filtragem temporal (7d/30d/60d/90d/all) extraída para hook reutilizável, eliminando duplicação entre Timeline e Benchmark.
- **`<TimeRangeFilter>` component**: Componente de UI unificado para seleção de período temporal.

### 🏗️ Sprint 4 — Architecture (Componentização)
- **Dashboard extraído**: `Dashboard` movido de `App.jsx` para `src/pages/Dashboard.jsx` com `snapshotAdapter.js` separado.
- **Benchmark componentizado**: 5 sub-componentes extraídos (`BenchmarkSearchForm`, `BenchmarkRepoChips`, `BenchmarkHealthBars`, `BenchmarkBusFactorRisk`, `BenchmarkDetailTable`).

### 🛡️ Sprint 5 — Security & Polish
- **Proteção XSS**: `dangerouslySetInnerHTML` substituído por componente `Trans` do react-i18next.
- **i18n completo**: Todas as strings hardcoded em português migradas para arquivos de locale.
- **Constantes extraídas**: Magic numbers movidos para `src/constants.js` (API pagination, thresholds, PDF config).
- **Migração de contexto**: `docs/CONTEXT.md` migrado para `CLAUDE.md` no padrão oficial Claude Code.

---

## [3.1.0] - 2026-02-13

### 🎉 Major Feature: Benchmark Multi-Repo
- **Página Benchmark (`/benchmark`)**: Comparação simultânea de até 10 repositórios com seleção via chips coloridos e remoção individual.
- **Gráficos de Evolução Comparativa**: Line charts com eixo temporal (`chartjs-adapter-date-fns`) mostrando evolução de Stars por repositório.
- **Gráficos de Comparação por Categoria**: Bar charts agrupados por Popularidade (Stars, Forks), Velocidade (Lead Time, Code Churn) e Qualidade (Health Score, Divergência).
- **Tabela Comparativa**: Tabela detalhada com Health Score, Lead Time, Divergência, Code Churn e classificação de risco Bus Factor.
- **Hook `useBenchmarkRepos`**: Busca paralela de dados via TanStack Query com `useQueries`, parse de `full_report` e extração de histórico completo.

### ⏱️ Filtros Temporais Unificados (Time Range)
- **Benchmark Filters**: Sistema de filtros (7d, 30d, 60d, 90d, todo histórico) acima dos gráficos do Benchmark. Default: 30d para normalizar visualização inicial de repos com datas de início diferentes.
- **Timeline 60d**: Novo filtro de 60 dias adicionado à página Timeline, expandindo as opções existentes.
- **Filtragem por `created_at`**: Dados filtrados via `useMemo` antes de serem passados aos componentes de chart, mantendo apenas registros dentro da janela temporal selecionada.

### 🌐 Internacionalização
- **Benchmark i18n**: Todas as strings do Benchmark traduzidas em PT-BR e EN-US (título, subtítulo, filtros, categorias, tabela, estados vazios/erro).
- **Filtro 60d**: Labels "60 dias" (PT) / "60 days" (EN) adicionados em `timeline.filters` e `benchmark.filters`.

### 🎨 UI/UX
- **Segmented Control Filters**: Botões de período com estilo consistente dark mode (mesmo padrão da Timeline).
- **Repo Chips**: Tags de seleção com cor identificadora, nome e botão de remoção.
- **Lazy Loading**: Charts do Benchmark carregados via `React.lazy` + `Suspense`.

---

## [3.0.1] - 2026-02-13

### 🔒 Security Hotfix
- **Dependency Updates**: Atualização crítica do `html2pdf.js` (v0.14.0) e `jspdf` para mitigar vulnerabilidades de XSS e injeção detectadas em CVEs anteriores.
- **Security Audit**: Varredura completa de dependências para garantir segurança da cadeia de suprimentos.

### ✨ Enhancements
- **Filtros Temporais no Timeline**: Implementação de controles de período (7d, 30d, 90d, todo histórico) na página Time Machine, permitindo análise focada de intervalos específicos.
- **UX Improvements**: Interface segmentada com botões de filtro estilizados e suporte completo a dark mode.

---

## [3.0.0] - 2026-02-12

### 🎉 Major Feature: Time Machine (Histórico de Evolução)
- **Visualização Temporal de Métricas**: Nova página `/timeline/:owner/:repo` para visualizar a evolução histórica de repositórios através de gráficos de linha interativos.
- **Gráficos de Evolução**: Gráficos Chart.js mostrando evolução de Stars, Forks e Watchers ao longo do tempo com dados extraídos de snapshots históricos.
- **Supabase RPC**: Nova função `get_repo_history(p_repo_name)` para buscar histórico completo de análises ordenadas cronologicamente.
- **UI Enhancements**: Botão "📈 Ver Evolução" adicionado ao RepoInfoCard para acesso direto à timeline do repositório.
- **Cards de Resumo**: Visualização de primeira análise, última análise e crescimento total de stars.
- **Internacionalização Completa**: Todas as strings da nova feature traduzidas em PT-BR e EN-US.

### 🛠️ Backend
- **Nova RPC**: `get_repo_history` com segurança `SECURITY DEFINER` e `SET search_path = public`.
- **Serviço Analytics**: Método `getRepoHistory(repoName)` adicionado para consumir a nova RPC.

### 🎨 UX/UI
- **Nova Rota**: `/timeline/:owner/:repo` integrada ao React Router.
- **Estado de Loading/Error**: Tratamento robusto de estados de carregamento e erro com feedback visual claro.
- **Dark Mode Support**: Tema escuro totalmente suportado nos novos gráficos através do hook `useChartTheme`.
- **Botão de Navegação**: Botão "Voltar ao Dashboard" para navegação intuitiva.

### 📊 Data Visualization
- **Line Charts**: Gráficos de linha com preenchimento gradiente e tensão suavizada (0.4).
- **Tooltips Interativos**: Tooltips detalhados mostrando valores de múltiplas métricas por data.
- **Cores Semânticas**: Dourado (#FFD700) para Stars, Azul (#3B82F6) para Forks, Verde (#10B981) para Watchers.

---

## [2.8.3] - 2026-01-20

### Fix (Navigation): Header State Management
- **Global Modal State**: Refactored settings modal state to App.jsx level, ensuring Header buttons (Settings & Language) work consistently across all routes (Dashboard & Ranking).
- **Cross-Route Functionality**: Fixed issue where configuration and language buttons were non-responsive in Ranking page due to isolated state management.

### Fix (i18n): Complete Internationalization
- **Missing Translations**: Added complete translations for Help Modal, Settings Modal, Ranking table, and Navigation links.
- **Header Navigation**: Implemented i18n for "Buscar/Search" and "Ranking" navigation links.
- **Modal Content**: Fully translated Help Modal (about, token setup, usage steps) and Settings Modal (title, description, labels, buttons).
- **Ranking Page**: Translated all table headers, loading/error messages, and empty state content.

### UX: Universal Access to Settings
- **Consistent Experience**: Users can now access settings and change language from any page in the application.
- **State Persistence**: Modal state properly managed globally to prevent navigation issues.

---

## [2.8.2] - 2025-12-19

### Feat (i18n): Timezone Detection
- **Automatic Timezone Detection**: Implemented automatic timezone detection using `Intl.DateTimeFormat().resolvedOptions().timeZone`. Date searches now respect the user's local timezone (e.g., Japan, Lisbon) instead of being fixed to 'America/Recife'.

### Backend: RPC Update
- **Dynamic Timezone Parameter**: Updated `buscar_snapshot_por_data` RPC to accept dynamic `p_timezone` parameter.

---

## [2.8.1] - 2025-12-18

### Architecture: Save on Load Strategy
- **Auto-Save Implementation**: Mudança fundamental da estratégia de persistência para "Save on Load". Agora os snapshots são salvos automaticamente ao fim da busca, garantindo integridade histórica e IDs únicos, em vez de depender da ação de compartilhar.

### Fix: Critical JSON Parse Issue
- **App.jsx JSON Handling**: Correção crítica no `loadSnapshot` e `loadSnapshotByDate` adicionando `JSON.parse()` obrigatório para tratar o campo `full_report` (que vem serializado como string do banco), evitando `TypeError` ao tentar acessar propriedades.

### Feature: Data Sanitization
- **Robust Sanitization**: Implementação de sanitização de dados (`sanitizeForJson`) para evitar falhas em repositórios gigantes onde a API do GitHub pode retornar referências circulares ou objetos não serializáveis.

### UX: Instant Share Button
- **Instant Sharing**: O botão 'Compartilhar' agora é instantâneo (apenas cópia de link), pois os dados já estão salvos automaticamente, melhorando a experiência do usuário.

---

## [2.7.4] - 2025-12-18

### Fix
- **Correção de loop infinito (re-render cycle) na busca semântica por data**: Implementação de guard clause com useRef para prevenir fetches duplicados no endpoint `buscar_snapshot_por_data`.

---

## [2.7.3] - 2025-12-17

### Feature: Busca Semântica Histórica
- **URLs Legíveis**: Suporte a `/?repo=owner/project&date=YYYY-MM-DD` para buscar snapshots por data.
- **Data da Análise**: Exibição da data/hora de coleta no card principal do dashboard.

### UX
- **Badge Temporal**: Ícone de relógio com formatação inteligente da data de análise.
- **Timezone Handling**: Correção de timezone (UTC vs Local) na busca de snapshots por data.

### Fix
- **Hierarquia de Busca**: Implementação completa da prioridade: ID > Semantic > Live.
- **Compatibilidade**: Manutenção de URLs existentes (?id= e ?q=).

---

## [2.7.2] - 2025-12-17

### Feature: Deep Linking & Snapshots
- **Deep Linking**: URLs de busca ao vivo (`/?q=owner/repo`) para compartilhamento direto.
- **Snapshots Permanentes**: Links imutáveis via ID (`/?id=123`) com dados congelados.
- **Botão Compartilhar**: Geração automática de permalinks via clipboard.

### Backend
- **Schema Update**: Migração para IDs `BIGINT` e scores `NUMERIC` no Supabase.
- **RPC Seguras**: `registrar_busca` e `obter_snapshot` com validação de dados.
- **Security Hardening**: Bloqueio de INSERT direto para usuários anônimos via RLS.

### UX
- **Modo Histórico**: Alerta visual diferenciando dados estáticos vs atuais.
- **URL Management**: Sincronização automática entre estado da aplicação e URL.
- **Adaptador de Dados**: Conversão flat→nested dos dados do Supabase.

---

## [2.7.1] - 2025-12-12

### Security
- Implementação de RPC segura no Supabase para validação de dados.
- Bloqueio de INSERT direto via RLS (Hardening).

### Docs
- Atualização do guia de contribuição para stack Vite/React.

---

## [2.7.0] - 2025-12-10

### New Feature: JSON Data Export
- **Exportação de dados em JSON**: Botão secundário no RepoInfoCard para baixar dados brutos com metadados de proveniência.

### Fix: GitHub API 422 Error Handling
- **Tratamento silencioso para erro 422**: FetchCodeFrequency agora retorna array vazio silenciosamente em repositórios gigantes.

### Engineering & Quality
- **Performance**: Otimização de renderização de gráficos com `useMemo` para evitar re-renders desnecessários em componentes Chart.js.
- **Acessibilidade (A11y)**: Melhorias semânticas na tabela de Ranking (`scope="col"`) e ícones (`aria-label`, `aria-hidden`) para conformidade WCAG AA (Leitores de tela).
- **Code Quality**: Remoção de logs de debug e código morto (Dead Code) pós-refatoração, fortalecimento do tratamento de erros no serviço de analytics.

---

## [2.6.0] - 2025-12-10

### New Feature: Leaderboard (Bisolhômetro)
- **Página de Ranking (/ranking)**: Nova página com tabela de classificação de repositórios mais analisados.
- **Data Engineering**: Coleta de snapshot completo (Estrelas, Health Score, Linguagem) no Supabase a cada busca.
- **UX/UI**: Nova navegação no Header (Links Buscar/Ranking) e correção de rotas com basename.
- **Refactor**: Botão de PDF movido para o contexto do card do repositório.

---

## [2.5.0] - 2025-12-09

### Analytics & Persistência

- **Analytics Híbrido:** Implementação do Supabase para persistência de buscas (bypassing AdBlock) em paralelo com Google Analytics 4.
- **Infraestrutura:** Adição de cliente Supabase e novas variáveis de ambiente.
- **Resiliência:** Melhoria no tratamento de falhas da API (Fail-safe).

---

## [2.4.0] - 2025-12-03

### Analytics & Qualidade

- **Google Analytics 4:** Implementação completa de rastreamento de eventos (Buscas, Downloads) e PageViews para monitoramento de crescimento.
- **ESLint Otimizado:** Ajuste nas regras de linting para ignorar pastas de build e legado, garantindo um CI/CD limpo.

---

## [2.3.0] - 2025-12-03

### 🎨 Design & Global Experience

- **Dark Mode:** Full dark theme (Abyssal Shark) with persistence and automatic graphic adaptation.
- **Internationalization (i18n):** Full support for **Portuguese (PT-BR)** and **English (EN-US)** with automatic detection.
- **UI Refinements:** Z-Index correction in the Header and translated dynamic Bus Factor messages.

---

## [2.2.0] - 2025-12-02

### 🚀 Performance & UX
- **TanStack Query:** Migração para React Query com cache inteligente (5min), retentativas automáticas e eliminação de waterfalls.
- **Skeleton Screens:** Implementação de placeholders pulsantes para melhorar percepção de velocidade (LCP otimizado).
- **Code Splitting:** Lazy loading dos componentes de gráficos (Chart.js) para reduzir bundle inicial.

---

## [2.1.0] - 2025-12-01

### ✨ Adicionado
- **Exportação de PDF:** Botão funcional para baixar relatório completo.
- **Identidade Visual:** Logo oficial do Assert Lab e Favicon.

### 🔧 Corrigido
- **Dados:** Correção crítica nas queries da Search API (Issues e PRs estavam zerados).
- **Gráficos:** Ajuste na lógica de 'Smart Trim' do Fluxo de Trabalho para projetos novos.
- **Deploy:** Correção de caminhos absolutos (assets) para suporte ao GitHub Pages.

---

## [1.2.0] - 2025-11-30

### ✨ Added
- **Process Analysis Module**: New section analyzing Pull Request dynamics with Lead Time and Divergence/Convergence metrics
  - Lead Time calculation: Average time from PR creation to merge, with smart singular/plural display ('hora' vs 'horas')
  - Divergence metric: Average comments per PR, categorized as 'Baixa (Silencioso)', 'Saudável', or 'Alta (Debate Intenso)'
  - Extreme defensive programming: Handles NaN cases, null arrays, and invalid data gracefully
- **Code Churn Analysis**: Added churn rate calculation to metrics cards with API status handling
  - Returns null for 202/empty responses, displays "Calculando pelo GitHub..." in UI
  - Tracks lines added/removed over time for code volatility insights
- **Zombie Branches Detection**: Enhanced maturity analysis with branch zombie identification
  - Always displays badge (green for 0 zombies, red for >0)
  - Identifies stale branches that may indicate poor maintenance practices
- **Merged PRs Counter**: Repository info now includes total merged pull requests
  - Provides insight into project activity and contribution patterns
- **Dynamic Chart Transparency**: Commit charts now show sample size in titles
  - Displays "(Amostra: X commits)" to indicate data scope
  - Helps users understand analysis limitations for small repositories

### 🔧 Changed
- **Tooltip System**: Updated all tooltips with explicit classification criteria
  - Divergence: "< 1: Baixa (Silencioso), 1 a 5: Saudável, > 5: Alta (Debate Intenso)"
  - Work Habits: "Alerta se > 30% de Madrugada ou > 50% no Fim de Semana"
  - Bus Factor: "Risco de Atenção se > 40%, Risco Crítico se > 60%"
  - Health Score: "Nota baseada em 7 itens: Readme, License, Contributing, Description, Code of Conduct, Issue Template e PR Template"
- **API Error Handling**: Improved robustness for GitHub API responses
  - Better null/empty response handling across all modules
- **Data Validation**: Extreme defensive programming in divergence calculation
  - Input validation, safe averaging, NaN protection

### 🐛 Fixed
- **NaN Classification Bug**: Fixed divergence metric incorrectly categorizing NaN as high debate
  - Now properly returns 'Sem dados (0 PRs)' for empty repositories
- **Plural Logic**: Lead Time now correctly displays singular forms ('1 hora' vs '2 horas')
- **Chart Titles**: Dynamic titles now reflect actual commit sample sizes

---

## [1.1.0] - 2025-11-29

### ✨ Added
- **Commit History Flow Chart**: New timeline visualization showing commit activity over the repository's lifetime
  - Smart trimming for young projects (< 52 weeks)
  - Weekly commit aggregation with responsive line charts
- **Enhanced Toolbar**: Improved header with help modal and PDF export functionality
  - Contextual help for token configuration and usage
  - One-click PDF report generation
- **Release Counter**: Repository info now displays total releases/tags
  - Provides insight into project versioning and release frequency

### 🔧 Changed
- **UI Polish**: Refined responsive layouts and hover effects
- **Performance**: Optimized chart rendering and data processing

---

## [1.0.0] - 2024-11-28

# 🎉 Release Notes - Bisolhador Dashboard v1.0.0

We're thrilled to announce the launch of **Bisolhador Dashboard v1.0.0**, the first stable release of our GitHub Repository Analysis tool! This milestone marks the culmination of dedicated efforts to create an intuitive, reliable platform for educators and developers to gain valuable insights into software engineering practices.

## 🚀 What's New in v1.0.0

### 🔍 **Busca & Dados** (Fail-Safe, Token)
- **Intelligent Search**: Seamlessly search and analyze GitHub repositories using the simple `owner/repo` format.
- **Robust Fail-Safe Mechanisms**: Built-in error handling ensures the application remains stable even during API failures, rate limits, or connectivity issues.
- **GitHub Token Integration**: Easily configure personal tokens via the settings ⚙️ button to increase request limits from 60 to 5,000 per hour, enabling uninterrupted analysis sessions.

### 📊 **Métricas Visuais** (Gráficos, Stack Tecnológica)
- **Dynamic Charts**: Visualize commit patterns across weekdays with intuitive bar charts that highlight work habits and crunch periods.
- **Technological Stack Visualization**: Explore project language composition through dynamic, color-coded doughnut charts. Known languages feature standardized colors, while unknown languages receive algorithmically generated hues for optimal readability.

### 🔬 **Análise de Processo** (Bus Factor, Crunch, Taxa de Resolução)
- **Contributors Table**: Analyze team composition and distribution through a comprehensive contributors ranking, helping identify Bus Factor risks.
- **Crunch Detection**: Automated analysis of commit timing to detect excessive weekend or late-night work, promoting healthy development practices.
- **Resolution Rate**: Calculate issue resolution efficiency with real-time metrics showing open vs. closed issue ratios, supporting project health assessments.

### 🛡️ **Governança** (Health Score, Maturidade de Engenharia)
- **Community Health Score**: Evaluate repository governance through a scoring system based on 7 critical files (README, License, Contributing Guidelines, etc.), providing a percentage-based health indicator with color-coded feedback.
- **Engineering Maturity Assessment**: Inspect infrastructure quality by checking for Automated Tests, CI/CD pipelines, Linters, and Security Auditing tools, displayed through intuitive badge visualizations.

### 🛠️ **Utilitários** (PDF, Tooltips)
- **PDF Export**: Generate comprehensive PDF reports of all dashboard metrics, perfect for documentation, presentations, or archival purposes.
- **Interactive Tooltips**: Contextual help throughout the interface with hover-based explanations, ensuring users understand each metric's significance.
- **Responsive Design**: Mobile-friendly layouts that adapt gracefully across devices, built with modern Tailwind CSS.

## 🏆 Key Highlights
- **Educational Focus**: Designed specifically to support Software Engineering education, helping students and instructors identify best practices and common pitfalls.
- **Open Source Community**: Built for collaboration, using GitHub's ecosystem to analyze projects within the platform.
- **Privacy-First**: All configured tokens remain local to your browser, ensuring data security and user control.
- **Zero Dependencies Setup**: Launch the dashboard instantly using VS Code's Live Server extension - no complex installations required.

## 📈 Performance & Reliability
- **Stable API Integrations**: Comprehensive error handling for all GitHub API calls, maintaining functionality even during network issues.
- **Efficient Rendering**: Fast, responsive UI updates powered by Chart.js and Vanilla JS architecture.
- **Accessible Interface**: Professional design with Shark/Ocean color themes, clear typography, and semantic HTML structure.

## 🤝 Acknowledgments
A heartfelt thank you to everyone who contributed to making Bisolhador v1.0.0 a reality:

- **Core Development Team**: Vinicius Cardoso Garcia and the ASSERT Lab community for their vision and expertise.
- **Beta Testers**: Early adopters who provided invaluable feedback on usability and functionality.
- **Open Source Community**: Leveraging powerful tools like GitHub API, Tailwind CSS, and Chart.js to build this solution.
- **Educators and Developers**: Whose innovative practices inspired the creation of tools to measure and improve software engineering excellence.

We're excited to see how the community uses Bisolhador to enhance educational outcomes and promote better development habits. This is just the beginning - stay tuned for future updates and enhancements!

---

**Get Started**: Clone the repository, install the Live Server extension in VS Code, and open `index.html`. Happy analyzing!

Celebrating this milestone with 🦈 (our Recife roots)!
