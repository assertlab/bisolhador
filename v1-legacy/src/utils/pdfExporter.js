export function exportToPDF(owner, repo) {
    const element = document.querySelector('main');
    const exportBtn = document.getElementById('export-pdf-btn');

    // Hide the export button during PDF generation
    if (exportBtn) {
        exportBtn.style.display = 'none';
    }

    const options = {
        margin: 10, // 10mm
        filename: `Relatorio_Bisolhador_${owner}_${repo}.pdf`,
        html2canvas: {
            scale: 2,
            useCORS: true
        },
        jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait'
        }
    };

    html2pdf().from(element).set(options).save().then(() => {
        // Restore the export button after PDF generation
        if (exportBtn) {
            exportBtn.style.display = '';
        }
    });
}
