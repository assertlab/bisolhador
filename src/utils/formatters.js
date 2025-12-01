// Formatters - Utility functions for data formatting

export const formatters = {
    // Format large numbers with Brazilian locale
    formatNumber(value) {
        if (value === null || value === undefined || value === 'N/A') {
            return value;
        }

        const num = typeof value === 'string' ? parseFloat(value) : value;

        if (isNaN(num)) {
            return value;
        }

        return new Intl.NumberFormat('pt-BR').format(num);
    }
};
