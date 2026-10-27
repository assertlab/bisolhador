/** Hands a Blob to the browser as a file download. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoked later: some browsers start the download asynchronously and would lose a revoked URL
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
