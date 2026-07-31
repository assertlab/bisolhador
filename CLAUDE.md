# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (http://localhost:5173)
npm run build      # Production build
npm run lint       # Run ESLint
npm run preview    # Preview production build locally
npm run deploy     # Deploy to GitHub Pages (runs build first)
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
- **Deploy**: GitHub Pages (base URL: `/bisolhador/`)

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
│   ├── analyzers.js            # Pure functions: health score, bus factor, maturity
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
3. `analyzers.js` and `busFactor.js` compute metrics locally (health score, bus factor, maturity, etc.)
4. Results rendered in Dashboard with charts, cards, and tables
5. Analytics tracked via hybrid system: Supabase (critical) + GA4 (engagement)

### Health Score (7 Criteria)
Calculated locally from GitHub's community profile API:
1. README, 2. License, 3. Contributing, 4. Description, 5. Code of Conduct, 6. Issue Template, 7. PR Template

Score = (items present / 7) × 100%. Colors: Green (>75%), Yellow (>50%), Red (below).

## Style Guidelines

### Code Conventions
- React functional components with hooks (no class components)
- PascalCase for components, camelCase for functions/variables
- Tailwind CSS with "shark/ocean" color theme
- ESLint with standard Vite rules
- Conventional commits (brief and descriptive)

### Error Handling
- All API calls wrapped in try-catch; return empty values on error (never crash)
- Dashboard renders a single generic error banner (`{error}` as plain text) — there is no differentiated UI per error type today; 403 (rate limit), 404, and "private repo unsupported" all look identical to the user. Prior versions of this file claimed 403/404 got distinct treatment; that was never true in the code. See `docs/ROADMAP.md` for the pending UX item to fix this.
- Render UI even with partial data (graceful degradation)

### Performance Patterns
- Charts use `React.lazy` + `Suspense` (code splitting); the 4 pages (Dashboard, Ranking, Timeline, Benchmark) are lazy-loaded in `App.jsx` the same way
- `chart.js` is imported dynamically and registered on demand via `ensureChartSetup()` (`src/lib/chartSetup.js`) — never eager from `main.jsx`. Initialization is shared through a single memoized promise and prefetched (fire-and-forget) in parallel with searches (`useRepository.js`) and Benchmark repo additions (`Benchmark.jsx`), so it doesn't block the search itself but avoids visible lag on first chart render
- `useMemo` for chart data/options to avoid Chart.js canvas re-creation
- `useChartTheme` returns memoized theme object
- Skeleton screens for loading states (LCP optimization)
- Vite manual chunks: vendor (react), charts-vendor (chart.js), pdf-vendor (html2pdf)

### Component Structure
- Pages in `src/pages/`, UI components in `src/components/`
- Complex pages broken into sub-components (e.g., `benchmark/`)
- Shared UI extracted as reusable components (`TimeRangeFilter`, `StatCard`)
- Constants extracted to `src/constants.js` (no magic numbers in business logic)
- Version display is dynamic (Header reads from `package.json`)

## Project Context

### Purpose
Educational tool by ASSERT Lab (UFPE) for software engineering teaching (v3.5.0). Transforms GitHub repository data into visual insights for students and professors.

### Token System
- Stored in `localStorage['github_token']` (via safe storage wrapper)
- Increases rate limit from 60 to 5,000 requests/hour
- Auto-added to requests in `githubService.getHeaders()`

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

### Environment Variables
```bash
VITE_GA_ID=G-xxx              # Google Analytics 4 ID
VITE_SUPABASE_URL=https://... # Supabase project URL
VITE_SUPABASE_ANON_KEY=...    # Supabase anonymous key
```

### Automated Testing
`scripts/csp-smoke-test.mjs` is the project's only automated test (Playwright). Run via `npm run smoke:csp`. Optional process env vars (never `VITE_`-prefixed, never bundled):
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
`githubService.js` applies `encodeURIComponent` to every interpolated value (`owner`, `repo`, `defaultBranch`) in request URLs and GitHub search query strings — including inside search qualifiers (e.g. `` repo:${owner}/${repo}+type:pr ``), where only the interpolated values are encoded, never the literal `+`/`:` separators, so query semantics aren't broken.

### Content-Security-Policy
`index.html` ships a CSP scoped to the domains the app actually calls: `api.github.com`, Supabase (via the build-time `%VITE_SUPABASE_URL%` substitution, not a wildcard), GA4's script/collection domains, and `avatars.githubusercontent.com` for contributor images. `style-src` includes `'unsafe-inline'` because `html2canvas` (used by the PDF export) applies inline styles via `setAttribute`/`cssText` while cloning the DOM for rendering — confirmed with a real headless-browser test (`npm run smoke:csp`), not assumed. `frame-ancestors`/`report-uri` don't work via `<meta>` (HTTP-header-only directives), so GitHub Pages static hosting has no clickjacking protection through this CSP.

### Route Safety
`RepoInfoCard.jsx` validates `owner`/`repo` against `SAFE_GITHUB_NAME_PATTERN` before calling `navigate()` for the `/timeline/:owner/:repo` route — defense in depth, since that data can come from a Supabase snapshot rather than a live search, and a react-router version fix shouldn't be the only safety net for app-constructed routes.

## Documentation Maintenance Policy

Whenever a code change has the potential to change behavior documented in this file, in `README.md`, or in `docs/DESIGN_SYSTEM.md`, explicitly evaluate — before considering the task done — whether any of those documents need updating, and whether the change justifies a new `docs/CHANGELOG.md` entry and a `package.json` version bump (following SemVer: patch for fixes with no visible behavior change, minor for new behavior/hardening that doesn't break existing usage, major for changes that break existing usage).

Stale documentation isn't a cosmetic problem in this project. It has already, concretely, caused a false sense of security about RLS protections that didn't actually exist — this file and the project's other docs asserted for months that anonymous INSERT into `analytics_searches` was blocked, when in fact two public RLS policies made it (and anonymous SELECT) fully open. Treat every doc claim about security posture as something that needs re-verifying against the actual code/config, not something to copy forward from the previous version.
