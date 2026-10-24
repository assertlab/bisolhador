// GitHub API pagination defaults
export const GITHUB_PER_PAGE_COMMITS = 100; // recent list shows 10; Conventional Commits measures all
export const BRANCH_SCAN_MAX = 1000; // branches checked for zombies via GraphQL (100 per request)
export const GITHUB_PER_PAGE_RECENT_PRS = 10;
export const CLOSED_PR_SCAN = 100; // recently updated closed PRs fetched to find the merged sample
export const MERGED_PR_SCAN = 100; // merged PRs fetched via GraphQL (ordered by last update: GitHub can't order by merge date)
export const MERGED_PR_SAMPLE = 50; // lead time / review / divergence: latest merged PRs by humans among those
export const GITHUB_PER_PAGE_CONTRIBUTORS = 100; // fallback list (max page size)
export const GITHUB_PER_PAGE_RELEASES = 1;

// Time thresholds
export const ZOMBIE_BRANCH_DAYS = 90;

// Benchmark
export const MAX_BENCHMARK_REPOS = 10;

// Repository analysis
export const RECENT_ITEMS_LIMIT = 10;
export const LANGUAGE_MIN_PERCENTAGE = 1;
export const CACHE_STALE_TIME_MS = 1000 * 60 * 5; // 5 minutes

// PDF export
export const PDF_MARGIN = 10;
export const PDF_IMAGE_QUALITY = 0.98;
export const PDF_CANVAS_SCALE = 2;

// Toast notifications
export const TOAST_AUTO_DISMISS_MS = 1000 * 5; // 5 seconds

// Contributor concentration (Dashboard table + Benchmark use the same thresholds)
export const TOP_SHARE_CRITICAL_PERCENT = 60; // > 60% of commits from one person
export const TOP_SHARE_WARNING_PERCENT = 40;  // > 40%
// Concentration is computed over the last 12 months when there is enough
// recent activity; otherwise all-time (a long-gone maintainer is not today's risk).
export const CONTRIBUTORS_RECENT_WEEKS = 52;
export const CONTRIBUTORS_MIN_RECENT_COMMITS = 20;

// Day boundary of the date permalink (?repo=&date=); must match supabase-migrations/buscar_snapshot_por_data.sql
export const SNAPSHOT_TIMEZONE = 'America/Recife';

// Benchmark warns when the compared repos' latest data are further apart than this
export const BENCHMARK_DATE_GAP_DAYS = 7;

// Health Score bands (Dashboard card, Ranking badge): green ≥ GOOD, yellow ≥ FAIR
export const HEALTH_GOOD_PERCENT = 75;
export const HEALTH_FAIR_PERCENT = 50;
