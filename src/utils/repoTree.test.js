import { describe, it, expect } from 'vitest';
import { analyzeMaturity, detectTests, detectCi, detectDocker, detectLinter, hasIssueTemplate, profileFilesFromTree } from './repoTree.js';

const tree = (...paths) => ({ tree: paths.map((path) => ({ path, type: 'blob' })), truncated: false });

describe('detectTests (real layouts that used to be missed)', () => {
  it.each([
    'test/app.js',                       // express: singular test/
    'tests/test_app.py',
    'packages/core/__tests__/x.js',
    'src/app.test.jsx', 'src/app.test.tsx', 'src/app.spec.mjs',
    'pkg/app_test.go', 'lib/thing_test.py', 'test_app.py',
    'src/test/java/AppTest.java',
    'spec/models/user_spec.rb',
    'crates/ruff/tests/fixtures.rs',     // Rust integration tests
    'tools/testing/selftests/run.sh',
  ])('finds %s', (path) => {
    expect(detectTests(tree(path).tree.map((f) => f.path))).toBe(true);
  });

  it.each(['src/app.js', 'README.md', 'docs/testing-guide.md', 'contest/entry.js', 'latest/notes.md'])('does not flag %s', (path) => {
    expect(detectTests([path])).toBe(false);
  });
});

describe('detectCi (not only GitHub Actions)', () => {
  it.each([
    '.github/workflows/ci.yml', '.gitlab-ci.yml', '.circleci/config.yml', 'Jenkinsfile',
    'azure-pipelines.yml', '.travis.yml', '.buildkite/pipeline.yml', 'bitbucket-pipelines.yml', '.drone.yml', 'appveyor.yml',
  ])('finds %s', (path) => {
    expect(detectCi([path])).toBe(true);
  });

  it('ignores unrelated files', () => {
    expect(detectCi(['src/ci.js', 'docs/jenkins.md'])).toBe(false);
  });
});

describe('detectDocker (any directory, modern names)', () => {
  it.each([
    'Dockerfile', 'docker/Dockerfile', 'machine-learning/Dockerfile', 'Dockerfile.dev',
    'docker-compose.yml', 'docker/docker-compose.yaml', 'compose.yaml', 'compose.prod.yml', 'Containerfile',
  ])('finds %s', (path) => {
    expect(detectDocker([path])).toBe(true);
  });

  it('ignores lookalikes', () => {
    expect(detectDocker(['docs/dockerfile-guide.md', 'src/compose.js'])).toBe(false);
  });
});

describe('detectLinter (modern configs; root or one level down, not vendored fixtures)', () => {
  it.each([
    'eslint.config.js', 'eslint.config.mjs', '.eslintrc.json', '.eslintrc.cjs', 'biome.json', 'biome.jsonc',
    '.golangci.yml', 'ruff.toml', '.ruff.toml', '.flake8', '.pylintrc', '.rubocop.yml', 'clippy.toml',
    '.stylelintrc.json', 'checkstyle.xml', 'frontend/eslint.config.js',
  ])('finds %s', (path) => {
    expect(detectLinter([path])).toBe(true);
  });

  it('ignores deep vendored fixtures and formatters', () => {
    expect(detectLinter(['fixtures/eslint-v6/.eslintrc.json', '.prettierrc', '.editorconfig'])).toBe(false);
  });
});

describe('analyzeMaturity: "not verified" is not "absent"', () => {
  it('complete tree: true/false', () => {
    const m = analyzeMaturity(tree('test/a.js', 'Dockerfile'), 0);
    expect(m).toMatchObject({ testsDetected: true, dockerDetected: true, ciCdDetected: false, lintDetected: false, treeStatus: 'complete', zombies: 0 });
  });

  it('truncated tree: found → true, not found → null (inconclusive), never false', () => {
    const m = analyzeMaturity({ ...tree('Dockerfile'), truncated: true }, 3);
    expect(m).toMatchObject({ dockerDetected: true, testsDetected: null, ciCdDetected: null, lintDetected: null, treeStatus: 'truncated' });
  });

  it('tree unavailable: everything null', () => {
    expect(analyzeMaturity(null, null)).toMatchObject({ testsDetected: null, ciCdDetected: null, dockerDetected: null, lintDetected: null, treeStatus: 'unavailable' });
  });
});

describe('Issue Template and fork fallback', () => {
  it('hasIssueTemplate accepts the ISSUE_TEMPLATE/ directory (issue forms), not only the legacy file', () => {
    expect(hasIssueTemplate(['.github/ISSUE_TEMPLATE/bug.yml'])).toBe(true);
    expect(hasIssueTemplate(['docs/ISSUE_TEMPLATE/feature.md'])).toBe(true);
    expect(hasIssueTemplate(['.github/ISSUE_TEMPLATE.md'])).toBe(true);
    expect(hasIssueTemplate(['src/issue_template.js'])).toBe(false);
  });

  it('profileFilesFromTree builds the community-profile files shape (forks have no profile)', () => {
    const files = profileFilesFromTree([
      'README.md', 'LICENSE', '.github/CONTRIBUTING.md', 'docs/CODE_OF_CONDUCT.md',
      '.github/ISSUE_TEMPLATE/bug.yml', '.github/pull_request_template.md', 'src/readme.js',
    ]);
    expect(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v !== null]))).toEqual({
      readme: true, license: true, contributing: true, code_of_conduct: true, issue_template: true, pull_request_template: true,
    });
  });

  it('profileFilesFromTree only looks at root, .github/ and docs/', () => {
    expect(profileFilesFromTree(['vendor/lib/README.md', 'node_modules/x/LICENSE']).readme).toBeNull();
  });
});
