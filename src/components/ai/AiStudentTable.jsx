import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { formatters } from '../../utils/formatters.js';
import { intlLocale } from '../../i18n.js';
import { AI_GUIDE_PATH } from '../../utils/indicatorGuide.js';
import { toolLabel } from './toolLabel.js';

const NOTE = 'text-xs text-gray-500 dark:text-slate-400';
const TH = 'px-3 py-2 text-xs font-medium text-gray-500 dark:text-slate-300 uppercase';
const TD = 'px-3 py-2 text-gray-700 dark:text-slate-300';

/**
 * "AI in the Process › Per student" (Classroom Mode only). Facts side by side — who declared AI
 * co-authorship, who configured AI tools — with no alert colors, icons or badge (spec §3, §7.3).
 * Lives only in the browser's memory: never in the CSV, Supabase or GA.
 */
export function AiStudentTable({ students }) {
  const { t } = useTranslation();
  const locale = intlLocale();
  const num = (v) => formatters.formatNumber(v, locale);

  const authorOf = (row) => {
    if (row.kind === 'agent') return t('aiProcess.students.agent', { tool: toolLabel(row.agentToolId, t) });
    if (row.kind === 'unidentified') return t('aiProcess.students.unidentified');
    return row.login;
  };
  const configOf = (row) => {
    if (!students.authorshipAvailable) return t('aiProcess.students.notAvailable');
    return row.configPaths.length ? row.configPaths.join(', ') : '—';
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6 space-y-3">
      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{t('aiProcess.students.title')}</h4>
      <div role="note" className="text-sm text-gray-700 dark:text-slate-200 bg-gray-50 dark:bg-slate-900/40 border border-gray-200 dark:border-slate-700 rounded-md p-3 space-y-1">
        <p><Trans i18nKey="aiProcess.students.notice" components={{ strong: <strong /> }} /></p>
        <p>{t('aiProcess.students.agentLimit')}</p>
        <p>
          <Link to={`${AI_GUIDE_PATH}#teachers`} className="font-medium text-ocean hover:underline">
            {t('aiGuide.studentsLink')}: {t('aiGuide.link')} →
          </Link>
        </p>
      </div>

      {!students?.available ? (
        <p className="text-sm text-gray-600 dark:text-slate-300">{t('aiProcess.students.unavailable')}</p>
      ) : students.rows.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-slate-300">{t('aiProcess.students.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700 text-sm">
            <thead className="bg-gray-50 dark:bg-slate-700">
              <tr>
                <th scope="col" className={`${TH} text-left`}>{t('aiProcess.students.columns.author')}</th>
                <th scope="col" className={`${TH} text-right`}>{t('aiProcess.students.columns.commits')}</th>
                <th scope="col" className={`${TH} text-right`}>{t('aiProcess.students.columns.withAi')}</th>
                <th scope="col" className={`${TH} text-left`}>{t('aiProcess.students.columns.tools')}</th>
                <th scope="col" className={`${TH} text-left`}>{t('aiProcess.students.columns.config')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {students.rows.map((row) => (
                <tr key={row.key}>
                  <th scope="row" className={`${TD} text-left font-medium whitespace-nowrap`}>{authorOf(row)}</th>
                  <td className={`${TD} text-right`}>{num(row.commits)}</td>
                  <td className={`${TD} text-right whitespace-nowrap`}>
                    {num(row.withAi)} ({formatters.formatPercent(row.percentage, locale)})
                  </td>
                  <td className={TD}>{row.tools.length ? row.tools.map((id) => toolLabel(id, t)).join(', ') : '—'}</td>
                  <td className={`${TD} font-mono text-xs`}>{configOf(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {students?.available && students.sampled && <p className={NOTE}>{t('aiProcess.students.sampled')}</p>}
      {students?.available && !students.authorshipAvailable && <p className={NOTE}>{t('aiProcess.students.configUnavailable')}</p>}
      <p className={NOTE}>{t('aiProcess.students.footnote')}</p>
    </div>
  );
}
