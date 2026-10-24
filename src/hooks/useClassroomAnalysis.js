import { useEffect, useState } from 'react';
import { githubService } from '../services/githubService.js';
import { withExponentialBackoff } from '../utils/retry.js';
import { parseSafeRepoName } from '../utils/repoName.js';
import { analyzeTeamRepo } from '../utils/classroom.js';

const CONCURRENCY = 3; // repositories analyzed at once (~5–7 requests each)

/**
 * One repository: privacy gate first (fail-closed, like Benchmark — a private
 * or unverifiable repo is never analyzed), then the period fetches in parallel.
 * Nothing is persisted.
 */
async function analyzeRepository(name, period) {
  const [owner, repo] = name.split('/');
  let info;
  try {
    // A 404 is final (retrying a missing repo only wastes calls); anything else gets 2 retries
    info = await githubService.fetchRepository(owner, repo).catch((error) => {
      if (/\b404\b/.test(error.message)) throw error;
      return withExponentialBackoff(() => githubService.fetchRepository(owner, repo), 2, 300);
    });
  } catch (error) {
    return { status: /\b404\b/.test(error.message) ? 'notFound' : 'error' };
  }
  if (info?.private !== false) return { status: 'private' };
  const canonical = parseSafeRepoName(info.full_name);
  if (!canonical) return { status: 'error' };
  const [o, r] = canonical;
  const [history, prs, runs, releases] = await Promise.allSettled([
    githubService.fetchCommitHistoryInPeriod(o, r, period.since, period.until),
    githubService.fetchMergedPullRequestsInPeriod(o, r, period.since, period.until),
    info.default_branch ? githubService.fetchActionRunsInPeriod(o, r, info.default_branch, period.from, period.to) : Promise.resolve({ total_count: 0, workflow_runs: [] }),
    githubService.fetchReleases(o, r),
  ]);
  // Parts fail on their own (N/A in that column): say why in the console
  for (const [part, result] of Object.entries({ history, prs, runs, releases })) {
    if (result.status === 'rejected') console.warn(`[classroom] ${info.full_name}: ${part} failed:`, result.reason?.message);
  }
  return { status: 'ok', fullName: info.full_name, ...analyzeTeamRepo({ history, prs, runs, releases }, period) };
}

/**
 * Analyzes `repos` over `period`, CONCURRENCY at a time. Results arrive per
 * repository (rows keyed by the requested name); a new request cancels the
 * previous run's pending updates.
 */
export function useClassroomAnalysis(repos, period, enabled, runId = 0) {
  const [state, setState] = useState({ rows: {}, done: 0, key: null });
  // runId: resubmitting the same class re-runs it (e.g. to retry failed rows)
  const key = enabled && period ? `${repos.join(',')}|${period.from}|${period.to}|${runId}` : null;

  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;
    const queue = [...repos];
    const worker = async () => {
      while (!cancelled && queue.length) {
        const name = queue.shift();
        let row;
        try {
          row = await analyzeRepository(name, period);
        } catch {
          row = { status: 'error' };
        }
        if (cancelled) return;
        // First result of a new run replaces the previous run's state
        setState((s) => {
          const base = s.key === key ? s : { rows: {}, done: 0, key };
          return { ...base, rows: { ...base.rows, [name]: row }, done: base.done + 1 };
        });
      }
    };
    Array.from({ length: Math.min(CONCURRENCY, repos.length) }, worker);
    return () => { cancelled = true; };
    // key encodes repos and period
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = state.key === key ? state : { rows: {}, done: 0 };
  return { rows: current.rows, done: current.done, total: key ? repos.length : 0, running: Boolean(key) && current.done < repos.length };
}
