#!/usr/bin/env node
// Builds a GitHub release title + notes for one version from the repo's own
// docs, so a release says exactly what was reviewed in the release PR:
//   title: README "### vX.Y.Z - Title" (falls back to "vX.Y.Z")
//   notes: docs/CHANGELOG.md "## [X.Y.Z] - date" section
// Used by .github/workflows/deploy.yml (job "release"). CLI:
//   node scripts/release-notes.mjs v3.8.0 <notes-out-file>   → prints the title
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function releaseNotes(version, { changelog, readme }) {
  const v = version.replace(/^v/, '');
  const section = changelog.match(new RegExp(`## \\[${escape(v)}\\][^\\n]*\\n([\\s\\S]*?)(?=\\n---\\n|\\n## \\[)`));
  if (!section) {
    throw new Error(`docs/CHANGELOG.md has no "## [${v}]" section — add it in the release PR`);
  }
  const heading = readme.match(new RegExp(`^### v${escape(v)} - (.+)$`, 'm'));
  return {
    title: heading ? `v${v} - ${heading[1].trim()}` : `v${v}`,
    notes: `${section[1].trim()}\n\n---\n_Histórico completo: [docs/CHANGELOG.md](https://github.com/assertlab/bisolhador/blob/v${v}/docs/CHANGELOG.md)._\n`,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [tag, outFile] = process.argv.slice(2);
  const { title, notes } = releaseNotes(tag, {
    changelog: readFileSync('docs/CHANGELOG.md', 'utf8'),
    readme: readFileSync('README.md', 'utf8'),
  });
  writeFileSync(outFile, notes);
  console.log(title);
}
