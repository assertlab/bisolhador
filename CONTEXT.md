# Manual de Instruções para IAs: Bisolhador Dashboard

## 1. Resumo do Projeto

O **Bisolhador** é um Dashboard de Análise de Repositórios GitHub de código aberto, desenvolvido como um Single Page Application (SPA). Ele transforma dados de repositórios GitHub em insights poderosos para apoiar o ensino de Engenharia de Software, focando especificamente em métricas educacionais e práticas profissionais.

### Problema que Resolve
- Fornece métricas visuais e quantitativas de repositórios GitHub para estudantes e professores.
- Identifica padrões de trabalho, maturidade de infraestrutura e saúde comunitária.
- Apoia decisões pedagógicas sobre boas práticas de desenvolvimento de software.
- Permite analisar saúde de projetos open-source e gestão de tempo (evitar "crush time").

### Principais Funcionalidades
- Busca inteligente por repositórios (`owner/repo`).
- Visualização de stack tecnológica com cores dinâmicas.
- Métricas: commits, pull requests, issues, contribuidores.
- Health Score baseado em governança comunitária.
- Análise de hábitos de trabalho e maturidade de engenharia.
- Contribuição de dados.
- **v1.2.0**: Análise de processo (Lead Time, Divergência/Convergência), detecção de zombies branches, análise de code churn, contador de PRs merged, títulos dinâmicos de gráficos com transparência de amostra.

## 2. Arquitetura Técnica

### Stack Tecnológico
- **Frontend**: HTML5, Tailwind CSS (via CDN), JavaScript ES6 Modules.
- **Bibliotecas**: Chart.js (gráficos), html2pdf.js (export PDF).
- **Integrations**: GitHub REST API v3.
- **Executável**: Aberto via Live Server (VS Code extension).

### Estrutura de Módulos
O código está organizado em módulos ES6 em `src/modules/`, com responsabilidades claras:
- `githubAPI.js`: Centraliza todas as chamadas para a API do GitHub, encapsulando lógica de autenticação e tratamento de erros.
- `searchComponent.js`: Componente de busca e validação.
- `metricsCards.js`: Cards de métricas básicas (stars, forks, issues).
- `chartComponent.js`: Gráficos de commits semanais e stack tecnológica.
- `healthComponent.js`: Componente de saúde da comunidade.
- `activityLogs.js`: Logs de atividade.
- `contributorsTable.js`: Tabela de contribuidores.
- `engineeringMaturity.js` e `engineeringMaturityCard.js`: Análise de maturidade de infraestrutura.
- `configComponent.js`: Configuração de token GitHub.
- `workHabits.js`: Análise de hábitos de trabalho.

### Utilitários
- `uiHelpers.js`: Funções auxiliares para UI (ex: tooltips).
- `pdfExporter.js`: Lógica de exportação para PDF.

### Ponto de Entrada
- `src/main.js`: Inicializa aplicação, configura eventos DOM, coordena fluxo de busca e atualização de componentes.

### Estrutura de Dados
- Dados são buscados via `githubAPI.js`, processados localmente e renderizados nos componentes.
- Estado central simples: variáveis em `main.js` para owner/repo atual.
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
- Inclusão automática no header `Authorization: token ${token}` em `GitHubAPI.getHeaders()`.
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

### Cores Dinâmicas nos Gráficos
- Stack Tecnológica: Cores fixas para linguagens conhecidas (JS=#f1e05a, HTML=#e34c26, etc.).
- Linguagens desconhecidas: Geração HSL dinâmica baseada no hash da string (`abs(hash) % 360` para hue).
- Commits: Azul padrão (rgba(54, 162, 235, ...)).
- Garantir contraste e legibilidade.

## 4. Padrões de Projeto (Design System)

### Tema Visual
- **Cores Shark/Ocean**:
  - Azul marinho para primários: `bg-blue-500/700`, `text-blue-600`.
  - Tons de cinza para texto: `text-gray-900/600`.
  - Fundo: `bg-gray-100`.
  - Sem dark mode; sempre tema claro.

### Cards e Layout
- **Cards com Z-Index Fixo**: Todos os cards têm `hover:z-50` (equivalente a z-index: 50 no CSS).
- Estilo: `bg-white p-4 rounded shadow hover:z-50 transition-all duration-200`.
- Break-inside-avoid para PDF.
- Grid responsivo: 1 coluna (mobile), 2 (md), 5 (lg) para metrics.
- Tooltips customizados para explicações (via `uiHelpers.js`).

### Tipografia e Espaçamento
- **Tailwind classes** padrão: `text-lg font-semibold`, `text-2xl` para valores.
- Padding/margin: `p-4`, `mb-4`, `gap-4`.
- Botões: `bg-blue-500 hover:bg-blue-700 text-white py-2 px-4 rounded`.

### Responsividade
- Mobile-first: breakpoints `md:`, `lg:`.
- Gráficos e tabelas adaptativos.

### Interações
- Formulário de busca preventDefault.
- Loading states implícitos (dados atualizam UI imediatamente).
- Export PDF: `html2pdf.js` com configurações padrão.

### Convenções de Código
- JavaScript ES6: classes com methods, arrow functions.
- Privacidade: métodos não exportados são locais; apenas classes exportadas.
- Nomes: PascalCase para classes, camelCase para variables/methods.
- Comentários: mínimo, focado em lógica não óbvia.
- Sem linters customizados; seguir Tailwind/Chart.js padrões.

---

## Notas Finais para IAs
- Preservar compatibilidade: Qualquer mudança deve manter todos os comportamentos acima.
- Testar buscando repos como `twbs/bootstrap` ou `torvalds/linux` (maduros).
- Repos inexistentes: Devem mostrar erro sem crash.
- Rate limit: Sugerir token se 403.
- Export PDF: Deve incluir todos os cards e gráficos.

Ao continuar o trabalho, use este manual para garantir consistência e evitar regressões. Para dúvidas, buscar código existente primeiro.
