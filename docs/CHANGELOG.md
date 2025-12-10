# 📋 Changelog - Bisolhador Dashboard

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
