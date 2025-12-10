# Manual de Instruções para IAs: Bisolhador Dashboard

## 1. Resumo do Projeto

O **Bisolhador** é um Dashboard de Análise de Repositórios GitHub de código aberto, desenvolvido como um Single Page Application (SPA) em React. Ele transforma dados de repositórios GitHub em insights poderosos para apoiar o ensino de Engenharia de Software, focando especificamente em métricas educacionais e práticas profissionais. O projeto agora possui telemetria via Google Analytics 4 para monitoramento de crescimento e uso.

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
- **v2.6.0**: Leaderboard público alimentado por logs imutáveis no Supabase.
- **v2.5.0**: Supabase implementado para persistência de buscas (bypassing AdBlock) em paralelo com Google Analytics 4.
- **v2.3.0**: Dark Mode completo e internacionalização (PT-BR/EN-US) com detecção automática.
- **v2.2.0**: Performance otimizada com TanStack Query, skeleton screens e code splitting.
- **v2.1.0**: Export PDF funcional, gráficos inteligentes com smart trim, UX aprimorada com alertas inline.

### Estado Atual das Features
- **Inteligência Coletiva**: Leaderboard público alimentado por logs imutáveis no Supabase.
- **Analytics Híbrido**: Supabase + GA4 implementado com bypass de AdBlock.

## 2. Arquitetura Técnica

### Stack Tecnológico
- **Frontend**: React 18 + Vite + Tailwind CSS.
- **Bibliotecas**: react-chartjs-2 (gráficos), html2pdf.js (export PDF), @tanstack/react-query (data fetching/cache), react-i18next (internacionalização), react-ga4 (analytics).
- **Integrations**: GitHub REST API v3.
- **Performance**: React.lazy + Suspense (code splitting), Skeleton screens (LCP optimization).
- **Build**: Vite (HMR, fast refresh).
- **Deploy**: GitHub Pages.

### Estrutura de Módulos
O código está organizado em módulos ES6 modernos em `src/`, com responsabilidades claras:
- `src/components/`: UI Components (StatCard, Header, Charts, etc.)
- `src/hooks/`: Lógica de Estado (useRepository - gerenciamento de dados)
- `src/services/`: Chamadas de API (githubService - integração GitHub)
- `src/utils/`: Utilitários (pdfExporter, formatters, analyzers)

### Utilitários
- `src/utils/pdfExporter.js`: Lógica de exportação para PDF.
- `src/utils/analyzers.js`: Análise de métricas (health score, bus factor, etc.).
- `src/utils/formatters.js`: Formatação de dados (idades, números).

### Ponto de Entrada
- `src/main.jsx`: Inicializa aplicação React com Vite.
- `src/App.jsx`: Componente principal com roteamento e estado global.

### Estrutura de Dados
- Dados são buscados via `githubService`, processados localmente e gerenciados pelo hook `useRepository`.
- Estado centralizado em React hooks com fail-safe para erros.
- Nenhum banco de dados; dados persistem apenas na sessão.

## 3. Regras de Negócio Críticas

### Fail-Safe nas APIs
- Todas as chamadas API devem ser envolvidas em try-catch.
- Em caso de erro, **nunca** quebrar a aplicação; retornar valores vazios (ex: [], null) e log console.warn.
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
