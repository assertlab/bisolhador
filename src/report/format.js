// Number formatting for report values; `locale` comes from intlLocale().
export function formatValue(unit, value, locale) {
  if (value == null) return null;
  const nf = (v, digits) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(v);
  if (unit === 'percent') return `${nf(value, 0)}%`;
  if (unit === 'hours') return value < 48 ? `${nf(value, 1)} h` : `${nf(value / 24, 1)} d`;
  return nf(value, value < 10 ? 1 : 0);
}
