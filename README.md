# 🦈 Bisolhador Dashboard v2.6.0

Dashboard de Análise de Repositórios GitHub que transforma dados em insights poderosos para ensinamentos de Engenharia de Software. Ferramenta educacional desenvolvida pelo ASSERT Lab (UFPE) para apoiar professores e alunos na análise de práticas de desenvolvimento.

## ✨ Features

- **🔍 Busca Inteligente**: Encontre e analise repositórios GitHub usando o formato `owner/repo`
- **📊 Métricas Completas**: Stars, forks, issues, PRs, releases e code churn
- **📈 Gráficos Avançados**: Fluxo de trabalho, padrões de commits e stack tecnológica
- **⚡ Health Score**: Avaliação rigorosa baseada em 7 critérios comunitários
- **👥 Bus Factor**: Análise de risco de dependência de contribuidores
- **🔄 Dinâmica de Revisão**: Lead time e métricas de colaboração
- **🏆 Leaderboard**: Ranking dos repositórios mais analisados com histórico de evolução
- **📄 Export PDF**: Relatórios completos em PDF com um clique
- **📡 Monitoramento de Uso**: Rastreamento de acessos e eventos (Buscas, Exports) com Google Analytics 4
- **🛡️ Fail-Safe**: Tratamento robusto de erros e rate limits

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

## 🛠️ Tech Stack

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Charts**: Chart.js + react-chartjs-2
- **Database**: Supabase (@supabase/supabase-js)
- **API**: GitHub REST API v3
- **Analytics**: Google Analytics 4 (react-ga4)
- **Build**: Vite
- **Deploy**: GitHub Pages

## 📚 Documentação & Arquitetura

Para detalhes técnicos, arquitetura e desenvolvimento:

- **[Contexto do Projeto](docs/CONTEXT.md)** - Manual completo para IAs e desenvolvedores
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

- **ASSERT Lab** - Laboratório de Engenharia de Software do CIN/UFPE
- **Comunidade Open Source** - Por inspirar e possibilitar esta ferramenta
- **Educadores e Desenvolvedores** - Por usar e contribuir com feedback

---

**Powered by ASSERT Lab 🦈 | Orgulhosamente feito em Recife**
