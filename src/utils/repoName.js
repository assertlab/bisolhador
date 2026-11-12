// GitHub owner/repo segments: alphanumeric, dots, hyphens, underscores only —
// no slashes, backslashes or control characters. Defense in depth for app-built
// routes (/timeline/:owner/:repo, ?alias=): names can originate from a Supabase
// snapshot (analytics_searches), which was reachable by open INSERT for anon
// users in the past, or from the URL, so they aren't trusted just because
// react-router is patched.
export const SAFE_GITHUB_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

// A repository name (not an owner) may also start with '.', '_' or '-'
// (org/.github), but is never '.' or '..'. Used by parseRepoRef; the stricter
// parseSafeRepoName below still guards app-built routes.
const GITHUB_REPO_SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/;
export const isSafeGithubRepoName = (s) => GITHUB_REPO_SEGMENT_PATTERN.test(s) && s !== '.' && s !== '..';

/** "owner/repo" → [owner, repo] when both segments are safe, else null. */
export function parseSafeRepoName(fullName) {
  const parts = String(fullName ?? '').split('/');
  if (parts.length !== 2) return null;
  const [owner, repo] = parts;
  return SAFE_GITHUB_NAME_PATTERN.test(owner) && SAFE_GITHUB_NAME_PATTERN.test(repo) ? [owner, repo] : null;
}
