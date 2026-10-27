import i18n, { intlLocale } from '../i18n.js';
import { loadLocale } from '../lib/lazyLocales.js';
import { toolLabel } from '../components/ai/toolLabel.js';
import { REGISTRY_VERSION } from '../utils/aiRegistry.js';
import { version } from '../../package.json';
import { buildReportModel } from './reportModel.js';

/**
 * Classroom PDF report. react-pdf, the document and the report texts are imported on click, not at
 * page load (same pattern as the Dashboard PDF). Resolves with the Blob; the caller downloads it.
 * Throws on a failed chunk or font: a report in the wrong font is worse than an error.
 */
export async function generateClassroomReport({ repos, rows, duplicateOf, period, anonymize }) {
  const [{ pdf }, { ClassroomReportDocument }, { registerFonts }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./ClassroomReportDocument.jsx'),
    import('./fonts.js'),
    loadLocale(i18n, 'guide'),
    loadLocale(i18n, 'report'),
  ]);
  registerFonts();
  const locale = intlLocale(i18n.language);
  const t = i18n.t.bind(i18n);
  const model = buildReportModel({
    repos, rows, duplicateOf, period, anonymize,
    anonymousLabel: (letter) => t('report.summary.anonymousRepo', { letter }),
  });
  const meta = {
    appVersion: version,
    registryVersion: REGISTRY_VERSION,
    generatedAt: new Intl.DateTimeFormat(locale).format(new Date()),
    anonymized: Boolean(anonymize),
    toolLabel: (id) => toolLabel(id, t),
  };
  return pdf(ClassroomReportDocument({ model, t, locale, meta, i18nHas: (key) => i18n.exists(key) })).toBlob();
}
