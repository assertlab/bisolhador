// Texts that depend on the platform a report came from (docs/ESTUDO_GITLAB.md).
// A GitLab report reads `key_gitlab` when that key exists and `key` otherwise
// (i18next context, plurals included), so only the texts that really differ
// get a variant: pipelines instead of GitHub Actions, statistics computed from
// commits, merge requests disabled on GitLab... GitHub reports, snapshots
// (no provider) and everything outside a report keep the plain keys.
//
// Every component uses usePlatformTranslation() / PlatformTrans instead of
// useTranslation() / Trans (platformText.test.js enforces it): outside a report
// it is the same `t`, so no component can miss a variant by forgetting to opt in.
import { createContext, createElement, useContext, useMemo } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { intlLocale } from '../i18n.js';
import {
  GITLAB_PER_PAGE, GITLAB_COMMIT_MAX_PAGES, GITLAB_TREE_MAX_PAGES, GITLAB_MR_NOTES, GITLAB_COUNT_LIMIT, MERGED_PR_SAMPLE,
} from '../constants.js';

const PlatformContext = createContext('github');

/**
 * The GitLab limits the `_gitlab` texts quote, from the constants (never typed
 * in the texts), formatted for the current language.
 */
export function gitlabLimits(locale = intlLocale()) {
  const { format: n } = new Intl.NumberFormat(locale);
  return {
    commitCap: n(GITLAB_COMMIT_MAX_PAGES * GITLAB_PER_PAGE),
    treeCap: n(GITLAB_TREE_MAX_PAGES * GITLAB_PER_PAGE),
    noteCap: n(GITLAB_MR_NOTES),
    countLimit: n(GITLAB_COUNT_LIMIT),
    mrSample: n(MERGED_PR_SAMPLE),
  };
}

/**
 * `t` that prefers the provider's variant of each key. Same `t` for GitHub.
 * The context wins over a `context: undefined` the caller passes (<Trans> always does).
 */
export function withPlatform(t, provider) {
  if (provider !== 'gitlab') return t;
  const limits = gitlabLimits(); // once per wrapper: re-made on a language change (new `t`)
  return (key, options) => t(key, { ...limits, ...options, context: options?.context ?? 'gitlab' });
}

/** Wraps the part of the page that shows one report. */
export function PlatformProvider({ provider, children }) {
  return createElement(PlatformContext.Provider, { value: provider ?? 'github' }, children);
}

/** <Trans> with the platform-aware `t` (components import this, never react-i18next's Trans). */
export function PlatformTrans(props) {
  const { t } = usePlatformTranslation();
  return createElement(Trans, { t, ...props });
}

/** useTranslation() whose `t` prefers the report platform's variants (same `t` outside a report). */
export function usePlatformTranslation() {
  const translation = useTranslation();
  const provider = useContext(PlatformContext);
  const t = useMemo(() => withPlatform(translation.t, provider), [translation.t, provider]);
  return { ...translation, t };
}
