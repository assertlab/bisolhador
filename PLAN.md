# Plano de Implementação - Bisolhar Dashboard

## Visão Geral
Dashboard SPA para análise de métricas de repositórios GitHub de alunos, focado em apoiar o ensino de Engenharia de Software.

**Stack**: HTML5, JavaScript ES6 Modules, Tailwind CSS (CDN), Chart.js, GitHub REST API

---

## Fase 1: Scaffolding

### 1.1 Estrutura de Diretórios
- [ ] Criar estrutura de pastas do projeto:
  - [ ] `/src` - Código fonte
  - [ ] `/src/modules` - Módulos JavaScript (ES6)
  - [ ] `/src/styles` - Estilos customizados (se necessário)
  - [ ] `/src/utils` - Utilitários e helpers
  - [ ] `/assets` - Recursos estáticos (ícones, imagens)
  - [ ] `/docs` - Documentação adicional

### 1.2 Arquivo HTML Base
- [ ] Criar `index.html` na raiz do projeto
- [ ] Configurar estrutura HTML5 semântica
- [ ] Adicionar meta tags (viewport, charset, description)
- [ ] Incluir Tailwind CSS via CDN
- [ ] Incluir Chart.js via CDN
- [ ] Configurar tag `<script type="module">` para entry point
- [ ] Adicionar estrutura básica do layout (header, main, footer)

### 1.3 Configuração Inicial
- [ ] Criar `.gitignore` (se ainda não existir)
- [ ] Criar `package.json` para documentação de dependências (opcional)
- [ ] Configurar arquivo de constantes (`src/config.js`):
  - [ ] URL base da API do GitHub
  - [ ] Rate limit defaults
  - [ ] Configurações de timeout

---

## Fase 2: Core Logic

### 2.1 Módulo de API GitHub (`src/modules/githubAPI.js`)
- [ ] Criar classe/objeto `GitHubAPI` para encapsular chamadas
- [ ] Implementar método `fetchRepository(owner, repo)`:
  - [ ] Validar parâmetros de entrada
  - [ ] Construir URL da API
  - [ ] Realizar fetch com tratamento de erros
  - [ ] Retornar dados estruturados
- [ ] Implementar método `fetchCommits(owner, repo, params)`:
  - [ ] Suportar paginação
  - [ ] Filtrar por período (opcional)
  - [ ] Tratar respostas vazias
- [ ] Implementar método `fetchPullRequests(owner, repo, state)`:
  - [ ] Suportar estados: open, closed, all
  - [ ] Retornar contagem e detalhes
- [ ] Implementar método `fetchIssues(owner, repo, state)`:
  - [ ] Suportar estados: open, closed, all
  - [ ] Retornar contagem e detalhes

### 2.2 Tratamento de Erros (`src/utils/errorHandler.js`)
- [ ] Criar função `handleAPIError(error, response)`:
  - [ ] Detectar erro 404 (repositório não encontrado)
  - [ ] Detectar erro 403 (Rate Limit excedido)
  - [ ] Detectar erro 401 (autenticação necessária)
  - [ ] Retornar mensagens amigáveis ao usuário
- [ ] Criar função `displayError(message)` para UI
- [ ] Implementar retry logic para Rate Limit (com exponential backoff)
- [ ] Adicionar logging para debug (console.warn/error)

### 2.3 Processamento de Dados (`src/utils/dataProcessor.js`)
- [ ] Criar função `aggregateCommitsByDay(commits)`:
  - [ ] Agrupar commits por data
  - [ ] Contar commits por dia
  - [ ] Retornar estrutura para Chart.js
- [ ] Criar função `calculateMetrics(repoData)`:
  - [ ] Total de commits
  - [ ] Total de PRs (abertos/fechados)
  - [ ] Total de Issues (abertas/fechadas)
  - [ ] Contribuidores únicos
- [ ] Criar função `formatDate(dateString)` para exibição
- [ ] Criar função `sanitizeInput(input)` para segurança

---

## Fase 3: UI/UX

### 3.1 Componente de Busca (`src/modules/searchComponent.js`)
- [ ] Criar formulário de busca HTML:
  - [ ] Input para owner (usuário/organização)
  - [ ] Input para nome do repositório
  - [ ] Botão de busca
  - [ ] Loader/spinner durante busca
- [ ] Implementar validação de input:
  - [ ] Campos obrigatórios
  - [ ] Formato válido (sem caracteres especiais)
  - [ ] Feedback visual de erros
- [ ] Implementar evento de submit:
  - [ ] Prevenir reload da página
  - [ ] Mostrar estado de loading
  - [ ] Chamar módulo de API
  - [ ] Atualizar dashboard com resultados
- [ ] Adicionar histórico de buscas (localStorage - opcional)

### 3.2 Cards de Métricas (`src/modules/metricsCards.js`)
- [ ] Criar template HTML para cards:
  - [ ] Card de Commits (total, ícone)
  - [ ] Card de Pull Requests (abertos/fechados)
  - [ ] Card de Issues (abertas/fechadas)
  - [ ] Card de Contribuidores (opcional)
- [ ] Aplicar estilização com Tailwind:
  - [ ] Grid/Flex responsivo
  - [ ] Cores e ícones semânticos
  - [ ] Hover effects
  - [ ] Animações de entrada (opcional)
