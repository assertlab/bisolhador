# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bisolhador is a GitHub Repository Analysis Dashboard built as a React SPA. It transforms GitHub repository data into educational insights for software engineering teaching (ASSERT Lab/UFPE). The application is in Portuguese (PT-BR) with English support.

## Development Commands

```bash
npm run dev      # Start dev server (http://localhost:5173)
npm run build    # Production build
npm run lint     # Run ESLint
npm run preview  # Preview production build locally
npm run deploy   # Deploy to GitHub Pages (runs build first)
```

## Architecture

### Data Flow
1. User searches for repo in `owner/repo` format
2. `useRepository` hook (TanStack Query) orchestrates all GitHub API calls via `githubService`
3. `analyzers.js` computes metrics locally (health score, bus factor, maturity, etc.)
4. Analytics tracked via hybrid system: Supabase (critical data) + GA4 (engagement)

### Key Modules

**Entry Points:**
- `src/main.jsx` - React initialization
- `src/App.jsx` - Router setup with `/` (Dashboard) and `/ranking` routes

**Core Logic:**
- `src/hooks/useRepository.js` - Main data hook, fetches 15+ GitHub endpoints in parallel using `Promise.allSettled`, processes results with fail-safe handling
- `src/services/githubService.js` - GitHub REST API v3 calls with token support
- `src/utils/analyzers.js` - Pure functions for all metric calculations

**Services:**
- `src/services/supabase.js` - Supabase client for analytics persistence
- `src/services/leaderboardService.js` - RPC calls for public ranking
- `src/services/analytics.js` - Hybrid analytics (GA4 + Supabase)

### Health Score (7 Criteria)
Always calculated locally from GitHub's community profile API:
1. README, 2. License, 3. Contributing, 4. Description, 5. Code of Conduct, 6. Issue Template, 7. PR Template

Score = (items present / 7) * 100%. Colors: Green (>75%), Yellow (>50%), Red (below).

### Token System
- Stored in `localStorage['github_token']`
- Increases rate limit from 60 to 5,000 requests/hour
- Auto-added to requests in `githubService.getHeaders()`

## Code Conventions

- React functional components with hooks
- PascalCase for components, camelCase for functions/variables
- Tailwind CSS for styling with "shark/ocean" color theme
- All API calls wrapped in try-catch, return empty values on error (never crash)
- Charts use lazy loading with `React.lazy` + `Suspense`
- i18n via react-i18next (locales in `src/locales/`)

## Build Configuration

- Vite with React plugin
- Base URL: `/bisolhador/` (GitHub Pages)
- Manual chunks: vendor (react), charts-vendor (chart.js), pdf-vendor (html2pdf)
- Dark mode supported via `useTheme` hook

## Environment Variables

```bash
VITE_GA_ID=G-xxx              # Google Analytics 4 ID
VITE_SUPABASE_URL=https://... # Supabase project URL
VITE_SUPABASE_ANON_KEY=...    # Supabase anonymous key
```

## Testing Repositories

Use these for testing different scenarios:
- `twbs/bootstrap` or `torvalds/linux` - Mature, high-activity repos
- `assertlab/bisolhador` - Young, low-activity repo (tests smart trim on charts)
