# Manual de Instruções para IAs: Bisolhador Dashboard v3.1.0

## 1. Resumo do Projeto

O **Bisolhador** é um Dashboard de Análise de Repositórios GitHub de código aberto, desenvolvido como um Single Page Application (SPA) em React. Ele transforma dados de repositórios GitHub em insights poderosos para apoiar o ensino de Engenharia de Software, focando especificamente em métricas educacionais e práticas profissionais. O projeto possui análise temporal (Time Machine) com histórico de evolução de métricas e telemetria via Google Analytics 4 para monitoramento de crescimento e uso.

### Problema que Resolve
- Fornece métricas visuais e quantitativas de repositórios GitHub para estudantes e professores.
- Identifica padrões de trabalho, maturidade de infraestrutura e saúde comunitária.
- Apoia decisões pedagógicas sobre boas práticas de desenvolvimento de software.
- Permite analisar saúde de projetos open-source e gestão de tempo (evitar "crush time").

### Estratégia de Analytics Híbrida
- **Supabase**: Dados críticos de negócio (buscas de repositórios) - bypassing AdBlock para métricas de uso real.
- **Google Analytics 4**: Métricas de vaidade/navegação (pageviews, eventos de engajamento) - bloqueáveis por AdBlock.
- **Objetivo**: Combinar dados confiáveis de uso com métricas de engajamento para tomada de decisões estratégicas.

### Principais Funcionalidades
- Busca inteligente por repositórios (`owner/repo`).
- Visualização de stack tecnológica com cores dinâmicas.
- Métricas: commits, pull requests, issues, contribuidores.
- Health Score baseado em governança comunitária.
- Análise de hábitos de trabalho e maturidade de engenharia.
- Contribuição de dados.
- **v3.1.0**: Benchmark Multi-Repo - Comparação simultânea de até 10 repositórios com gráficos de evolução, filtros temporais unificados (7d, 30d, 60d, 90d, todo histórico) e tabela comparativa.
- **v3.0.1**: Security Hotfix (html2pdf.js, jspdf) e Filtros Temporais na Timeline (7d, 30d, 90d, todo histórico).
- **v3.0.0**: Time Machine - Visualização temporal de métricas com gráficos de evolução (Stars, Forks, Watchers) através de snapshots históricos.
- **v2.7.3**: Busca Semântica Histórica com URLs legíveis (`/?repo=owner/project&date=YYYY-MM-DD`) e badge temporal.
- **v2.7.2**: Deep Linking & Snapshots Permanentes (`/?q=owner/repo` e `/?id=123`) com compartilhamento seguro.
- **v2.6.0**: Leaderboard público alimentado por logs imutáveis no Supabase.
- **v2.5.0**: Supabase implementado para persistência de buscas (bypassing AdBlock) em paralelo com Google Analytics 4.
- **v2.3.0**: Dark Mode completo e internacionalização (PT-BR/EN-US) com detecção automática.
- **v2.2.0**: Performance otimizada com TanStack Query, skeleton screens e code splitting.
- **v2.1.0**: Export PDF funcional, gráficos inteligentes com smart trim, UX aprimorada com alertas inline.

### Estado Atual das Features
- **Benchmark Multi-Repo (v3.1.0)**: Página dedicada `/benchmark` para comparação simultânea de até 10 repositórios com gráficos de evolução temporal (Chart.js time-series), bar charts comparativos por categoria (Popularidade, Velocidade, Qualidade), tabela comparativa detalhada, Health Score bars e análise de Bus Factor. Filtros temporais (7d, 30d, 60d, 90d, todo histórico) normalizam visualizações para repos com datas de início diferentes. Hook `useBenchmarkRepos` busca dados em paralelo via TanStack Query.
- **Time Machine (v3.0.0-v3.0.1)**: Página dedicada `/timeline/:owner/:repo` com gráficos de evolução temporal e filtros de período (7d, 30d, 60d, 90d, todo histórico) para análise focada.
- **Compartilhamento de Resultados**: Permalinks com Deep Linking (`/?q=owner/repo`) e Snapshots históricos (`/?id=123`) via RPC segura no Supabase.
- **Data Mining**: Botão de exportação JSON com metadados de proveniência (versão/data) para auditoria e análise externa.
- **Inteligência Coletiva**: Leaderboard público alimentado por logs imutáveis no Supabase.
- **Analytics Híbrido**: Supabase + GA4 implementado com bypass de AdBlock.
- **Qualidade de Código**: Segue práticas de Clean Code com remoção de dead code, logs de debug e tratamento robusto de erros.
- **Secure by Design**: Auditoria de segurança completa, dependências atualizadas (v3.0.1), dados sensíveis protegidos.