- [ ] Implementar função `renderMetricsCards(metrics)`:
  - [ ] Limpar container anterior
  - [ ] Injetar novos dados
  - [ ] Aplicar formatação de números
- [ ] Adicionar loading state para cards

### 3.3 Visualização de Gráficos (`src/modules/chartComponent.js`)
- [ ] Criar container HTML para gráfico Chart.js
- [ ] Implementar função `renderCommitsChart(commitData)`:
  - [ ] Configurar gráfico de barras
  - [ ] Eixo X: dias
  - [ ] Eixo Y: número de commits
  - [ ] Cores e labels
  - [ ] Responsividade
- [ ] Adicionar opções de Chart.js:
  - [ ] Tooltip customizado
  - [ ] Legend
  - [ ] Animations
- [ ] Implementar função `destroyChart()` para cleanup
- [ ] Adicionar estado vazio (sem dados para exibir)

### 3.4 Layout e Responsividade
- [ ] Estruturar layout principal com Tailwind:
  - [ ] Header com título e descrição do projeto
  - [ ] Seção de busca (centralizada)
  - [ ] Grid de cards de métricas
  - [ ] Seção de gráficos (full-width)
  - [ ] Footer com créditos/links
- [ ] Implementar responsividade:
  - [ ] Mobile-first approach
  - [ ] Breakpoints: sm, md, lg, xl
  - [ ] Grid adaptativo (1 col → 2 cols → 4 cols)
  - [ ] Gráfico responsivo
- [ ] Adicionar dark mode (opcional):
  - [ ] Toggle switch
  - [ ] Classes Tailwind dark:
  - [ ] Persistir preferência (localStorage)

### 3.5 Estados da Aplicação (`src/modules/appState.js`)
- [ ] Criar gerenciador de estado simples:
  - [ ] Estado de loading
  - [ ] Estado de erro
  - [ ] Estado com dados (sucesso)
  - [ ] Estado vazio (inicial)
- [ ] Implementar função `setState(newState)`:
  - [ ] Atualizar UI baseado no estado
  - [ ] Mostrar/esconder componentes
  - [ ] Aplicar classes CSS condicionais
- [ ] Adicionar feedback visual para cada estado:
  - [ ] Skeleton loaders
  - [ ] Mensagens de erro amigáveis
  - [ ] Empty state ilustrado

---

## Fase 4: Integração e Polimento

### 4.1 Entry Point (`src/main.js`)
- [ ] Importar todos os módulos necessários
- [ ] Inicializar aplicação no DOMContentLoaded
- [ ] Configurar event listeners globais
- [ ] Implementar fluxo principal:
  - [ ] Usuário submete busca
  - [ ] Fetch de dados da API
  - [ ] Processamento de dados
  - [ ] Renderização de UI
  - [ ] Tratamento de erros
- [ ] Adicionar cleanup em caso de erros

### 4.2 Testes Manuais
- [ ] Testar busca com repositório válido
- [ ] Testar busca com repositório inexistente (404)
- [ ] Testar comportamento com Rate Limit excedido
- [ ] Testar responsividade em diferentes viewports
- [ ] Testar com repositórios de diferentes tamanhos
- [ ] Testar edge cases:
  - [ ] Repositório sem commits
  - [ ] Repositório sem PRs/Issues
  - [ ] Repositório privado (403)

### 4.3 Otimizações
- [ ] Implementar debounce na busca (opcional)
- [ ] Cache de requisições recentes (opcional)
- [ ] Lazy loading de Chart.js (opcional)
- [ ] Minificação de código para produção (opcional)

### 4.4 Documentação
- [ ] Atualizar README.md com:
  - [ ] Descrição do projeto
  - [ ] Como executar localmente
  - [ ] Screenshots/GIFs
  - [ ] Tecnologias utilizadas
  - [ ] Limitações conhecidas
- [ ] Adicionar comentários JSDoc nos módulos principais
- [ ] Criar arquivo CONTRIBUTING.md (opcional)

---

## Notas Técnicas

### Rate Limits GitHub API
- **Sem autenticação**: 60 requisições/hora
- **Com token**: 5000 requisições/hora
- **Recomendação**: Implementar autenticação via token para testes

### Endpoints Principais
```
GET /repos/{owner}/{repo}
GET /repos/{owner}/{repo}/commits
GET /repos/{owner}/{repo}/pulls
GET /repos/{owner}/{repo}/issues
```

### Considerações de Segurança
- Sanitizar inputs do usuário
- Não expor tokens de API no código (usar variáveis de ambiente)
- Validar respostas da API antes de processar
- Implementar CSP headers (se usar servidor)

---

## Critérios de Conclusão do MVP

- ✅ Dashboard carrega sem erros
- ✅ Busca por repositório funciona
- ✅ Métricas são exibidas corretamente
- ✅ Gráfico de commits por dia renderiza
- ✅ Erros são tratados e exibidos ao usuário
- ✅ Interface é responsiva (mobile/desktop)
- ✅ README.md está atualizado

---

**Próximos Passos**: Após aprovação deste plano, iniciar implementação pela Fase 1.
