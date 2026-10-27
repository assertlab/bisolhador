import i18n, { intlLocale } from '../i18n.js';
import { loadLocale } from '../lib/lazyLocales.js';
import { REGISTRY_VERSION } from '../utils/aiRegistry.js';
import { version } from '../../package.json';
import { buildRepoReportModel } from './repoReportModel.js';
import { plainText } from './plainText.js';

/**
 * Dashboard PDF report. react-pdf, the document and the report texts are imported on click, not at page
 * load (same pattern as the Classroom report). Resolves with the Blob; the caller downloads it.
 * Throws on a failed chunk or font: a report in the wrong font is worse than an error.
 * @param {object} data - the report shown on screen (live or snapshot)
 * @param {{ isSnapshot?: boolean }} [opts]
 */
export async function generateRepoReport(data, { isSnapshot = false } = {}) {
  const [{ pdf }, { RepoReportDocument }, { registerFonts }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./RepoReportDocument.jsx'),
    import('./fonts.js'),
    loadLocale(i18n, 'guide'),
    loadLocale(i18n, 'report'),
  ]);
  registerFonts();
  const locale = intlLocale(i18n.language);
  const t = (key, options) => plainText(i18n.t(key, options));
  const model = buildRepoReportModel(data, t, locale, { isSnapshot });
  const meta = {
    appVersion: version,
    registryVersion: REGISTRY_VERSION,
    generatedAt: new Intl.DateTimeFormat(locale).format(new Date()),
  };
  return pdf(RepoReportDocument({ model, t, locale, meta })).toBlob();
}
