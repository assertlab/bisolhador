# AGENTS.md

## Commands

```bash
npm run dev        # Start dev server (http://localhost:5173)
npm run build      # Production build
npm run lint       # Run ESLint
npm run preview    # Preview production build locally
npm test           # Unit tests (Vitest): src/**/*.test.js
npm run smoke:csp  # CSP + PDF-export smoke test (Playwright, build + dev modes)
```

## Architecture

### Stack
- **Frontend**: React 19 + Vite + Tailwind CSS
- **Data Fetching**: TanStack Query (cache 5min, stale-while-revalidate)
- **Charts**: Chart.js + react-chartjs-2 (lazy loaded via React.lazy + Suspense)
- **Database**: Supabase (analytics persistence, snapshots, leaderboard)
- **API**: GitHub REST API v3
- **Analytics**: Hybrid — Supabase (critical data, AdBlock-proof) + GA4 (engagement)
- **i18n**: react-i18next (PT-BR / EN-US) with auto-detection
- **Deploy**: GitHub Pages at **https://bisolhador.assertlab.com** (repo custom domain, base `/`) via `.github/workflows/deploy.yml` — see `### Release / Deploy`. `assertlab.com/bisolhador/*` 301-redirects there (Cloudflare Redirect Rule, path + query preserved). The build also writes `dist/404.html` = `index.html` (`scripts/spa-fallback.mjs`) because Pages has no SPA rewrite.

### Folder Structure
```
src/
├── main.jsx                    # React initialization
├── App.jsx                     # Router setup (/, /ranking, /timeline, /benchmark)
├── constants.js                # Shared constants (API limits, thresholds, etc.)
├── pages/
│   ├── Dashboard.jsx           # Main analysis dashboard
│   ├── Ranking.jsx             # Leaderboard (Bisolhômetro)
│   ├── Timeline.jsx            # Time Machine — repo evolution over time
│   └── Benchmark.jsx           # Multi-repo comparison (up to 10 repos)
├── components/
│   ├── Header.jsx, SearchBar.jsx, StatCard.jsx, ...
│   ├── BusFactorCard.jsx       # Advanced Bus Factor risk card (stacked bar, avatars)
│   ├── TimeRangeFilter.jsx     # Shared time filter (7d/30d/60d/90d/all)
│   ├── charts/                 # Chart components (lazy loaded)
│   │   ├── CommitActivityChart.jsx
│   │   ├── BenchmarkEvolutionChart.jsx
│   │   └── BenchmarkComparisonChart.jsx
│   ├── benchmark/              # Benchmark sub-components
│   │   ├── BenchmarkSearchForm.jsx
│   │   ├── BenchmarkRepoChips.jsx
│   │   ├── BenchmarkHealthBars.jsx
│   │   ├── BenchmarkBusFactorRisk.jsx
│   │   └── BenchmarkDetailTable.jsx
│   └── skeletons/              # Skeleton loading screens
├── hooks/
│   ├── useRepository.js        # Main data hook (15+ GitHub endpoints, Promise.allSettled)
│   ├── useSnapshot.js          # Supabase snapshot by URL (?id= / ?repo=&date=), TanStack Query
│   ├── useBenchmarkRepos.js    # Parallel fetch via TanStack useQueries
│   ├── useTimeFilter.js        # Unified time range filtering logic
│   ├── useChartTheme.js        # Chart colors for light/dark mode
│   └── useTheme.js             # Dark mode toggle with localStorage
├── services/
│   ├── githubService.js        # GitHub REST API calls with token support
│   ├── supabase.js             # Supabase client
│   ├── leaderboardService.js   # RPC calls for public ranking
│   └── analytics.js            # Hybrid analytics (GA4 + Supabase)
├── utils/
│   ├── analyzers.js            # Pure functions: health score, process metrics
│   ├── repoTree.js             # Maturity detectors (tests/CI/Docker/linter: ✓/✗/? not verified), issue-template dir, fork profile from tree
│   ├── branches.js             # Zombie branches: excludes default, protected and release/maintenance lines
│   ├── contributors.js         # Contributor analysis: bots excluded, 12-month window, top concentration (feeds busFactor.js)
│   ├── busFactor.js            # Advanced Bus Factor (Pareto 70% threshold)
│   ├── formatters.js           # Date/number formatting
│   ├── pdfExporter.js          # PDF export via html2pdf.js
│   ├── exportJson.js           # JSON data export with provenance metadata
│   └── csvExporter.js          # CSV export (native, no dependencies)
└── locales/                    # i18n translation files (pt/, en/)
```

