// Engineering-maturity detectors over the repository file tree
// (GET /git/trees/{branch}?recursive=1). Each returns true (found), false
// (not found in a complete tree) or null (not verified: the tree was
// truncated or unavailable) — "couldn't check" must not read as "absent".

const TEST_PATTERNS = [
  // spec(s)/ folders are left out: often design docs / OpenAPI specs, not tests.
  /(^|\/)(tests?|__tests__|selftests)\//,      // test/, tests/, packages/x/__tests__/, crates/x/tests/
  /\.(test|spec)\.[cm]?[jt]sx?$/,                // app.test.tsx, app.spec.mjs
  /(^|\/)test_[^/]+\.py$/,                       // test_app.py
  /_test\.(py|go)$/,                             // app_test.go
  /_spec\.rb$/,
  /(^|\/)src\/test\//,                           // Maven/Gradle
];

const CI_PATTERNS = [
  /^\.github\/workflows\/.+\.ya?ml$/,
  /^\.gitlab-ci\.ya?ml$/,
  /^\.circleci\//,
  /(^|\/)Jenkinsfile$/,
  /^azure-pipelines\.ya?ml$/,
  /^\.travis\.ya?ml$/,
  /^\.buildkite\//,
  /^bitbucket-pipelines\.ya?ml$/,
  /^\.drone\.ya?ml$/,
  /^appveyor\.ya?ml$/,
  /^\.woodpecker(\.ya?ml|\/)/,
];

// Case-sensitive on purpose: "Dockerfile", not "dockerfile-guide.md".
// Dockerfile.md / Dockerfile.txt are docs, not Docker.
const DOCKER_PATTERN = /(^|\/)(Dockerfile(\.(?![^/]*\.(md|txt)$|md$|txt$)[^/]+)?|Containerfile|(docker-)?compose(\.[^/]+)?\.ya?ml)$/;

const LINTER_FILES = [
  /^eslint\.config\.[cm]?[jt]s$/,
  /^\.eslintrc(\.(json|js|cjs|yml|yaml))?$/,
  /^biome\.jsonc?$/,
  /^\.golangci\.ya?ml$/,
  /^\.?ruff\.toml$/,
  /^\.flake8$/,
  /^\.pylintrc$/,
  /^\.rubocop\.yml$/,
  /^clippy\.toml$/,
  /^\.stylelintrc/,
  /^\.swiftlint\.yml$/,
  /^checkstyle\.xml$/,
  /^sonar-project\.properties$/,
];
// Root or one level down — deeper hits are usually vendored fixtures (react's
// fixtures/eslint-v6/.eslintrc.json) — plus monorepo packages one level deeper.
const MAX_LINTER_DEPTH = 1;
const MONOREPO_DIRS = /^(packages|apps|crates|services|libs)\/[^/]+\/[^/]+$/;

const basename = (path) => path.slice(path.lastIndexOf('/') + 1);
const depth = (path) => path.split('/').length - 1;

export const detectTests = (paths) => paths.some((p) => TEST_PATTERNS.some((re) => re.test(p)));
export const detectCi = (paths) => paths.some((p) => CI_PATTERNS.some((re) => re.test(p)));
export const detectDocker = (paths) => paths.some((p) => DOCKER_PATTERN.test(p));
export const detectLinter = (paths) =>
  paths.some((p) => (depth(p) <= MAX_LINTER_DEPTH || MONOREPO_DIRS.test(p)) && LINTER_FILES.some((re) => re.test(basename(p))));

export const treePathsOf = (treeResult) => (treeResult?.tree ?? []).map((f) => f.path).filter(Boolean);
export const treeStatusOf = (treeResult) => (!treeResult ? 'unavailable' : treeResult.truncated ? 'truncated' : 'complete');

/**
 * @param {{tree: Array<{path: string}>, truncated?: boolean} | null} treeResult
 * @param {number|null} zombies
 */
