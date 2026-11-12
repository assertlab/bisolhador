// GitLab API responses → the shapes the analysis code already reads (GitHub's),
// so utils, cards, PDF and CSV don't branch on the platform
// (docs/ESTUDO_GITLAB.md, section 3.2). Pure functions; the requests are in
// services/gitlabService.js.
import { isBotName } from './contributors.js';

export const WEEK_MS = 7 * 24 * 3600 * 1000;

// GitLab has no "[bot]" suffix. Bot accounts: project/group access tokens
// (project_123_bot_ab12, e-mail project_123_bot_ab12@noreply.<host>), the
// `bot` flag (GraphQL), and names that say so — the flag alone misses some:
// gitlab-dependency-update-bot comes with bot: false (measured 2026-11-12).
const TOKEN_BOT = /^(project|group)_\d+_bot(_|$)/i;
const BOT_USERNAME = /(^|[-_.])bot($|[-_.])|^gitlabduo$/i;

/** Is this GitLab user or commit author a bot? Any of the fields may be missing. */
export function isGitlabBot({ username, name, email, bot } = {}) {
  if (bot === true) return true;
  if (username && (TOKEN_BOT.test(username) || BOT_USERNAME.test(username))) return true;
  if (email && TOKEN_BOT.test(email.split('@')[0])) return true;
  return isBotName(name);
}

const authorOf = (user) => (user ? { login: user.username, __typename: isGitlabBot(user) ? 'Bot' : 'User' } : null);

/**
 * GET /projects/:id (+ GraphQL flags) → the GitHub repository fields useRepository reads.
 * `private` is true unless the visibility is exactly "public": `internal`
 * projects are visible only to people logged in to the instance (decision
 * 2026-11-12). Unknown visibility is `null`: useRepository refuses it too
 * (fail-closed), with a "couldn't confirm" message instead of "not public".
 * Watchers don't exist on GitLab (null, shown as N/A); GitLab has no primary
 * language field (null).
 */
export function toRepoData(project, flags = null) {
  const visibility = project.visibility ?? flags?.visibility?.toLowerCase() ?? null;
  return {
    full_name: project.path_with_namespace,
    private: visibility === null ? null : visibility !== 'public',
    visibility,
    default_branch: project.default_branch ?? null,
    description: project.description ?? null,
    language: null,
    created_at: project.created_at,
    // Updated by GitLab at most once an hour
    pushed_at: project.last_activity_at ?? null,
    owner: { type: project.namespace?.kind === 'group' ? 'Organization' : 'User' },
    stargazers_count: project.star_count ?? 0,
    forks_count: project.forks_count ?? 0,
    subscribers_count: null,
    // false only when GitLab says so (a missing flag counts as enabled, as on GitHub)
    has_issues: flags?.issuesEnabled === false ? false : project.issues_enabled !== false,
    has_pull_requests: flags?.mergeRequestsEnabled === false ? false : project.merge_requests_enabled !== false,
    archived: flags?.archived ?? project.archived ?? null,
    web_url: project.web_url,
    readme_url: project.readme_url ?? null,
    license: project.license ?? null,
  };
}

/** GET /repository/commits item → the REST commit shape (ActivityLogs, Conventional Commits, AI traces). No login or avatar on GitLab commits. */
export function toRestCommit(c) {
  return {
    sha: c.id,
    html_url: c.web_url,
    commit: {
      message: c.message ?? c.title ?? '',
      author: { name: c.author_name, email: c.author_email ?? null, date: c.authored_date ?? c.created_at },
    },
    author: null,
    parents: (c.parent_ids ?? []).map((sha) => ({ sha })),
  };
}

const isMerge = (c) => (c.parent_ids?.length ?? 1) > 1;

// Local day of week and hour of an ISO date as written ("…T10:05:00.000-03:00"):
// the author's own time zone, like GitHub's punch card.
function localDayHour(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})/.exec(iso ?? '');
  if (!m) return null;
  return { day: new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay(), hour: +m[4] };
}

// Index of the week (0 = oldest of `weeks`) for a date, counting back from now; -1 outside the window.
function weekIndex(iso, nowMs, weeks) {
  const age = nowMs - Date.parse(iso);
  if (!Number.isFinite(age) || age < 0) return age < 0 ? weeks - 1 : -1;
  const back = Math.floor(age / WEEK_MS);
  return back < weeks ? weeks - 1 - back : -1;
}

