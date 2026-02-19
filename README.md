# 🦈 Bisolhador Dashboard v3.3.0

Dashboard de Análise de Repositórios GitHub que transforma dados em insights poderosos para ensinamentos de Engenharia de Software. Ferramenta educacional desenvolvida pelo ASSERT Lab (UFPE) para apoiar professores e alunos na análise de práticas de desenvolvimento.

## ✨ Features

- **🔍 Busca Inteligente**: Encontre e analise repositórios GitHub usando o formato `owner/repo`
- **📊 Métricas Completas**: Stars, forks, issues, PRs, releases e code churn
- **📈 Gráficos Avançados**: Fluxo de trabalho, padrões de commits e stack tecnológica
- **⚡ Health Score**: Avaliação rigorosa baseada em 7 critérios comunitários
- **👥 Bus Factor**: Análise de risco de dependência de contribuidores
- **🔄 Dinâmica de Revisão**: Lead time e métricas de colaboração
- **🏆 Leaderboard**: Ranking dos repositórios mais analisados com histórico de evolução
- **📊 Benchmark Multi-Repo**: Compare a evolução de até 10 repositórios lado a lado com gráficos comparativos, filtros temporais (7d, 30d, 60d, 90d, todo histórico) e tabela de métricas detalhada
- **📈 Time Machine (Histórico de Evolução)**: Visualize a evolução temporal de qualquer repositório através de gráficos interativos com filtros de período (7d, 30d, 60d, 90d, todo histórico). Acompanhe o crescimento de Stars, Forks e Watchers ao longo do tempo com dados baseados em snapshots históricos
- **🔗 Compartilhamento e Histórico**: Gere links permanentes (Snapshots) para suas análises. Ideal para avaliações de disciplinas, provas ou code reviews. O link congela o estado do repositório no momento da busca, com data/hora da coleta sempre visível
- **🌍 Suporte Global a Fusos Horários**: As buscas por data respeitam automaticamente o fuso horário do navegador do usuário
- **💾 Persistência Automática**: O histórico é salvo automaticamente ao carregar a análise, garantindo integridade dos dados
- **🛡️ Sanitização de Dados**: Tratamento robusto de payloads JSON para evitar erros com repositórios massivos
- **🌐 Internacionalização Completa**: Suporte total PT/EN em todas as interfaces (Ranking, Modais, Navegação)
- **📄 Export PDF/JSON/CSV**: Relatórios completos em PDF, dados brutos em JSON e exportação em CSV para análise em planilhas
- ** Monitoramento de Uso**: Rastreamento de acessos e eventos (Buscas, Exports) com Google Analytics 4
- **🛡️ Security-First (RPC Validation)**: Implementação de RPC segura no Supabase com validação de dados
- **🛡️ Fail-Safe**: Tratamento robusto de erros e rate limits
- **♿ Acessibilidade (WCAG AA)**: Semântica de tabelas, aria-label/aria-hidden em ícones, suporte a leitores de tela
- **⚡ Performance Otimizada**: useMemo para gráficos, code splitting e skeleton screens

## 🔄 Últimas Atualizações

### v3.3.0 - Data Science Edition
- **📊 Exportação Avançada (CSV)**: Motor nativo de exportação CSV (sem libs externas) com UTF-8 BOM para compatibilidade com Excel
- **📊 CSV no Dashboard**: Exporta 13 métricas do repositório (Stars, Forks, Issues, Health Score, Lead Time, Code Churn, Divergência, etc.)
- **📊 CSV no Benchmark**: Botão "Exportar CSV" na Tabela Comparativa com colunas idênticas à tabela visual

### v3.2.0 - Resilience & Stability
- **🛡️ Exponential Backoff**: Retentativas automáticas com backoff exponencial para envios de analytics ao Supabase, garantindo resiliência a oscilações de rede
- **🛡️ PartialDataAlert**: Tratamento de falhas parciais da API do GitHub — o painel renderiza os dados disponíveis e exibe um banner amigável detalhando os dados ausentes

### v3.1.2 - Patch Fix
- **🐛 Dynamic Version**: Header agora exibe a versão dinamicamente do `package.json` (sem strings hardcoded)

### v3.1.1 - Refactoring Edition
- **⚡ Performance**: `useMemo` em todos os charts (evita re-criação do canvas Chart.js a cada render)
- **🏗️ Clean Architecture**: Dashboard e Benchmark componentizados, lógica temporal unificada em `useTimeFilter`
- **🛡️ Segurança**: Proteção XSS (`dangerouslySetInnerHTML` substituído por `Trans`), localStorage com wrapper seguro
- **🌐 i18n Total**: Todas as strings hardcoded migradas para react-i18next
- **🧹 Código Limpo**: Constantes extraídas para `src/constants.js`, dead code removido

### v3.1.0 - Benchmark Edition
- **📊 Benchmark Multi-Repo**: Nova página `/benchmark` para comparação simultânea de até 10 repositórios com gráficos de evolução temporal e tabela comparativa
- **⏱️ Filtros Temporais Unificados**: Sistema de filtros (7d, 30d, 60d, 90d, todo histórico) no Benchmark e na Timeline, normalizando visualizações para repositórios com datas de início diferentes
- **📈 Gráficos de Comparação**: Evolution charts (Chart.js time-series) e comparison bar charts por categoria (Popularidade, Velocidade, Qualidade)

### v3.0.1 - Security Hotfix & Time Filters
- **🔒 Security**: Atualização crítica de dependências (html2pdf.js, jspdf) para mitigar vulnerabilidades CVE
- **⏱️ Filtros Temporais**: Controles de período (7d, 30d, 90d, todo histórico) na Timeline para análise focada

