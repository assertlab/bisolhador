import { PDF_MARGIN, PDF_IMAGE_QUALITY, PDF_CANVAS_SCALE } from '../constants.js';
import { showToast } from '../hooks/useToast.js';
import i18n from '../i18n.js';

// html2pdf.js (+ jsPDF + html2canvas, ~950 KB) is imported on click, not at
// page load: statically imported, it landed in the Dashboard chunk (or, with
// the old manualChunks, was preloaded on every first visit).
async function loadHtml2pdf() {
  try {
    return (await import('html2pdf.js')).default;
  } catch (error) {
    // Typically a tab opened before a deploy asking for a chunk hash that no
    // longer exists: retrying can't help, reloading does.
    error.code = 'PDF_MODULE_LOAD_FAILED';
    throw error;
  }
}

let exportInFlight = null;

/**
 * Exports the dashboard (<main>) to PDF. Resolves when the file was handed to
 * the browser (or the export failed and the user was told). Concurrent calls
 * share the one in flight: on a slow connection the module download takes
 * seconds, and repeated clicks used to produce several identical PDFs.
 */
export function exportToPDF() {
  exportInFlight ??= runExport().finally(() => {
    exportInFlight = null;
  });
  return exportInFlight;
}

async function runExport() {
  try {
    const html2pdf = await loadHtml2pdf();

    // Looked up after the (possibly slow) import: the user may have navigated.
    const element = document.querySelector('main');
    if (!element) {
      console.error('Elemento main não encontrado para exportação');
      return;
    }

    // Gera nome do arquivo com data atual
    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `Relatorio_Bisolhador_${dateStr}.pdf`;

    const options = {
      margin: [PDF_MARGIN, PDF_MARGIN, PDF_MARGIN, PDF_MARGIN],
      filename,
      image: { type: 'jpeg', quality: PDF_IMAGE_QUALITY },
      html2canvas: {
        scale: PDF_CANVAS_SCALE,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      },
      pagebreak: {
        mode: ['avoid-all', 'css', 'legacy']
      }
    };

    await html2pdf().set(options).from(element).save();
    console.log('PDF exportado com sucesso:', filename);
  } catch (error) {
    console.error('Erro ao exportar PDF:', error);
    showToast(
      i18n.t(error.code === 'PDF_MODULE_LOAD_FAILED' ? 'errors.pdfModuleLoad' : 'errors.pdfExport'),
      'error'
    );
  }
}
