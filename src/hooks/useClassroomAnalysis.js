import { useEffect, useState } from 'react';
import { getProvider } from '../services/providers/index.js';
import { withExponentialBackoff } from '../utils/retry.js';
import { parseRepoRef, withPath, ownerAndRepo, repoListName, repoWebUrl } from '../utils/repoRef.js';
import { analyzeTeamRepo } from '../utils/classroom.js';
import { NO_CI_RUNS } from '../utils/projectPractices.js';
import { parseAiRepoContext } from '../utils/aiProcess.js';
import { authorshipPaths } from '../utils/aiClassroom.js';

const CONCURRENCY = 3; // repositories analyzed at once (~6–9 requests each)

/**
 * One repository: visibility check first, then the period fetches in parallel.
 * Private repositories ARE analyzed here — the one exception to "never process
 * private repos" (AGENTS.md): it runs in the user's browser with the user's
 * own token, shows only what they can already see on the platform, and is never
 * persisted (no Supabase; GA gets no query string). On GitLab, internal and
 * private projects are analyzed here the same way. Unverifiable visibility
 * still fails closed. Elsewhere (Dashboard, Benchmark) private stays refused.
 * `name` is a list entry (GitHub "owner/repo", GitLab "host/path"); the service
 * comes from its ref (getProvider), with that host's token.
 */
async function analyzeRepository(name, period, rejectedHosts) {
  const { ref: requested } = parseRepoRef(name);
  const service = requested && getProvider(requested);
  if (!service) return { status: 'error' };
  // That host already refused the token in this run: don't send it again for every repository
  if (rejectedHosts.has(requested.host)) return { status: 'tokenRejected', host: requested.host };
  const [owner, repo] = ownerAndRepo(requested);
  let info;
  try {
    // Missing repository or refused token are final (isFinalError, not retried); anything else gets 2 retries
    info = await withExponentialBackoff(() => service.fetchRepository(owner, repo), 2, 300);
  } catch (error) {
    if (error.code === 'TOKEN_REJECTED') {
      rejectedHosts.add(error.host);
      return { status: 'tokenRejected', host: error.host };
    }
    return error.code === 'NOT_FOUND' ? { status: 'notFound', host: requested.host } : { status: 'error' };
  }
  if (typeof info?.private !== 'boolean') return { status: 'error' }; // can't tell: don't analyze
  const ref = withPath(requested, info.full_name); // canonical name, validated again
  if (!ref) return { status: 'error' };
  const [o, r] = ownerAndRepo(ref);
  const [history, prs, runs, releases, aiContext] = await Promise.allSettled([
    service.fetchCommitHistoryInPeriod(o, r, period.since, period.until),
    service.fetchMergedPullRequestsInPeriod(o, r, period.since, period.until),
    info.default_branch ? service.fetchCiRunsInPeriod(o, r, info.default_branch, period.from, period.to) : Promise.resolve({ ...NO_CI_RUNS }),
    service.fetchReleases(o, r),
    service.fetchAiRepoContext(o, r),
  ]);
  // Parts fail on their own (N/A in that column): say why in the console
  const fullName = repoListName(ref);
  for (const [part, result] of Object.entries({ history, prs, runs, releases, aiContext })) {
    if (result.status === 'rejected') console.warn(`[classroom] ${fullName}: ${part} failed:`, result.reason?.message);
  }
  // Parsed once: the authorship query and the analysis read the same context. Classroom may read
  // a private template (it already analyzes private repositories, in memory only).
  const ctx = aiContext.status === 'fulfilled' && aiContext.value ? parseAiRepoContext(aiContext.value, { allowPrivateTemplate: true }) : null;
  const authorship = await fetchAuthorship(service, o, r, ctx, fullName);
  return {
    status: 'ok',
    fullName,
    provider: ref.provider,
    url: repoWebUrl(ref),
    isPrivate: info.private,
    ...analyzeTeamRepo({ history, prs, runs, releases }, period, { ctx, authorship }),
  };
}

/**
 * Who added or changed each AI-config file (+1 GraphQL, only when the repository has
 * configuration outside the template). [] = nothing to ask; null = unknown (context or query failed).
 */
async function fetchAuthorship(service, owner, repo, ctx, fullName) {
  if (!ctx || !service.fetchAiConfigAuthorship) return null;
  const paths = authorshipPaths(ctx);
  if (paths.length === 0) return [];
  try {
    return await service.fetchAiConfigAuthorship(owner, repo, paths);
  } catch (error) {
    console.warn(`[classroom] ${fullName}: AI config authorship failed:`, error?.message);
    return null;
  }
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
    const rejectedHosts = new Set(); // hosts whose token was refused in this run
    const worker = async () => {
      while (!cancelled && queue.length) {
        const name = queue.shift();
        let row;
        try {
          row = await analyzeRepository(name, period, rejectedHosts);
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
