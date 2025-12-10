export function exportJson(data, filename) {
  const exportData = {
    metadata: {
      tool: "Bisolhador",
      version: "2.7.0",
      generated_at: new Date().toISOString()
    },
    payload: data
  };

  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
