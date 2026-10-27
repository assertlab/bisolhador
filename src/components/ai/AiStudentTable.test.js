import { describe, it, expect, beforeAll } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18next from 'i18next';
import pt from '../../locales/pt.json';
import en from '../../locales/en.json';
import { AiStudentTable } from './AiStudentTable.jsx';

// Server rendering: markup without a DOM library. Enough for what matters here: what is said, what is
// left out (alert tones) and how the link is built.
let i18n;
beforeAll(async () => {
  i18n = i18next.createInstance();
  await i18n.init({ lng: 'pt', fallbackLng: 'pt', resources: structuredClone({ pt: { translation: pt }, en: { translation: en } }) });
});

const render = (students, lng = 'pt') => {
  i18n.changeLanguage(lng);
  return renderToStaticMarkup(
    createElement(I18nextProvider, { i18n }, createElement(MemoryRouter, null, createElement(AiStudentTable, { students }))),
  );
};

const person = (over) => ({ key: 'alice', kind: 'person', login: 'student-alice', commits: 10, withAi: 4, percentage: 40, tools: [], configPaths: [], ...over });
const students = (rows, over = {}) => ({ available: true, rows, authorshipAvailable: true, sampled: false, ...over });

describe('AiStudentTable', () => {
  it('says the commits could not be fetched, with no table', () => {
    const html = render({ available: false });
    expect(html).toContain(pt.aiProcess.students.unavailable);
    expect(html).not.toContain('<table');
  });

  it('an empty period says so, with no table', () => {
    const html = render(students([]));
    expect(html).toContain(pt.aiProcess.students.empty);
    expect(html).not.toContain('<table');
  });

  it('lists authors with commits, declared AI count and percentage, declared tools and config files', () => {
    const html = render(students([
      person({ tools: ['claude'], configPaths: ['CLAUDE.md', '.claude/settings.json'] }),
      person({ key: 'bob', login: 'student-bob', commits: 3, withAi: 0, percentage: 0 }),
    ]));
    expect(html).toContain('student-alice');
    expect(html).toContain('4 (40%)');
    expect(html).toContain('CLAUDE.md, .claude/settings.json');
    expect(html).toContain('student-bob');
    expect(html).toContain('0 (0%)');
    expect(html).toContain('—'); // no declared tool / no config file
  });

  it('agent rows are named by the agent, unidentified commits get one row, never a login', () => {
    const html = render(students([
      person({ key: 'agent:copilot', kind: 'agent', agentToolId: 'copilot', login: undefined }),
      person({ key: 'unidentified', kind: 'unidentified', login: undefined }),
    ]));
    expect(html).toContain('GitHub Copilot (agente)');
    expect(html).toContain(pt.aiProcess.students.unidentified);
  });

  it('config authorship unavailable: n/d in the column and the explanation, never an empty "—"', () => {
    const html = render(students([person()], { authorshipAvailable: false }));
    expect(html).toContain(pt.aiProcess.students.notAvailable);
    expect(html).toContain(pt.aiProcess.students.configUnavailable);
    expect(html).not.toContain('font-mono text-xs">—<');
  });

  it('shows the sample note only for a capped sample', () => {
    expect(render(students([person()]))).not.toContain(pt.aiProcess.students.sampled);
    expect(render(students([person()], { sampled: true }))).toContain(pt.aiProcess.students.sampled);
  });

  it('always carries the notice (declared, not real use) and the footnote (nothing saved or exported)', () => {
    const html = render(students([person()]));
    expect(html).toContain('<strong>declarado</strong>');
    expect(html).toContain(pt.aiProcess.students.footnote.slice(0, 40));
  });

  it('neutral tone: facts side by side, no alert role or red/amber colors', () => {
    const html = render(students([person({ withAi: 0, percentage: 0 })]));
    expect(html).not.toContain('role="alert"');
    expect(html).not.toMatch(/\b(red|amber|yellow|orange)-\d/);
  });

  it('the guide link opens in a new tab without leaking the class URL, and says so to screen readers', () => {
    const html = render(students([person()]));
    const link = html.match(/<a [^>]*>/)[0];
    expect(link).toContain('target="_blank"');
    expect(link).toContain('rel="noopener noreferrer"');
    expect(link).toContain('#teachers');
    expect(html).toContain('sr-only');
  });

  it('renders in English too', () => {
    const html = render(students([person()]), 'en');
    expect(html).toContain(en.aiProcess.students.title);
    expect(html).not.toContain(pt.aiProcess.students.title);
  });
});
