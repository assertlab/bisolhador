import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const save = vi.fn(() => Promise.resolve());
const html2pdfFactory = vi.fn(() => ({ set: () => ({ from: () => ({ save }) }) }));
vi.mock('html2pdf.js', () => ({ default: html2pdfFactory }));
vi.mock('../hooks/useToast.js', () => ({ showToast: vi.fn() }));
vi.mock('../i18n.js', () => ({ default: { t: (key) => key } }));

const { showToast } = await import('../hooks/useToast.js');

describe('exportToPDF', () => {
  beforeEach(() => {
    vi.resetModules();
    save.mockClear();
    html2pdfFactory.mockClear();
    showToast.mockClear();
    vi.stubGlobal('document', { querySelector: vi.fn(() => ({ tagName: 'MAIN' })) });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.doMock('html2pdf.js', () => ({ default: html2pdfFactory }));
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('concurrent clicks share one export: a single PDF, not one per click', async () => {
    const { exportToPDF } = await import('./pdfExporter.js');
    await Promise.all([exportToPDF(), exportToPDF(), exportToPDF()]);
    expect(save).toHaveBeenCalledOnce();
  });

  it('a later click after the first finished starts a new export', async () => {
    const { exportToPDF } = await import('./pdfExporter.js');
    await exportToPDF();
    await exportToPDF();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('module load failure tells the user to reload (retrying the stale chunk cannot work)', async () => {
    vi.doMock('html2pdf.js', () => {
      throw new Error('Failed to fetch dynamically imported module');
    });
    const { exportToPDF } = await import('./pdfExporter.js');
    await exportToPDF();
    expect(save).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('errors.pdfModuleLoad', 'error');
  });

  it('render/save failure shows the generic PDF error', async () => {
    save.mockImplementationOnce(() => Promise.reject(new Error('canvas failed')));
    const { exportToPDF } = await import('./pdfExporter.js');
    await exportToPDF();
    expect(showToast).toHaveBeenCalledWith('errors.pdfExport', 'error');
  });
});
