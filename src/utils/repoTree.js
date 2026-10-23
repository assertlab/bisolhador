// Engineering-maturity detectors over the repository file tree
// (GET /git/trees/{branch}?recursive=1). Each returns true (found), false
// (not found in a complete tree) or null (not verified: the tree was
// truncated or unavailable) — "couldn't check" must not read as "absent".

const TEST_PATTERNS = [
  /(^|\/)(tests?|specs?|__tests__|selftests)\//, // test/, tests/, spec/, packages/x/__tests__/, crates/x/tests/
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
const DOCKER_PATTERN = /(^|\/)(Dockerfile(\.[^/]+)?|Containerfile|(docker-)?compose(\.[^/]+)?\.ya?ml)$/;

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
// Root or one level down (monorepo packages) — deeper hits are usually
// vendored fixtures (react's fixtures/eslint-v6/.eslintrc.json).
const MAX_LINTER_DEPTH = 1;

const basename = (path) => path.slice(path.lastIndexOf('/') + 1);
const depth = (path) => path.split('/').length - 1;

export const detectTests = (paths) => paths.some((p) => TEST_PATTERNS.some((re) => re.test(p)));
export const detectCi = (paths) => paths.some((p) => CI_PATTERNS.some((re) => re.test(p)));
export const detectDocker = (paths) => paths.some((p) => DOCKER_PATTERN.test(p));
export const detectLinter = (paths) =>
  paths.some((p) => depth(p) <= MAX_LINTER_DEPTH && LINTER_FILES.some((re) => re.test(basename(p))));

/**
 * @param {{tree: Array<{path: string}>, truncated?: boolean} | null} treeResult
 * @param {number|null} zombies
 */
export function analyzeMaturity(treeResult, zombies) {
  const treeStatus = !treeResult ? 'unavailable' : treeResult.truncated ? 'truncated' : 'complete';
  const paths = (treeResult?.tree ?? []).map((f) => f.path).filter(Boolean);
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
const ISSUE_TEMPLATE = /^(\.github\/|docs\/)?ISSUE_TEMPLATE(\/.+|\.md)$/i;
export const hasIssueTemplate = (paths) => paths.some((p) => ISSUE_TEMPLATE.test(p));

// Community-profile files from the tree, for repos GitHub has no profile for
// (forks: the profile endpoint returns 404). Same locations GitHub checks.
const PROFILE_FILES = {
  readme: /^README(\.[a-z]+)?$/i,
  license: /^(LICENSE|LICENCE|COPYING)(\.[a-z]+)?$/i,
  contributing: /^CONTRIBUTING(\.[a-z]+)?$/i,
  code_of_conduct: /^CODE_OF_CONDUCT(\.[a-z]+)?$/i,
  pull_request_template: /^PULL_REQUEST_TEMPLATE(\.md|\/.+)$/i,
};
const PROFILE_DIRS = /^(\.github\/|docs\/)?/;

export function profileFilesFromTree(paths) {
  const files = Object.fromEntries(Object.keys(PROFILE_FILES).map((k) => [k, null]));
  for (const path of paths) {
    const rest = path.replace(PROFILE_DIRS, '');
    if (rest.includes('/') && !/^PULL_REQUEST_TEMPLATE\//i.test(rest)) continue; // root, .github/ or docs/ only
    for (const [key, re] of Object.entries(PROFILE_FILES)) {
      if (!files[key] && re.test(rest)) files[key] = { path };
    }
  }
  files.issue_template = hasIssueTemplate(paths) ? { path: 'ISSUE_TEMPLATE' } : null;
  return files;
}