const commitDate = (c) => c.authored_date ?? c.created_at;
// Start (epoch seconds) of week i of `weeks`, oldest first: shared so the charts agree on week boundaries.
const weekStartSeconds = (i, nowMs, weeks) => Math.floor((nowMs - (weeks - i) * WEEK_MS) / 1000);

/** Weekly commit counts, oldest first, last = current week (GitHub's participation.all). */
export function weeklySeries(commits, { nowMs = Date.now(), weeks = 52 } = {}) {
  const all = new Array(weeks).fill(0);
  for (const c of commits) {
    const i = weekIndex(commitDate(c), nowMs, weeks);
    if (i >= 0) all[i]++;
  }
  return { all };
}

/** [day 0=Sunday, hour, commits] of the non-merge commits, as /stats/punch_card. */
export function punchCard(commits) {
  const counts = new Map();
  for (const c of commits) {
    if (isMerge(c)) continue;
    const at = localDayHour(commitDate(c));
    if (!at) continue;
    const key = at.day * 24 + at.hour;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].sort(([a], [b]) => a - b).map(([key, n]) => [Math.floor(key / 24), key % 24, n]);
}

/** [weekStartSeconds, additions, -deletions] per week, oldest first, as /stats/code_frequency. Needs with_stats=true. */
export function codeFrequency(commits, { nowMs = Date.now(), weeks = 52 } = {}) {
  const rows = Array.from({ length: weeks }, (_, i) => [weekStartSeconds(i, nowMs, weeks), 0, 0]);
  for (const c of commits) {
    if (isMerge(c) || !c.stats) continue;
    const i = weekIndex(commitDate(c), nowMs, weeks);
    if (i < 0) continue;
    rows[i][1] += c.stats.additions ?? 0;
    rows[i][2] -= c.stats.deletions ?? 0;
  }
  return rows;
}

/**
 * Commits → GitHub's /stats/contributors shape (author, total, weeks[{w, c}]).
 * GitLab commits have no account: people are grouped by e-mail (name when
 * there is none) and shown by name, without avatar. Merges are left out.
 */
export function contributorStats(commits, { nowMs = Date.now(), weeks = 52 } = {}) {
  const people = new Map();
  for (const c of commits) {
    if (isMerge(c)) continue;
    const key = (c.author_email || c.author_name || '').toLowerCase();
    if (!key) continue;
    const i = weekIndex(commitDate(c), nowMs, weeks);
    if (i < 0) continue;
    let p = people.get(key);
    if (!p) {
      const bot = isGitlabBot({ name: c.author_name, email: c.author_email });
      p = { author: { login: c.author_name || c.author_email, avatar_url: null, type: bot ? 'Bot' : 'User' }, total: 0, counts: new Array(weeks).fill(0) };
      people.set(key, p);
    }
    p.total++;
    p.counts[i]++;
  }
  return [...people.values()].map(({ author, total, counts }) => ({
    author,
    total,
    weeks: counts.map((n, i) => ({ w: weekStartSeconds(i, nowMs, weeks), c: n })),
  }));
}

// Health files from targeted, non-recursive listings (no community profile on GitLab).
const ROOT_FILES = {
  readme: /^README(\.[a-z]+)?$/i,
  license: /^(LICENSE|LICENCE|COPYING)(?!.*THIRD)([-.][\w.-]+)?$/i,
  contributing: /^CONTRIBUTING(\.[a-z]+)?$/i,
  code_of_conduct: /^CODE_OF_CONDUCT(\.[a-z]+)?$/i,
};
const TEMPLATE = /\.md$/i;

/**
 * Root listing + .gitlab/issue_templates + .gitlab/merge_request_templates
 * (null = directory absent) + the project's own readme/license fields →
 * GitHub's community profile { files }. GitLab only reads templates from
 * .gitlab/, so that is the only place checked.
 */
export function profileFromListings({ root, issueTemplates, mergeRequestTemplates, project }) {
  const files = { readme: null, license: null, contributing: null, code_of_conduct: null, issue_template: null, pull_request_template: null };
  for (const entry of root ?? []) {
    if (entry.type !== 'blob') continue;
    for (const [key, re] of Object.entries(ROOT_FILES)) {
      if (!files[key] && re.test(entry.name)) files[key] = { path: entry.path };
    }
  }
  if (!files.readme && project?.readme_url) files.readme = { url: project.readme_url };
  if (!files.license && project?.license) files.license = { key: project.license.key ?? null };
  const firstTemplate = (list) => (list ?? []).find((e) => e.type === 'blob' && TEMPLATE.test(e.name));
  const issue = firstTemplate(issueTemplates);
  const mr = firstTemplate(mergeRequestTemplates);
  if (issue) files.issue_template = { path: issue.path };
  if (mr) files.pull_request_template = { path: mr.path };
  return { files };
}

