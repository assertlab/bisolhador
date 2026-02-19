/**
 * Escapes a CSV field value, wrapping in double quotes if it contains
 * commas, double quotes, or newlines (RFC 4180).
 */
function escapeCsvField(value) {
  const str = value == null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts an array of flat objects into a CSV string and triggers a download.
 *
 * @param {string} filename - Name for the downloaded file (e.g. "report.csv")
 * @param {Array<Record<string, unknown>>} dataArray - Rows to export; keys become headers.
 */
export function exportToCsv(filename, dataArray) {
  if (!dataArray || dataArray.length === 0) return;

  const headers = Object.keys(dataArray[0]);
  const headerRow = headers.map(escapeCsvField).join(',');

  const rows = dataArray.map((row) =>
    headers.map((h) => escapeCsvField(row[h])).join(',')
  );

  const csv = [headerRow, ...rows].join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
