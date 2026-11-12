// Which service fetches a repository's data (docs/ESTUDO_GITLAB.md, section 3).
// Each provider returns the shapes the utils already read, so the analysis
// code doesn't branch on the platform. GitHub is the only one so far; a
// GitLab ref gets null and the caller explains it (code PROVIDER_UNAVAILABLE).
import { githubService } from '../githubService.js';

const PROVIDERS = { github: githubService };

export function getProvider(ref) {
  return PROVIDERS[ref?.provider] ?? null;
}
