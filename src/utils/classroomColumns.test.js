import { describe, it, expect } from 'vitest';
import { CLASSROOM_COLUMNS, classroomCsvRows } from './classroomColumns.js';
import { analyzeTeamRepo, parsePeriod } from './classroom.js';
import { parseAiRepoContext } from './aiProcess.js';
import pt from '../locales/pt.json';
import en from '../locales/en.json';

const t = (key, opts) => (opts ? `${key}:${JSON.stringify(opts)}` : key);
const p = parsePeriod('2026-08-01', '2026-11-30');
const ok = (value) => ({ status: 'fulfilled', value });
const fail = { status: 'rejected', reason: new Error('x') };
const node = (login, message = 'feat: x') => ({ message, committedDate: '2026-09-02T00:00:00Z', parents: { totalCount: 1 }, author: { name: `${login} name`, email: `${login}@x.io`, user: { login } } });
const pr = (login, approved) => ({ user: { login, type: 'User' }, merged_by: { login }, created_at: '2026-09-01T00:00:00Z', merged_at: '2026-09-01T10:00:00Z', comments: 0, review_comments: 0, approvedByOther: approved, firstReviewAt: null, readyAt: '2026-09-01T00:00:00Z', changedLines: 10 });

const fullRow = () => {
  const ctx = parseAiRepoContext({ repository: {
    d0: { entries: [{ name: 'AGENTS.md', type: 'blob' }, { name: 'tests', type: 'tree' }] },
    workflows: { entries: [{ name: 'ci.yml', type: 'blob' }] }, templateRepository: null,
  } }, { allowPrivateTemplate: true });
  const authorship = [{ path: 'AGENTS.md', complete: true, commits: [{ login: 'student-alice', name: 'Alice', email: 'alice@x.io', date: '2026-09-02T00:00:00Z' }] }];
  return {
    status: 'ok', fullName: 'org/team-1', isPrivate: true,
    ...analyzeTeamRepo({
      history: ok({ totalCount: 3, capped: false, nodes: [node('student-alice'), node('student-bob', 'wip'), node('student-alice', 'x\n\nCo-Authored-By: Claude <noreply@anthropic.com>')] }),
      prs: ok({ capped: false, stats: [pr('student-alice', true), pr('student-bob', false)] }),
      runs: ok({ total_count: 2, workflow_runs: [{ event: 'push', conclusion: 'success' }, { event: 'push', conclusion: 'failure' }] }),
      releases: ok([]),
    }, p, { ctx, authorship }),
  };
};

describe('classroomCsvRows', () => {
  it('every percentage column is followed by its n', () => {
    const [row] = classroomCsvRows(['org/team-1'], { 'org/team-1': fullRow() }, () => null, t);
    const headers = Object.keys(row);
    for (const col of CLASSROOM_COLUMNS.filter((c) => c.pct)) {
      expect(col.n, col.key).toBeTypeOf('function');
      expect(headers[headers.indexOf(`classroom.csv.${col.key}`) + 1]).toBe(`classroom.csv.${col.key}N`);
    }
    expect(row).toMatchObject({
      'classroom.csv.approved': 50, 'classroom.csv.approvedN': 2,
      'classroom.csv.ci': 50, 'classroom.csv.ciN': 2,
      'classroom.csv.conventional': 33, 'classroom.csv.conventionalN': 3,
      'classroom.csv.topShare': 67, 'classroom.csv.topShareN': 3,
      'classroom.csv.aiCommits': 33, 'classroom.csv.aiCommitsN': 3,
      'classroom.csv.aiPrs': 0, 'classroom.csv.aiPrsN': 2,
    });
  });

  it('n is empty when the part could not be measured, never 0', () => {
    const row = { status: 'ok', fullName: 'org/t', isPrivate: false, ...analyzeTeamRepo({ history: fail, prs: fail, runs: fail, releases: fail }, p) };
    const [csv] = classroomCsvRows(['org/t'], { 'org/t': row }, () => null, t);
    for (const col of CLASSROOM_COLUMNS.filter((c) => c.pct)) {
      expect(csv[`classroom.csv.${col.key}`], col.key).toBe('');
      expect(csv[`classroom.csv.${col.key}N`], col.key).toBe('');
    }
  });

  it('n is 0 when the fetch succeeded with an empty sample (measured, nothing to count)', () => {
    const row = { status: 'ok', fullName: 'org/e', isPrivate: false, ...analyzeTeamRepo({
      history: ok({ totalCount: 0, capped: false, nodes: [] }), prs: ok({ capped: false, stats: [] }),
      runs: ok({ total_count: 0, workflow_runs: [] }), releases: ok([]),
    }, p, { ctx: null, authorship: [] }) };
    const [csv] = classroomCsvRows(['org/e'], { 'org/e': row }, () => null, t);
    for (const col of CLASSROOM_COLUMNS.filter((c) => c.pct)) {
      expect(csv[`classroom.csv.${col.key}`], col.key).toBe('');
      expect(csv[`classroom.csv.${col.key}N`], col.key).toBe(0);
    }
  });

  it('pending / failed rows: every value empty', () => {
    const [csv] = classroomCsvRows(['org/x'], {}, () => null, t);
    expect(csv['classroom.csv.approvedN']).toBe('');
    expect(csv['classroom.columns.status']).toBe('classroom.status.pending:{"name":null}');
  });

  it('carries no student login or name (per-student data stays on screen)', () => {
    const row = fullRow();
    expect(row.students.rows.map((r) => r.login)).toContain('student-alice'); // the data is there…
    const csv = JSON.stringify(classroomCsvRows(['org/team-1'], { 'org/team-1': row }, () => null, t));
    for (const who of ['student-alice', 'student-bob', 'Alice', 'alice@x.io']) expect(csv).not.toContain(who); // …but not in the CSV
  });

  it('every n header has a translation in both locales', () => {
    for (const col of CLASSROOM_COLUMNS.filter((c) => c.n)) {
      expect(pt.classroom.csv[`${col.key}N`], col.key).toBeTruthy();
      expect(en.classroom.csv[`${col.key}N`], col.key).toBeTruthy();
    }
  });
});
