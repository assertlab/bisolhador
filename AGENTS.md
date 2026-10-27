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
- **Charts**: Chart.js + react-chartjs-2 (lazy loaded via React.lazy + Suspense); the Classroom PDF report draws its own vector bars with react-pdf
- **Database**: Supabase (analytics persistence, snapshots, leaderboard)
- **API**: GitHub REST API v3
- **Analytics**: Hybrid — Supabase (critical data, AdBlock-proof) + GA4 (engagement)
- **i18n**: react-i18next (PT-BR / EN-US) with auto-detection
- **Deploy**: GitHub Pages at **https://bisolhador.assertlab.com** (repo custom domain, base `/`) via `.github/workflows/deploy.yml` — see `### Release / Deploy`. `assertlab.com/bisolhador/*` 301-redirects there (Cloudflare Redirect Rule, path + query preserved). The build also writes `dist/404.html` = `index.html` (`scripts/spa-fallback.mjs`) because Pages has no SPA rewrite.

### Folder Structure
```
src/
├── main.jsx                    # React initialization
├── App.jsx                     # Router setup (/, /ranking, /timeline, /benchmark, /guia, /guia/ia, /turma)
├── constants.js                # Shared constants (API limits, thresholds, etc.)
├── pages/
│   ├── Dashboard.jsx           # Main analysis dashboard
│   ├── Ranking.jsx             # Leaderboard (Bisolhômetro)
│   ├── Timeline.jsx            # Time Machine — repo evolution over time
│   ├── Benchmark.jsx           # Multi-repo comparison (up to 10 repos)
│   ├── Guide.jsx               # /guia "Como interpretar": one entry per indicator + CHAOSS reference
│   └── AiGuide.jsx             # /guia/ia "Guia de IA no Processo": principles, how to declare co-authorship, detection table generated from the registry, Classroom guidance, FAQ, limits
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
│   ├── ai/                     # AI in the Process (Dashboard and Classroom)
│   │   ├── AiProcessSection.jsx    # Repository level: tools, config depth, commits, PRs, AI review, safeguards (receives report.aiProcess only: counts and tool ids)
│   │   ├── AiCoherence.jsx         # "Sources disagree" at repository level, neutral tone, legitimate causes listed
│   │   ├── AiResponsibleBadge.jsx  # "Responsible AI use" badge (repository level, met/unmet/na/unverified)
│   │   ├── AiStudentTable.jsx      # Per-student view, Classroom Mode only (in memory: never CSV, Supabase or GA)
│   │   ├── AiParts.jsx             # Shared bits (InfoTip, Chip, BlockTitle)
│   │   └── toolLabel.js            # Registry tool id → display name
│   ├── RouteErrorBoundary.jsx  # Error page around the routes (chunk load failure: one auto reload; render crash); the one class component
│   └── skeletons/              # Skeleton loading screens
├── hooks/
│   ├── useRepository.js        # Main data hook (15+ GitHub endpoints, Promise.allSettled)
│   ├── useClassroomAnalysis.js # Classroom queue: privacy gate (fail-closed) + period fetches, 3 repos at a time
│   ├── useSnapshot.js          # Supabase snapshot by URL (?id= / ?repo=&date=), TanStack Query
│   ├── useBenchmarkRepos.js    # Parallel fetch via TanStack useQueries
│   ├── useTimeFilter.js        # Unified time range filtering logic
│   ├── useChartTheme.js        # Chart colors for light/dark mode
│   ├── useTheme.js             # Dark mode toggle with localStorage
│   └── useHashScroll.js        # Scroll to and focus the #hash target (Guide, AiGuide)
├── services/
│   ├── githubService.js        # GitHub REST API calls with token support
│   ├── supabase.js             # Supabase client
│   ├── leaderboardService.js   # RPC calls for public ranking
│   └── analytics.js            # Hybrid analytics (GA4 + Supabase)
├── utils/
│   ├── analyzers.js            # Pure functions: health score, process metrics
│   ├── repoTree.js             # Maturity detectors (tests/CI/Docker/linter: ✓/✗/? not verified), issue-template dir, fork profile from tree
│   ├── branches.js             # Zombie branches: excludes default, protected and release/maintenance lines
│   ├── classroom.js            # Repo list parsing, period, per-repo row from settled fetches (incl. AI section + per-student rows)
│   ├── aiRegistry.js           # AI tool registry (data, REGISTRY_VERSION): config paths, co-author e-mails, agent/reviewer logins, CONTEXT_DIRS, .gitignore patterns
│   ├── aiTraces.js             # Trace detectors: co-author trailers (by e-mail; line-based, last 4 KB, no regex: messages are untrusted), agent/reviewer logins (no [bot], case-insensitive; an agent login counts only on a bot account), config paths, .gitignore (capped), co-author switch
│   ├── aiProcess.js            # report.aiProcess (method ai-traces-v1): config, commits, PRs, safeguards, coherence, badge; normalizeSnapshotAiProcess
│   ├── aiClassroom.js          # Classroom AI: template origin (github-classroom[bot]), authorship paths, per-student rows, tests/CI badge input (classroomMaturity)
│   ├── classroomColumns.js     # Classroom table columns (shared with the CSV) and classroomCsvRows (n after each %)
│   ├── indicatorGuide.js       # Guide structure and CHAOSS mapping (relation equivalent/related/none); texts in `locales/guide.{pt,en}.json` (`guide.*`)
│   ├── aiGuide.js              # /guia/ia structure: per-tool declaration entries (verified vs e-mail only, with sources), detection rows from AI_TOOLS, FAQ, limits, numbers quoted from constants; texts in `locales/aiGuide.{pt,en}.json` (`aiGuide.*`)
│   ├── repoName.js             # SAFE_GITHUB_NAME_PATTERN / parseSafeRepoName for app-built routes
│   ├── projectPractices.js     # CI health (push runs on the default branch), Conventional Commits, release cadence (12 months, min(created_at, published_at)); snapshot normalizer
│   ├── activityStats.js        # /stats/* status (computing/tooLarge/error), weekdays from punch_card, additions/deletions ratio, closed share
│   ├── timelineData.js         # Timeline points: rows with a report, one per day, null = gap; signed growth
│   ├── benchmarkData.js        # Benchmark rows from history: latest row with a report, null = N/A, old-method values not recorded, one point per day
│   ├── contributors.js         # Contributor analysis: bots excluded, 12-month window, top concentration (feeds busFactor.js)
│   ├── busFactor.js            # Advanced Bus Factor (Pareto 70% threshold)
│   ├── formatters.js           # Date/number formatting
│   ├── pdfExporter.js          # PDF export via html2pdf.js (Dashboard)
│   ├── downloadBlob.js         # Blob → file download (Classroom PDF)
│   ├── exportJson.js           # JSON data export with provenance metadata
│   └── csvExporter.js          # CSV export (native, no dependencies)
├── lib/chunkErrors.js          # isChunkLoadError, claimAutoReload (one reload per 60 s; not offline, not without storage)
├── report/                     # Classroom PDF report (react-pdf, vector): reportModel.js (repository-level whitelist from the Classroom rows), reportReading.js (rule-based "Leitura desta turma"), ClassroomReportDocument.jsx + ReportParts.jsx + styles.js + theme.js (Compasso identity), fonts.js (IBM Plex Sans .woff), generateReport.js (lazy entry point)
└── locales/                    # i18n: pt.json / en.json (main, in the entry bundle);
                                #   guide.{pt,en}.json (/guia), aiGuide.{pt,en}.json (/guia/ia) and report.{pt,en}.json (PDF report), loaded on demand only
```

