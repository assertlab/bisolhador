import { useMemo, useRef, useState } from 'react';
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
import { intlLocale } from '../i18n.js';
import { guidePath } from '../utils/indicatorGuide.js';

const DEFAULT_PERIOD_DAYS = 120;
const isoDay = (d) => d.toISOString().slice(0, 10);

// Column definitions: header key, guide entry, raw value, and whether the
// value comes from a capped sample (shown with "*" / "+"). Rows that failed
// for a part show N/A in that column only.
const commitsCapped = (r) => r.commits.available && r.commits.capped;
const COLUMNS = [
  { key: 'commits', guide: 'commit-activity', get: (r) => (r.commits.available ? r.commits.commits : null) },
  { key: 'authors', guide: 'contributors', get: (r) => (r.commits.available ? r.commits.authors : null), sampled: commitsCapped },
  { key: 'topShare', guide: 'bus-factor', get: (r) => r.commits.topSharePercentage, pct: true, sampled: commitsCapped },
  { key: 'mergedPrs', guide: 'prs-merges', get: (r) => (r.prs.available ? r.prs.merged : null), atLeast: (r) => r.prs.capped },
  { key: 'approved', guide: 'review-coverage', get: (r) => r.prs.approvedPercentage, pct: true, sampled: (r) => r.prs.capped },
  { key: 'firstReview', guide: 'first-review', get: (r) => r.prs.firstReviewHours, hours: true, sampled: (r) => r.prs.capped },
  { key: 'leadTime', guide: 'lead-time', get: (r) => r.prs.leadTimeHours, hours: true, sampled: (r) => r.prs.capped },
  { key: 'prSize', guide: 'pr-size', get: (r) => r.prs.prSizeLines, sampled: (r) => r.prs.capped },
  { key: 'ci', guide: 'ci-health', get: (r) => (r.ci.available ? r.ci.successPercentage : null), pct: true },
  { key: 'conventional', guide: 'conventional-commits', get: (r) => (r.commits.available && r.commits.conventional.available ? r.commits.conventional.percentage : null), pct: true, sampled: commitsCapped },
  { key: 'releases', guide: 'release-cadence', get: (r) => r.releases?.count ?? null, atLeast: (r) => r.releases?.capped },
];

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
    if (v == null) return 'N/A';
    let text;
    if (col.pct) text = formatters.formatPercent(v, locale);
    else if (col.hours) {
      const { value, unit } = formatDuration(v);
      text = `${value.toLocaleString(locale)} ${t('units.' + unit, { count: value })}`;
    } else text = formatters.formatNumber(v, locale);
    if (col.atLeast?.(row)) return `${text}+`;
    return col.sampled?.(row) ? `${text}*` : text;
  };
  const anyPrivate = requested.repos.some((name) => rows[name]?.isPrivate);
  const anySampled = requested.repos.some((name) => rows[name]?.status === 'ok' && COLUMNS.some((c) => c.sampled?.(rows[name]) || c.atLeast?.(rows[name])));

  // CSV: raw numbers (hours, %, counts) with the unit in the header, so a
  // spreadsheet can sort/average them; the screen formats for reading.
  const exportCsv = () => {
    exportToCsv(`bisolhador-turma-${period.from}_${period.to}.csv`, requested.repos.map((name) => {
      const row = rows[name];
      const dup = duplicateOf(name);
      const status = dup ? 'duplicate' : row?.status ?? 'pending';
      const base = { [t('classroom.columns.repo')]: row?.fullName ?? name, [t('classroom.csv.visibility')]: row?.status === 'ok' ? t(row.isPrivate ? 'classroom.csv.private' : 'classroom.csv.public') : '', [t('classroom.columns.status')]: t(`classroom.status.${status}`, { name: dup }) };
      for (const col of COLUMNS) {
        const header = t(`classroom.csv.${col.key}`);
        base[header] = status === 'ok' ? col.get(row) ?? '' : '';
      }
      base[t('classroom.csv.partial')] = status === 'ok' && COLUMNS.some((c) => c.sampled?.(row) || c.atLeast?.(row)) ? t('classroom.csv.yes') : '';
      return base;
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col">
      <Header onSettingsClick={() => setIsSettingsOpen(true)} />
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-shark dark:text-white">{t('classroom.title')}</h1>
          <p className="text-gray-600 dark:text-slate-300">{t('classroom.subtitle', { max: CLASSROOM_MAX_REPOS })}</p>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {t('classroom.ethics')} <GuideLink id="classroom" />
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

        {total > 0 && (
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
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700 text-sm">
                <thead className="bg-gray-50 dark:bg-slate-700">
                  <tr>
                    <th scope="col" className="sticky left-0 z-10 bg-gray-50 dark:bg-slate-700 px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase">{t('classroom.columns.repo')}</th>
                    {COLUMNS.map((col) => (
                      <th key={col.key} scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-slate-300 uppercase whitespace-nowrap">
                        <Link to={guidePath(col.guide)} className="hover:underline" title={t('guide.link')}>
                          {t(`classroom.columns.${col.key}`)}
                          <span className="sr-only"> — {t('guide.link')}</span>
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                  {requested.repos.map((name) => {
                    const row = rows[name];
                    const dup = duplicateOf(name);
                    return (
                      <tr key={name}>
                        <td className="sticky left-0 bg-white dark:bg-slate-800 px-3 py-2 whitespace-nowrap font-medium text-gray-900 dark:text-white">
                          <a href={`https://github.com/${dup ? name : row?.fullName ?? name}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{dup ? name : row?.fullName ?? name}</a>
                          {row?.isPrivate && !dup && <span className="ml-1" title={t('classroom.privateBadge')} aria-label={t('classroom.privateBadge')}>🔒</span>}
                        </td>
                        {row?.status === 'ok' && !dup
                          ? COLUMNS.map((col) => (
                              <td key={col.key} className="px-3 py-2 text-right whitespace-nowrap text-gray-700 dark:text-slate-300">{cell(col, row)}</td>
                            ))
                          : (
                            <td colSpan={COLUMNS.length} className="px-3 py-2 text-gray-500 dark:text-slate-400">
                              {t(`classroom.status.${dup ? 'duplicate' : row?.status ?? 'pending'}`, { name: dup })}
                            </td>
                          )}
                      </tr>
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
            <p className="text-xs text-gray-500 dark:text-slate-400">{t('classroom.notes')}</p>
          </section>
        )}
      </main>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
