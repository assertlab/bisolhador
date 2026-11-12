// The text for a usage limit (RATE_LIMITED from the services). Called when rendering, so the reset time
// follows the current language. With the reset time when the platform gave one (GitHub), "in a few
// minutes" otherwise (GitLab doesn't expose it); GitHub without a token adds the token hint (60
// requests/hour without one, 5,000 with). Classroom rows use their own, shorter wording.
import { intlLocale } from '../i18n.js';

const formatTime = (resetAt) => (Number.isFinite(resetAt)
  ? new Intl.DateTimeFormat(intlLocale(), { hour: '2-digit', minute: '2-digit' }).format(new Date(resetAt))
  : null);

/** { host, resetAt, noToken } → { key, options } for t(). */
export function rateLimitI18n({ host, resetAt, noToken = false }) {
  const time = formatTime(resetAt);
  return {
    key: time ? 'errors.rateLimitedAt' : 'errors.rateLimited',
    options: { host, time, ...(noToken && { context: 'noToken' }) },
  };
}

/** The "run it again" sentence of a Classroom row. */
export function classroomRetryI18n({ resetAt }) {
  const time = formatTime(resetAt);
  return { key: time ? 'classroom.status.retry.rateLimitedAt' : 'classroom.status.retry.rateLimited', options: { time } };
}

/** What a page keeps of a RATE_LIMITED error (the text is built when rendering). */
export const rateLimitInfo = (error, { noToken = false } = {}) => ({ host: error.host, resetAt: error.resetAt ?? null, noToken });
