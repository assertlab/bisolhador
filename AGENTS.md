# AGENTS.md

## Boas Práticas de Código

- Mensagens de erro traduzidas seguem o namespace `errors.*` em `src/locales/{pt,en}.json` (ex: `errors.privateRepo`, `errors.privacyCheckFailed`, `errors.invalidRepoName`) — sempre com uma frase explicando o motivo, não só "operação não permitida".
- Registro do Chart.js é sempre via `ensureChartSetup()` (`src/lib/chartSetup.js`, import dinâmico memoizado numa promise compartilhada) — nunca importado estaticamente/eager em nenhum arquivo, nem mesmo `main.jsx`.
- Páginas novas em `src/pages/` entram no `App.jsx` via `React.lazy()`, seguindo o padrão já usado para Dashboard/Ranking/Timeline/Benchmark — nunca import estático de página inteira.
- Testes automatizados ou scripts ad-hoc que precisam de dados reais do GitHub leem `SMOKE_GITHUB_TOKEN` de `process.env` (nunca prefixado `VITE_`, injetado via `page.addInitScript` no localStorage do browser de teste, nunca logado) em vez de esgotar o rate limit de 60/h ou recorrer a mock indiscriminadamente.

## O Que Evitar

- Nunca usar `window.history.pushState()` bruto para sincronizar estado com a URL — sempre `useSearchParams()`/`useNavigate()` do react-router-dom. Chamar a API nativa diretamente dessincroniza o `location` interno do router do que a barra de endereços mostra (causou bug real: resíduo de busca anterior não limpava ao navegar para Home via link, v3.5.1).
- Nunca aplicar o padrão geral de fail-safe do projeto ("nunca quebrar, retornar valores vazios em erro") a uma checagem de segurança — ali a regra é fail-closed: se a checagem falhar, bloqueia a ação, não deixa passar (ver visibilidade de repo no `Benchmark.jsx`).
- Nunca confiar em `owner`/`repo`/`fullName` vindo de dado persistido (snapshot do Supabase) sem validar contra `SAFE_GITHUB_NAME_PATTERN` antes de usar em `navigate()` ou construir qualquer rota — esse dado pode ter sido inserido fora do fluxo normal do app.
- Nunca aceitar a sugestão de `npm audit fix --force` sem antes verificar se o "fix" proposto é, na verdade, um downgrade que reintroduz uma vulnerabilidade já corrigida (aconteceu com react-router-dom nesta sessão).
- Nunca adicionar um componente de chart novo sem garantir que ele passa por `ensureChartSetup()` antes de montar — sem isso, crash real em runtime (`"category" is not a registered scale"`), não erro de build/lint.
- Ao remover código aparentemente não utilizado, confirmar que nenhuma ADR/documento descreve um propósito para ele antes de apagar — o `sanitizeForJson.js` foi removido como dead code num refactor passado sem que ninguém notasse que a ADR-004 ainda descrevia sua função como vigente.
- Em scripts de medição de performance (Playwright + `performance.now()`), cuidado para não incluir o tempo de carregamento de um chunk lazy (ex: esperar um seletor que só existe após o code-splitting de página) dentro da métrica que está sendo medida — isso já inflou artificialmente um resultado de lag duas vezes nesta mesma sessão de trabalho.
