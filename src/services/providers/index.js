// Which service fetches a repository's data (docs/ESTUDO_GITLAB.md, section 3).
// Each provider returns the shapes the utils already read, so the analysis
// code doesn't branch on the platform. GitLab gets one service per allowed
// host (its own base URL and token); anything else gets null and the caller
// explains it (code PROVIDER_UNAVAILABLE).
import { githubService } from '../githubService.js';
import { createGitlabService } from '../gitlabService.js';
import { GITLAB_HOSTS } from '../../utils/repoRef.js';

const gitlabByHost = new Map();

export function getProvider(ref) {
  if (ref?.provider === 'github') return githubService;
  if (ref?.provider === 'gitlab' && GITLAB_HOSTS.includes(ref.host)) {
    if (!gitlabByHost.has(ref.host)) gitlabByHost.set(ref.host, createGitlabService(ref.host));
    return gitlabByHost.get(ref.host);
  }
  return null;
}
