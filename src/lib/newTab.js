import { createContext, useContext } from 'react';

/**
 * Links that open in a new tab. Classroom Mode sets NewTabContext around its results: the class
 * analysis lives only in memory, so following a link in place would throw away a run of up to 50
 * repositories. noreferrer keeps /turma?repos=… out of the Referer sent to pages where GA is on.
 * Everywhere else (Dashboard) links keep opening in the same tab.
 */
export const NEW_TAB_LINK_PROPS = Object.freeze({ target: '_blank', rel: 'noopener noreferrer' });

export const NewTabContext = createContext(false);

/** Anchor props for a link: new-tab props when newTab is true, none otherwise. */
export const linkTargetProps = (newTab) => (newTab ? NEW_TAB_LINK_PROPS : {});

/** Whether links here open in a new tab: an explicit prop wins over the context. */
export function useNewTab(override) {
  const fromContext = useContext(NewTabContext);
  return override ?? fromContext;
}