### Data Flow
1. User searches for repo in `owner/repo` format
2. `useRepository` hook orchestrates all GitHub API calls via `githubService`
3. `analyzers.js`, `contributors.js` and `busFactor.js` compute metrics locally (health score, maturity, contributor concentration, bus factor, etc.)
4. Results rendered in Dashboard with charts, cards, and tables
5. Analytics tracked via hybrid system: Supabase (critical) + GA4 (engagement)

### Health Score (7 Criteria)
Calculated locally from GitHub's community profile API:
1. README, 2. License, 3. Contributing, 4. Description, 5. Code of Conduct, 6. Issue Template, 7. PR Template

Score = (items present / 7) × 100%. Colors (`HealthScoreCard.jsx`): Green (≥75%), Yellow (≥50%), Red (below).

## Style Guidelines

### Code Conventions
- React functional components with hooks (no class components)
- PascalCase for components, camelCase for functions/variables
- Tailwind CSS with "shark/ocean" color theme
- ESLint with standard Vite rules
- Conventional commits (brief and descriptive)

### Error Handling
- Never crash the page: every fetch failure is contained, and the UI renders with partial data.
- **But "couldn't measure" must never look like "zero" or "absent".** Count/indicator fetchers (`fetchSearchCount` for issues/PRs/merges, `fetchBranches`, `fetchReleasesCount`, `fetchCommunityProfile`) **throw** on failure; `useRepository` gets `null` from `Promise.allSettled`, lists the endpoint in `_warnings` (partial-data banner) and the UI shows "N/A"/"n/d" (`formatters.formatNumber(null)` → `N/A`). A snapshot is **not persisted** when one of the count indicators or the community profile request failed (`PERSIST_BLOCKERS` in `useRepository.js`); forks (no community profile, 404) are saved with health unavailable. Not yet covered: list fetchers that still return empty values on error (commits, contributors, languages, tree) — their failures can still be saved as empty data; audit wave 1 items 2–5, see `docs/AUDITORIA_INDICADORES_2026-10.md`.
- All GitHub calls after the initial `/repos/{o}/{r}` use the **canonical** `repoData.full_name` (renamed repos: the Search API does not follow renames).
- Dashboard renders a single generic error banner (`{error}` as plain text) — there is no differentiated UI per error type today; 403 (rate limit), 404, and "private repo unsupported" all look identical to the user. Prior versions of this file claimed 403/404 got distinct treatment; that was never true in the code. See `docs/ROADMAP.md` for the pending UX item to fix this.
- Render UI even with partial data (graceful degradation)

### Performance Patterns
- Charts use `React.lazy` + `Suspense` (code splitting); the 4 pages (Dashboard, Ranking, Timeline, Benchmark) are lazy-loaded in `App.jsx` the same way
- `chart.js` is imported dynamically and registered on demand via `ensureChartSetup()` (`src/lib/chartSetup.js`) — never eager from `main.jsx`. Initialization is shared through a single memoized promise and prefetched (fire-and-forget) in parallel with searches (`useRepository.js`) and Benchmark repo additions (`Benchmark.jsx`), so it doesn't block the search itself but avoids visible lag on first chart render
- `useMemo` for chart data/options to avoid Chart.js canvas re-creation
- `useChartTheme` returns memoized theme object
- Skeleton screens for loading states (LCP optimization)
- No `manualChunks` (Vite 8 / Rolldown): splitting follows the dynamic imports. Forcing packages into named chunks used to drag shared deps along and made the entry preload them — in Vite 7 the ~950 KB `pdf-vendor` was preloaded on every first visit. `html2pdf.js` is imported on click inside `exportToPDF()` (`src/utils/pdfExporter.js`), like chart.js via `ensureChartSetup()`. First load went from ~1.56 MB to ~592 KB of JS.

