import { useMemo } from "react";

const DAYS_MAP = {
  "7d": 7,
  "30d": 30,
  "60d": 60,
  "90d": 90,
};

function getCutoffDate(timeRange) {
  const days = DAYS_MAP[timeRange];
  if (!days) return null;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
}

/**
 * Filters an array of data points by a time range.
 * @param {Array} data - Array of objects with a date field
 * @param {string} timeRange - One of '7d', '30d', '60d', '90d', 'all'
 * @param {(item: any) => Date} dateAccessor - Function to extract the date from each item
 */
export function useTimeFilter(data, timeRange, dateAccessor = (d) => d.date) {
  return useMemo(() => {
    if (!data || timeRange === "all") return data;
    const cutoff = getCutoffDate(timeRange);
    if (!cutoff) return data;
    return data.filter((item) => dateAccessor(item) >= cutoff);
  }, [data, timeRange, dateAccessor]);
}