## 2. Arquitetura Técnica

### Backend / Supabase
- **Estratégia de Dados 'Save on Load'**: Dados são salvos automaticamente no momento da busca, garantindo integridade histórica e IDs únicos, em vez de depender de ação explícita do usuário.
- **Escrita Exclusiva via RPC**: Todas as operações de escrita no banco utilizam RPCs seguros (`registrar_busca`) em vez de INSERT direto, garantindo validação e controle de acesso.
- **Leitura de Histórico com Timezone Dinâmico**: Dados históricos são recuperados via RPC dedicada (`buscar_snapshot_por_data`) com detecção automática de fuso horário do usuário usando `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- **Schema da Tabela**: `analytics_searches` utiliza `id` do tipo `BIGINT` (não UUID) e `health_score` do tipo `NUMERIC` para compatibilidade com tipos numéricos do JavaScript.
- **Segurança Hardening**: INSERT direto foi revogado para usuários anônimos via Row Level Security (RLS), forçando uso de RPCs validadas para todas as operações.

### Stack Tecnológico
- **Frontend**: React 18 + Vite + Tailwind CSS.
- **Bibliotecas**: react-chartjs-2 (gráficos), html2pdf.js (export PDF), @tanstack/react-query (data fetching/cache), react-i18next (internacionalização), react-ga4 (analytics).
- **Integrations**: GitHub REST API v3.
- **Performance**: React.lazy + Suspense (code splitting), Skeleton screens (LCP optimization), useMemo para otimização de re-renders em gráficos.
- **Acessibilidade**: Conformidade WCAG AA com semântica de tabelas (scope="col"), aria-label/aria-hidden em ícones, leitores de tela suportados.
- **Build**: Vite (HMR, fast refresh).
- **Deploy**: GitHub Pages.

### Estrutura de Módulos
O código está organizado em módulos ES6 modernos em `src/`, com responsabilidades claras:
- `src/components/`: UI Components (StatCard, Header, Charts, etc.)
- `src/components/charts/`: Chart Components (BenchmarkEvolutionChart, BenchmarkComparisonChart)
- `src/hooks/`: Lógica de Estado (useRepository, useBenchmarkRepos, useChartTheme)
- `src/pages/`: Páginas dedicadas (Timeline, Benchmark)
- `src/services/`: Chamadas de API (githubService - integração GitHub)
- `src/utils/`: Utilitários (pdfExporter, formatters, analyzers)

### Utilitários
- `src/utils/pdfExporter.js`: Lógica de exportação para PDF.
- `src/utils/exportJson.js`: Exportação de dados em JSON (Client-side) para interoperabilidade.
- `src/utils/analyzers.js`: Análise de métricas (health score, bus factor, etc.).
- `src/utils/formatters.js`: Formatação de dados (idades, números).

### Ponto de Entrada
- `src/main.jsx`: Inicializa aplicação React com Vite.
- `src/App.jsx`: Componente principal com roteamento e estado global.

### Estrutura de Dados
- Dados são buscados via `githubService`, processados localmente e gerenciados pelo hook `useRepository`.
- Estado centralizado em React hooks com fail-safe para erros.
- Nenhum banco de dados; dados persistem apenas na sessão.

### Frontend / State Management
- **Hierarquia de Busca (Prioridade)**:
  - **Permalink (v2.7.2)**: Busca exata por ID (`?id=123`) - prioridade máxima para links imutáveis.
  - **Semantic (v2.7.3)**: Busca pelo último registro de uma data específica (`?repo=owner/project&date=YYYY-MM-DD`) - prioridade média com suporte a timezone.
  - **Live**: Busca em tempo real na API do GitHub (`?q=owner/repo`) - fallback padrão.
- **Fluxo Híbrido de Dados**:
  - **Live Mode**: Busca dados em tempo real da API do GitHub quando não há parâmetros de URL.
  - **Snapshot Mode**: Carrega dados históricos do Supabase via RPC quando URL contém `?id=...` ou `?repo=...&date=...`.
- **Deep Linking**: Sincronização automática entre estado da aplicação e URL através de `pushState`.
- **Adaptador de Dados**: Conversão automática de dados flat do Supabase para formato nested esperado pelos componentes React.

## 3. Regras de Negócio Críticas

### Fail-Safe nas APIs
- Todas as chamadas API devem ser envolvidas em try-catch.
- Em caso de erro, **nunca** quebrar a aplicação; retornar valores vazios (ex: [], null) e log console.warn.
- Tratamento silencioso de erros da API do GitHub (ex: 422 em repositórios gigantes) para manter o console limpo.
- Quando erro 403 (Rate Limit), sugerir adicionar token.
- Quando erro 404 (repo não encontrado), mostrar mensagem amigável.
- Contribua comportamento gracioso: sempre renderizar UI, mesmo com dados parciais.

### Sistema de Token (localStorage)
- Token salvo em `localStorage['github_token']`.
- Aumenta rate limit de 60 para 5.000 requests/hora.
- Inclusão automática no header `Authorization: token ${token}` em `githubService`.
- Configuração via botão ⚙️ (engrenagem), permanecendo privativa no navegador.

### Health Score com 7 Critérios (Cálculo Local)
- **Apenas 7 itens avaliados**, independente de dados extras da API.
- Critérios:
  1. README
  2. License
  3. Contributing
  4. Description (não vazia)
  5. Code of Conduct
  6. Issue Template
  7. Pull Request Template
- Score = (itens presentes / 7) * 100%.
- Cores: Verde (>75%), Amarelo (>50%), Vermelho (abaixo).
- Dados vêm da API GitHub (`/repos/{owner}/{repo}/community/profile`), mas cálculo é local.
- **Não** use APIs externas para score; sempre calcular localmente baseado nos dados retornados.

### Smart Trim nos Gráficos
- **CommitActivityChart**: Para projetos jovens (< 52 semanas), encontra primeiro commit não-zero e mostra período relevante com margem de contexto.
- **Objetivo**: Evitar gráficos vazios mostrando apenas semanas com atividade significativa.
- **Lógica**: `findIndex(value => value > 0)` + margem de 2 semanas antes da primeira atividade.

## 4. Padrões de Projeto (Design System)

### Tema Visual
- **Cores Shark/Ocean**:
  - Azul marinho para primários: `bg-blue-500/700`, `text-blue-600`.
  - Tons de cinza para texto: `text-gray-900/600`.
  - Fundo: `bg-gray-100`.
  - Sem dark mode; sempre tema claro.

### Componentes React
- **Cards**: `bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow`.
- **Z-Index**: Todos os cards têm `hover:z-50` para tooltips.
- **Break-inside-avoid**: Para export PDF funcionar corretamente.
- **Grid responsivo**: 1 coluna (mobile), 2 (md), 5 (lg) para metrics.

### Tipografia e Espaçamento
- **Tailwind classes** padrão: `text-lg font-semibold`, `text-2xl` para valores.
- Padding/margin: `p-4`, `mb-4`, `gap-4`.
- Botões: `bg-blue-500 hover:bg-blue-700 text-white py-2 px-4 rounded`.

### Interações
- Formulário de busca preventDefault.
- Loading states via React state.
- Export PDF: `html2pdf.js` com configurações otimizadas.

### Convenções de Código
- React com Hooks e Functional Components.
- Nomes: PascalCase para componentes, camelCase para variáveis.
- ESLint com regras padrão do Vite.
- TypeScript não utilizado (planejado para futuro).

---

## Notas Finais para IAs
- **Compatibilidade**: Manter todos os comportamentos v1.0 preservados na migração React.
- **Testes**: Buscar repos como `twbs/bootstrap` ou `torvalds/linux` (maduros) e `assertlab/bisolhador` (jovem).
- **Edge Cases**: Repos inexistentes devem mostrar erro sem crash; rate limit deve sugerir token.
- **Export PDF**: Deve incluir todos os cards e gráficos sem quebras.

Ao continuar o trabalho, use este manual para garantir consistência e evitar regressões. Para dúvidas, buscar código existente primeiro.
