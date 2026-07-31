// Formatters - Utility functions for data formatting

// Shared between formatDateTime/formatDateShort so the day/year portion
// can't silently drift apart between the two date display styles.
const BASE_DATE_OPTIONS = { day: '2-digit', year: 'numeric' };

export const formatters = {
    // Format large numbers with dynamic locale
    formatNumber(value, locale = 'pt-BR') {
        if (value === null || value === undefined || value === 'N/A') {
            return value;
        }

        const num = typeof value === 'string' ? parseFloat(value) : value;

        if (isNaN(num)) {
            return value;
        }

        return new Intl.NumberFormat(locale).format(num);
    },

    // Full date + time (e.g. "28/07/2026, 14:32") — used where an exact
    // analysis timestamp needs to be shown, not just the day (RepoInfoCard's
    // "analysisDate"). Accepts anything `new Date()` accepts (Date, ISO
    // string, or timestamp) so callers don't need to normalize first.
    formatDateTime(date, locale = 'pt-BR') {
        return new Intl.DateTimeFormat(locale, {
            ...BASE_DATE_OPTIONS,
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date(date));
    },

    // Compact date only, abbreviated month (e.g. "28 jul 2026") — used for
    // chart axis labels and summary stats (BenchmarkEvolutionChart, Timeline)
    // where day-level precision is enough and a numeric month is less
    // scannable in a chart tick or stat card.
    formatDateShort(date, locale = 'pt-BR') {
        return new Intl.DateTimeFormat(locale, {
            ...BASE_DATE_OPTIONS,
            month: 'short',
        }).format(new Date(date));
    },

    // Full written-out date + time (e.g. "28 de julho de 2026 às 14:32") —
    // used for ActivityLogs' commit/PR timestamps, where the longer, more
    // readable style fits a detail list better than the compact grid/card
    // styles the other two formatters target.
    formatDateLong(date, locale = 'pt-BR') {
        return new Intl.DateTimeFormat(locale, {
            dateStyle: 'long',
            timeStyle: 'short',
        }).format(new Date(date));
    }
};
