// Number formatting for report values; `locale` comes from intlLocale().
const formatters = new Map();
const numberFormat = (locale, digits) => {
  const key = `${locale}:${digits}`;
  if (!formatters.has(key)) formatters.set(key, new Intl.NumberFormat(locale, { maximumFractionDigits: digits }));
  return formatters.get(key);
};

export function formatValue(unit, value, locale) {
  if (value == null) return null;
  const nf = (v, digits) => numberFormat(locale, digits).format(v);
  if (unit === 'percent') return `${nf(value, 0)}%`;
  if (unit === 'hours') return value < 48 ? `${nf(value, 1)} h` : `${nf(value / 24, 1)} d`;
  return nf(value, value < 10 ? 1 : 0);
}
