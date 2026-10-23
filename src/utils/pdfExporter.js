import { PDF_MARGIN, PDF_IMAGE_QUALITY, PDF_CANVAS_SCALE } from '../constants.js';
import { showToast } from '../hooks/useToast.js';

// html2pdf.js (+ jsPDF + html2canvas, ~950 KB) is imported on click, not at
// page load: statically imported, it landed in the Dashboard chunk (or, with
// the old manualChunks, was preloaded on every first visit).
export async function exportToPDF() {
  // Seleciona o elemento main que contém todo o dashboard
  const element = document.querySelector('main');

  if (!element) {
    console.error('Elemento main não encontrado para exportação');
    return;
  }

  // Gera nome do arquivo com data atual
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const filename = `Relatorio_Bisolhador_${dateStr}.pdf`;

  // Configurações do html2pdf
  const options = {
    margin: [PDF_MARGIN, PDF_MARGIN, PDF_MARGIN, PDF_MARGIN],
    filename: filename,
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

  let html2pdf;
  try {
    ({ default: html2pdf } = await import('html2pdf.js'));
  } catch (error) {
    console.error('Erro ao carregar o módulo de PDF:', error);
    showToast('Erro ao gerar o relatório PDF. Tente novamente.', 'error');
    return;
  }

  // Gera e baixa o PDF
  html2pdf()
    .set(options)
    .from(element)
    .save()
    .then(() => {
      console.log('PDF exportado com sucesso:', filename);
    })
    .catch((error) => {
      console.error('Erro ao exportar PDF:', error);
      showToast('Erro ao gerar o relatório PDF. Tente novamente.', 'error');
    });
}