### Component Structure
- Pages in `src/pages/`, UI components in `src/components/`
- Complex pages broken into sub-components (e.g., `benchmark/`)
- Shared UI extracted as reusable components (`TimeRangeFilter`, `StatCard`)
- Constants extracted to `src/constants.js` (no magic numbers in business logic)
- Version display is dynamic (Header reads from `package.json`)

## Project Context

### Purpose
Educational tool by ASSERT Lab (UFPE) for software engineering teaching (v3.8.0). Transforms GitHub repository data into visual insights for students and professors.

### Token System
- Stored in `localStorage['github_token']` (via safe storage wrapper)
- Increases rate limit from 60 to 5,000 requests/hour
- Auto-added to requests in `githubService.getHeaders()`
- Required for the **Code Review (self-merge rate)** and **Divergence** metrics: they come from one GraphQL call (`fetchPullRequestReviewStats`), because the REST `/pulls` list has no `merged_by`/comment counts. Without a token, both are shown as unavailable ("n/d" plus an explanation), never as 0% (`src/utils/prReviewStats.js`). Persisted snapshots go through `normalizeSnapshotReviewMetrics` on read: pre-fix reports (no `codeReview.available`) and reports saved as unavailable both show "not recorded in this snapshot".

### Backend / Supabase
- **Write**: All writes via validated RPCs (`registrar_busca`), no direct INSERT
- **Read**: History via RPC (`buscar_snapshot_por_data`) with dynamic timezone
- **Schema**: `analytics_searches` uses `BIGINT` IDs and `NUMERIC` health_score
- **Security**: Direct table access (INSERT/SELECT) for the `anon` role is revoked via RLS — all access goes through `SECURITY DEFINER` RPCs. This was **not** true before v3.5.0: two public RLS policies ("Permitir inserts publicos", "Permitir leitura publica") let `anon` read/write `analytics_searches` directly, bypassing every RPC, despite this file previously claiming otherwise. See `## Security` below and `docs/CHANGELOG.md` [3.5.0].

### URL / Deep Linking
- `/?q=owner/repo` — live search
- `/?id=123` — immutable snapshot permalink
- `/?repo=owner/project&date=YYYY-MM-DD` — semantic historical search
- Priority: ID > Semantic > Live

### Release / Deploy
Production is published only by pushing a version tag — never from a local machine.
1. Bump `package.json` + `docs/CHANGELOG.md` in a PR, merge it.
2. `git tag vX.Y.Z <merge-commit> && git push origin vX.Y.Z`.
3. `deploy.yml` builds that tag, publishes to Pages, then (job `release`) creates the **GitHub release** with the tag's `docs/CHANGELOG.md` section as notes and the README `### vX.Y.Z - Title` as title (`scripts/release-notes.mjs`, run in the build job **before** deploying, so a missing CHANGELOG section fails closed; the release job skips if the release exists and marks "Latest" only on tag push, never on dispatch). Before 2026-10-23 this step didn't exist and releases v3.6.2–v3.8.0 were backfilled by hand. Its in-workflow checks (build config present, tag = `package.json` version, commit on `main`) catch **mistakes**, not malice: on a tag push the workflow file comes from the tagged commit itself, which could drop them.

**Security boundary** (repo settings, not the workflow): a tag ruleset limiting who can create/update/delete `v*` tags, plus the `github-pages` environment allowing only `v*` tags and `main`. Without the tag ruleset, anyone with write access can publish an unreviewed commit by tagging it.

Repo setup this depends on: Settings → Pages → Source = "GitHub Actions"; Actions variables `VITE_SUPABASE_URL`, `VITE_GA_ID` and secret `VITE_SUPABASE_ANON_KEY` (names: see `### Environment Variables`).

