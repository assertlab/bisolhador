// Formatters - Utility functions for data formatting

// Shared between formatDateTime/formatDateShort so the day/year portion
// can't silently drift apart between the two date display styles.
const BASE_DATE_OPTIONS = { day: '2-digit', year: 'numeric' };

export const formatters = {
    // Format large numbers with dynamic locale
    formatNumber(value, locale = 'pt-BR') {
        // null/undefined = not measured: show N/A, never an empty cell or a 0.
        if (value == null || value === 'N/A') {
            return 'N/A';
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
    formatDateTime(date, locale = 'pt-BR', timeZone = undefined) {
        return new Intl.DateTimeFormat(locale, {
            ...BASE_DATE_OPTIONS,
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZone,
        }).format(new Date(date));
    },

    // Numeric date only (e.g. "18/12/2025" / "12/18/2025") — repository
    // creation date ("Since …").
    formatDate(date, locale = 'pt-BR') {
        return new Intl.DateTimeFormat(locale, { ...BASE_DATE_OPTIONS, month: '2-digit' }).format(new Date(date));
    },

    // Compact date only, abbreviated month (e.g. "28 jul 2026") — used for
    // chart axis labels and summary stats (BenchmarkEvolutionChart, Timeline)
    // where day-level precision is enough and a numeric month is less
    // scannable in a chart tick or stat card.
    formatDateShort(date, locale = 'pt-BR', timeZone = undefined) {
        return new Intl.DateTimeFormat(locale, {
            ...BASE_DATE_OPTIONS,
            month: 'short',
            timeZone,
        }).format(new Date(date));
    },

    // null = not measured → N/A. Decimal separator follows the locale ("1,5").
    formatDecimal(value, locale = 'pt-BR', digits = 1) {
        if (value == null || !Number.isFinite(value)) return 'N/A';
        return value.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    },

    formatPercent(value, locale = 'pt-BR') {
        if (value == null || !Number.isFinite(value)) return 'N/A';
        return `${value.toLocaleString(locale, { maximumFractionDigits: 1 })}%`;
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
