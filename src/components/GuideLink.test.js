import { describe, it, expect } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import '../i18n.js';
import { GuideLink } from './GuideLink.jsx';
import { NewTabContext, linkTargetProps, useNewTab, NEW_TAB_LINK_PROPS } from '../lib/newTab.js';

const render = (element, newTab) => renderToStaticMarkup(
  h(MemoryRouter, null, newTab === undefined ? element : h(NewTabContext.Provider, { value: newTab }, element)),
);

describe('linkTargetProps', () => {
  it('new tab: target _blank with noopener and noreferrer', () => {
    expect(linkTargetProps(true)).toEqual({ target: '_blank', rel: 'noopener noreferrer' });
    expect(linkTargetProps(true)).toBe(NEW_TAB_LINK_PROPS);
  });
  it('same tab: no props', () => {
    expect(linkTargetProps(false)).toEqual({});
    expect(linkTargetProps(undefined)).toEqual({});
  });
});

describe('useNewTab', () => {
  const Probe = ({ override }) => String(useNewTab(override));
  it.each([
    [undefined, undefined, 'false'],
    [true, undefined, 'true'],
    [true, false, 'false'],
    [false, true, 'true'],
  ])('context %s, prop %s → %s', (context, override, expected) => {
    expect(render(h(Probe, { override }), context)).toBe(expected);
  });
});

describe('GuideLink', () => {
  it('same tab by default (Dashboard)', () => {
    const html = render(h(GuideLink, { id: 'lead-time' }));
    expect(html).toContain('href="/guia#lead-time"');
    expect(html).not.toContain('target=');
    expect(html).not.toContain('sr-only');
  });

  it('new tab inside NewTabContext (Classroom), with the screen-reader hint', () => {
    const html = render(h(GuideLink, { id: 'lead-time' }), true);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toMatch(/<span class="sr-only"> \((abre em nova aba|opens in a new tab)\)<\/span>/);
  });

  it('explicit newTab prop works without the context', () => {
    expect(render(h(GuideLink, { id: 'classroom', newTab: true }))).toContain('target="_blank"');
  });
});
