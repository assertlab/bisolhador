# 🗺️ Roadmap - Bisolhador Dashboard

Este documento rastreia a evolução do Bisolhador, desde sua concepção em Vanilla JS até a arquitetura atual em React, e define os próximos passos estratégicos.

---

## 🔮 O Futuro (Próximas Versões)

### 🔭 v3.0.0 - A Plataforma (Longo Prazo)
- [ ] **Comparador de Repositórios:** Visualização "Split View" para comparar dois projetos lado a lado.
- [ ] **Gamificação:** Badges de conquista para alunos (ex: "Clean Coder", "Bug Hunter").
- [ ] **Painel Público de Repositórios Mais Buscados (Leaderboard):** Ranking público baseado em dados do Supabase.
- [ ] **Exportação Avançada:** JSON/CSV além do PDF.

---

## ✅ O Presente (React Era)

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

**Mantido por [ASSERT Lab](https://assertlab.com)** 🦈
