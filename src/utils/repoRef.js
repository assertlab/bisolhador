// Repository reference: which platform, which host and which path, instead of
// a bare "owner/repo" string (docs/ESTUDO_GITLAB.md, section 3). GitHub paths
// keep exactly 2 segments; GitLab paths have a namespace that can nest
// subgroups (group/sub/project). Every segment is validated per provider, and
// a GitLab host must be on the build-time allow-list (fail-closed): names end
// up in API URLs and routes, so they are never trusted as typed.
import { SAFE_GITHUB_NAME_PATTERN, isSafeGithubRepoName } from './repoName.js';

const GITHUB_HOST = 'github.com';

// Dotted name with an optional port: a host, never a GitHub owner.
const LOOKS_LIKE_HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?$/;

// What follows owner/repo in a GitHub page path copied without the host
// (facebook/react/tree/main): still that repository, as it always was.
const GITHUB_ROUTES = new Set(['tree', 'blob', 'blame', 'raw', 'commit', 'commits', 'compare', 'pull', 'pulls', 'issues',
  'actions', 'releases', 'tags', 'branches', 'wiki', 'discussions', 'projects', 'security', 'pulse', 'graphs', 'network', 'settings']);

// GitLab hosts: gitlab.com plus the instances listed at build time in
// VITE_GITLAB_HOSTS (comma-separated, e.g. "gitlab.cin.ufpe.br" or
// "git.example.edu:8443"). The CSP must allow the same hosts (phase 2);
// anything else is refused (fail-closed). Entries that aren't host names
// (scheme, path, wildcard, IP, github.com) are dropped with a console warning.
const HOST_NAME_PATTERN = /^(?=.{1,253}(:|$))([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(:\d{1,5})?$/;
export function parseGitlabHosts(value) {
  const entries = String(value ?? '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
  const dropped = entries.filter((h) => !HOST_NAME_PATTERN.test(h) || h === GITHUB_HOST);
  if (dropped.length > 0) console.warn('[repoRef] VITE_GITLAB_HOSTS entries ignored (not a host name):', dropped.join(', '));
  return Object.freeze([...new Set(['gitlab.com', ...entries.filter((h) => !dropped.includes(h))])]);
}
export const GITLAB_HOSTS = parseGitlabHosts(import.meta.env?.VITE_GITLAB_HOSTS);

/** Where a GitLab user creates a personal access token on that instance (shown without the scheme). */
export const gitlabTokenPage = (host) => `${host}/-/user_settings/personal_access_tokens`;

// GitLab path rules: letters, digits, '_', '-' and '.'; can't start with '-'
// or '.' (so no '.' or '..'), can't end in '.git' or '.atom'.
const SAFE_GITLAB_SEGMENT_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/;
// Top-level group + up to 20 nested subgroups + the project.
export const GITLAB_MAX_SEGMENTS = 22;

const isSafeGitlabSegment = (s) => SAFE_GITLAB_SEGMENT_PATTERN.test(s) && !/\.(git|atom)$/i.test(s);

/**
 * Input as typed or pasted → { ref } or { error }.
 *
 * Accepted: "owner/repo" (GitHub, as always), "github.com/owner/repo",
 * "https://github.com/owner/repo/tree/main", "gitlab.com/group/sub/project",
 * "https://<allowed host>/group/project/-/tree/main". The first segment is a
 * host when there is a scheme, or when it has a '.' or ':' — a GitHub owner
 * never does (a repository name may, but it is the second segment).
 *
 * Errors: 'invalid' (malformed or unsafe segment), 'hostRequired' (3+
 * segments with no host that aren't a GitHub page path: never guess the
 * platform), 'hostNotAllowed' (a host outside the allow-list).
 */
// Typed/pasted text → { scheme, segments }: trimmed, query/fragment and trailing slashes cut, scheme removed.
function splitInput(input) {
  const text = String(input ?? '').trim().split(/[?#]/)[0].replace(/\/+$/, '');
  return { empty: !text, scheme: /^https?:\/\//i.test(text), segments: text.replace(/^https?:\/\//i, '').split('/') };
}

// GitLab web URLs put everything after the project (or group) behind "/-/".
const beforeDash = (segments) => (segments.includes('-') ? segments.slice(0, segments.indexOf('-')) : segments);

export function parseRepoRef(input, { gitlabHosts = GITLAB_HOSTS } = {}) {
  const parts = splitInput(input);
  if (parts.empty) return { error: 'invalid' };

  const { scheme } = parts;
  let { segments } = parts;
  const first = segments[0].toLowerCase();

  let host = null;
  if (scheme || LOOKS_LIKE_HOST.test(first)) {
    host = first.replace(/^www\.github\.com$/, GITHUB_HOST);
    segments = segments.slice(1);
  }

  if (host === null || host === GITHUB_HOST) {
    // A GitHub URL may continue past the repository (/tree/main, /pulls).
    if (host === GITHUB_HOST || GITHUB_ROUTES.has(segments[2])) segments = segments.slice(0, 2);
    // Only a well-formed GitLab-like path earns the "add the host" hint.
    else if (segments.length > 2) return { error: segments.every(isSafeGitlabSegment) ? 'hostRequired' : 'invalid' };
    if (segments.length === 2) segments[1] = segments[1].replace(/\.git$/i, '');
    return refFromSegments('github', GITHUB_HOST, segments);
  }

  if (!gitlabHosts.includes(host)) return { error: 'hostNotAllowed' };
  segments = beforeDash(segments);
  if (segments.length > 0) segments[segments.length - 1] = segments[segments.length - 1].replace(/\.git$/i, '');
  return refFromSegments('gitlab', host, segments);
}

/** Per-provider segment rules, shared by the input parser and withPath. */
function refFromSegments(provider, host, segments) {
  const valid = provider === 'github'
    ? segments.length === 2 && SAFE_GITHUB_NAME_PATTERN.test(segments[0]) && isSafeGithubRepoName(segments[1])
    : segments.length >= 2 && segments.length <= GITLAB_MAX_SEGMENTS && segments.every(isSafeGitlabSegment);
  if (!valid) return { error: 'invalid' };
  return { ref: Object.freeze({ provider, host, path: segments.join('/'), segments: Object.freeze([...segments]) }) };
}

/**
 * The same ref with another path (the canonical name the API returns),
 * validated with the same segment rules. No input normalization: a name the
 * API returns is either exactly valid or refused.
 */
export function withPath(ref, path) {
  return refFromSegments(ref.provider, ref.host, String(path ?? '').split('/')).ref ?? null;
}

/**
 * A GitLab group as typed for the Classroom import: "<allowed host>/group[/sub…]"
 * (an https:// URL works too). → { host, path } or null. Same segment rules as projects.
 */
export function parseGitlabGroup(input, { gitlabHosts = GITLAB_HOSTS } = {}) {
  const { segments } = splitInput(input);
  const host = segments[0].toLowerCase();
  const path = beforeDash(segments.slice(1));
  if (!gitlabHosts.includes(host) || path.length < 1 || path.length > GITLAB_MAX_SEGMENTS - 1 || !path.every(isSafeGitlabSegment)) return null;
  return { host, path: path.join('/') };
}

/** owner = everything before the project (a GitLab namespace may hold subgroups: "g/sub"), repo = the project. */
export const ownerAndRepo = (ref) => [ref.segments.slice(0, -1).join('/'), ref.segments.at(-1)];

/**
 * How a repository is written in lists (Classroom, CSV, PDF, ?repos=): GitHub as
 * always ("owner/repo"), GitLab with its host ("gitlab.cin.ufpe.br/g/p"), which
 * parseRepoRef reads back to the same ref.
 */
export const repoListName = (ref) => (ref.provider === 'github' ? ref.path : `${ref.host}/${ref.path}`);

/** Identity across platforms: the same "foo/bar" on GitHub and on GitLab are different projects. */
export const repoKey = (ref) => `${ref.host}/${ref.path}`.toLowerCase();

/** The repository's page on its platform. */
export const repoWebUrl = (ref) => `https://${ref.host}/${ref.segments.map(encodeURIComponent).join('/')}`;

/** "a/b/c" → "a-b-c", for downloaded file names (every slash, not just the first). */
export const repoFileSlug = (name) => String(name).replaceAll('/', '-');