export function analyzeMaturity(treeResult, zombies) {
  const treeStatus = treeStatusOf(treeResult);
  const paths = treePathsOf(treeResult);
  // Found is found even in a partial tree; "not found" only counts in a complete one.
  const verdict = (detector) => {
    if (treeStatus === 'unavailable') return null;
    if (detector(paths)) return true;
    return treeStatus === 'complete' ? false : null;
  };
  return {
    testsDetected: verdict(detectTests),
    ciCdDetected: verdict(detectCi),
    dockerDetected: verdict(detectDocker),
    lintDetected: verdict(detectLinter),
    zombies,
    treeStatus,
  };
}

// GitHub's community profile only reports the legacy single-file issue
// template; the ISSUE_TEMPLATE/ directory (issue forms) came back null, which
// cost react, bootstrap, flask, express… a Health Score point.
// A lone ISSUE_TEMPLATE/config.yml only configures the chooser: not a template.
const ISSUE_TEMPLATE = /^(\.github\/|docs\/)?ISSUE_TEMPLATE(\/(?!config\.ya?ml$).+|\.md)$/i;
export const hasIssueTemplate = (paths) => paths.some((p) => ISSUE_TEMPLATE.test(p));
const FROM_TREE = { path: '(from repository tree)' };

// Community-profile files from the tree, for repos GitHub has no profile for
// (forks: the profile endpoint returns 404). Same locations GitHub checks.
const PROFILE_FILES = {
  readme: /^README(\.[a-z]+)?$/i,
  license: /^(LICENSE|LICENCE|COPYING)(?!.*THIRD)([-.][\w.-]+)?$/i, // LICENSE-MIT, LICENSE.Apache-2.0 — not LICENSE-THIRD-PARTY notices
  contributing: /^CONTRIBUTING(\.[a-z]+)?$/i,
  code_of_conduct: /^CODE_OF_CONDUCT(\.[a-z]+)?$/i,
  pull_request_template: /^PULL_REQUEST_TEMPLATE(\.md|\/.+)$/i,
};
const PROFILE_DIRS = /^(\.github\/|docs\/)?/;
const ROOT_ONLY = new Set(['license']); // GitHub only recognizes a root LICENSE

export function profileFilesFromTree(paths) {
  const files = Object.fromEntries(Object.keys(PROFILE_FILES).map((k) => [k, null]));
  for (const path of paths) {
    const rest = path.replace(PROFILE_DIRS, '');
    if (rest.includes('/') && !/^PULL_REQUEST_TEMPLATE\//i.test(rest)) continue; // root, .github/ or docs/ only
    for (const [key, re] of Object.entries(PROFILE_FILES)) {
      if (ROOT_ONLY.has(key) && rest !== path) continue;
      if (!files[key] && re.test(rest)) files[key] = { path };
    }
  }
  files.issue_template = hasIssueTemplate(paths) ? FROM_TREE : null;
  return files;
}

/**
 * Community-profile files completed with the tree, in one place:
 * - profile present: fill issue_template from the ISSUE_TEMPLATE/ directory
 *   (the profile only reports the legacy file);
 * - no profile (forks, 404) + complete tree: every file from the tree.
 * `uncertain` = the result may undercount because the tree couldn't confirm
 * an absence (unavailable/truncated): callers must not persist it as fact.
 * `profileMissing`: the profile request succeeded with "none" (fork, 404) —
 * only then is the tree a substitute; a failed request stays unavailable.
 * `issueTemplateDirectory` (true/false/null): targeted check used when the
 * tree is truncated, so huge repos aren't left permanently "uncertain".
 * Returns null when there's nothing to score (no profile and no usable tree).
 */
export function mergeProfileWithTree(profile, treeResult, { profileMissing = false, issueTemplateDirectory = null } = {}) {
  const status = treeStatusOf(treeResult);
  const paths = treePathsOf(treeResult);
  if (profile) {
    const files = { ...profile.files };
    let uncertain = false;
    if (!files.issue_template) {
      if (hasIssueTemplate(paths) || issueTemplateDirectory === true) files.issue_template = FROM_TREE;
      else uncertain = status !== 'complete' && issueTemplateDirectory !== false;
    }
    return { files, source: 'profile', uncertain };
  }
  if (profileMissing && status === 'complete') return { files: profileFilesFromTree(paths), source: 'tree', uncertain: false };
  return null;
}