Rollback/redeploy: run `deploy.yml` via `workflow_dispatch` **from `main`**, passing the tag. Workflow logic then comes from `main`; only the app code comes from the tag. Floor: `v3.6.2` — older tags have no `.nvmrc`, so `setup-node` fails on them.

### Environment Variables
```bash
VITE_GA_ID=G-xxx              # Google Analytics 4 ID
VITE_SUPABASE_URL=https://... # Supabase project URL
VITE_SUPABASE_ANON_KEY=...    # Supabase anonymous key
```

### Automated Testing
CI (rationale in each workflow's comments):
- `ci.yml` → **`lint + build`** (required on `protect-main`; PRs and `main`): lint, unit tests (`npm test`), build. Builds without secrets, so `%VITE_SUPABASE_URL%` stays unresolved in the CSP — green CI proves the app compiles, not that the shipped CSP is valid.
- `ci.yml` → **`dependency review`** (PRs): blocks a PR that *introduces* a runtime dependency with a high+ vulnerability.
- `audit.yml` → **`npm audit (runtime)`** (weekly + lockfile changes on `main`, not on PRs): alarm for new advisories against what's already installed.
- `ci.yml` → **`smoke (CSP + PDF)`** (PRs from this repo and `main`, **not required** yet — it depends on network and production Supabase reads): `npm run smoke:csp` in snapshot mode (`vars.SMOKE_SNAPSHOT_ID`, currently `893` — a real facebook/react snapshot; the previous default `1047` was one of the mocks deleted on 2026-10-23). Gets `VITE_*` from Actions vars/secrets, and from **Dependabot secrets** on Dependabot PRs (Actions secrets aren't passed to those runs). Promote to required after a few stable weeks. Dependabot config: `.github/dependabot.yml`. Node: `.nvmrc` (CI/dev) and `engines` in `package.json` (minimum).

Unit tests: Vitest, colocated as `src/**/*.test.js` (pure functions in `src/utils/`: health score, maturity detectors, code review, lead time, divergence, both bus factor variants, code churn, `full_report` parsing). They run in CI on every PR.

`scripts/csp-smoke-test.mjs` is the end-to-end smoke test (Playwright), also run in CI (job `smoke`). Run via `npm run smoke:csp`. It **never writes to production**: `registrar_busca` and GA4 collection hits are intercepted and answered locally (since 2026-10; before that, each live-search run wrote two `facebook/react` rows to production Supabase). CSP is still fully exercised, since the browser enforces it before a request reaches the interception. It **exits 1** if any mode fails to navigate, load the dashboard or start the PDF download, or has a CSP violation or page error (before 2026-10 it always exited 0). After a Playwright upgrade, run `npx playwright install chromium` once. Optional process env vars (never `VITE_`-prefixed, never bundled):
- `SMOKE_SNAPSHOT_ID` — loads an existing `analytics_searches` id via the app's `?id=` permalink instead of live-searching, to bypass the unauthenticated GitHub rate limit (60 req/h).
- `SMOKE_GITHUB_TOKEN` — a real GitHub PAT, injected into the test browser's `localStorage` (mirrors what `SettingsModal` does manually) so the live search actually gets 5,000 req/h. Never logged.

This pattern isn't specific to `csp-smoke-test.mjs`: any ad-hoc/throwaway Playwright script written to investigate a bug should read `SMOKE_GITHUB_TOKEN` from `process.env` (same rules — never `VITE_`-prefixed, injected via `page.addInitScript` into the test browser's `localStorage`, never logged) before falling back to mocking the GitHub API or just eating the 60 req/h rate limit. Mocking the GitHub API is still legitimate when the bug is clearly independent of the actual data returned (e.g. router state-sync bugs) — the rule is to reach for the token when testing against real data is what actually matters, not to inject it into every test regardless of what's being verified.

### Testing Repositories
- `twbs/bootstrap` or `torvalds/linux` — Mature, high-activity repos
- `assertlab/bisolhador` — Young, low-activity repo (tests smart trim on charts)

## Security

### Private Repositories
The app never processes or persists data from private GitHub repositories, even when the user's PAT has private-repo scope. `useRepository.js` checks `repoData.private` immediately after the initial repo fetch and aborts (`PRIVATE_REPO_UNSUPPORTED`) before any of the 15+ parallel calls or the Supabase save-on-load. `Benchmark.jsx` has its own entry path — it reads history from Supabase, not live GitHub calls — so it performs its own live visibility check via `githubService.fetchRepository`, retried with `withExponentialBackoff` and fail-closed if visibility can't be confirmed.

### Input Sanitization
`githubService.js` applies `encodeURIComponent` to every interpolated value (`owner`, `repo`, `defaultBranch`) in request URLs and GitHub search query strings — including inside search qualifiers (e.g. `` repo:${owner}/${repo}+type:pr ``), where only the interpolated values are encoded, never the literal `+`/`:` separators, so query semantics aren't broken. The one GraphQL query (`fetchPullRequestReviewStats`) passes `owner`/`repo` as GraphQL **variables**, never interpolated into the query string.

### RPC Input Validation
`get_leaderboard` tem teto de 100 no `limit_count` (`LEAST`/`GREATEST` com `COALESCE(limit_count, 50)` cobrindo o caso de `NULL` explícito, nunca confia no valor enviado pelo client); `registrar_busca` valida tamanho de `full_report` (500KB via `octet_length`, não `pg_column_size` — este último mede o tamanho comprimido/TOAST no disco, não o tamanho lógico, e podia ser contornado por payloads muito compressíveis) e `repo_name` (nulo ou > 300 chars) antes do INSERT, com `RAISE EXCEPTION` — ambos no nível do banco, não só no client. Ambas as funções também têm `DROP FUNCTION IF EXISTS` antes do `CREATE OR REPLACE`, seguindo o padrão de `get_repo_history.sql`, para garantir que um `CREATE OR REPLACE` com assinatura diferente da já implantada substitua a função antiga em vez de criar uma sobrecarga (overload) coexistente. Aplicado após revisão via Supabase Security Advisor.

### Content-Security-Policy
`index.html` ships a CSP scoped to the domains the app actually calls: `api.github.com`, Supabase (via the build-time `%VITE_SUPABASE_URL%` substitution, not a wildcard), GA4's script/collection domains (also in `img-src`, for gtag.js image hits), and `avatars.githubusercontent.com` for contributor images. `style-src` includes `'unsafe-inline'` because `html2canvas` (used by the PDF export) applies inline styles via `setAttribute`/`cssText` while cloning the DOM for rendering — confirmed with a real headless-browser test (`npm run smoke:csp`), not assumed. `frame-ancestors`/`report-uri` don't work via `<meta>` (HTTP-header-only directives), so GitHub Pages static hosting has no clickjacking protection through this CSP.

### Route Safety
`RepoInfoCard.jsx` validates `owner`/`repo` against `SAFE_GITHUB_NAME_PATTERN` before calling `navigate()` for the `/timeline/:owner/:repo` route — defense in depth, since that data can come from a Supabase snapshot rather than a live search, and a react-router version fix shouldn't be the only safety net for app-constructed routes.

## Documentation Maintenance Policy

Whenever a code change has the potential to change behavior documented in this file, in `README.md`, or in `docs/DESIGN_SYSTEM.md`, explicitly evaluate — before considering the task done — whether any of those documents need updating, and whether the change justifies a new `docs/CHANGELOG.md` entry and a `package.json` version bump (following SemVer: patch for fixes with no visible behavior change, minor for new behavior/hardening that doesn't break existing usage, major for changes that break existing usage).

Stale documentation isn't a cosmetic problem in this project. It has already, concretely, caused a false sense of security about RLS protections that didn't actually exist — this file and the project's other docs asserted for months that anonymous INSERT into `analytics_searches` was blocked, when in fact two public RLS policies made it (and anonymous SELECT) fully open. Treat every doc claim about security posture as something that needs re-verifying against the actual code/config, not something to copy forward from the previous version.

## Decisões Arquiteturais que Já Foram Tomadas (não reabrir sem motivo novo)

- RLS do Supabase: acesso à tabela `analytics_searches` é só via RPCs `SECURITY DEFINER` (`registrar_busca`, `obter_snapshot`, etc). Nunca reintroduzir policy de INSERT/SELECT direta para o role `anon` — foi exatamente essa configuração que causou o vazamento de dados corrigido na v3.5.0. Confirmado via Supabase Security Advisor: a tabela ter RLS habilitada com zero policies é o estado correto e esperado (sinalizado como INFO "RLS Enabled No Policy", não como problema).
- Repositórios privados nunca são processados nem persistidos pelo app, mesmo quando o PAT do usuário tem escopo de acesso privado — decisão de produto deliberada (v3.5.0), não uma limitação técnica a ser contornada.
- Checagens de segurança seguem fail-closed, não fail-safe/fail-open. Isso é uma exceção intencional ao padrão geral de "nunca quebrar a aplicação, retornar valores vazios" do projeto — esse padrão vale para degradação graciosa de UX, não para controles de segurança.
- react-router-dom permanece em `^7.18.2+` (nunca aceitar sugestão de `npm audit fix --force` de rebaixar para `7.11.0` — isso reintroduziria um open redirect real e já corrigido).
- Histórico do git não foi reescrito após o vazamento da anon key do Supabase no histórico (dez/2025) — a chave foi rotacionada em vez disso. Não propor reescrita de histórico como solução padrão para segredos vazados neste projeto.
- Versionamento segue SemVer estrito: mudanças de segurança/hardening que não quebram uso existente são minor (ex: v3.5.0), não major.
- As 4 RPCs públicas (get_leaderboard, get_repo_history, obter_snapshot, registrar_busca) são intencionalmente SECURITY DEFINER e executáveis por anon/authenticated — é assim que o app funciona sem exigir login. O Supabase Security Advisor sinaliza isso como WARN estrutural permanentemente, mesmo com toda a validação interna correta — não é um problema de código, é o modelo de acesso do produto. Não tentar "resolver" trocando para SECURITY INVOKER ou revogando EXECUTE — isso quebraria a aplicação para todo usuário não autenticado.
- Auditoria de dependências (2026-08): os 44 alerts que o GitHub reportava vs. os 14 do `npm audit` local eram o **mesmo** conjunto de vulnerabilidades — o GitHub conta um alert por (pacote, GHSA individual, faixa de versão instalada), enquanto o `npm audit` agrega todas as GHSAs de um pacote numa única entrada (confirmado via `gh api repos/assertlab/bisolhador/dependabot/alerts`, não suposição). `npm audit fix` (sem `--force`) resolveu as 14 sem tocar em nenhuma versão major declarada em `package.json` — só o lockfile mudou. Antes do fix, os 14 achados foram individualmente verificados linha a linha contra o uso real do Bisolhador e nenhum era explorável: 11 eram devDependency (eslint/vite/tailwindcss/postcss e suas transitivas — nunca chegam ao bundle do browser); `jspdf`/`dompurify` chegam via `html2pdf.js` mas o Bisolhador só faz screenshot-para-PDF via `html2canvas` + `.save()`, nunca chama `addJS`/`AcroForm`/`FreeText`/`.output('*newwindow', ...)` (as APIs vulneráveis); `ws` chega transitivamente de uma dependência de produção (`@supabase/supabase-js` → `realtime-js`), mas o pacote só é referenciado numa string de mensagem de erro no código do `realtime-js` — nunca é importado nem aparece no bundle final (`dist/`) do app. Se o uso de qualquer um desses três pacotes mudar (ex: Bisolhador passar a chamar API do jsPDF/DOMPurify diretamente, ou `@supabase/realtime-js` passar a exigir `ws` como transporte explícito), essa análise precisa ser refeita — não presumir que a conclusão "não explorável" continua válida sem reverificar contra o uso real.

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
- Nunca rodar um script ad-hoc (Playwright, curl, etc.) contra o app com `VITE_SUPABASE_*` configurado sem interceptar `**/rest/v1/rpc/registrar_busca` — cada carregamento de Dashboard grava um snapshot em produção. Mockar a API do GitHub **não** basta: em 29–30/07/2026 um script de medição de lag gravou 30 snapshots "Mocked…" (100 ⭐, health 14) que viraram o dado mais recente de react/angular/vue/svelte no Benchmark e no Ranking (ver `docs/AUDITORIA_INDICADORES_2026-10.md`). O `scripts/csp-smoke-test.mjs` já intercepta; copiar o padrão dele (com cabeçalhos CORS).
- Em scripts de medição de performance (Playwright + `performance.now()`), cuidado para não incluir o tempo de carregamento de um chunk lazy (ex: esperar um seletor que só existe após o code-splitting de página) dentro da métrica que está sendo medida — isso já inflou artificialmente um resultado de lag duas vezes nesta mesma sessão de trabalho.

## Fluxo de Trabalho com Agentes de Código

1. Antes de qualquer mudança, atualize e crie uma branch nova: `git checkout main && git pull origin main`, depois `git checkout -b <tipo>/<nome-descritivo>` (ex: `perf/`, `fix/`, `docs/`). Nunca commitar direto em `main`.
2. Implemente a mudança pedida.
3. Depois de implementar qualquer mudança e antes de declarar que está pronto para revisão do usuário:
   1. Rode `/code-review` sobre o diff atual da branch sempre que a mudança fizer alguma afirmação — em prosa ou em código — sobre como o sistema se comporta HOJE, que possa estar factualmente errada. O gatilho não é "código vs. documentação" como tipos de arquivo: vale para qualquer mudança de código, e para qualquer mudança de documentação que descreva arquitetura, segurança, comportamento de uma feature, ou qualquer afirmação verificável contra o repositório real (ex: as seções `## Architecture`, `## Security`, `## Decisões Arquiteturais` deste próprio arquivo). Pode ser pulado para documentação que não descreve comportamento do sistema — lista de features em prosa, entradas de changelog/roadmap, ajuste de tom/formatação, correção de número de versão. Trate achados de severidade alta/crítica como bloqueantes — corrija antes de prosseguir. Achados de baixa severidade podem ser reportados ao usuário como pendência, sem bloquear.
      - Exemplo real desta sessão: pular `/code-review` na branch `docs/agents-boas-praticas` por ela ser "só documentação" teria deixado passar uma afirmação factualmente errada sobre `ensureChartSetup()` não existir ainda no código — o `/code-review` pegou isso justamente por ter rodado mesmo sendo uma mudança de arquivo `.md`.
   2. Rode `/simplify` sobre o mesmo diff, sob o mesmo critério do item anterior. Aplique limpezas óbvias (duplicação, complexidade desnecessária) que não mudem comportamento; para qualquer sugestão que mude comportamento observável, reporte ao usuário em vez de aplicar direto.
   3. Rode `/security-review` sempre que o trabalho tocar autenticação, autorização, dados persistidos, RLS/RPCs do Supabase, ou qualquer integração externa (GitHub API, Supabase, GA4) — esse critério vale independente de ser mudança de código ou de documentação. Para mudanças sem nenhum desses fatores, pode ser pulado — mas registre explicitamente que foi pulado e por quê, em vez de simplesmente omitir.
   4. Só depois desses passos, rode `npm run lint` e `npm run build`, e então pare e reporte ao usuário que está pronto para revisão — seguindo o resto do fluxo abaixo (branch, commit, push, PR, nunca merge automático).
4. `git add`, `git commit` com mensagem descritiva (o porquê, não só o quê), `git push -u origin <branch>`.
5. Abra ou atualize o Pull Request: use `gh pr create`/`gh pr edit` se o `gh` CLI estiver disponível e autenticado; caso contrário, não tente contornar — reporte ao usuário a URL de comparação que o próprio `git push` imprime, para abrir manualmente.
6. Nunca dar merge nem fechar o PR — isso fica com o usuário, manualmente, depois de revisar.