### Data Flow
1. User searches for repo in `owner/repo` format
2. `useRepository` hook orchestrates all GitHub API calls via `githubService`
3. `analyzers.js`, `contributors.js` and `busFactor.js` compute metrics locally (health score, maturity, contributor concentration, bus factor, etc.); `aiProcess.js` builds the "AI in the Process" section (`report.aiProcess`) from the tree, the recent commits, the merged-PR sample and, with a token, one extra GraphQL call (`fetchAiRepoContext`)
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
- **But "couldn't measure" must never look like "zero" or "absent".** Count/indicator fetchers (`fetchSearchCount` for issues/PRs/merges, `fetchBranches`, `fetchReleasesCount`, `fetchCommunityProfile`, and the `/stats/*` fetchers via `fetchStats` — participation, punch_card, code_frequency — with error codes COMPUTING/TOO_LARGE/FAILED that the charts explain, so they stay out of the partial-data banner) **throw** on failure; `useRepository` gets `null` from `Promise.allSettled`, lists the endpoint in `_warnings` (partial-data banner) and the UI shows "N/A"/"n/d" (`formatters.formatNumber(null)` → `N/A`). A snapshot is **not persisted** when one of the count indicators or the community profile request failed (`PERSIST_BLOCKERS` in `useRepository.js`); forks (no community profile, 404) are saved with health unavailable. A failed `fetchCommits` (it throws; 409, the empty repository, returns `[]`) is no longer turned into an empty list: it gives `recentCommits: null` (`recentCommitsOf` in `activityStats.js`; the activity list says "couldn't load", not empty) and Conventional Commits `reason: 'error'`, listed as `commits` in `_warnings`. It doesn't block persistence — no history view (Timeline/Benchmark/Ranking) compares commits — so the snapshot is saved with those unavailable values, read back as "not recorded". Older snapshots may hold `recentCommits: []` from a failure, so in snapshot mode an empty list reads "no commits recorded". Not yet covered: list fetchers that still return empty values on error (contributors, languages, tree) — their failures can still be saved as empty data; audit wave 1 items 2–5, see `docs/AUDITORIA_INDICADORES_2026-10.md`.
- AI in the Process: the `aiContext` request (`fetchAiRepoContext`, token only) is in `SELF_EXPLAINED` — its failure doesn't raise the partial-data banner, the section shows those checks as "not verified" — and AI failures never block persistence (not in `PERSIST_BLOCKERS`). Everything there is a lower bound: no trace shows "No AI trace found" plus an explanation, never "0% AI" or "doesn't use AI".
- All GitHub calls after the initial `/repos/{o}/{r}` use the **canonical** `repoData.full_name` (renamed repos: the Search API does not follow renames).
- Dashboard renders a single generic error banner (`{error}` as plain text) — there is no differentiated UI per error type today; 403 (rate limit), 404, and "private repo unsupported" all look identical to the user. Prior versions of this file claimed 403/404 got distinct treatment; that was never true in the code. See `docs/ROADMAP.md` for the pending UX item to fix this.
- Render UI even with partial data (graceful degradation)
- A route whose chunk fails to load (hash gone after a deploy, network) or whose render crashes shows an error page, never a blank screen: `RouteErrorBoundary` (`src/components/RouteErrorBoundary.jsx`, reset by `resetKey` = path, the one class component, boundaries require it; reports `analytics.trackRouteError(kind)`, kind only, no path or message) around the routes in `App.jsx`. A chunk error (`isChunkLoadError`, `src/lib/chunkErrors.js`) reloads once on its own (`claimAutoReload`: one per 60 s, sessionStorage; no storage = no auto reload, no loop); a second failure shows the error with the header, its own settings modal and a reload button. `React.lazy` keeps a rejected import rejected, so returning to the same broken page fails until a reload. There is deliberately no global `vite:preloadError` reload: it would throw away a class analysis held only in memory on `/turma` when the PDF chunk fails (that failure keeps showing the button's toast).

### Performance Patterns
- Charts use `React.lazy` + `Suspense` (code splitting); the 4 pages (Dashboard, Ranking, Timeline, Benchmark) are lazy-loaded in `App.jsx` the same way
- `chart.js` is imported dynamically and registered on demand via `ensureChartSetup()` (`src/lib/chartSetup.js`) — never eager from `main.jsx`. Initialization is shared through a single memoized promise and prefetched (fire-and-forget) in parallel with searches (`useRepository.js`) and Benchmark repo additions (`Benchmark.jsx`), so it doesn't block the search itself but avoids visible lag on first chart render
- `useMemo` for chart data/options to avoid Chart.js canvas re-creation
- `useChartTheme` returns memoized theme object
- Skeleton screens for loading states (LCP optimization)
- No `manualChunks` (Vite 8 / Rolldown): splitting follows the dynamic imports. Forcing packages into named chunks used to drag shared deps along and made the entry preload them — in Vite 7 the ~950 KB `pdf-vendor` was preloaded on every first visit. `html2pdf.js` is imported on click inside `exportToPDF()` (`src/utils/pdfExporter.js`), like chart.js via `ensureChartSetup()`. At the Vite 8 upgrade, first load went from ~1.56 MB to ~592 KB of JS (measured then, without the supabase-js modulepreload that today's build has, so not comparable with the v3.17.2 numbers below).
- Page-only texts live in their own locale files, not in `pt.json`/`en.json`: `guide.*` in `src/locales/guide.{pt,en}.json` (/guia), `aiGuide.*` in `src/locales/aiGuide.{pt,en}.json` (/guia/ia). `src/lib/lazyLocales.js` imports them dynamically, for the active language only, and merges them into the `translation` namespace (`addResourceBundle`), so call sites keep `t('guide.…')`. The pages wait with `useLazyLocale(name)` (spinner, or an error if the chunk fails; never raw keys) and `useHashScroll(ready)` scrolls once the texts are in; `App.jsx` starts the text fetch in parallel with the page chunk, and `LanguageSwitcher` loads the mounted pages' bundles in the new language before switching (`changeLanguageWithLocales`), so the swap doesn't flash (only the latest switch applies: a late load can't undo a newer click). Keys used outside those pages (the "Como interpretar" / AI guide link labels) are in the main locale under `guideLinks.*`; `lazyLocales.test.js` fails if `guide`/`aiGuide` creep back into `pt.json`/`en.json`. A new page-only namespace goes the same way: add it to `BUNDLES` in `lazyLocales.js`. Measured at v3.17.2 (entry + modulepreloads, before the route's page chunk): ~644 KB raw / ~193 KB gzip, down from ~731 KB / ~218 KB in v3.17.1; the entry chunk alone went from ~443 KB to ~355 KB (~141 → ~115 KB gzip).

### Component Structure
- Pages in `src/pages/`, UI components in `src/components/`
- Complex pages broken into sub-components (e.g., `benchmark/`)
- Shared UI extracted as reusable components (`TimeRangeFilter`, `StatCard`)
- Constants extracted to `src/constants.js` (no magic numbers in business logic)
- Version display is dynamic (Header reads from `package.json`)

## Project Context

### Purpose
Educational tool by ASSERT Lab (UFPE) for software engineering teaching (v3.16.0). Transforms GitHub repository data into visual insights for students and professors.

### Token System
- Stored in `localStorage['github_token']` (via safe storage wrapper)
- Increases rate limit from 60 to 5,000 requests/hour
- Auto-added to requests in `githubService.getHeaders()`
- Required for the **Code Review (merged without approval)** and **Divergence** metrics: they come from one GraphQL call (`fetchPullRequestReviewStats`) over the latest 50 **merged** PRs by humans (by merge date, among the 100 most recently updated merged PRs — GitHub can't order by merge date), because the REST `/pulls` list has no approvals/comment authors. Bots (PR authors, comments, approvals) are excluded — code agents included (Copilot, `claude[bot]`, …): these indicators keep measuring human PRs only, with no `method` change; agents are measured separately, in `aiProcess` (AI in the Process). "Unapproved" = merged with no `APPROVED` review, submitted before the merge, from someone other than the author; self-merge rate is only in the tooltip. Without a token, both are shown as unavailable ("n/d" plus an explanation), never as 0% (`src/utils/prReviewStats.js`).
- **Review coverage, time to first review and PR size** (`reviewProcess` in the report) come from the same merged sample. `fetchPullRequestReviewStats` runs three GraphQL queries in parallel (core / timing / size): one query with every field took 5–10 s, close to GitHub's ~10 s GraphQL limit; split, each takes ~1.5–5 s (~5 points per search). Only the core query is required; a failed timing or size query makes only that indicator unavailable (the snapshot is still saved, like the other review metrics), and a PR missing from a list that loaded is just left out of that indicator. Reviews and approvals after the merge don't count. Small PR = under 400 changed lines. The first-review clock starts at `ReadyForReviewEvent` (or creation for non-drafts).
- **Lead time** is the **median** (plus p90 and n) creation → merge over those same merged PRs; without a token, over the merged ones among the 100 most recently updated closed PRs (REST, smaller sample). A failed fetch blocks persistence; PRs disabled (404, torvalds/linux) = "no merged PRs". `leadTime.source` (`graphql`/`rest`) records which sample was used. Benchmark plots `leadTimeDays()` (median in days; old mean-based snapshots → N/A).
- **AI in the Process** (`report.aiProcess`, `src/utils/aiProcess.js`): without a token, zero new requests (tree, the 100 recent REST commits and the REST PR list only); with a token, +1 GraphQL (`fetchAiRepoContext`: `.gitignore`, `.claude/settings.json`, AI-config directories and the template repository's, plus the repository's `.github/workflows` listing, used only by Classroom; a partial GraphQL error makes that part "not verified", never "absent"; the Dashboard ignores a private or unknown-visibility template, Classroom reads it). GitHub reports `templateRepository: null` for GitHub Classroom repositories (verified on real public ones), so on the Dashboard a root commit by `github-classroom[bot]` in the 100-commit sample (`isClassroomCreated`) makes every config path outside the template listing "origin not verified" (`fromTemplate: null`) instead of the team's own; without that commit in the sample, `null` still means "no template". Classroom resolves origin per file from its history (`templateFromAuthorship`) and AI review/safeguards from the same merged-PR sample as the review metrics, but with humans and agents together (maintenance bots out). Counts and tool ids only, nothing per person. `method = 'ai-traces-v1'`, `registryVersion = '2026-10-25'`.
- Persisted snapshots go through `normalizeSnapshotProcessMetrics` and `normalizeSnapshotContributors` (contributors/bus factor without `busFactorAnalysis.window`, i.e. before v3.8.0 → "not recorded"; a fetch that failed stays "unavailable") on read: values without the current `method` (measured over recently *created* PRs, mean lead time, self-merge rate, bots included) and reports saved as unavailable both show "not recorded in this snapshot". The Benchmark applies the same rules (`src/utils/benchmarkData.js`); the Timeline plots only stars/forks/watchers, which have no method change. `useSnapshot` also applies `normalizeSnapshotAiProcess`: an `aiProcess` without the current `method` (snapshots before v3.15.0) or with a malformed shape → "not recorded in this snapshot".

### Backend / Supabase
- **Write**: All writes via validated RPCs (`registrar_busca`), no direct INSERT
- **Read**: snapshot by id (`obter_snapshot`), by date (`buscar_snapshot_por_data`: most recent record up to the end of that day, fixed `America/Recife` timezone — `p_timezone` accepted and ignored for old clients; versioned in `supabase-migrations/` since 2026-10, it returned null for every input before), history (`get_repo_history`), ranking (`get_leaderboard`). The smoke test opens the date permalink of `SMOKE_SNAPSHOT_ID`'s record.
- **Schema**: `analytics_searches` uses `BIGINT` IDs and `NUMERIC` health_score
- **Security**: Direct table access (INSERT/SELECT) for the `anon` role is revoked via RLS — all access goes through `SECURITY DEFINER` RPCs. This was **not** true before v3.5.0: two public RLS policies ("Permitir inserts publicos", "Permitir leitura publica") let `anon` read/write `analytics_searches` directly, bypassing every RPC, despite this file previously claiming otherwise. See `## Security` below and `docs/CHANGELOG.md` [3.5.0].

### URL / Deep Linking
- `/?q=owner/repo` — live search
- `/?id=123` — immutable snapshot permalink
- `/?repo=owner/project&date=YYYY-MM-DD` — semantic historical search: most recent snapshot up to that day (America/Recife); the banner shows when it was actually recorded. Not rename-aware: old snapshots stay under the old name (e.g. `facebook/react`).
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
The app never processes or persists data from private GitHub repositories, even when the user's PAT has private-repo scope — except in Classroom Mode, which analyzes them live without persisting anything (see `### Classroom Mode` and the decision log). `useRepository.js` checks `repoData.private` immediately after the initial repo fetch and aborts (`PRIVATE_REPO_UNSUPPORTED`) before any of the 15+ parallel calls or the Supabase save-on-load. `Benchmark.jsx` has its own entry path — it reads history from Supabase, not live GitHub calls — so it performs its own live visibility check via `githubService.fetchRepository`, retried with `withExponentialBackoff` and fail-closed if visibility can't be confirmed.

### Classroom Mode
`/turma` analyzes up to 50 repositories over a course period (pasted, or imported from an organization with `fetchOwnerRepositories`). It never writes to Supabase (no `saveSearch`). It is the **only** place private repositories are processed (see the decision below): each repository's visibility is checked first (`fetchRepository`); private ones are analyzed and flagged (🔒, on-screen notice, CSV visibility column); unverifiable visibility fails closed. Repository names come from the URL or pasted text and are validated with `parseSafeRepoName` (and the canonical name returned by GitHub again) before use; they only go as GraphQL variables or encoded URL parts. Merged PRs come from `repository.pullRequests` filtered by `mergedAt`, not from the search API: search returned 0 with no error where an org or token restricts it, which would show a whole class as "0 PRs". Concentration is shown without naming the top author (CHAOSS data ethics).
- **Links in the results open in a new tab** (since v3.17.1): the analysis lives only in memory, so following a link in place throws away a class run of up to 50 repositories. The results section is wrapped in `NewTabContext` (`src/lib/newTab.js`), which `GuideLink` and `AiProcessSection` read; the column headers, repository links, the page-top `GuideLink` (`newTab` prop) and `AiStudentTable` set `target="_blank" rel="noopener noreferrer"` directly. `noreferrer` keeps `/turma?repos=…` out of the Referer sent to pages where GA is on. Each such link carries a visually hidden `app.opensInNewTab` hint (`NewTabHint`). Outside Classroom (Dashboard) links stay in the same tab. The detail row's panel is `sticky` and sized with `100cqw` of the table's scroll box (`[container-type:inline-size]`), so it fits a phone screen instead of taking the table's width; that box is also `relative`, so the table's `sr-only` spans don't widen the page.
- **AI badge "tests and CI"** (`classroomMaturity` in `src/utils/aiClassroom.js`, since v3.16.0; before, always "not verified"): Classroom has no tree, so it uses what it already fetches — the root listing (`rootPaths`, directories as `name/`) and the `.github/workflows` listing (alias `workflows` in the same `fetchAiRepoContext` query, repository only, kept out of `CONTEXT_DIRS` with its own unverified part) plus the period's Actions runs that exercise the default branch (push to it, same-repo non-bot PR runs, merge queue: `fetchCiRunsInPeriod` + `ciRunsForBranch`; since v3.19.0, before it only `push` runs counted and a PR-only CI looked absent). CI = `detectCi` on those paths, or any completed run; `false` only when the listings were read **and** the runs loaded and both are negative, otherwise `null`. Tests = a test directory at the root (`test/`, `tests/`, `__tests__/`; `spec/` excluded as in `repoTree.js`) or `null`, **never `false`**: co-located `*.test.js` and `src/test` are invisible without the tree. So the criterion can only be unmet through CI. The listings are read at the repository's current state (HEAD), not at the end of the period; only the runs are limited to the period.
- **PDF report** (since v3.18.0, `src/report/`): button next to the CSV. `@react-pdf/renderer`, the document and the `report.*` / `guide.*` texts are imported on click (`generateClassroomReport`), never at page load; a failure shows a toast (no silent Helvetica fallback: fonts come from `@fontsource/ibm-plex-sans` `.woff`, react-pdf does not read `.woff2`). **Privacy boundary:** the document renders `buildReportModel(...)` only — repository-level values from the same `CLASSROOM_COLUMNS` the CSV uses, a whitelist built by construction (tested: no per-student data in the model). Per-student data stays out of the PDF; including it would change the "never exported" boundary and needs a maintainer decision recorded below. Optional anonymization (off by default) replaces names with "Repository A, B…" and drops the private count. Commits/authors/concentration use `report.indicator.*` texts (the guide's 52-week/12-month wording doesn't describe the class period); every other indicator reuses `guide.items.<id>`. "Leitura desta turma" is rule-based (`readingFor`), no LLM, no grades or ranking. **CSP cost:** react-pdf's layout engine (yoga) is WebAssembly loaded from a data URI, so the CSP has `'wasm-unsafe-eval'` (script-src) and `data:` (connect-src); see the `index.html` comment. The banner logo is `src/report/logo.jpg` (site logo flattened onto the banner navy): a PNG `<Image>` makes react-pdf spawn a `blob:` worker, which the CSP blocks (the report then hangs with no visible error), so keep raster assets in JPEG, or add `worker-src blob:` as a conscious CSP decision. The smoke test doesn't cover this path yet (it needs Classroom data); it was verified in a production build under the real CSP.
- **CI column** (`analyzeCiRuns(…, { events: CLASSROOM_CI_EVENTS })`): reads up to `CLASSROOM_CI_RUN_PAGES` × 100 completed runs of the period (any trigger) and keeps push / same-repo non-bot PR / merge-queue runs client-side (the API's `branch` filter is the head branch, and `pull_requests` is empty on nearly every completed run, so a PR run's target branch is only checked when reported). `capped` marks a sample. PR runs include attempts that failed before the merge. The Dashboard still counts push runs only.
- **CSV** (`classroomCsvRows` in `src/utils/classroomColumns.js`, the column definitions shared with the table): repository level only, raw numbers, `''` when unavailable. Since v3.16.0 every percentage column is followed by its n (`…N` header keys: human commits behind concentration, merged PRs behind approval, runs behind CI, commits behind Conventional Commits and AI commits, PRs behind agent PRs). Rule: when the fetch succeeded, n is the sample size, `0` for an empty sample (the % is then `''`); `''` only when that part failed or wasn't measured. Empty-sample results carry `n: 0` for this (`analyzeCiRuns` noRuns/noConclusive, `analyzeConventionalCommits` noCommits, `prs.approvedN`). Per-student data never goes in (tested).

AI in the Process in Classroom: +1 GraphQL per repository (`fetchAiRepoContext`) and +1 authorship query (`fetchAiConfigAuthorship`, up to 10 paths passed as GraphQL variables) only when the repository has AI-config files not found in its template repository. The table gets repository-level AI columns (tools, % AI commits, % agent PRs, sources disagree, badge), which also go to the CSV. Expanding a row shows the repository AI section and a **per-student view** (commits, commits with AI, tools, AI-config files touched in the period), which **names authors** — the only exception to "don't name authors", restricted to that view (decision log, 2026-10-26). It lives only in the browser's memory: never in the CSV, Supabase or GA. Agent-authored commits get their own row per agent, and commits not linked to an account a single "unidentified" row.

### Input Sanitization
`githubService.js` applies `encodeURIComponent` to every interpolated value (`owner`, `repo`, `defaultBranch`) in request URLs and GitHub search query strings — including inside search qualifiers (e.g. `` repo:${owner}/${repo}+type:pr ``), where only the interpolated values are encoded, never the literal `+`/`:` separators, so query semantics aren't broken. GraphQL queries (review stats, branches, classroom history/PRs) pass `owner`/`repo` as GraphQL **variables**, never interpolated into the query string.

### RPC Input Validation
`get_leaderboard` ordena por dias distintos com análise (coluna `dias_analisados`, fuso America/Recife; `total_buscas` continua sendo o número de linhas, para compatibilidade) e tem teto de 100 no `limit_count` (`LEAST`/`GREATEST` com `COALESCE(limit_count, 50)` cobrindo o caso de `NULL` explícito, nunca confia no valor enviado pelo client); `registrar_busca` valida tamanho de `full_report` (500KB via `octet_length`, não `pg_column_size` — este último mede o tamanho comprimido/TOAST no disco, não o tamanho lógico, e podia ser contornado por payloads muito compressíveis) e `repo_name` (nulo ou > 300 chars) antes do INSERT, com `RAISE EXCEPTION` — ambos no nível do banco, não só no client. Ambas as funções também têm `DROP FUNCTION IF EXISTS` antes do `CREATE OR REPLACE`, seguindo o padrão de `get_repo_history.sql`, para garantir que um `CREATE OR REPLACE` com assinatura diferente da já implantada substitua a função antiga em vez de criar uma sobrecarga (overload) coexistente. Aplicado após revisão via Supabase Security Advisor.

### Analytics (GA4)
GA4 is initialized with `send_page_view: false`, and `RouteTracker` (`App.jsx`) sends one pageview per route/query change with `page_location` set to origin + path (`analytics.pathOnlyLocation`). Before v3.14.0 the default config sent the full URL, query string included, with every hit (`?q=owner/repo`, Classroom's `?repos=…`). That only covers **our** hits: GA4 **enhanced measurement** reads the real URL and links on its own — history-change page views (full URL as `dl`/`dr`), outbound clicks (`link_url`), form interactions (`form_destination`) and site search (`search_term` from `?q=`) — verified with intercepted hits. So GA is **disabled from the first visit to `/turma`** until the page is closed (`analytics.disableIfClassroom`), and those four enhanced-measurement toggles must be off in the GA4 admin for the rest of the app. Don't add hits that carry repository names (the old `trackSearch` label does, but nothing calls it).

### Content-Security-Policy
`index.html` ships a CSP scoped to the domains the app actually calls: `api.github.com`, Supabase (via the build-time `%VITE_SUPABASE_URL%` substitution, not a wildcard), GA4's script/collection domains (also in `img-src`, for gtag.js image hits), and `avatars.githubusercontent.com` for contributor images. `script-src` has `'wasm-unsafe-eval'` and `connect-src` has `data:` for the Classroom PDF report (react-pdf's yoga layout is WebAssembly fetched from a data URI; the directive allows compiling WebAssembly only, not JS `eval`). `style-src` includes `'unsafe-inline'` because `html2canvas` (used by the PDF export) applies inline styles via `setAttribute`/`cssText` while cloning the DOM for rendering — confirmed with a real headless-browser test (`npm run smoke:csp`), not assumed. `frame-ancestors`/`report-uri` don't work via `<meta>` (HTTP-header-only directives), so GitHub Pages static hosting has no clickjacking protection through this CSP.

### Route Safety
`RepoInfoCard.jsx` validates `owner`/`repo` (and the `?alias=` pre-rename name) with `parseSafeRepoName`/`SAFE_GITHUB_NAME_PATTERN` (`src/utils/repoName.js`) before calling `navigate()` for the `/timeline/:owner/:repo` route; `Timeline.jsx` validates `?alias=` again on read — defense in depth, since that data can come from a Supabase snapshot rather than a live search, and a react-router version fix shouldn't be the only safety net for app-constructed routes.

## Documentation Maintenance Policy

Whenever a code change has the potential to change behavior documented in this file, in `README.md`, or in `docs/DESIGN_SYSTEM.md`, explicitly evaluate — before considering the task done — whether any of those documents need updating, and whether the change justifies a new `docs/CHANGELOG.md` entry and a `package.json` version bump (following SemVer: patch for fixes with no visible behavior change, minor for new behavior/hardening that doesn't break existing usage, major for changes that break existing usage).

Changing how an indicator is measured also means updating its entry in the "Como interpretar" guide (`guide.items.<id>` in both `src/locales/guide.pt.json` and `src/locales/guide.en.json`, and `relation`/CHAOSS refs in `src/utils/indicatorGuide.js`): the guide states definitions and differences from CHAOSS, so it goes stale exactly like this file. `indicatorGuide.test.js` only checks structure, not that the text still matches the code.

The same goes for the "Guia de IA no Processo" page (`/guia/ia`, `src/pages/AiGuide.jsx`, `src/utils/aiGuide.js`, texts in `src/locales/aiGuide.pt.json` and `aiGuide.en.json`): update it whenever the AI registry (`src/utils/aiRegistry.js`) or the AI rules (`aiTraces.js`, `aiProcess.js`, `aiClassroom.js`, Classroom caps) change. Its detection table is generated from `AI_TOOLS` (display fields `show`/`examples`, checked against the patterns by `aiRegistry.test.js`) and its numbers come from `constants.js`, but the prose (limits, FAQ, per-tool instructions) is hand-written. Per-tool instructions in block 2 are only for tools whose mechanism was checked against official docs or source (`mode: 'verified'`, with `sources` and `checked` date in `aiGuide.js`); re-check them when a tool changes how it attributes commits, and leave unconfirmed tools as e-mail only.

Stale documentation isn't a cosmetic problem in this project. It has already, concretely, caused a false sense of security about RLS protections that didn't actually exist — this file and the project's other docs asserted for months that anonymous INSERT into `analytics_searches` was blocked, when in fact two public RLS policies made it (and anonymous SELECT) fully open. Treat every doc claim about security posture as something that needs re-verifying against the actual code/config, not something to copy forward from the previous version.

## Decisões Arquiteturais que Já Foram Tomadas (não reabrir sem motivo novo)

- RLS do Supabase: acesso à tabela `analytics_searches` é só via RPCs `SECURITY DEFINER` (`registrar_busca`, `obter_snapshot`, etc). Nunca reintroduzir policy de INSERT/SELECT direta para o role `anon` — foi exatamente essa configuração que causou o vazamento de dados corrigido na v3.5.0. Confirmado via Supabase Security Advisor: a tabela ter RLS habilitada com zero policies é o estado correto e esperado (sinalizado como INFO "RLS Enabled No Policy", não como problema).
- Repositórios privados nunca são processados nem persistidos pelo app, mesmo quando o PAT do usuário tem escopo de acesso privado — decisão de produto deliberada (v3.5.0), não uma limitação técnica a ser contornada. **Única exceção (v3.14.0, decidida pelo mantenedor em 2026-10-24): o Modo Turma (`/turma`) analisa privados** — turmas do GitHub Classroom são privadas por padrão. A exceção só vale porque o risco que motivou a regra era a **persistência** no Supabase público, e o Modo Turma: roda no navegador de quem usa, com o token dessa pessoa (só vê o que ela já pode ver no GitHub); nunca chama `saveSearch`/Supabase; desliga o GA ao entrar em `/turma` até a página ser fechada (`analytics.disableIfClassroom`, flag `ga-disable-<id>`), porque a medição aprimorada do GA4 enviaria a URL `?repos=`, os links da tabela e o destino do formulário; mostra aviso explícito na tela. Visibilidade não verificável continua fail-closed. Dashboard, Benchmark, Timeline e Ranking continuam recusando privados. Não estender a exceção a nenhum fluxo que persista dados.
- **IA no Processo (v3.15.0, decidida pelo mantenedor em 2026-10-26):**
  - A **visão por estudante** de IA no Modo Turma é exceção à regra de não nomear autores, restrita a essa visão (linha expandida da tabela), só em memória: nunca no CSV, no Supabase nem no GA. A concentração no autor principal continua sem nome.
  - **Nada de IA por pessoa** no Dashboard, no `report` nem no snapshot: `report.aiProcess` só tem contagens e ids de ferramentas.
  - **"Fontes em desacordo"** só no nível do repositório, em tom neutro ("as fontes não concordam") e sempre com as causas legítimas; na visão por estudante, só fatos lado a lado, sem alerta individual.
  - O selo **"Uso responsável de IA"** é só por repositório, nunca por estudante, e fica fora do Ranking.
  - Os indicadores de revisão (lead time, cobertura, 1ª revisão, tamanho de PR, divergência) continuam medindo **só PRs de humanos**, sem mudança de `method`; agentes são medidos à parte, em `aiProcess`.
  - Ler o conteúdo dos workflows de CI fica **fora do escopo** por enquanto (custo de rate limit); registrado no `docs/ROADMAP.md`.
- Checagens de segurança seguem fail-closed, não fail-safe/fail-open. Isso é uma exceção intencional ao padrão geral de "nunca quebrar a aplicação, retornar valores vazios" do projeto — esse padrão vale para degradação graciosa de UX, não para controles de segurança.
- react-router-dom permanece em `^7.18.2+` (nunca aceitar sugestão de `npm audit fix --force` de rebaixar para `7.11.0` — isso reintroduziria um open redirect real e já corrigido).
- Histórico do git não foi reescrito após o vazamento da anon key do Supabase no histórico (dez/2025) — a chave foi rotacionada em vez disso. Não propor reescrita de histórico como solução padrão para segredos vazados neste projeto.
- Versionamento segue SemVer estrito: mudanças de segurança/hardening que não quebram uso existente são minor (ex: v3.5.0), não major.
- As 4 RPCs públicas (get_leaderboard, get_repo_history, obter_snapshot, registrar_busca) são intencionalmente SECURITY DEFINER e executáveis por anon/authenticated — é assim que o app funciona sem exigir login. O Supabase Security Advisor sinaliza isso como WARN estrutural permanentemente, mesmo com toda a validação interna correta — não é um problema de código, é o modelo de acesso do produto. Não tentar "resolver" trocando para SECURITY INVOKER ou revogando EXECUTE — isso quebraria a aplicação para todo usuário não autenticado.
- Auditoria de dependências (2026-08): os 44 alerts que o GitHub reportava vs. os 14 do `npm audit` local eram o **mesmo** conjunto de vulnerabilidades — o GitHub conta um alert por (pacote, GHSA individual, faixa de versão instalada), enquanto o `npm audit` agrega todas as GHSAs de um pacote numa única entrada (confirmado via `gh api repos/assertlab/bisolhador/dependabot/alerts`, não suposição). `npm audit fix` (sem `--force`) resolveu as 14 sem tocar em nenhuma versão major declarada em `package.json` — só o lockfile mudou. Antes do fix, os 14 achados foram individualmente verificados linha a linha contra o uso real do Bisolhador e nenhum era explorável: 11 eram devDependency (eslint/vite/tailwindcss/postcss e suas transitivas — nunca chegam ao bundle do browser); `jspdf`/`dompurify` chegam via `html2pdf.js` mas o Bisolhador só faz screenshot-para-PDF via `html2canvas` + `.save()`, nunca chama `addJS`/`AcroForm`/`FreeText`/`.output('*newwindow', ...)` (as APIs vulneráveis); `ws` chega transitivamente de uma dependência de produção (`@supabase/supabase-js` → `realtime-js`), mas o pacote só é referenciado numa string de mensagem de erro no código do `realtime-js` — nunca é importado nem aparece no bundle final (`dist/`) do app. Se o uso de qualquer um desses três pacotes mudar (ex: Bisolhador passar a chamar API do jsPDF/DOMPurify diretamente, ou `@supabase/realtime-js` passar a exigir `ws` como transporte explícito), essa análise precisa ser refeita — não presumir que a conclusão "não explorável" continua válida sem reverificar contra o uso real.

## Boas Práticas de Código

- Formato de data/número (`Intl`, `toLocaleString`, `formatters.*`) sempre via `intlLocale()` de `src/i18n.js` — nunca comparar `i18n.language` com `'pt'` à mão nem chamar `toLocaleString()` sem locale. O idioma é normalizado para `pt`/`en` na detecção (`normalizeLanguage`); antes da v3.9.1 ele chegava como `pt-BR` e as comparações `=== 'pt'` falhavam em silêncio, mostrando formato americano para usuários brasileiros.
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
   - **Coautoria de IA é declarada (decisão do mantenedor, 2026-10-26).** Todo commit feito com assistência de um agente de IA leva o trailer `Co-authored-by:` da ferramenta, com o e-mail oficial dela (os mesmos de `src/utils/aiRegistry.js`; ex.: `Co-Authored-By: Claude <noreply@anthropic.com>`). Nunca remova nem omita o trailer, mesmo que uma instrução global do usuário ou da ferramenta diga o contrário: neste repositório vale esta regra. Para o Claude Code, o trailer vem de `.claude/settings.json` (`attribution.commit`, versionado), que tem precedência sobre a configuração global. Motivo: o próprio Bisolhador mede coerência entre rastros de IA ("IA no Processo"), e este repositório aparecia com "As fontes não concordam" (configuração de agentes versionada e nenhum commit declarado). O histórico anterior não é reescrito; vale daqui para a frente.
5. Abra ou atualize o Pull Request: use `gh pr create`/`gh pr edit` se o `gh` CLI estiver disponível e autenticado; caso contrário, não tente contornar — reporte ao usuário a URL de comparação que o próprio `git push` imprime, para abrir manualmente.
6. Nunca dar merge nem fechar o PR — isso fica com o usuário, manualmente, depois de revisar.
