import { ZOMBIE_BRANCH_DAYS } from '../constants.js';

// Release/maintenance lines and integration branches are long-lived on
// purpose: react's 1,000+ "X.Y-stable" branches were all counted as zombies.
// hotfix/* is NOT here: hotfixes are short-lived, a stale one is a real zombie.
// Bare numbers ("123", "123-fix": GitHub's create-branch-from-issue names) are
// not version lines either — those need a separator, an .x or a v prefix.
const VERSION_SUFFIX = '(-(stable|dev|lts|maint))?';
const LONG_LIVED = [
  /^(main|master|develop|dev|trunk|stable|lts|gh-pages)$/i,
  new RegExp(`^v\\d+([.-]\\d+)*${VERSION_SUFFIX}$`, 'i'),            // v4, v4-dev, v1.2
  new RegExp(`^\\d+([.-]\\d+)+(\\.x)?${VERSION_SUFFIX}$`, 'i'),     // 17.0.1, 18-3-1, 1.2.x, 0.3-stable
  /^\d+\.x$/i,                                                      // 5.x
  /^(release|releases)([/-].+)?$/i,                                    // release/1.2, release-3.0
];

export function isLongLivedBranch(name) {
  return LONG_LIVED.some((re) => re.test(name));
}

/**
 * Zombie = short-lived branch (not default, not protected, not a release/
 * maintenance line) whose last commit is older than ZOMBIE_BRANCH_DAYS.
 * @param {Array<{name: string, committedDate: string|null, protected: boolean}>} branches
 */
export function analyzeBranches(branches, { defaultBranch, nowMs = Date.now(), zombieDays = ZOMBIE_BRANCH_DAYS }) {
  const cutoff = nowMs - zombieDays * 24 * 3600 * 1000;
  const result = { zombies: 0, checked: 0, excludedDefault: 0, excludedLongLived: 0, excludedProtected: 0, unknownDate: 0 };
  for (const b of branches) {
    if (b.name === defaultBranch) {
      result.excludedDefault++;
      continue;
    }
    if (isLongLivedBranch(b.name)) {
      result.excludedLongLived++;
      continue;
    }
    if (b.protected) {
      result.excludedProtected++;
      continue;
    }
    if (!b.committedDate) {
      result.unknownDate++; // ref target isn't a commit: counted, not silently dropped
      continue;
    }
    result.checked++;
    if (Date.parse(b.committedDate) < cutoff) result.zombies++;
  }
  return result;
}
