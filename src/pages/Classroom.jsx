import { Fragment, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { Header } from '../components/Header';
import { SettingsModal } from '../components/SettingsModal';
import { GuideLink } from '../components/GuideLink.jsx';
import { useClassroomAnalysis } from '../hooks/useClassroomAnalysis.js';
import { hasGithubToken, githubService } from '../services/githubService.js';
import { parseSafeRepoName, SAFE_GITHUB_NAME_PATTERN } from '../utils/repoName.js';
import { parseRepoList, parsePeriod, CLASSROOM_MAX_REPOS } from '../utils/classroom.js';
import { formatDuration } from '../utils/prReviewStats.js';
import { formatters } from '../utils/formatters.js';
import { exportToCsv } from '../utils/csvExporter.js';
import { CLASSROOM_COLUMNS, classroomCsvRows, isPartialRow } from '../utils/classroomColumns.js';
import { intlLocale } from '../i18n.js';
import { guidePath } from '../utils/indicatorGuide.js';
import { AiProcessSection } from '../components/ai/AiProcessSection.jsx';
import { AiStudentTable } from '../components/ai/AiStudentTable.jsx';
import { Tooltip } from '../components/Tooltip.jsx';
import { NewTabHint } from '../components/NewTabHint.jsx';
import { NEW_TAB_LINK_PROPS, NewTabContext } from '../lib/newTab.js';

const DEFAULT_PERIOD_DAYS = 120;
const isoDay = (d) => d.toISOString().slice(0, 10);

// Columns and CSV rows live in utils/classroomColumns.js; the screen adds the JSX-only rendering.
const SCREEN_SHOW = {
  aiCoherence: (flags, t) => (flags.length ? <CoherenceMark flags={flags} t={t} /> : '—'),
};
const COLUMNS = CLASSROOM_COLUMNS.map((col) => (SCREEN_SHOW[col.key] ? { ...col, show: SCREEN_SHOW[col.key] } : col));

// Neutral mark (no alert color): the sources disagree, at the repository level only.
function CoherenceMark({ flags, t }) {
  const text = `${t('aiProcess.coherence.title')}: ${flags.map((f) => t(`aiProcess.coherence.${f}`)).join(' ')}`;
  return (
    <Tooltip text={t('classroom.ai.coherenceTip')}>
      <span aria-hidden="true">≠</span>
      <span className="sr-only">{text}</span>
    </Tooltip>
  );
}

export function Classroom({ isSettingsOpen, setIsSettingsOpen }) {
  const { t, i18n } = useTranslation();
  const locale = intlLocale(i18n.language);
  const [searchParams, setSearchParams] = useSearchParams();

  // The class lives in the URL (?repos=&from=&to=): shareable, nothing stored.
  const formFromUrl = (params) => {
    const today = new Date();
    return {
      text: (params.get('repos') ?? '').split(',').join('\n'),
      from: params.get('from') ?? isoDay(new Date(today.getTime() - DEFAULT_PERIOD_DAYS * 86_400_000)),
      to: params.get('to') ?? isoDay(today),
    };
  };
  const [form, setForm] = useState(() => formFromUrl(searchParams));
  const { text, from, to } = form;
  const setText = (v) => setForm((f) => ({ ...f, text: v }));
  const setFrom = (v) => setForm((f) => ({ ...f, from: v }));
  const setTo = (v) => setForm((f) => ({ ...f, to: v }));
  // Back/forward changes the URL: bring the form along (adjust-state-on-change pattern, like Dashboard)
  const search = searchParams.toString();
  const [syncedSearch, setSyncedSearch] = useState(search);
  if (syncedSearch !== search) {
    setSyncedSearch(search);
    setForm(formFromUrl(searchParams));
  }
  const [runId, setRunId] = useState(0);

  // Import from an organization (GitHub Classroom puts every team repo in one)
  const [org, setOrg] = useState('');
  const [prefix, setPrefix] = useState('');
  const [importState, setImportState] = useState(null); // { loading } | { found, matched, capped } | { error }
  const importRequest = useRef(0);
  const importOrg = async () => {
    const requestId = ++importRequest.current; // a newer import wins
    if (!SAFE_GITHUB_NAME_PATTERN.test(org)) {
      setImportState({ error: 'invalidOrg' });
      return;
    }
    setImportState({ loading: true });
    try {
      const { repos, capped } = await githubService.fetchOwnerRepositories(org);
      const wanted = prefix.trim().toLowerCase();
      const matched = repos
        .filter((r) => !r.archived && r.fullName.split('/')[1].toLowerCase().startsWith(wanted))
        .map((r) => r.fullName)
        .filter((name) => parseSafeRepoName(name));
      if (requestId !== importRequest.current) return;
      setText(matched.join('\n'));
      setImportState({ found: repos.length, matched: matched.length, capped });
    } catch (error) {
      if (requestId !== importRequest.current) return;
      setImportState({ error: /\b404\b/.test(error.message) ? 'orgNotFound' : 'orgFailed' });
    }
  };

  const requested = useMemo(() => parseRepoList(searchParams.get('repos') ?? ''), [searchParams]);
  const period = useMemo(() => parsePeriod(searchParams.get('from'), searchParams.get('to')), [searchParams]);
  const hasToken = hasGithubToken();
  const { rows, done, total, running } = useClassroomAnalysis(requested.repos, period, hasToken && requested.repos.length > 0, runId);
  const urlPeriodInvalid = requested.repos.length > 0 && !period;
  // Two requested names resolving to the same repository (renamed): keep the first
  const firstByRepo = new Map();
  for (const name of requested.repos) {
    const full = rows[name]?.fullName?.toLowerCase();
    if (full && !firstByRepo.has(full)) firstByRepo.set(full, name);
  }
  const duplicateOf = (name) => {
    const full = rows[name]?.fullName?.toLowerCase();
    const first = full && firstByRepo.get(full);
    return first && first !== name ? first : null;
  };

  const draft = parseRepoList(text);
  const draftPeriod = parsePeriod(from, to);

  const submit = (e) => {
    e.preventDefault();
    if (!draftPeriod || draft.repos.length === 0) return;
    setSearchParams({ repos: draft.repos.join(','), from, to });
    setRunId((n) => n + 1); // same class again = run again (retries failed rows)
  };

  const cell = (col, row) => {
    const v = col.get(row);
    if (v == null) return col.na ?? 'N/A';
    if (col.show) return col.show(v, t);
    let text;
    if (col.pct) text = formatters.formatPercent(v, locale);
    else if (col.hours) {
      const { value, unit } = formatDuration(v);
      text = `${value.toLocaleString(locale)} ${t('units.' + unit, { count: value })}`;
    } else text = formatters.formatNumber(v, locale);
    if (col.count) {
      const [part, n] = col.count(row);
      text = `${text} (${formatters.formatNumber(part, locale)}/${formatters.formatNumber(n, locale)})`;
    }
    if (col.atLeast?.(row)) return `${text}+`;
    return col.sampled?.(row) ? `${text}*` : text;
  };
  // AI detail row: closed by default, open when a single repository was requested
  const [expanded, setExpanded] = useState({});
  const isExpanded = (name) => expanded[name] ?? requested.repos.length === 1;
  const toggle = (name) => setExpanded((e) => ({ ...e, [name]: !isExpanded(name) }));
  const anyPrivate = requested.repos.some((name) => rows[name]?.isPrivate);
  const anySampled = requested.repos.some((name) => rows[name]?.status === 'ok' && isPartialRow(rows[name]));

  // CSV: raw numbers with the unit in the header, plus the n behind each percentage (classroomCsvRows)
  const exportCsv = () => {
    exportToCsv(`bisolhador-turma-${period.from}_${period.to}.csv`, classroomCsvRows(requested.repos, rows, duplicateOf, t));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col">
      <Header onSettingsClick={() => setIsSettingsOpen(true)} />
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-shark dark:text-white">{t('classroom.title')}</h1>
          <p className="text-gray-600 dark:text-slate-300">{t('classroom.subtitle', { max: CLASSROOM_MAX_REPOS })}</p>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {t('classroom.ethics')} <GuideLink id="classroom" newTab />
          </p>
        </header>

        {urlPeriodInvalid && (
          <div role="alert" className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-md text-sm">
            {t('classroom.invalidUrlPeriod')}
          </div>
        )}

        {!hasToken && (
          <div role="status" className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300 px-4 py-3 rounded-md text-sm flex flex-wrap items-center gap-3">
            <span>{t('classroom.needsToken')}</span>
            <button type="button" onClick={() => setIsSettingsOpen(true)} className="underline font-medium">{t('classroom.openSettings')}</button>
          </div>
        )}

        <form onSubmit={submit} action="/turma" className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6 space-y-4">
          <fieldset className="flex flex-wrap items-end gap-3 pb-3 border-b border-gray-100 dark:border-slate-700">
            <legend className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">{t('classroom.importTitle')}</legend>
            <label className="text-sm text-gray-700 dark:text-slate-200">
              {t('classroom.orgLabel')}
              <input value={org} onChange={(e) => setOrg(e.target.value.trim())} placeholder="ufpe-es-2026" className="block mt-1 p-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 dark:text-white" />
            </label>
            <label className="text-sm text-gray-700 dark:text-slate-200">
              {t('classroom.prefixLabel')}
              <input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="projeto-1-" className="block mt-1 p-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 dark:text-white" />
            </label>
            <button type="button" onClick={importOrg} disabled={!hasToken || !org || importState?.loading} className="px-4 py-2 text-sm font-medium rounded-lg border border-ocean text-ocean disabled:opacity-50">
              {importState?.loading ? t('classroom.importing') : t('classroom.importButton')}
            </button>
            {importState && !importState.loading && (
              <span role="status" className={`text-xs ${importState.error ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-slate-400'}`}>
                {importState.error
                  ? t(`classroom.import.${importState.error}`)
                  : t('classroom.import.result', { found: importState.found, matched: importState.matched }) + (importState.capped ? ` ${t('classroom.import.capped')}` : '')}
              </span>
            )}
          </fieldset>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-200" htmlFor="classroom-repos">{t('classroom.reposLabel')}</label>
          <textarea
            id="classroom-repos"
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('classroom.reposPlaceholder')}
            className="block w-full p-3 text-sm font-mono text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
          />
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {t('classroom.reposCount', { count: draft.repos.length, max: CLASSROOM_MAX_REPOS })}
            {draft.truncated && ` ${t('classroom.reposTruncated', { max: CLASSROOM_MAX_REPOS })}`}
            {draft.invalid.length > 0 && ` ${t('classroom.reposInvalid', { list: draft.invalid.slice(0, 5).join(', ') })}`}
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <label className="text-sm text-gray-700 dark:text-slate-200">
              {t('classroom.from')}
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-describedby={draftPeriod ? undefined : 'classroom-period-error'} className="block mt-1 p-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 dark:text-white" />
            </label>
            <label className="text-sm text-gray-700 dark:text-slate-200">
              {t('classroom.to')}
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-describedby={draftPeriod ? undefined : 'classroom-period-error'} className="block mt-1 p-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 dark:text-white" />
            </label>
            <button
              type="submit"
              disabled={!hasToken || !draftPeriod || draft.repos.length === 0}
              className="px-5 py-2.5 bg-ocean text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('classroom.analyze')}
            </button>
            {!draftPeriod && <span id="classroom-period-error" className="text-xs text-red-600 dark:text-red-400">{t('classroom.invalidPeriod')}</span>}
          </div>
        </form>

        {/* Results: every link opens in a new tab (the analysis lives only in memory; see lib/newTab.js) */}
        {total > 0 && (
          <NewTabContext.Provider value>
            <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-shark dark:text-white">
                  {t('classroom.resultsTitle', { from: period.from, to: period.to })}
                </h2>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500 dark:text-slate-400" aria-live="polite">
                    {running ? t('classroom.progress', { done, total }) : t('classroom.finished', { total })}
                  </span>
                  <button type="button" onClick={exportCsv} disabled={running} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg disabled:opacity-50">
                    {t('button.csvExport')}
                  </button>
                </div>
              </div>
              {/* relative: contains the absolutely positioned sr-only spans, which otherwise widen the page.
                  The container query lets the detail panel be as wide as this box, not the table. */}
              <div className="relative overflow-x-auto [container-type:inline-size]">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700 text-sm">
                  <thead className="bg-gray-50 dark:bg-slate-700">
                    <tr>
                      <th scope="col" className="sticky left-0 z-10 bg-gray-50 dark:bg-slate-700 px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase">{t('classroom.columns.repo')}</th>
                      {COLUMNS.map((col) => (
                        <th key={col.key} scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-slate-300 uppercase whitespace-nowrap">
                          <Link to={guidePath(col.guide)} {...NEW_TAB_LINK_PROPS} className="hover:underline" title={t('guideLinks.indicator')}>
                            {t(`classroom.columns.${col.key}`)}
                            <span className="sr-only"> — {t('guideLinks.indicator')}</span>
                            <NewTabHint />
                          </Link>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                    {requested.repos.map((name, index) => {
                      const row = rows[name];
                      const dup = duplicateOf(name);
                      const ok = row?.status === 'ok' && !dup;
                      const open = ok && isExpanded(name);
                      const detailId = `classroom-ai-${index}`;
                      const shownName = dup ? name : row?.fullName ?? name;
                      return (
                        <Fragment key={name}>
                          <tr>
                            <td className="sticky left-0 bg-white dark:bg-slate-800 px-3 py-2 whitespace-nowrap font-medium text-gray-900 dark:text-white">
                              {ok && (
                                <button
                                  type="button"
                                  onClick={() => toggle(name)}
                                  aria-expanded={open}
                                  aria-controls={open ? detailId : undefined}
                                  aria-label={t(open ? 'classroom.ai.collapse' : 'classroom.ai.expand', { repo: shownName })}
                                  title={t(open ? 'classroom.ai.collapse' : 'classroom.ai.expand', { repo: shownName })}
                                  className="mr-2 inline-flex w-5 h-5 items-center justify-center rounded border border-gray-300 dark:border-slate-600 text-xs text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700"
                                >
                                  <span aria-hidden="true">{open ? '−' : '+'}</span>
                                </button>
                              )}
                              <a href={`https://github.com/${shownName}`} {...NEW_TAB_LINK_PROPS} className="hover:underline">{shownName}<NewTabHint /></a>
                              {row?.isPrivate && !dup && <span className="ml-1" title={t('classroom.privateBadge')} aria-label={t('classroom.privateBadge')}>🔒</span>}
                            </td>
                            {ok
                              ? COLUMNS.map((col) => (
                                  <td key={col.key} className="px-3 py-2 text-right whitespace-nowrap text-gray-700 dark:text-slate-300">{cell(col, row)}</td>
                                ))
                              : (
                                <td colSpan={COLUMNS.length} className="px-3 py-2 text-gray-500 dark:text-slate-400">
                                  {t(`classroom.status.${dup ? 'duplicate' : row?.status ?? 'pending'}`, { name: dup })}
                                </td>
                              )}
                          </tr>
                          {open && (
                            <tr id={detailId}>
                              <td colSpan={COLUMNS.length + 1} className="bg-gray-50 dark:bg-slate-900/40 px-3 py-4">
                                {/* The cell spans the whole (scrolling) table: pin the panel to the visible part
                                    and cap it at the scroll box width (100cqw) minus the cell padding. */}
                                <div className="sticky left-3 w-[calc(100cqw-1.5rem)] max-w-5xl space-y-4 break-words">
                                  <h3 className="text-base font-semibold text-shark dark:text-white">{t('aiProcess.title')} — {shownName}</h3>
                                  <AiProcessSection aiProcess={row.ai} />
                                  <AiStudentTable students={row.students} />
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {anyPrivate && (
                <p role="note" className="text-xs bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 px-3 py-2 rounded">
                  🔒 {t('classroom.privateNote')}
                </p>
              )}
              {anySampled && <p className="text-xs text-gray-500 dark:text-slate-400">{t('classroom.sampledNote')}</p>}
              <p className="text-xs text-gray-500 dark:text-slate-400">{t('classroom.ai.note')}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">{t('classroom.notes')}</p>
            </section>
          </NewTabContext.Provider>
        )}
      </main>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
