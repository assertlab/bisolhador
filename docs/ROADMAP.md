# 🗺️ Roadmap - Bisolhador Dashboard

Este documento rastreia a evolução do Bisolhador, desde sua concepção em Vanilla JS até a arquitetura atual em React, e define os próximos passos estratégicos.

---

## 🔮 O Futuro (Próximas Versões)

### 🔭 v3.0.0 - v3.0.1 - Time Machine ✅
*Nota: A infraestrutura de backend (snapshots históricos) foi antecipada na v2.7.2, permitindo foco na experiência temporal.*
- [x] **Timeline Histórica (Time Machine):** Visualização temporal de métricas através de gráficos de evolução baseados nos snapshots armazenados (Stars, Forks, Watchers). Implementado com página dedicada `/timeline/:owner/:repo` e botão "Ver Evolução" no RepoInfoCard.
- [x] **Filtros Temporais:** Controles de período (7d, 30d, 90d, todo histórico) para análise focada de intervalos específicos na Timeline.
- [x] **Security Hotfix (v3.0.1):** Atualização crítica de dependências (html2pdf.js, jspdf) para mitigar vulnerabilidades CVE.
- [ ] **Resiliência de Analytics:** Implementar lógica de Retry com Exponential Backoff para o serviço de analytics (atual: fire-and-forget).
- [ ] **UX de Falhas Parciais:** Melhorar feedback visual no Dashboard quando githubService retorna dados parciais (atual: silencia erro e retorna array vazio).

### 🎯 v3.1.0+ - Próximas Iterações (Planejado)
- [ ] **Benchmark de Repositórios (Comparação Multi-Repo):** Suporte a múltiplos repositórios (até 10) simultâneos na Timeline, com gráficos de linhas comparativos por métrica (Stars, Forks, etc). Seleção via multi-select ou chips para análise comparativa side-by-side.
- [ ] **Gamificação:** Badges de conquista para alunos (ex: "Clean Coder", "Bug Hunter").
- [ ] **Exportação Avançada:** CSV além do PDF/JSON existente.

---

## ✅ O Presente (React Era)

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

**Mantido por [ASSERT Lab](https://assertlab.com)** 🦈