### v3.0.0 - Time Machine (Histórico de Evolução)
- **📈 Visualização Temporal**: Nova página Timeline para visualizar evolução histórica de repositórios através de gráficos interativos
- **📊 Gráficos de Evolução**: Line charts mostrando crescimento de Stars, Forks e Watchers ao longo do tempo
- **🔧 Backend RPC**: Nova função Supabase `get_repo_history` para buscar snapshots históricos
- **🎨 UI/UX**: Botão "Ver Evolução" no card do repositório com cards de resumo (primeira análise, última análise, crescimento total)
- **🌐 i18n Completa**: Todas as strings traduzidas em PT-BR e EN-US

### v2.8.3 - Correções de UI/UX e Internacionalização Completa
- **🎨 UI/UX Polished**: Correções de navegação global, modal states unificado entre todas as telas
- **🌐 Internacionalização Completa**: Suporte total PT/EN em Ranking, Modais (Ajuda/Configurações) e navegação
- **🔧 Header State Management**: Botões de configurações e idioma funcionam consistentemente em Dashboard e Ranking
- **♿ Acessibilidade Aprimorada**: Labels e aria-atributos completos para leitores de tela

### v2.8.2 - Timezone Global & Persistência Automática
- **🌍 Suporte Global a Fusos Horários**: Detecção automática do timezone do navegador para snapshots diários
- **💾 Persistência Inteligente (Save-on-Load)**: Histórico salvo automaticamente ao carregar análise
- **🛡️ Sanitização de Dados**: Tratamento robusto de JSON payloads para repositórios massivos
- **📊 Analytics Aprimorado**: RPC segura com validação de dados no Supabase

## 🚀 Como Rodar

### Pré-requisitos
- Node.js 18+
- npm ou yarn

### Instalação e Execução

```bash
# Clone o repositório
git clone https://github.com/assertlab/bisolhador.git
cd bisolhador

# Instale as dependências
npm install

# Execute em modo desenvolvimento
npm run dev

# Ou faça o build para produção
npm run build
```

**Nota**: Crie um arquivo `.env` na raiz com as seguintes variáveis para habilitar o Analytics:

```bash
VITE_GA_ID=G-SEU-ID
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima
```

A aplicação estará disponível em `http://localhost:5173`

## 📖 Como Usar

### Exemplos de Uso

**Busca Direta por URL:**
```
https://assertlab.github.io/bisolhador/?q=facebook/react
```

**Acesso a Snapshot Histórico (Permalink):**
```
https://assertlab.github.io/bisolhador/?id=123
```

**Busca Semântica Histórica (por Data):**
```
https://assertlab.github.io/bisolhador/?repo=facebook/react&date=2025-12-17
```

### Funcionalidades Principais

1. **Busque um repositório** usando o formato `owner/repo` (ex: `facebook/react`)
2. **Analise as métricas** de saúde, maturidade e padrões de trabalho
3. **Compartilhe resultados** clicando no botão "Compartilhar" para gerar links permanentes (O Bisolhador salva automaticamente o histórico da sua análise)
4. **Acesse dados históricos** usando URLs semânticas com datas específicas
5. **Exporte relatórios** em PDF, dados brutos em JSON ou métricas em CSV

## 🛠️ Tech Stack

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Charts**: Chart.js + react-chartjs-2
- **Database**: Supabase (@supabase/supabase-js)
- **API**: GitHub REST API v3
- **Analytics**: Google Analytics 4 (react-ga4)
- **Build**: Vite
- **Deploy**: GitHub Pages

> **Nota técnica (v3.3.0):** A codebase passou por uma refatoração completa em 5 sprints focando em performance otimizada (`useMemo` em charts), Clean Architecture (componentização de Dashboard e Benchmark), segurança (proteção XSS, safe localStorage) e eliminação de código duplicado (hooks unificados, constantes extraídas).

## 📚 Documentação & Arquitetura

Para detalhes técnicos, arquitetura e desenvolvimento:

- **[CLAUDE.md](CLAUDE.md)** - Contexto técnico do projeto (padrão Claude Code)
- **[Design System](docs/DESIGN_SYSTEM.md)** - Sistema de design e padrões visuais
- **[Histórico de Mudanças (Changelog)](CHANGELOG.md)** - Todas as versões e alterações
- **[Roadmap](docs/ROADMAP.md)** - Planejamento futuro e histórico de releases

## 📋 Scripts Disponíveis

- `npm run dev` - Inicia servidor de desenvolvimento
- `npm run build` - Gera build de produção
- `npm run preview` - Visualiza build local
- `npm run lint` - Executa ESLint

## 🎯 Uso Educacional

O Bisolhador foi desenvolvido especificamente para:

- **Análise de Projetos Open Source**: Avaliar saúde e maturidade de repositórios
- **Ensino de Engenharia de Software**: Demonstrar boas práticas e identificar problemas
- **Pesquisa**: Coletar métricas quantitativas sobre desenvolvimento colaborativo
- **Mentoria Técnica**: Apoiar decisões sobre processos e governança

## 🤝 Contribuição

Contribuições são bem-vindas! Siga estes passos:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 🙏 Agradecimentos

- **ASSERT Lab** - [Advanced System and Software Engineering Research Technologies Lab](https://assertlab.com/) do [CIN/UFPE](http://www.cin.ufpe.br/)
- **Comunidade Open Source** - Por inspirar e possibilitar esta ferramenta
- **Educadores e Desenvolvedores** - Por usar e contribuir com feedback

---

**Powered by ASSERT Lab 🦈 | Orgulhosamente feito em Recife**
