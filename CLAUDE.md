# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (http://localhost:5173)
npm run build    # Production build
npm run lint     # Run ESLint
npm run preview  # Preview production build locally
npm run deploy   # Deploy to GitHub Pages (runs build first)
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
│   ├── formatters.js           # Date/number formatting
│   ├── pdfExporter.js          # PDF export via html2pdf.js
│   └── exportJson.js           # JSON data export with provenance metadata
└── locales/                    # i18n translation files (pt/, en/)
```

### Data Flow
1. User searches for repo in `owner/repo` format
2. `useRepository` hook orchestrates all GitHub API calls via `githubService`
3. `analyzers.js` computes metrics locally (health score, bus factor, maturity, etc.)
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
- 403 (Rate Limit) → suggest adding token
- 404 (Not found) → friendly error message
- Render UI even with partial data (graceful degradation)

### Performance Patterns
- Charts use `React.lazy` + `Suspense` (code splitting)
- `useMemo` for chart data/options to avoid Chart.js canvas re-creation
- `useChartTheme` returns memoized theme object
- Skeleton screens for loading states (LCP optimization)
- Vite manual chunks: vendor (react), charts-vendor (chart.js), pdf-vendor (html2pdf)

### Component Structure
- Pages in `src/pages/`, UI components in `src/components/`
- Complex pages broken into sub-components (e.g., `benchmark/`)
- Shared UI extracted as reusable components (`TimeRangeFilter`, `StatCard`)
- Constants extracted to `src/constants.js` (no magic numbers in business logic)

## Project Context

### Purpose
Educational tool by ASSERT Lab (UFPE) for software engineering teaching. Transforms GitHub repository data into visual insights for students and professors.

### Token System
- Stored in `localStorage['github_token']` (via safe storage wrapper)
- Increases rate limit from 60 to 5,000 requests/hour
- Auto-added to requests in `githubService.getHeaders()`

### Backend / Supabase
- **Write**: All writes via validated RPCs (`registrar_busca`), no direct INSERT
- **Read**: History via RPC (`buscar_snapshot_por_data`) with dynamic timezone
- **Schema**: `analytics_searches` uses `BIGINT` IDs and `NUMERIC` health_score
- **Security**: INSERT revoked for anon users via RLS; RPCs handle validation

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

### Testing Repositories
- `twbs/bootstrap` or `torvalds/linux` — Mature, high-activity repos
- `assertlab/bisolhador` — Young, low-activity repo (tests smart trim on charts)
