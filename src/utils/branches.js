import { ZOMBIE_BRANCH_DAYS } from '../constants.js';

// Release/maintenance lines and integration branches are long-lived on
// purpose: react's 1,000+ "X.Y-stable" branches were all counted as zombies.
const LONG_LIVED = [
  /^(main|master|develop|dev|trunk|stable|lts|gh-pages)$/i,
  /^v?\d+([.-]\d+)*(\.x)?(-[a-z]+)?$/i, // 17.0.1, 18-3-1, v4, v4-dev, 5.x, 1.2.x
  /^\d+(\.\d+)*-stable$/i,            // 0.3-stable
  /^(release|releases|hotfix)([/-].+)?$/i,
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
  const result = { zombies: 0, checked: 0, excludedLongLived: 0, excludedProtected: 0 };
  for (const b of branches) {
    if (b.name === defaultBranch || isLongLivedBranch(b.name)) {
      result.excludedLongLived++;
      continue;
    }
    if (b.protected) {
      result.excludedProtected++;
      continue;
    }
    if (!b.committedDate) continue;
    result.checked++;
    if (Date.parse(b.committedDate) < cutoff) result.zombies++;
  }
  return result;
}