const MR_STATE = { opened: 'open', merged: 'closed', closed: 'closed', locked: 'closed' };

/** GET /merge_requests item → the REST pull request fields ActivityLogs and lead time read. */
export function toRestPullRequest(mr) {
  return {
    number: mr.iid,
    title: mr.title,
    html_url: mr.web_url,
    state: MR_STATE[mr.state] ?? 'closed',
    created_at: mr.created_at,
    merged_at: mr.merged_at ?? null,
    user: mr.author ? { login: mr.author.username, type: isGitlabBot(mr.author) ? 'Bot' : 'User' } : null,
  };
}

/**
 * GraphQL merged MRs → the node shape toPullRequestStats reads (GitHub's).
 * GitLab has no review object: an approval is an APPROVED review, timed by
 * its "approved this merge request" system note when that note is among the
 * first 50 (else untimed); user notes are comments; the first review is the
 * first user note or approval by someone other than the author. Drafts have no ready-for-review event here,
 * so the review clock starts at creation.
 */
// System note GitLab writes on approval (stored in English): it carries the approval time.
const APPROVAL_NOTE = /^approved this merge request/i;

export function toReviewNodes(nodes) {
  return (nodes ?? []).filter(Boolean).map((mr) => {
    const authorLogin = mr.author?.username;
    const allNotes = (mr.notes?.nodes ?? []).filter((n) => n?.author);
    const notes = allNotes.filter((n) => !n.system);
    const approvalNotes = allNotes.filter((n) => n.system && APPROVAL_NOTE.test(n.body ?? ''));
    const approvalAt = new Map(approvalNotes.map((n) => [n.author.username, n.createdAt]));
    const approvals = (mr.approvedBy?.nodes ?? []).filter(Boolean);
    // First review: a comment or an approval by someone else, whichever came first
    const others = [...notes, ...approvalNotes].filter((n) => n.author.username !== authorLogin);
    return {
      number: mr.iid,
      createdAt: mr.createdAt,
      mergedAt: mr.mergedAt,
      author: authorOf(mr.author),
      mergedBy: mr.mergeUser ? { login: mr.mergeUser.username } : null,
      comments: { totalCount: notes.length, nodes: notes.map((n) => ({ author: authorOf(n.author) })) },
      reviews: { nodes: approvals.map((u) => ({ state: 'APPROVED', submittedAt: approvalAt.get(u.username) ?? null, author: authorOf(u), comments: { totalCount: 0 } })) },
      firstReviews: { nodes: others.map((n) => ({ submittedAt: n.createdAt, author: authorOf(n.author) })) },
      readyForReview: { nodes: [] },
      ...(mr.diffStatsSummary ? { additions: mr.diffStatsSummary.additions, deletions: mr.diffStatsSummary.deletions } : {}),
      ...(mr.sizeFailed && { sizeFailed: true }),
    };
  });
}

const PIPELINE_CONCLUSION = { success: 'success', failed: 'failure', canceled: 'cancelled', skipped: 'skipped' };
const PIPELINE_EVENT = { push: 'push', merge_request_event: 'pull_request' };

/** GET /pipelines items → GitHub Actions runs ({ event, conclusion, run_started_at, updated_at }). */
export function toWorkflowRuns(pipelines, total) {
  return {
    total_count: Number.isFinite(total) ? total : pipelines.length, // total null/NaN: not reported
    workflow_runs: pipelines.map((p) => ({
      event: PIPELINE_EVENT[p.source] ?? p.source,
      conclusion: PIPELINE_CONCLUSION[p.status] ?? null,
      head_branch: p.ref,
      run_started_at: p.created_at,
      updated_at: p.updated_at,
    })),
  };
}

/** GET /releases item → GitHub release fields used by the cadence. */
export const toRelease = (r) => ({ tag_name: r.tag_name, created_at: r.created_at, published_at: r.released_at ?? r.created_at, draft: false });
